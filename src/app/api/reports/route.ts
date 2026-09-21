import { NextResponse } from "next/server";
import { db } from "@/db";
import { products, stockMovements, users } from "@/db/schema";
import { eq, sql, desc, and, gte, lte } from "drizzle-orm";
import { getSession } from "@/lib/auth";

// GET /api/reports?type=movement|store|top&from=YYYY-MM-DD&to=YYYY-MM-DD
export async function GET(request: Request) {
  try {
    await getSession(); // opsional: guest boleh lihat
    const url = new URL(request.url);
    const type = url.searchParams.get("type") ?? "movement";
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    const productId = url.searchParams.get("productId");

    const conditions: any[] = [];
    if (from) conditions.push(gte(stockMovements.createdAt, new Date(from)));
    if (to) {
      const toDate = new Date(to);
      toDate.setHours(23, 59, 59, 999);
      conditions.push(lte(stockMovements.createdAt, toDate));
    }
    if (productId) conditions.push(eq(stockMovements.productId, Number(productId)));

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    if (type === "movement") {
      const rows = await db
        .select({
          date: sql<string>`date_trunc('day', ${stockMovements.createdAt})::date`,
          type: stockMovements.type,
          source: stockMovements.source,
          totalQty: sql<number>`coalesce(sum(${stockMovements.quantity}),0)::int`,
          txCount: sql<number>`count(*)::int`,
        })
        .from(stockMovements)
        .where(where)
        .groupBy(
          sql`date_trunc('day', ${stockMovements.createdAt})::date`,
          stockMovements.type,
          stockMovements.source,
        )
        .orderBy(desc(sql`date_trunc('day', ${stockMovements.createdAt})::date`));
      return NextResponse.json({ data: rows });
    }

    if (type === "store") {
      const rows = await db
        .select({
          storeName: stockMovements.storeName,
          totalQty: sql<number>`coalesce(sum(${stockMovements.quantity}),0)::int`,
          txCount: sql<number>`count(*)::int`,
          uniqueProducts: sql<number>`count(DISTINCT ${stockMovements.productId})::int`,
        })
        .from(stockMovements)
        .where(and(where, eq(stockMovements.type, "out")))
        .groupBy(stockMovements.storeName)
        .orderBy(desc(sql`sum(${stockMovements.quantity})`));
      return NextResponse.json({ data: rows });
    }

    if (type === "top") {
      const rows = await db
        .select({
          productId: stockMovements.productId,
          productName: products.name,
          productSku: products.sku,
          unit: products.unit,
          totalOut: sql<number>`coalesce(sum(${stockMovements.quantity}),0)::int`,
          txCount: sql<number>`count(*)::int`,
        })
        .from(stockMovements)
        .innerJoin(products, eq(stockMovements.productId, products.id))
        .where(and(where, eq(stockMovements.type, "out")))
        .groupBy(
          stockMovements.productId,
          products.name,
          products.sku,
          products.unit,
        )
        .orderBy(desc(sql`sum(${stockMovements.quantity})`))
        .limit(20);
      return NextResponse.json({ data: rows });
    }

    // Laporan total barang masuk & keluar per produk
    if (type === "product") {
      const rows = await db
        .select({
          productId: stockMovements.productId,
          productName: products.name,
          productSku: products.sku,
          unit: products.unit,
          totalIn: sql<number>`coalesce(sum(CASE WHEN ${stockMovements.type} = 'in' THEN ${stockMovements.quantity} ELSE 0 END),0)::int`,
          totalOut: sql<number>`coalesce(sum(CASE WHEN ${stockMovements.type} = 'out' THEN ${stockMovements.quantity} ELSE 0 END),0)::int`,
          txCount: sql<number>`count(*)::int`,
        })
        .from(stockMovements)
        .innerJoin(products, eq(stockMovements.productId, products.id))
        .where(where)
        .groupBy(
          stockMovements.productId,
          products.name,
          products.sku,
          products.unit,
        )
        .orderBy(desc(sql`sum(${stockMovements.quantity})`));

      // Ambil stok sekarang
      const stocks = await db
        .select({
          id: products.id,
          newStock: products.newStock,
          returnStock: products.returnStock,
        })
        .from(products);
      const stockMap = new Map(stocks.map((s) => [s.id, s]));

      const data = rows.map((r) => {
        const st = stockMap.get(r.productId);
        return {
          ...r,
          currentNewStock: st?.newStock ?? 0,
          currentReturnStock: st?.returnStock ?? 0,
          currentTotalStock: (st?.newStock ?? 0) + (st?.returnStock ?? 0),
        };
      });

      const totalIn = data.reduce((a, b) => a + b.totalIn, 0);
      const totalOut = data.reduce((a, b) => a + b.totalOut, 0);
      return NextResponse.json({ data, totalQty: totalIn + totalOut, totalIn, totalOut, txCount: data.length });
    }

    // Laporan detail transaksi barang masuk / keluar
    if (type === "in" || type === "out") {
      const rows = await db
        .select({
          id: stockMovements.id,
          createdAt: stockMovements.createdAt,
          ticketNo: stockMovements.ticketNo,
          storeName: stockMovements.storeName,
          source: stockMovements.source,
          quantity: stockMovements.quantity,
          serialNumber: stockMovements.serialNumber,
          barcode: stockMovements.barcode,
          assetStatus: stockMovements.assetStatus,
          note: stockMovements.note,
          productName: products.name,
          productSku: products.sku,
          unit: products.unit,
          userName: users.fullName,
        })
        .from(stockMovements)
        .innerJoin(products, eq(stockMovements.productId, products.id))
        .innerJoin(users, eq(stockMovements.userId, users.id))
        .where(and(where, eq(stockMovements.type, type)))
        .orderBy(desc(stockMovements.createdAt))
        .limit(1000);

      // Parse SN & barcode array
      const parsed = rows.map((row) => {
        let serialNumbers: string[] = [];
        let barcodes: string[] = [];
        try {
          if (row.serialNumber) {
            const p = JSON.parse(row.serialNumber);
            serialNumbers = Array.isArray(p) ? p : [row.serialNumber];
          }
        } catch {
          serialNumbers = row.serialNumber ? [row.serialNumber] : [];
        }
        try {
          if (row.barcode) {
            const p = JSON.parse(row.barcode);
            barcodes = Array.isArray(p) ? p : [row.barcode];
          }
        } catch {
          barcodes = row.barcode ? [row.barcode] : [];
        }
        return { ...row, serialNumbers, barcodes };
      });

      const totalQty = parsed.reduce((acc, r) => acc + r.quantity, 0);

      return NextResponse.json({ data: parsed, totalQty, txCount: parsed.length });
    }

    return NextResponse.json({ error: "Type tidak valid" }, { status: 400 });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Gagal memuat laporan" },
      { status: 500 },
    );
  }
}
