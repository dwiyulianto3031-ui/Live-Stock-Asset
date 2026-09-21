import { NextResponse } from "next/server";
import { db } from "@/db";
import { products, stockMovements, users } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { getSession } from "@/lib/auth";

// GET /api/serial-search?q=SN atau Barcode
export async function GET(request: Request) {
  try {
    await getSession(); // opsional: guest boleh lihat
    const url = new URL(request.url);
    const q = (url.searchParams.get("q") ?? "").trim();

    if (!q || q.length < 2) {
      return NextResponse.json({ results: [] });
    }

    // Ambil semua movements yang mengandung SN atau barcode tersebut
    const movements = await db
      .select({
        id: stockMovements.id,
        productId: stockMovements.productId,
        productName: products.name,
        productSku: products.sku,
        type: stockMovements.type,
        source: stockMovements.source,
        quantity: stockMovements.quantity,
        serialNumber: stockMovements.serialNumber,
        barcode: stockMovements.barcode,
        assetStatus: stockMovements.assetStatus,
        ticketNo: stockMovements.ticketNo,
        storeName: stockMovements.storeName,
        userName: users.fullName,
        createdAt: stockMovements.createdAt,
      })
      .from(stockMovements)
      .innerJoin(products, eq(stockMovements.productId, products.id))
      .innerJoin(users, eq(stockMovements.userId, users.id))
      .where(
        sql`${stockMovements.serialNumber} ILIKE ${`%${q}%`} OR ${stockMovements.barcode} ILIKE ${`%${q}%`}`,
      )
      .orderBy(sql`${stockMovements.createdAt} DESC`)
      .limit(100);

    // Parse dan filter hasil untuk hanya yang match
    const results = movements.flatMap((m) => {
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

      const matchedItems: any[] = [];
      for (let i = 0; i < Math.max(serialNumbers.length, barcodes.length); i++) {
        const sn = serialNumbers[i] ?? null;
        const bc = barcodes[i] ?? null;
        const snMatch = sn && sn.toLowerCase().includes(q.toLowerCase());
        const bcMatch = bc && bc.toLowerCase().includes(q.toLowerCase());
        if (snMatch || bcMatch) {
          matchedItems.push({
            movementId: m.id,
            productId: m.productId,
            productName: m.productName,
            productSku: m.productSku,
            type: m.type,
            source: m.source,
            serialNumber: sn,
            barcode: bc,
            assetStatus: m.assetStatus,
            ticketNo: m.ticketNo,
            storeName: m.storeName,
            userName: m.userName,
            createdAt: m.createdAt,
          });
        }
      }
      return matchedItems;
    });

    return NextResponse.json({ results, query: q });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Gagal melakukan pencarian" },
      { status: 500 },
    );
  }
}
