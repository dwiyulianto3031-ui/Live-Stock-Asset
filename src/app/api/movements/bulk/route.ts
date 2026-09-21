import { NextResponse } from "next/server";
import { db } from "@/db";
import { products, stockMovements } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { requireSession } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

// POST /api/movements/bulk - Input bulk banyak transaksi (masuk/keluar) sekaligus
export async function POST(request: Request) {
  try {
    const user = await requireSession();
    const body = await request.json();
    const items: any[] = body.items ?? [];
    const defaultDate = body.date ? new Date(body.date) : new Date();

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "Tidak ada item untuk diproses" }, { status: 400 });
    }
    if (items.length > 50) {
      return NextResponse.json({ error: "Maksimal 50 baris per submit" }, { status: 400 });
    }

    const results: {
      row: number;
      sku: string;
      status: "success" | "error";
      message: string;
      newStock?: number;
    }[] = [];
    let successCount = 0;

    for (let i = 0; i < items.length; i++) {
      const item = items[i] ?? {};
      const rowNum = i + 1;

      try {
        const type = item.type === "in" ? "in" : item.type === "out" ? "out" : null;
        const productId = Number(item.productId);
        const quantity = Math.floor(Number(item.quantity));
        const source = item.source === "return" ? "return" : "new";

        if (!type) throw new Error("Tipe harus masuk atau keluar");
        if (!productId) throw new Error("Produk wajib dipilih");
        if (!Number.isFinite(quantity) || quantity <= 0) throw new Error("Jumlah harus lebih dari 0");
        if (type === "out" && !String(item.storeName ?? "").trim())
          throw new Error("Nama gerai wajib untuk barang keluar");

        const productRows = await db
          .select()
          .from(products)
          .where(eq(products.id, productId))
          .limit(1);
        if (productRows.length === 0) throw new Error("Produk tidak ditemukan");
        const product = productRows[0];
        const sourceStock = source === "new" ? product.newStock : product.returnStock;

        // SN & barcode
        const serialNumbers = Array.isArray(item.serialNumbers)
          ? item.serialNumbers.map((s: any) => String(s).trim()).filter((s: string) => s.length > 0).slice(0, quantity)
          : [];
        const barcodes = Array.isArray(item.barcodes)
          ? item.barcodes.map((b: any) => String(b).trim()).filter((b: string) => b.length > 0).slice(0, quantity)
          : [];

        const resis = Array.isArray(item.resi)
          ? item.resi.map((r: any) => String(r).trim()).filter((r: string) => r.length > 0).slice(0, 50)
          : [];

        if (type === "out" && sourceStock < quantity) {
          throw new Error(`Stok ${source === "new" ? "Baru" : "Retur"} tidak cukup (tersedia ${sourceStock})`);
        }

        if (type === "out") {
          // Validasi duplikat SN/Barcode yang sudah keluar
          const outMovements = await db
            .select({ serialNumber: stockMovements.serialNumber, barcode: stockMovements.barcode })
            .from(stockMovements)
            .where(and(eq(stockMovements.productId, productId), eq(stockMovements.type, "out")));
          const outSNSet = new Set<string>();
          const outBarcodeSet = new Set<string>();
          for (const m of outMovements) {
            for (const key of ["serialNumber", "barcode"] as const) {
              const v = m[key];
              if (!v) continue;
              try {
                const parsed = JSON.parse(v);
                const arr = Array.isArray(parsed) ? parsed : [v];
                arr.forEach((x: string) => (key === "serialNumber" ? outSNSet : outBarcodeSet).add(x));
              } catch {
                (key === "serialNumber" ? outSNSet : outBarcodeSet).add(v);
              }
            }
          }
          const dupSN = serialNumbers.find((sn: string) => outSNSet.has(sn));
          if (dupSN) throw new Error(`SN "${dupSN}" sudah pernah keluar`);
          const dupBC = barcodes.find((bc: string) => outBarcodeSet.has(bc));
          if (dupBC) throw new Error(`Barcode "${dupBC}" sudah pernah keluar`);
        }

        // Tanggal per item atau default
        let transactionDate = defaultDate;
        if (item.date) {
          const parsed = new Date(item.date);
          if (!isNaN(parsed.getTime())) transactionDate = parsed;
        }

        const updatedNewStock = type === "in"
          ? source === "new" ? product.newStock + quantity : product.newStock
          : source === "new" ? product.newStock - quantity : product.newStock;
        const updatedReturnStock = type === "in"
          ? source === "return" ? product.returnStock + quantity : product.returnStock
          : source === "return" ? product.returnStock - quantity : product.returnStock;

        await db.transaction(async (tx) => {
          await tx.insert(stockMovements).values({
            productId,
            userId: user.id,
            type,
            source,
            quantity,
            ticketNo: type === "in"
              ? String(item.poNumber ?? "").trim() || null
              : String(item.ticketNo ?? "").trim() || null,
            storeName: type === "out" ? String(item.storeName ?? "").trim() || null : null,
            serialNumber: serialNumbers.length > 0 ? JSON.stringify(serialNumbers) : null,
            barcode: barcodes.length > 0 ? JSON.stringify(barcodes) : null,
            assetStatus: item.assetStatus ? String(item.assetStatus).trim().slice(0, 50) : null,
            itemType: item.itemType ? String(item.itemType).trim().slice(0, 100) : null,
            resi: resis.length > 0 ? JSON.stringify(resis) : null,
            note: item.note ? String(item.note).trim().slice(0, 500) : null,
            createdAt: transactionDate,
          });
          await tx
            .update(products)
            .set({ newStock: updatedNewStock, returnStock: updatedReturnStock, updatedAt: new Date() })
            .where(eq(products.id, productId));
        });

        successCount++;
        results.push({
          row: rowNum,
          sku: product.sku,
          status: "success",
          message: `OK (${type === "in" ? "masuk" : "keluar"} ${quantity} ${product.unit})`,
          newStock: updatedNewStock + updatedReturnStock,
        });
      } catch (err: any) {
        results.push({
          row: rowNum,
          sku: String(item.sku ?? ""),
          status: "error",
          message: err?.message ?? "Gagal",
        });
      }
    }

    await logAudit({
      userId: user.id,
      userName: user.fullName,
      action: "IMPORT",
      entityType: "movement",
      description: `Input bulk transaksi: ${successCount} sukses, ${results.length - successCount} error`,
      metadata: { totalItems: items.length, success: successCount, errors: results.length - successCount },
    });

    return NextResponse.json({ results, success: successCount, errors: results.length - successCount });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Gagal input bulk" }, { status: 500 });
  }
}
