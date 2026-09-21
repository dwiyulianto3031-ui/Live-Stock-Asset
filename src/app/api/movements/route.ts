import { NextResponse } from "next/server";
import { db } from "@/db";
import { products, stockMovements, users } from "@/db/schema";
import { eq, desc, sql, and, gte, lte } from "drizzle-orm";
import { getSession, requireSession } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    await getSession(); // opsional: guest boleh lihat
    const url = new URL(request.url);
    const productId = url.searchParams.get("productId");
    const type = url.searchParams.get("type");
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    const ticket = url.searchParams.get("ticket")?.trim();
    const limit = Math.min(Number(url.searchParams.get("limit") ?? 100), 500);

    const conditions: any[] = [];
    if (productId) conditions.push(eq(stockMovements.productId, Number(productId)));
    if (type === "in" || type === "out")
      conditions.push(eq(stockMovements.type, type));
    if (from) conditions.push(gte(stockMovements.createdAt, new Date(from)));
    if (to) {
      const toDate = new Date(to);
      toDate.setHours(23, 59, 59, 999);
      conditions.push(lte(stockMovements.createdAt, toDate));
    }
    if (ticket) {
      conditions.push(sql`${stockMovements.ticketNo} ILIKE ${`%${ticket}%`}`);
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const rows = await db
      .select({
        id: stockMovements.id,
        productId: stockMovements.productId,
        productName: products.name,
        productSku: products.sku,
        unit: products.unit,
        type: stockMovements.type,
        source: stockMovements.source,
        quantity: stockMovements.quantity,
        ticketNo: stockMovements.ticketNo,
        storeName: stockMovements.storeName,
        serialNumber: stockMovements.serialNumber,
        barcode: stockMovements.barcode,
        assetStatus: stockMovements.assetStatus,
        itemType: stockMovements.itemType,
        resi: stockMovements.resi,
        driveLink: stockMovements.driveLink,
        note: stockMovements.note,
        createdAt: stockMovements.createdAt,
        userName: users.fullName,
      })
      .from(stockMovements)
      .innerJoin(products, eq(stockMovements.productId, products.id))
      .innerJoin(users, eq(stockMovements.userId, users.id))
      .where(where)
      .orderBy(desc(stockMovements.createdAt))
      .limit(limit);

    // Parse JSON untuk serialNumber, barcode, resi
    const parsed = rows.map((row) => {
      const parseJSONArray = (v: string | null): string[] => {
        if (!v) return [];
        try {
          const parsed = JSON.parse(v);
          return Array.isArray(parsed) ? parsed : [v];
        } catch {
          return [v];
        }
      };
      let resis = parseJSONArray(row.resi);
      // Backward compat: jika driveLink terpisah, gabungkan ke resis
      if (row.driveLink) {
        const dl = String(row.driveLink).trim();
        if (dl && !resis.includes(dl)) resis.push(dl);
      }
      return {
        ...row,
        serialNumbers: parseJSONArray(row.serialNumber),
        barcodes: parseJSONArray(row.barcode),
        resis,
      };
    });

    return NextResponse.json({ movements: parsed });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Gagal memuat pergerakan stok" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireSession();
    const body = await request.json();
    const productId = Number(body.productId);
    const type = body.type === "in" ? "in" : body.type === "out" ? "out" : null;
    const quantity = Math.floor(Number(body.quantity));
    const note = body.note ? String(body.note).slice(0, 500) : null;
    const ticketNo = body.ticketNo ? String(body.ticketNo).trim().slice(0, 50) : null;
    const storeName =
      type === "out" && body.storeName
        ? String(body.storeName).trim().slice(0, 150)
        : null;

    if (type === "out" && !storeName) {
      return NextResponse.json(
        { error: "Nama Gerai wajib diisi untuk barang keluar" },
        { status: 400 },
      );
    }

    if (!productId) {
      return NextResponse.json({ error: "Produk wajib dipilih" }, { status: 400 });
    }
    if (!type) {
      return NextResponse.json(
        { error: "Tipe harus 'in' atau 'out'" },
        { status: 400 },
      );
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      return NextResponse.json(
        { error: "Jumlah harus lebih dari 0" },
        { status: 400 },
      );
    }

    const productRows = await db
      .select()
      .from(products)
      .where(eq(products.id, productId))
      .limit(1);
    if (productRows.length === 0) {
      return NextResponse.json({ error: "Produk tidak ditemukan" }, { status: 404 });
    }
    const product = productRows[0];
    const totalStock = product.newStock + product.returnStock;

    // Tentukan sumber stok (new atau return)
    const source = body.source === "return" ? "return" : "new";
    const sourceStock = source === "new" ? product.newStock : product.returnStock;

    // Field tambahan untuk SN, barcode, asset status
    // SN dan barcode bisa multi-value (array) untuk tracking per unit
    const serialNumbers = Array.isArray(body.serialNumbers)
      ? body.serialNumbers
          .map((s: any) => String(s).trim())
          .filter((s: string) => s.length > 0)
          .slice(0, quantity)
      : body.serialNumber
      ? [String(body.serialNumber).trim()].filter((s) => s.length > 0)
      : [];

    const barcodes = Array.isArray(body.barcodes)
      ? body.barcodes
          .map((b: any) => String(b).trim())
          .filter((b: string) => b.length > 0)
          .slice(0, quantity)
      : body.barcode
      ? [String(body.barcode).trim()].filter((b) => b.length > 0)
      : [];

    // Simpan sebagai JSON string
    const serialNumber = serialNumbers.length > 0 ? JSON.stringify(serialNumbers) : null;
    const barcode = barcodes.length > 0 ? JSON.stringify(barcodes) : null;

    const assetStatus = body.assetStatus
      ? String(body.assetStatus).trim().slice(0, 50)
      : null;

    // Tipe barang (opsional)
    const itemType = body.itemType
      ? String(body.itemType).trim().slice(0, 100)
      : null;

    // Resi pengiriman (multi, opsional) - JSON array
    const resis = Array.isArray(body.resi)
      ? body.resi.map((r: any) => String(r).trim()).filter((r: string) => r.length > 0).slice(0, 50)
      : body.resi && typeof body.resi === "string"
      ? [String(body.resi).trim()].filter((r) => r.length > 0)
      : [];
    const resi = resis.length > 0 ? JSON.stringify(resis) : null;

    // Link google drive bukti serah terima (opsional)
    const driveLink = body.driveLink
      ? String(body.driveLink).trim().slice(0, 1000)
      : null;

    // Rename ticketNo menjadi poNumber untuk barang masuk
    const poNumber = type === "in" && body.poNumber ? String(body.poNumber).trim().slice(0, 50) : null;
    const ticketNoFinal = type === "out" ? ticketNo : poNumber;

    if (type === "out" && sourceStock < quantity) {
      const sourceLabel = source === "new" ? "Baru" : "Retur";
      return NextResponse.json(
        {
          error: `Stok ${sourceLabel} tidak cukup. Tersedia: ${sourceStock} ${product.unit}`,
        },
        { status: 400 },
      );
    }

    // Validasi SN & Barcode untuk barang keluar
    if (type === "out") {
      // Ambil semua SN/Barcode yang sudah keluar untuk produk ini
      const outMovements = await db
        .select({
          serialNumber: stockMovements.serialNumber,
          barcode: stockMovements.barcode,
        })
        .from(stockMovements)
        .where(
          and(
            eq(stockMovements.productId, productId),
            eq(stockMovements.type, "out"),
          ),
        );

      const outSNSet = new Set<string>();
      const outBarcodeSet = new Set<string>();
      for (const m of outMovements) {
        try {
          if (m.serialNumber) {
            const parsed = JSON.parse(m.serialNumber);
            const arr = Array.isArray(parsed) ? parsed : [m.serialNumber];
            arr.forEach((s: string) => outSNSet.add(s));
          }
        } catch {
          if (m.serialNumber) outSNSet.add(m.serialNumber);
        }
        try {
          if (m.barcode) {
            const parsed = JSON.parse(m.barcode);
            const arr = Array.isArray(parsed) ? parsed : [m.barcode];
            arr.forEach((b: string) => outBarcodeSet.add(b));
          }
        } catch {
          if (m.barcode) outBarcodeSet.add(m.barcode);
        }
      }

      // Cek SN yang sudah keluar
      const duplicateSN = serialNumbers.find((sn: string) => outSNSet.has(sn));
      if (duplicateSN) {
        return NextResponse.json(
          {
            error: `Serial Number "${duplicateSN}" sudah pernah keluar dari stok dan tidak dapat digunakan kembali`,
          },
          { status: 400 },
        );
      }

      // Cek Barcode yang sudah keluar
      const duplicateBarcode = barcodes.find((bc: string) => outBarcodeSet.has(bc));
      if (duplicateBarcode) {
        return NextResponse.json(
          {
            error: `Barcode "${duplicateBarcode}" sudah pernah keluar dari stok dan tidak dapat digunakan kembali`,
          },
          { status: 400 },
        );
      }
    }

    // Hitung stok baru berdasarkan sumber
    const updatedNewStock =
      type === "in"
        ? source === "new"
          ? product.newStock + quantity
          : product.newStock
        : source === "new"
        ? product.newStock - quantity
        : product.newStock;

    const updatedReturnStock =
      type === "in"
        ? source === "return"
          ? product.returnStock + quantity
          : product.returnStock
        : source === "return"
        ? product.returnStock - quantity
        : product.returnStock;

    const newTotalStock = updatedNewStock + updatedReturnStock;

    // Import audit helper
    const { logAudit } = await import("@/lib/audit");

    // Custom date untuk backdating transaksi (optional)
    let transactionDate = new Date();
    if (body.date) {
      const parsed = new Date(body.date);
      if (isNaN(parsed.getTime())) {
        return NextResponse.json({ error: "Format tanggal tidak valid" }, { status: 400 });
      }
      // Jangan izinkan tanggal di masa depan (toleransi 1 hari)
      const now = new Date();
      if (parsed.getTime() > now.getTime() + 24 * 60 * 60 * 1000) {
        return NextResponse.json(
          { error: "Tanggal tidak boleh di masa depan" },
          { status: 400 },
        );
      }
      transactionDate = parsed;
    }

    await db.transaction(async (tx) => {
      await tx.insert(stockMovements).values({
        productId,
        userId: user.id,
        type,
        source,
        quantity,
        ticketNo: ticketNoFinal,
        storeName,
        serialNumber,
        barcode,
        assetStatus,
        itemType,
        resi,
        driveLink,
        note,
        createdAt: transactionDate,
      });
      await tx
        .update(products)
        .set({
          newStock: updatedNewStock,
          returnStock: updatedReturnStock,
          updatedAt: new Date(),
        })
        .where(eq(products.id, productId));
    });

    // Audit log
    await logAudit({
      userId: user.id,
      userName: user.fullName,
      action: type === "in" ? "STOCK_IN" : "STOCK_OUT",
      entityType: "movement",
      description: `${type === "in" ? "Stok Masuk" : "Stok Keluar"}: ${quantity} ${product.unit} ${product.name} (${source === "new" ? "Baru" : "Retur"})${storeName ? ` ke ${storeName}` : ""}`,
      metadata: {
        productId,
        sku: product.sku,
        type,
        source,
        quantity,
        ticketNo: ticketNoFinal,
        storeName,
        serialNumbers,
        barcodes,
        newStock: updatedNewStock,
        returnStock: updatedReturnStock,
      },
    });

    return NextResponse.json(
      {
        ok: true,
        newStock: newTotalStock,
        newStockBreakdown: {
          new: updatedNewStock,
          return: updatedReturnStock,
        },
        product: {
          ...product,
          newStock: updatedNewStock,
          returnStock: updatedReturnStock,
        },
      },
      { status: 201 },
    );
  } catch (err: any) {
    if (err?.message === "Unauthorized") {
      return NextResponse.json(
        { error: "Silakan login untuk mencatat transaksi" },
        { status: 401 },
      );
    }
    console.error(err);
    return NextResponse.json(
      { error: "Gagal mencatat pergerakan stok" },
      { status: 500 },
    );
  }
}
