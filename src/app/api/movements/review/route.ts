import { NextResponse } from "next/server";
import { db } from "@/db";
import { products, stockMovements, auditLogs } from "@/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { requireSession } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

function parseArr(v: string | null): string[] {
  if (!v) return [];
  try {
    const p = JSON.parse(v);
    return Array.isArray(p) ? p : [v];
  } catch {
    return [v];
  }
}

// GET /api/movements/review?id=123 - ambil data lengkap 1 transaksi untuk form revisi
export async function GET(request: Request) {
  try {
    await requireSession();
    const url = new URL(request.url);
    const id = Number(url.searchParams.get("id"));
    if (!id) return NextResponse.json({ error: "ID wajib" }, { status: 400 });

    const rows = await db
      .select()
      .from(stockMovements)
      .where(eq(stockMovements.id, id))
      .limit(1);
    if (rows.length === 0) {
      return NextResponse.json({ error: "Transaksi tidak ditemukan" }, { status: 404 });
    }
    const m = rows[0];

    const prodRows = await db
      .select()
      .from(products)
      .where(eq(products.id, m.productId))
      .limit(1);

    return NextResponse.json({
      movement: {
        ...m,
        serialNumbers: parseArr(m.serialNumber),
        barcodes: parseArr(m.barcode),
        resis: parseArr(m.resi),
        productName: prodRows[0]?.name ?? "",
        productSku: prodRows[0]?.sku ?? "",
        productUnit: prodRows[0]?.unit ?? "",
      },
    });
  } catch (err: any) {
    if (err?.message === "Unauthorized") {
      return NextResponse.json({ error: "Silakan login" }, { status: 401 });
    }
    console.error(err);
    return NextResponse.json({ error: "Gagal memuat transaksi" }, { status: 500 });
  }
}

