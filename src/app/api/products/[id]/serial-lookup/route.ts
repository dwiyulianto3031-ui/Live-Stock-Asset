import { NextResponse } from "next/server";
import { db } from "@/db";
import { products, stockMovements } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { getSession } from "@/lib/auth";

// GET /api/products/[id]/serial-lookup?sn=SN1,SN2
// Lookup SN yang sudah tercatat di produk untuk auto-fill barcode saat keluar
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await getSession(); // opsional: guest boleh lihat
    const { id } = await params;
    const productId = Number(id);
    if (!productId) {
      return NextResponse.json({ error: "ID tidak valid" }, { status: 400 });
    }

    const url = new URL(request.url);
    const snParam = url.searchParams.get("sn") ?? "";
    const requestedSNs = snParam
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    if (requestedSNs.length === 0) {
      return NextResponse.json({ results: {} });
    }

    // Ambil semua movements masuk (in) untuk produk ini
    const inMovements = await db
      .select({
        id: stockMovements.id,
        source: stockMovements.source,
        serialNumber: stockMovements.serialNumber,
        barcode: stockMovements.barcode,
        assetStatus: stockMovements.assetStatus,
        createdAt: stockMovements.createdAt,
      })
      .from(stockMovements)
      .where(
        and(
          eq(stockMovements.productId, productId),
          eq(stockMovements.type, "in"),
        ),
      );

    // Ambil semua movements keluar (out) untuk produk ini
    const outMovements = await db
      .select({
        id: stockMovements.id,
        serialNumber: stockMovements.serialNumber,
        barcode: stockMovements.barcode,
      })
      .from(stockMovements)
      .where(
        and(
          eq(stockMovements.productId, productId),
          eq(stockMovements.type, "out"),
        ),
      );

    // Build set of SN yang sudah keluar
    const outSNSet = new Set<string>();
    // Build set of Barcode yang sudah keluar
    const outBarcodeSet = new Set<string>();
    for (const m of outMovements) {
      try {
        if (m.serialNumber) {
          const parsed = JSON.parse(m.serialNumber);
          const arr = Array.isArray(parsed) ? parsed : [m.serialNumber];
          arr.forEach((s: string) => outSNSet.add(s));
        }
      } catch {
        if (m.serialNumber) outSNSet.add(m.serialNumber);
      }
      try {
        if (m.barcode) {
          const parsed = JSON.parse(m.barcode);
          const arr = Array.isArray(parsed) ? parsed : [m.barcode];
          arr.forEach((b: string) => outBarcodeSet.add(b));
        }
      } catch {
        if (m.barcode) outBarcodeSet.add(m.barcode);
      }
    }

    // Build map SN → {barcode, assetStatus, source, available}
    const snMap: Record<
      string,
      {
        barcode: string | null;
        barcodeAvailable: boolean;
        assetStatus: string | null;
        source: "new" | "return";
        available: boolean;
      }
    > = {};

    for (const m of inMovements) {
      let serialNumbers: string[] = [];
      let barcodes: string[] = [];
      try {
        if (m.serialNumber) {
          const parsed = JSON.parse(m.serialNumber);
          serialNumbers = Array.isArray(parsed) ? parsed : [m.serialNumber];
        }
      } catch {
        serialNumbers = m.serialNumber ? [m.serialNumber] : [];
      }
      try {
        if (m.barcode) {
          const parsed = JSON.parse(m.barcode);
          barcodes = Array.isArray(parsed) ? parsed : [m.barcode];
        }
      } catch {
        barcodes = m.barcode ? [m.barcode] : [];
      }

      serialNumbers.forEach((sn, idx) => {
        // Skip jika SN sudah keluar
        if (outSNSet.has(sn)) return;
        const bc = barcodes[idx] ?? null;
        const barcodeAvailable = bc ? !outBarcodeSet.has(bc) : true;
        snMap[sn] = {
          barcode: bc,
          barcodeAvailable,
          assetStatus: m.assetStatus,
          source: (m.source as "new" | "return") ?? "new",
          available: true,
        };
      });
    }

    // Build map Barcode → info (untuk lookup by barcode)
    const barcodeMap: Record<
      string,
      {
        serialNumber: string | null;
        assetStatus: string | null;
        source: "new" | "return";
        available: boolean;
      }
    > = {};
    for (const m of inMovements) {
      let serialNumbers: string[] = [];
      let barcodes: string[] = [];
      try {
        if (m.serialNumber) {
          const parsed = JSON.parse(m.serialNumber);
          serialNumbers = Array.isArray(parsed) ? parsed : [m.serialNumber];
        }
      } catch {
        serialNumbers = m.serialNumber ? [m.serialNumber] : [];
      }
      try {
        if (m.barcode) {
          const parsed = JSON.parse(m.barcode);
          barcodes = Array.isArray(parsed) ? parsed : [m.barcode];
        }
      } catch {
        barcodes = m.barcode ? [m.barcode] : [];
      }
      barcodes.forEach((bc, idx) => {
        if (outBarcodeSet.has(bc)) return;
        barcodeMap[bc] = {
          serialNumber: serialNumbers[idx] ?? null,
          assetStatus: m.assetStatus,
          source: (m.source as "new" | "return") ?? "new",
          available: true,
        };
      });
    }

    // Hasil untuk setiap SN yang diminta
    const results: Record<
      string,
      {
        found: boolean;
        available: boolean;
        barcode: string | null;
        barcodeAvailable: boolean;
        assetStatus: string | null;
        source: "new" | "return" | null;
      }
    > = {};

    for (const sn of requestedSNs) {
      const match = snMap[sn];
      if (match) {
        results[sn] = {
          found: true,
          available: match.available,
          barcode: match.barcode,
          barcodeAvailable: match.barcodeAvailable,
          assetStatus: match.assetStatus,
          source: match.source,
        };
      } else {
        results[sn] = {
          found: false,
          available: false,
          barcode: null,
          barcodeAvailable: false,
          assetStatus: null,
          source: null,
        };
      }
    }

    return NextResponse.json({ results, barcodeMap });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Gagal lookup serial number" },
      { status: 500 },
    );
  }
}
