import { NextResponse } from "next/server";
import { db } from "@/db";
import { products } from "@/db/schema";
import { eq, ilike, desc, asc, sql, isNull } from "drizzle-orm";
import { getSession, requireSession } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    await getSession(); // opsional: guest boleh lihat
    const url = new URL(request.url);
    const q = url.searchParams.get("q")?.trim() ?? "";
    const category = url.searchParams.get("category")?.trim() ?? "";

    let query = db.select().from(products);
    const conditions: ReturnType<typeof ilike>[] = [];
    if (q) {
      conditions.push(
        sql`(${ilike(products.name, `%${q}%`)} OR ${ilike(products.sku, `%${q}%`)})`,
      );
    }
    if (category) {
      conditions.push(eq(products.category, category));
    }

    // Default: hanya produk aktif (bukan arsip)
    conditions.push(sql`${products.isArchived} = false`);

    let builder: any = query;
    if (conditions.length > 0) {
      builder = db
        .select()
        .from(products)
        .where(sql.join(conditions, sql` AND `));
    }
    const rows = await builder.orderBy(desc(products.updatedAt));

    return NextResponse.json({ products: rows });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Gagal memuat produk" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    await requireSession();
    const body = await request.json();
    const sku = String(body.sku ?? "").trim();
    const name = String(body.name ?? "").trim();
    const category = String(body.category ?? "Umum").trim() || "Umum";
    const unit = String(body.unit ?? "pcs").trim() || "pcs";
    const brand = body.brand ? String(body.brand).trim().slice(0, 100) : null;
    const model = body.model ? String(body.model).trim().slice(0, 150) : null;
    const minStock = Number(body.minStock ?? 10);
    const initialNewStock = Math.max(0, Math.floor(Number(body.newStock ?? body.initialStock ?? 0)));
    const initialReturnStock = Math.max(0, Math.floor(Number(body.returnStock ?? 0)));

    if (!sku || !name) {
      return NextResponse.json(
        { error: "SKU dan nama produk wajib diisi" },
        { status: 400 },
      );
    }
    if (Number.isNaN(minStock) || minStock < 0) {
      return NextResponse.json(
        { error: "Stok minimum tidak valid" },
        { status: 400 },
      );
    }

    const [product] = await db
      .insert(products)
      .values({
        sku,
        name,
        category,
        unit,
        brand,
        model,
        minStock,
        newStock: initialNewStock,
        returnStock: initialReturnStock,
        isArchived: false,
      })
      .returning();

    return NextResponse.json({ product }, { status: 201 });
  } catch (err: any) {
    console.error(err);
    if (String(err?.message ?? "").toLowerCase().includes("unique")) {
      return NextResponse.json(
        { error: "SKU sudah digunakan" },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { error: "Gagal menambah produk" },
      { status: 500 },
    );
  }
}
