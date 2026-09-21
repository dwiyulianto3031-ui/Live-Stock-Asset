import { NextResponse } from "next/server";
import { db } from "@/db";
import { products, stockOpnames, stockOpnameItems, auditLogs } from "@/db/schema";
import { desc, eq, and, sql } from "drizzle-orm";
import { requireSession } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

// GET /api/opname - daftar opname (atau detail satu opname: ?id=1)
export async function GET(request: Request) {
  try {
    await requireSession();
    const url = new URL(request.url);
    const id = url.searchParams.get("id");

    if (id) {
      const opname = await db
        .select()
        .from(stockOpnames)
        .where(eq(stockOpnames.id, Number(id)))
        .limit(1);
      if (opname.length === 0) {
        return NextResponse.json({ error: "Opname tidak ditemukan" }, { status: 404 });
      }
      const items = await db
        .select()
        .from(stockOpnameItems)
        .where(eq(stockOpnameItems.opnameId, Number(id)))
        .orderBy(stockOpnameItems.productSku);
      return NextResponse.json({ opname: opname[0], items });
    }

    const rows = await db
      .select({
        id: stockOpnames.id,
        periode: stockOpnames.periode,
        opnameDate: stockOpnames.opnameDate,
        userName: stockOpnames.userName,
        status: stockOpnames.status,
        note: stockOpnames.note,
        itemCount: sql<number>`(
          SELECT count(*)::int FROM stock_opname_items
          WHERE stock_opname_items.opname_id = ${stockOpnames.id}
        )`,
        diffCount: sql<number>`(
          SELECT count(*)::int FROM stock_opname_items
          WHERE stock_opname_items.opname_id = ${stockOpnames.id}
            AND (stock_opname_items.diff_new <> 0 OR stock_opname_items.diff_return <> 0)
        )`,
      })
      .from(stockOpnames)
      .orderBy(desc(stockOpnames.opnameDate));

    return NextResponse.json({ opnames: rows });
  } catch (err: any) {
    if (err?.message === "Unauthorized") {
      return NextResponse.json(
        { error: "Stock opname hanya untuk user yang login" },
        { status: 401 },
      );
    }
    console.error(err);
    return NextResponse.json({ error: "Gagal memuat opname" }, { status: 500 });
  }
}

// POST /api/opname - buat opname baru (snapshot stok sistem semua produk aktif)
export async function POST(request: Request) {
  try {
    const user = await requireSession();
    const body = await request.json().catch(() => ({}));
    const now = new Date();
    const periode =
      (body.periode as string) || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    const allProducts = await db
      .select()
      .from(products)
      .where(eq(products.isArchived, false));

    const [opname] = await db
      .insert(stockOpnames)
      .values({
        periode,
        opnameDate: now,
        userId: user.id,
        userName: user.fullName,
        status: "open",
        note: body.note ? String(body.note).slice(0, 500) : null,
      })
      .returning();

    if (allProducts.length > 0) {
      await db.insert(stockOpnameItems).values(
        allProducts.map((p) => ({
          opnameId: opname.id,
          productId: p.id,
          productSku: p.sku,
          productName: p.name,
          systemNew: p.newStock,
          systemReturn: p.returnStock,
          countedNew: p.newStock,
          countedReturn: p.returnStock,
          diffNew: 0,
          diffReturn: 0,
        })),
      );
    }

    await logAudit({
      userId: user.id,
      userName: user.fullName,
      action: "CREATE",
      entityType: "opname",
      entityId: opname.id,
      description: `Stock opname ${periode} dibuat (${allProducts.length} produk)`,
    });

    return NextResponse.json({ opname, itemCount: allProducts.length }, { status: 201 });
  } catch (err: any) {
    if (err?.message === "Unauthorized") {
      return NextResponse.json({ error: "Silakan login" }, { status: 401 });
    }
    console.error(err);
    return NextResponse.json({ error: "Gagal membuat opname" }, { status: 500 });
  }
}

