import { NextResponse } from "next/server";
import { db } from "@/db";
import { products } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireSession } from "@/lib/auth";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireSession();
    const { id } = await params;
    const productId = Number(id);
    if (!productId) {
      return NextResponse.json({ error: "ID tidak valid" }, { status: 400 });
    }
    const deleted = await db
      .delete(products)
      .where(eq(products.id, productId))
      .returning({ id: products.id });
    if (deleted.length === 0) {
      return NextResponse.json({ error: "Produk tidak ditemukan" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Gagal menghapus produk" },
      { status: 500 },
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireSession();
    const { id } = await params;
    const productId = Number(id);
    const body = await request.json();
    const updates: Record<string, any> = { updatedAt: new Date() };
    if (body.sku !== undefined) updates.sku = String(body.sku).trim();
    if (body.name !== undefined) updates.name = String(body.name).trim();
    if (body.category !== undefined)
      updates.category = String(body.category).trim() || "Umum";
    if (body.unit !== undefined) updates.unit = String(body.unit).trim() || "pcs";
    if (body.brand !== undefined)
      updates.brand = body.brand ? String(body.brand).trim().slice(0, 100) : null;
    if (body.model !== undefined)
      updates.model = body.model ? String(body.model).trim().slice(0, 150) : null;
    if (body.minStock !== undefined) updates.minStock = Number(body.minStock);

    const [updated] = await db
      .update(products)
      .set(updates)
      .where(eq(products.id, productId))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Produk tidak ditemukan" }, { status: 404 });
    }
    return NextResponse.json({ product: updated });
  } catch (err: any) {
    console.error(err);
    if (String(err?.message ?? "").toLowerCase().includes("unique")) {
      return NextResponse.json(
        { error: "SKU sudah digunakan" },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { error: "Gagal memperbarui produk" },
      { status: 500 },
    );
  }
}
