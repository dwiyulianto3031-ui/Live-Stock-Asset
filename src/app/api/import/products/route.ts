import { NextResponse } from "next/server";
import { db } from "@/db";
import { products } from "@/db/schema";
import { requireSession } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

// POST /api/import/products - Import produk dari JSON (diparse di client)
export async function POST(request: Request) {
  try {
    const user = await requireSession();
    const body = await request.json();
    const rows: any[] = body.rows ?? [];

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: "Data kosong" }, { status: 400 });
    }

    const results: {
      sku: string;
      status: "created" | "skipped" | "error";
      message?: string;
    }[] = [];

    for (const row of rows) {
      const sku = String(row.sku ?? row.SKU ?? "").trim();
      const name = String(row.name ?? row.nama ?? row.Nama ?? row["Nama Produk"] ?? "").trim();
      const unit = String(row.unit ?? row.satuan ?? row.Satuan ?? "pcs").trim();
      const brand = String(row.brand ?? row.merk ?? row.Merk ?? "").trim() || null;
      const model = String(row.model ?? row.tipe ?? row.Tipe ?? "").trim() || null;
      const minStock = Number(row.minStock ?? row["Min Stok"] ?? row["Stok Minimum"] ?? 10);
      const newStock = Number(row.newStock ?? row["Stok Baru"] ?? row.baru ?? 0);
      const returnStock = Number(row.returnStock ?? row["Stok Retur"] ?? row.retur ?? 0);

      if (!sku || !name) {
        results.push({ sku: sku || "(empty)", status: "error", message: "SKU dan Nama wajib" });
        continue;
      }

      try {
        await db.insert(products).values({
          sku,
          name,
          unit: unit || "pcs",
          brand,
          model,
          minStock: Math.max(0, Math.floor(minStock || 0)),
          newStock: Math.max(0, Math.floor(newStock || 0)),
          returnStock: Math.max(0, Math.floor(returnStock || 0)),
        });
        results.push({ sku, status: "created" });
      } catch (err: any) {
        if (String(err?.message ?? "").toLowerCase().includes("unique")) {
          results.push({ sku, status: "skipped", message: "SKU sudah ada" });
        } else {
          results.push({ sku, status: "error", message: "Gagal insert" });
        }
      }
    }

    const created = results.filter((r) => r.status === "created").length;
    const skipped = results.filter((r) => r.status === "skipped").length;
    const errors = results.filter((r) => r.status === "error").length;

    await logAudit({
      userId: user.id,
      userName: user.fullName,
      action: "IMPORT",
      entityType: "product",
      description: `Import produk dari Excel: ${created} dibuat, ${skipped} dilewati, ${errors} error`,
      metadata: { totalRows: rows.length, created, skipped, errors },
    });

    return NextResponse.json({ results, created, skipped, errors });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Gagal import" }, { status: 500 });
  }
}