// PUT /api/opname?id=1 - update hasil hitung fisik + koreksi stok
export async function PUT(request: Request) {
  try {
    const user = await requireSession();
    const url = new URL(request.url);
    const id = Number(url.searchParams.get("id"));
    const body = await request.json();

    if (!id) return NextResponse.json({ error: "ID wajib" }, { status: 400 });

    const opnameRows = await db
      .select()
      .from(stockOpnames)
      .where(eq(stockOpnames.id, id))
      .limit(1);
    if (opnameRows.length === 0) {
      return NextResponse.json({ error: "Opname tidak ditemukan" }, { status: 404 });
    }

    const items: any[] = body.items ?? [];
    let adjustedCount = 0;

    for (const it of items) {
      if (!it?.itemId) continue;
      const itemRows = await db
        .select()
        .from(stockOpnameItems)
        .where(eq(stockOpnameItems.id, Number(it.itemId)))
        .limit(1);
      if (itemRows.length === 0) continue;
      const item = itemRows[0];

      const countedNew = Math.max(0, Math.floor(Number(it.countedNew ?? item.countedNew)));
      const countedReturn = Math.max(
        0,
        Math.floor(Number(it.countedReturn ?? item.countedReturn)),
      );
      const diffNew = countedNew - item.systemNew;
      const diffReturn = countedReturn - item.systemReturn;

      await db
        .update(stockOpnameItems)
        .set({
          countedNew,
          countedReturn,
          diffNew,
          diffReturn,
          note: it.note != null ? String(it.note).slice(0, 500) : item.note,
        })
        .where(eq(stockOpnameItems.id, item.id));

      // Koreksi stok bila ada selisih & diminta
      if (it.adjust) {
        await db
          .update(products)
          .set({
            newStock: countedNew,
            returnStock: countedReturn,
            updatedAt: new Date(),
          })
          .where(eq(products.id, item.productId));

        await db
          .update(stockOpnameItems)
          .set({ adjusted: true })
          .where(eq(stockOpnameItems.id, item.id));

        await db.insert(auditLogs).values({
          userId: user.id,
          userName: user.fullName,
          action: "ADJUST",
          entityType: "product",
          entityId: item.productId,
          description: `Opname ${opnameRows[0].periode} - ${item.productSku}: koreksi Baru ${item.systemNew} -> ${countedNew}, Retur ${item.systemReturn} -> ${countedReturn}`,
          metadata: JSON.stringify({
            source: "stock_opname",
            opnameId: id,
            periode: opnameRows[0].periode,
            sku: item.productSku,
          }),
        });

        adjustedCount++;
      }
    }

    if (body.status) {
      await db
        .update(stockOpnames)
        .set({ status: String(body.status).slice(0, 20) })
        .where(eq(stockOpnames.id, id));
    }

    return NextResponse.json({ ok: true, adjustedCount });
  } catch (err: any) {
    if (err?.message === "Unauthorized") {
      return NextResponse.json({ error: "Silakan login" }, { status: 401 });
    }
    console.error(err);
    return NextResponse.json({ error: "Gagal menyimpan opname" }, { status: 500 });
  }
}

// DELETE /api/opname?id=1
export async function DELETE(request: Request) {
  try {
    const user = await requireSession();
    const url = new URL(request.url);
    const id = Number(url.searchParams.get("id"));
    if (!id) return NextResponse.json({ error: "ID wajib" }, { status: 400 });

    await db.delete(stockOpnames).where(eq(stockOpnames.id, id));
    await logAudit({
      userId: user.id,
      userName: user.fullName,
      action: "DELETE",
      entityType: "opname",
      entityId: id,
      description: `Stock opname #${id} dihapus`,
    });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    if (err?.message === "Unauthorized") {
      return NextResponse.json({ error: "Silakan login" }, { status: 401 });
    }
    console.error(err);
    return NextResponse.json({ error: "Gagal menghapus opname" }, { status: 500 });
  }
}