// PUT /api/movements/review?id=123
// Revisi transaksi dengan penyesuaian stok yang benar:
//  1. Kembalikan efek stok transaksi LAMA
//  2. Terapkan efek stoh transaksi BARU
export async function PUT(request: Request) {
  try {
    const user = await requireSession();
    const url = new URL(request.url);
    const id = Number(url.searchParams.get("id"));
    if (!id) return NextResponse.json({ error: "ID wajib" }, { status: 400 });

    const body = await request.json();

    const oldRows = await db
      .select()
      .from(stockMovements)
      .where(eq(stockMovements.id, id))
      .limit(1);
    if (oldRows.length === 0) {
      return NextResponse.json({ error: "Transaksi tidak ditemukan" }, { status: 404 });
    }
    const old = oldRows[0];

    if (old.isRevised) {
      return NextResponse.json(
        { error: "Transaksi ini sudah pernah direvisi. Revisi 1x saja untuk menjaga audit." },
        { status: 400 },
      );
    }

    // ===== Validasi & baca input baru (fallback ke nilai lama jika tak dikirim) =====
    const newProductId = Number(body.productId ?? old.productId);
    const newType = (body.type === "in" || body.type === "out") ? body.type : old.type;
    const newSource = body.source === "return" ? "return" : body.source === "new" ? "new" : old.source;
    const newQuantity = Math.max(1, Math.floor(Number(body.quantity ?? old.quantity)));

    const prodRows = await db
      .select()
      .from(products)
      .where(eq(products.id, newProductId))
      .limit(1);
    if (prodRows.length === 0) {
      return NextResponse.json({ error: "Produk tidak ditemukan" }, { status: 404 });
    }
    const newProd = prodRows[0];
    const oldProdRows = await db
      .select()
      .from(products)
      .where(eq(products.id, old.productId))
      .limit(1);
    const oldProd = oldProdRows[0];

    // SN/Barcode/Resi baru
    const newSerials: string[] = Array.isArray(body.serialNumbers)
      ? body.serialNumbers.map((s: any) => String(s).trim()).filter(Boolean).slice(0, newQuantity)
      : parseArr(old.serialNumber);
    const newBarcodes: string[] = Array.isArray(body.barcodes)
      ? body.barcodes.map((s: any) => String(s).trim()).filter(Boolean).slice(0, newQuantity)
      : parseArr(old.barcode);
    const newResis: string[] = Array.isArray(body.resi)
      ? body.resi.map((s: any) => String(s).trim()).filter(Boolean).slice(0, 50)
      : parseArr(old.resi);

    const newStoreName =
      newType === "out"
        ? String(body.storeName ?? old.storeName ?? "").trim() || null
        : null;
    if (newType === "out" && !newStoreName) {
      return NextResponse.json(
        { error: "Nama Gerai wajib untuk transaksi keluar" },
        { status: 400 },
      );
    }

    const newTicketNo =
      newType === "in"
        ? String(body.poNumber ?? old.ticketNo ?? "").trim() || null
        : String(body.ticketNo ?? old.ticketNo ?? "").trim() || null;

    const newItemType = body.itemType !== undefined
      ? String(body.itemType ?? "").trim() || null
      : old.itemType;
    const newAssetStatus = body.assetStatus !== undefined
      ? String(body.assetStatus ?? "").trim() || null
      : old.assetStatus;
    const newNote = body.note !== undefined
      ? String(body.note ?? "").trim() || null
      : old.note;
    const newDriveLink = body.driveLink !== undefined
      ? String(body.driveLink ?? "").trim() || null
      : old.driveLink;

    let newDate = old.createdAt;
    if (body.date) {
      const d = new Date(String(body.date));
      if (!isNaN(d.getTime())) newDate = d;
    }

    // ===== Hitung stok: rollback lama, terapkan baru =====
    // Stok saat ini di DB sudah termasuk efek transaksi lama.
    // Rollback: jika lama 'in' -> kurangi; jika 'out' -> tambahkan kembali.
    let workingNew = oldProd.newStock;
    let workingReturn = oldProd.returnStock;

    if (old.type === "in") {
      if (old.source === "new") workingNew -= old.quantity;
      else workingReturn -= old.quantity;
    } else {
      if (old.source === "new") workingNew += old.quantity;
      else workingReturn += old.quantity;
    }

    // Terapkan transaksi baru (pakai stok working = sebelum transaksi lama)
    let finalNew = workingNew;
    let finalReturn = workingReturn;

    const srcAvail = newSource === "new" ? workingNew : workingReturn;
    if (newType === "out" && srcAvail < newQuantity) {
      return NextResponse.json(
        {
          error: `Stok ${newSource === "new" ? "Baru" : "Retur"} tidak cukup untuk revisi. Tersedia: ${srcAvail} ${newProd.unit}`,
        },
        { status: 400 },
      );
    }

    if (newType === "in") {
      if (newSource === "new") finalNew = workingNew + newQuantity;
      else finalReturn = workingReturn + newQuantity;
    } else {
      if (newSource === "new") finalNew = workingNew - newQuantity;
      else finalReturn = workingReturn - newQuantity;
    }

    // ===== Simpan =====
    await db.transaction(async (tx) => {
      // Update transaksi
      await tx
        .update(stockMovements)
        .set({
          productId: newProductId,
          type: newType,
          source: newSource,
          quantity: newQuantity,
          ticketNo: newTicketNo,
          storeName: newStoreName,
          serialNumber: newSerials.length ? JSON.stringify(newSerials) : null,
          barcode: newBarcodes.length ? JSON.stringify(newBarcodes) : null,
          resi: newResis.length ? JSON.stringify(newResis) : null,
          assetStatus: newAssetStatus,
          itemType: newItemType,
          note: newNote,
          driveLink: newDriveLink,
          createdAt: newDate,
          isRevised: true,
          revisedAt: new Date(),
          revisedBy: user.fullName,
        })
        .where(eq(stockMovements.id, id));

      // Update stok kedua produk (jika produk berganti)
      const affected = new Set([old.productId, newProductId]);
      for (const pid of affected) {
        const isOld = pid === old.productId;
        const isNew = pid === newProductId;
        let nNew = 0;
        let nRet = 0;

        if (isOld && isNew) {
          nNew = finalNew;
          nRet = finalReturn;
        } else if (isOld) {
          // produk lama: hanya rollback
          if (old.type === "in") {
            if (old.source === "new") nNew = oldProd.newStock - old.quantity;
            else nRet = oldProd.returnStock - old.quantity;
          } else {
            if (old.source === "new") nNew = oldProd.newStock + old.quantity;
            else nRet = oldProd.returnStock + old.quantity;
          }
        } else {
          // produk baru: terapkan transaksi baru dari stok sebelum transaksi lama produk baru
          // Aproksimasi: gunakan stok sekarang dikurangi efek lama yang mungkin tercatat
          // (karena produk berganti, produk baru tidak pernah terpengaruh transaksi lama)
          const pr = await tx
            .select()
            .from(products)
            .where(eq(products.id, pid))
            .limit(1);
          nNew = pr[0].newStock;
          nRet = pr[0].returnStock;
          if (newType === "in") {
            if (newSource === "new") nNew = pr[0].newStock + newQuantity;
            else nRet = pr[0].returnStock + newQuantity;
          } else {
            if (newSource === "new") nNew = pr[0].newStock - newQuantity;
            else nRet = pr[0].returnStock - newQuantity;
          }
        }

        await tx
          .update(products)
          .set({ newStock: nNew, returnStock: nRet, updatedAt: new Date() })
          .where(eq(products.id, pid));
      }
    });

    await logAudit({
      userId: user.id,
      userName: user.fullName,
      action: "UPDATE",
      entityType: "movement",
      entityId: id,
      description: `Revisi transaksi #${id}: ${old.type === "in" ? "Masuk" : "Keluar"} ${old.quantity} -> ${newType === "in" ? "Masuk" : "Keluar"} ${newQuantity} (${newProd.sku})`,
      metadata: {
        old: {
          productId: old.productId,
          type: old.type,
          source: old.source,
          quantity: old.quantity,
          ticketNo: old.ticketNo,
          storeName: old.storeName,
        },
        new: {
          productId: newProductId,
          type: newType,
          source: newSource,
          quantity: newQuantity,
          ticketNo: newTicketNo,
          storeName: newStoreName,
        },
      },
    });

    return NextResponse.json({
      ok: true,
      revised: true,
      stock: { new: finalNew, retur: finalReturn, total: finalNew + finalReturn },
      message: `Transaksi #${id} berhasil direvisi.`,
    });
  } catch (err: any) {
    if (err?.message === "Unauthorized") {
      return NextResponse.json({ error: "Silakan login" }, { status: 401 });
    }
    console.error(err);
    return NextResponse.json(
      { error: `Gagal revisi: ${String(err?.message ?? err).slice(0, 200)}` },
      { status: 500 },
    );
  }
}
