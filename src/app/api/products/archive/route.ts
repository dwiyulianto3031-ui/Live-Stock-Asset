import { NextResponse } from "next/server";
import { db } from "@/db";
import { products, auditLogs } from "@/db/schema";
import { eq, desc, and, isNull, sql } from "drizzle-orm";
import { requireSession } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

// GET /api/products/archive?archived=true|false
export async function GET(request: Request) {
  try {
    await requireSession();
    const url = new URL(request.url);
    const showArchived = url.searchParams.get("archived") === "true";

    const rows = await db
      .select()
      .from(products)
      .where(showArchived ? eq(products.isArchived, true) : eq(products.isArchived, false))
      .orderBy(desc(products.updatedAt));

    return NextResponse.json({ products: rows });
  } catch (err: any) {
    if (err?.message === "Unauthorized") {
      return NextResponse.json({ error: "Silakan login" }, { status: 401 });
    }
    console.error(err);
    return NextResponse.json({ error: "Gagal memuat arsip" }, { status: 500 });
  }
}

// POST /api/products/archive?id=1 - arsipkan (soft delete)
export async function POST(request: Request) {
  try {
    const user = await requireSession();
    const url = new URL(request.url);
    const id = Number(url.searchParams.get("id"));
    if (!id) return NextResponse.json({ error: "ID wajib" }, { status: 400 });

    const rows = await db.select().from(products).where(eq(products.id, id)).limit(1);
    if (rows.length === 0) {
      return NextResponse.json({ error: "Produk tidak ditemukan" }, { status: 404 });
    }

    await db
      .update(products)
      .set({
        isArchived: true,
        archivedAt: new Date(),
        archivedBy: user.fullName,
        updatedAt: new Date(),
      })
      .where(eq(products.id, id));

    await logAudit({
      userId: user.id,
      userName: user.fullName,
      action: "UPDATE",
      entityType: "product",
      entityId: id,
      description: `Produk diarsipkan: ${rows[0].sku} - ${rows[0].name}`,
    });

    return NextResponse.json({ ok: true, archived: true });
  } catch (err: any) {
    if (err?.message === "Unauthorized") {
      return NextResponse.json({ error: "Silakan login" }, { status: 401 });
    }
    console.error(err);
    return NextResponse.json({ error: "Gagal mengarsipkan produk" }, { status: 500 });
  }
}

// PUT /api/products/archive?id=1 - kembalikan dari arsip
export async function PUT(request: Request) {
  try {
    const user = await requireSession();
    const url = new URL(request.url);
    const id = Number(url.searchParams.get("id"));
    if (!id) return NextResponse.json({ error: "ID wajib" }, { status: 400 });

    await db
      .update(products)
      .set({
        isArchived: false,
        archivedAt: null,
        archivedBy: null,
        updatedAt: new Date(),
      })
      .where(eq(products.id, id));

    await logAudit({
      userId: user.id,
      userName: user.fullName,
      action: "UPDATE",
      entityType: "product",
      entityId: id,
      description: `Produk dipulihkan dari arsip (ID ${id})`,
    });

    return NextResponse.json({ ok: true, archived: false });
  } catch (err: any) {
    if (err?.message === "Unauthorized") {
      return NextResponse.json({ error: "Silakan login" }, { status: 401 });
    }
    console.error(err);
    return NextResponse.json({ error: "Gagal memulihkan produk" }, { status: 500 });
  }
}

// DELETE /api/products/archive?id=1 - hapus permanen (ADMIN ONLY, hanya untuk yang sudah diarsip)
export async function DELETE(request: Request) {
  try {
    const user = await requireSession();
    if (user.role !== "admin") {
      return NextResponse.json(
        { error: "Hanya admin dapat menghapus permanen" },
        { status: 403 },
      );
    }
    const url = new URL(request.url);
    const id = Number(url.searchParams.get("id"));
    if (!id) return NextResponse.json({ error: "ID wajib" }, { status: 400 });

    const rows = await db.select().from(products).where(eq(products.id, id)).limit(1);
    if (rows.length === 0) {
      return NextResponse.json({ error: "Produk tidak ditemukan" }, { status: 404 });
    }
    if (!rows[0].isArchived) {
      return NextResponse.json(
        { error: "Arsipkan produk terlebih dahulu sebelum hapus permanen" },
        { status: 400 },
      );
    }

    await db.delete(products).where(eq(products.id, id));
    await logAudit({
      userId: user.id,
      userName: user.fullName,
      action: "DELETE",
      entityType: "product",
      entityId: id,
      description: `Produk DIHAPUS PERMANEN: ${rows[0].sku} - ${rows[0].name}`,
    });

    return NextResponse.json({ ok: true, deleted: true });
  } catch (err: any) {
    if (err?.message === "Unauthorized") {
      return NextResponse.json({ error: "Silakan login" }, { status: 401 });
    }
    console.error(err);
    return NextResponse.json({ error: "Gagal menghapus produk" }, { status: 500 });
  }
}
