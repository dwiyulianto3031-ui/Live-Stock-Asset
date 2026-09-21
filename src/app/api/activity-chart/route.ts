import { NextResponse } from "next/server";
import { db } from "@/db";
import { stockMovements } from "@/db/schema";
import { sql } from "drizzle-orm";
import { getSession } from "@/lib/auth";

// GET /api/activity-chart?period=day|week|month
// - day: H s/d H-2 (3 hari terakhir, per hari)
// - week: 7 hari terakhir (per hari)
// - month: 12 bulan terakhir (per bulan)
export async function GET(request: Request) {
  try {
    await getSession(); // opsional: guest boleh lihat
    const url = new URL(request.url);
    const period = url.searchParams.get("period") ?? "day";

    const isDaily = period === "day" || period === "week";
    const count = period === "day" ? 3 : period === "week" ? 7 : 12;

    // interval grouping: hari untuk day/week, bulan untuk month
    const intervalLiteral = sql.raw(isDaily ? "'day'" : "'month'");
    const intervalUnit = sql.raw(isDaily ? "INTERVAL '1 day'" : "INTERVAL '1 month'");

    const rows = await db
      .select({
        label: sql<string>`to_char(date_trunc(${intervalLiteral}, ${stockMovements.createdAt})::date, 'YYYY-MM-DD')`,
        type: stockMovements.type,
        totalQty: sql<number>`coalesce(sum(${stockMovements.quantity}),0)::int`,
      })
      .from(stockMovements)
      .where(
        sql`${stockMovements.createdAt} >= date_trunc(${intervalLiteral}, CURRENT_DATE) - (${count} - 1) * ${intervalUnit}`,
      )
      .groupBy(
        sql`date_trunc(${intervalLiteral}, ${stockMovements.createdAt})::date`,
        stockMovements.type,
      );

    // Map: label -> { masuk, keluar }
    const map = new Map<string, { masuk: number; keluar: number }>();
    for (const r of rows) {
      const key = String(r.label);
      const cur = map.get(key) ?? { masuk: 0, keluar: 0 };
      if (r.type === "in") cur.masuk += r.totalQty;
      else cur.keluar += r.totalQty;
      map.set(key, cur);
    }

    // Generate label kontinu (isi gap dengan 0)
    const now = new Date();
    const labels: string[] = [];

    if (isDaily) {
      // Mulai dari H-(count-1) sampai H
      const start = new Date(now);
      start.setDate(now.getDate() - (count - 1));
      for (let i = 0; i < count; i++) {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        labels.push(toYMD(d));
      }
    } else {
      // per bulan: awal bulan, 12 bulan terakhir
      const cur = new Date(now.getFullYear(), now.getMonth(), 1);
      const start = new Date(cur);
      start.setMonth(cur.getMonth() - (count - 1));
      for (let i = 0; i < count; i++) {
        const d = new Date(start);
        d.setMonth(start.getMonth() + i);
        labels.push(toYMD(d));
      }
    }

    const masuk = labels.map((l) => map.get(l)?.masuk ?? 0);
    const keluar = labels.map((l) => map.get(l)?.keluar ?? 0);

    return NextResponse.json({ period, labels, masuk, keluar });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Gagal memuat data grafik aktivitas" },
      { status: 500 },
    );
  }
}

function toYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
