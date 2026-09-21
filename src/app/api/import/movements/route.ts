import { NextResponse } from "next/server";
import { db } from "@/db";
import { products, stockMovements } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireSession } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

function splitMulti(v: any): string[] {
  if (v === null || v === undefined) return [];
  const s = String(v);
  return s
    .split(/\r?\n|\|/)
    .map((x) => x.trim())
    .filter((x) => x.length > 0);
}

// POST /api/import/movements - Bulk import transaksi masuk/keluar
export async function POST(request: Request) {
  try {
    const user = await requireSession();
    const body = await request.json();
    const rows: any[] = body.rows ?? [];

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: "Data kosong" }, { status: 400 });
    }

    const results: {
      row: number;
      sku: string;
      status: "success" | "error";
      message: string;
    }[] = [];
    let successCount = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2; // +2 karena baris 1 adalah header

      // Aksi: Masuk/Keluar atau in/out (mendukung kapital: Aksi, Tanggal, dll)
      const rawAction = String(
        row.aksi ?? row.Aksi ?? row.action ?? row.tipe ?? row.Tipe ?? "",
      );
      const actionLower = rawAction.toLowerCase();
      const type = actionLower.includes("masuk") || actionLower === "in"
        ? "in"
        : actionLower.includes("keluar") || actionLower === "out"
        ? "out"
        : null;

      const sku = String(
        row.sku ?? row.SKU ?? row.Sku ?? row["SKU"] ?? "",
      ).trim();
      const quantity = Math.floor(
        Number(row.jumlah ?? row.Jumlah ?? row.qty ?? row.quantity ?? 0),
      );
      const source = String(
        row.sumber ?? row.Sumber ?? row.source ?? "Baru",
      )
        .toLowerCase()
        .includes("retur")
        ? "return"
        : "new";

      if (!type) {
        results.push({ row: rowNum, sku, status: "error", message: "Aksi harus 'Masuk' atau 'Keluar'" });
        continue;
      }
      if (!sku) {
        results.push({ row: rowNum, sku: "", status: "error", message: "SKU wajib diisi" });
        continue;
      }
      if (!Number.isFinite(quantity) || quantity <= 0) {
        results.push({ row: rowNum, sku, status: "error", message: "Jumlah harus > 0" });
        continue;
      }

      try {
        const productRows = await db
          .select()
          .from(products)
          .where(eq(products.sku, sku))
          .limit(1);
        if (productRows.length === 0) {
          results.push({ row: rowNum, sku, status: "error", message: `SKU "${sku}" tidak ditemukan` });
          continue;
        }
        const product = productRows[0];
        const sourceStock = source === "new" ? product.newStock : product.returnStock;

        if (type === "out" && sourceStock < quantity) {
          results.push({
            row: rowNum,
            sku,
            status: "error",
            message: `Stok ${source === "new" ? "Baru" : "Retur"} tidak cukup (tersedia ${sourceStock})`,
          });
          continue;
        }

        // Tanggal
        let transactionDate = new Date();
        if (row.tanggal ?? row.Tanggal) {
          const parsed = new Date(String(row.tanggal ?? row.Tanggal));
          if (!isNaN(parsed.getTime())) transactionDate = parsed;
        }

        const ticketNo = type === "in"
          ? String(row.poNo ?? row["No PO"] ?? row.noPo ?? row["No PO"] ?? "").trim() || null
          : String(row.ticketNo ?? row["No Ticket"] ?? row.noTicket ?? "").trim() || null;

        const storeName = type === "out"
          ? String(
              row.namaGerai ??
                row.storeName ??
                row.gerai ??
                row["Nama Gerai"] ??
                row.StoreName ??
                "",
            ).trim() || null
          : null;

        const itemType = String(
          row.tipeBarang ?? row.itemType ?? row["Tipe Barang"] ?? "",
        ).trim() || null;
        const assetStatus = String(
          row.statusAsset ?? row.assetStatus ?? row["Status Asset"] ?? "Baik",
        ).trim() || null;
        const driveLink = String(
          row.linkDrive ?? row.driveLink ?? row["Link Drive"] ?? "",
        ).trim() || null;
        const note = String(
          row.catatan ?? row.note ?? row["Catatan"] ?? "",
        ).trim() || null;

        const serialNumbers = splitMulti(
          row.serialNumber ?? row.sn ?? row["Serial Number"] ?? row["SN"] ?? "",
        );
        const barcodes = splitMulti(row.barcode ?? row["Barcode"] ?? "");
        const resis = splitMulti(row.resi ?? row["Resi"] ?? "");

        const updatedNewStock = type === "in"
          ? source === "new" ? product.newStock + quantity : product.newStock
          : source === "new" ? product.newStock - quantity : product.newStock;
        const updatedReturnStock = type === "in"
          ? source === "return" ? product.returnStock + quantity : product.returnStock
          : source === "return" ? product.returnStock - quantity : product.returnStock;

        await db.transaction(async (tx) => {
          await tx.insert(stockMovements).values({
            productId: product.id,
            userId: user.id,
            type,
            source,
            quantity,
            ticketNo,
            storeName,
            serialNumber: serialNumbers.length > 0 ? JSON.stringify(serialNumbers) : null,
            barcode: barcodes.length > 0 ? JSON.stringify(barcodes) : null,
            assetStatus,
            itemType,
            resi: resis.length > 0 ? JSON.stringify(resis) : null,
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
            .where(eq(products.id, product.id));
        });

        successCount++;
        results.push({ row: rowNum, sku, status: "success", message: `OK (${type === "in" ? "masuk" : "keluar"} ${quantity})` });
      } catch (err: any) {
        results.push({ row: rowNum, sku, status: "error", message: "Gagal: " + (err?.message ?? "unknown") });
      }
    }

    await logAudit({
      userId: user.id,
      userName: user.fullName,
      action: "IMPORT",
      entityType: "movement",
      description: `Import transaksi dari Excel: ${successCount} sukses, ${results.length - successCount} error`,
      metadata: { totalRows: rows.length, success: successCount, errors: results.length - successCount },
    });

    return NextResponse.json({ results, success: successCount, errors: results.length - successCount });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Gagal import transaksi" }, { status: 500 });
  }
}
