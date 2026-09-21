import { NextResponse } from "next/server";
import { db } from "@/db";
import { products, stockMovements } from "@/db/schema";
import { eq, sql, desc, gte } from "drizzle-orm";
import { getSession } from "@/lib/auth";

export async function GET() {
  try {
    await getSession(); // opsional: guest boleh lihat

    const [
      totalProducts,
      totalStock,
      totalNewStock,
      totalReturnStock,
      lowStock,
      categories,
      recentMovements,
      inflowToday,
      outflowToday,
      topProducts,
    ] = await Promise.all([
      db.select({ count: sql<number>`count(*)::int` }).from(products),
      db
        .select({
          sum: sql<number>`coalesce(sum(${products.newStock} + ${products.returnStock}),0)::int`,
        })
        .from(products),
      db
        .select({ sum: sql<number>`coalesce(sum(${products.newStock}),0)::int` })
        .from(products),
      db
        .select({ sum: sql<number>`coalesce(sum(${products.returnStock}),0)::int` })
        .from(products),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(products)
        .where(
          sql`(${products.newStock} + ${products.returnStock}) <= ${products.minStock}`,
        ),
      db
        .select({
          category: products.category,
          count: sql<number>`count(*)::int`,
        })
        .from(products)
        .groupBy(products.category)
        .orderBy(desc(sql`count(*)`))
        .limit(6),
      db
        .select({
          id: stockMovements.id,
          type: stockMovements.type,
          quantity: stockMovements.quantity,
          ticketNo: stockMovements.ticketNo,
          storeName: stockMovements.storeName,
          createdAt: stockMovements.createdAt,
          productName: products.name,
          productSku: products.sku,
          unit: products.unit,
        })
        .from(stockMovements)
        .innerJoin(products, eq(stockMovements.productId, products.id))
        .orderBy(desc(stockMovements.createdAt))
        .limit(8),
      db
        .select({
          sum: sql<number>`coalesce(sum(${stockMovements.quantity}),0)::int`,
        })
        .from(stockMovements)
        .where(
          sql`${stockMovements.type} = 'in' AND ${stockMovements.createdAt} >= CURRENT_DATE`,
        ),
      db
        .select({
          sum: sql<number>`coalesce(sum(${stockMovements.quantity}),0)::int`,
        })
        .from(stockMovements)
        .where(
          sql`${stockMovements.type} = 'out' AND ${stockMovements.createdAt} >= CURRENT_DATE`,
        ),
      db
        .select({
          productId: stockMovements.productId,
          productName: products.name,
          productSku: products.sku,
          unit: products.unit,
          totalOut: sql<number>`coalesce(sum(${stockMovements.quantity}),0)::int`,
        })
        .from(stockMovements)
        .innerJoin(products, eq(stockMovements.productId, products.id))
        .where(eq(stockMovements.type, "out"))
        .groupBy(
          stockMovements.productId,
          products.name,
          products.sku,
          products.unit,
        )
        .orderBy(desc(sql`sum(${stockMovements.quantity})`))
        .limit(5),
    ]);

    return NextResponse.json({
      totalProducts: totalProducts[0]?.count ?? 0,
      totalStock: totalStock[0]?.sum ?? 0,
      totalNewStock: totalNewStock[0]?.sum ?? 0,
      totalReturnStock: totalReturnStock[0]?.sum ?? 0,
      lowStock: lowStock[0]?.count ?? 0,
      categories,
      topProducts,
      recentMovements,
      inflowToday: inflowToday[0]?.sum ?? 0,
      outflowToday: outflowToday[0]?.sum ?? 0,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Gagal memuat statistik" },
      { status: 500 },
    );
  }
}
