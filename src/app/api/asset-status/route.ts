import { NextResponse } from "next/server";
import { db } from "@/db";
import {
  products,
  stockMovements,
  assetStatusHistory,
  auditLogs,
} from "@/db/schema";
import { eq, desc, and, sql } from "drizzle-orm";
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

// GET /api/asset-status?serialNumber=SN1&productId=1
// Riwayat perubahan status asset per unit (SN/barcode)
export async function GET(request: Request) {
  try {
    await requireSession();
    const url = new URL(request.url);
    const serial = (url.searchParams.get("serialNumber") ?? "").trim();
    const productId = url.searchParams.get("productId");

    const conditions: any[] = [];
    if (serial) conditions.push(sql`${assetStatusHistory.serialNumber} = ${serial}`);
    if (productId) conditions.push(eq(assetStatusHistory.productId, Number(productId)));
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const history = await db
      .select()
      .from(assetStatusHistory)
      .where(where)
      .orderBy(desc(assetStatusHistory.changedAt))
      .limit(200);

    return NextResponse.json({ history });
  } catch (err: any) {
    if (err?.message === "Unauthorized") {
      return NextResponse.json({ error: "Silakan login" }, { status: 401 });
    }
    console.error(err);
    return NextResponse.json({ error: "Gagal memuat riwayat asset" }, { status: 500 });
  }
}

// POST /api/asset-status
// Body: { productId, serialNumber, barcode, newStatus, movementId? }
// Ubah status asset unit + catat ke riwayat
export async function POST(request: Request) {
  try {
    const user = await requireSession();
    const body = await request.json();
    const productId = Number(body.productId);
    const newStatus = String(body.newStatus ?? "").trim().slice(0, 50);
    const serialNumber = body.serialNumber
      ? String(body.serialNumber).trim().slice(0, 150)
      : null;
    const barcode = body.barcode ? String(body.barcode).trim().slice(0, 150) : null;
    const movementId = body.movementId ? Number(body.movementId) : null;

    if (!productId) {
      return NextResponse.json({ error: "productId wajib" }, { status: 400 });
    }
    if (!newStatus) {
      return NextResponse.json({ error: "newStatus wajib diisi" }, { status: 400 });
    }
    if (!serialNumber && !barcode) {
      return NextResponse.json(
        { error: "Isi serialNumber atau barcode unit yang diubah" },
        { status: 400 },
      );
    }

    const prodRows = await db
      .select()
      .from(products)
      .where(eq(products.id, productId))
      .limit(1);
    if (prodRows.length === 0) {
      return NextResponse.json({ error: "Produk tidak ditemukan" }, { status: 404 });
    }

    // Cari status asset saat ini dari movement terakhir yang memuat unit ini
    let oldStatus: string | null = null;
    let sourceMovementId: number | null = movementId;

    const moves = await db
      .select({
        id: stockMovements.id,
        type: stockMovements.type,
        serialNumber: stockMovements.serialNumber,
        barcode: stockMovements.barcode,
        assetStatus: stockMovements.assetStatus,
      })
      .from(stockMovements)
      .where(eq(stockMovements.productId, productId))
      .orderBy(desc(stockMovements.createdAt));

    for (const m of moves) {
      const sns = parseArr(m.serialNumber);
      const bcs = parseArr(m.barcode);
      const matchSN = serialNumber && sns.includes(serialNumber);
      const matchBC = barcode && bcs.includes(barcode);
      if (matchSN || matchBC) {
        oldStatus = m.assetStatus;
        if (!sourceMovementId) sourceMovementId = m.id;
        break;
      }
    }

    if (oldStatus === newStatus) {
      return NextResponse.json({
        ok: true,
        changed: false,
        message: `Status unit sudah "${newStatus}", tidak ada perubahan.`,
      });
    }

    // Update assetStatus pada movement yang memuat unit ini
    if (sourceMovementId) {
      await db
        .update(stockMovements)
        .set({ assetStatus: newStatus })
        .where(eq(stockMovements.id, sourceMovementId));
    }

    // Catat ke riwayat
    await db.insert(assetStatusHistory).values({
      movementId: sourceMovementId,
      productId,
      serialNumber,
      barcode,
      oldStatus,
      newStatus,
      changedBy: user.fullName,
    });

    await logAudit({
      userId: user.id,
      userName: user.fullName,
      action: "UPDATE",
      entityType: "asset_status",
      entityId: productId,
      description: `Status asset ${prodRows[0].sku} (${serialNumber ?? barcode}): ${oldStatus ?? "-"} -> ${newStatus}`,
      metadata: {
        serialNumber,
        barcode,
        oldStatus,
        newStatus,
        movementId: sourceMovementId,
      },
    });

    return NextResponse.json({
      ok: true,
      changed: true,
      oldStatus,
      newStatus,
      movementId: sourceMovementId,
    });
  } catch (err: any) {
    if (err?.message === "Unauthorized") {
      return NextResponse.json({ error: "Silakan login" }, { status: 401 });
    }
    console.error(err);
    return NextResponse.json({ error: "Gagal mengubah status asset" }, { status: 500 });
  }
}
