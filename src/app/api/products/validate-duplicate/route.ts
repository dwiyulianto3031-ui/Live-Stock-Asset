import { NextResponse } from "next/server";
import { db } from "@/db";
import { stockMovements } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { requireSession } from "@/lib/auth";

function parseArr(v: string | null): string[] {
  if (!v) return [];
  try {
    const p = JSON.parse(v);
    return Array.isArray(p) ? p : [v];
  } catch {
    return [v];
  }
}

// GET /api/products/validate-duplicate?sn=a,b&barcode=c&excludeMovementId=1
// Validasi duplikasi serial number & barcode di SELURUH riwayat
export async function GET(request: Request) {
  try {
    await requireSession();
    const url = new URL(request.url);
    const snParam = (url.searchParams.get("sn") ?? "").trim();
    const bcParam = (url.searchParams.get("barcode") ?? "").trim();
    const productId = url.searchParams.get("productId");
    const excludeMovementId = url.searchParams.get("excludeMovementId");

    const requestedSNs = snParam
      .split(/[,\n|]/)
      .map((s) => s.trim())
      .filter(Boolean);
    const requestedBCs = bcParam
      .split(/[,\n|]/)
      .map((s) => s.trim())
      .filter(Boolean);

    if (requestedSNs.length === 0 && requestedBCs.length === 0) {
      return NextResponse.json({ duplicates: [], serials: {}, barcodes: {} });
    }

    const rows = await db
      .select({
        id: stockMovements.id,
        productId: stockMovements.productId,
        type: stockMovements.type,
        serialNumber: stockMovements.serialNumber,
        barcode: stockMovements.barcode,
      })
      .from(stockMovements)
      .where(
        productId
          ? and(
              eq(stockMovements.productId, Number(productId)),
              sql`(${stockMovements.serialNumber} IS NOT NULL OR ${stockMovements.barcode} IS NOT NULL)`,
            )
          : sql`(${stockMovements.serialNumber} IS NOT NULL OR ${stockMovements.barcode} IS NOT NULL)`,
      );

    // Peta SN/barcode -> info kemunculan
    const snMap: Record<string, { count: number; types: string[]; movementIds: number[] }> = {};
    const bcMap: Record<string, { count: number; types: string[]; movementIds: number[] }> = {};

    for (const m of rows) {
      if (excludeMovementId && m.id === Number(excludeMovementId)) continue;
      const sns = parseArr(m.serialNumber);
      const bcs = parseArr(m.barcode);

      for (const sn of sns) {
        if (!sn) continue;
        snMap[sn] = snMap[sn] ?? { count: 0, types: [], movementIds: [] };
        snMap[sn].count++;
        if (!snMap[sn].types.includes(m.type)) snMap[sn].types.push(m.type);
        snMap[sn].movementIds.push(m.id);
      }
      for (const bc of bcs) {
        if (!bc) continue;
        bcMap[bc] = bcMap[bc] ?? { count: 0, types: [], movementIds: [] };
        bcMap[bc].count++;
        if (!bcMap[bc].types.includes(m.type)) bcMap[bc].types.push(m.type);
        bcMap[bc].movementIds.push(m.id);
      }
    }

    const serials: Record<string, { exists: boolean; duplicate: boolean; count: number; usedIn: string[] }> = {};
    for (const sn of requestedSNs) {
      const hit = snMap[sn];
      serials[sn] = {
        exists: !!hit,
        duplicate: !!hit && hit.count > 1,
        count: hit?.count ?? 0,
        usedIn: hit?.types ?? [],
      };
    }
    const barcodes: Record<string, { exists: boolean; duplicate: boolean; count: number; usedIn: string[] }> = {};
    for (const bc of requestedBCs) {
      const hit = bcMap[bc];
      barcodes[bc] = {
        exists: !!hit,
        duplicate: !!hit && hit.count > 1,
        count: hit?.count ?? 0,
        usedIn: hit?.types ?? [],
      };
    }

    // List semua yang duplikat (untuk halaman monitoring)
    const duplicates = [
      ...Object.entries(snMap)
        .filter(([, v]) => v.count > 1)
        .map(([k, v]) => ({ kind: "serial", value: k, count: v.count, usedIn: v.types })),
      ...Object.entries(bcMap)
        .filter(([, v]) => v.count > 1)
        .map(([k, v]) => ({ kind: "barcode", value: k, count: v.count, usedIn: v.types })),
    ].slice(0, 200);

    return NextResponse.json({ serials, barcodes, duplicates });
  } catch (err: any) {
    if (err?.message === "Unauthorized") {
      return NextResponse.json({ error: "Silakan login" }, { status: 401 });
    }
    console.error(err);
    return NextResponse.json({ error: "Gagal validasi duplikasi" }, { status: 500 });
  }
}
