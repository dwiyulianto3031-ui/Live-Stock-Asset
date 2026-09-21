import { NextResponse } from "next/server";
import { pool, dbInfo } from "@/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const checks: Record<string, any> = {};

  checks.env = {
    DATABASE_URL_set: !!process.env.DATABASE_URL,
    DATABASE_URL_masked: process.env.DATABASE_URL
      ? process.env.DATABASE_URL.replace(/:[^:@/]+@/, ":***@")
      : null,
    JWT_SECRET_set: !!process.env.JWT_SECRET,
    JWT_SECRET_length: process.env.JWT_SECRET?.length ?? 0,
    NODE_ENV: process.env.NODE_ENV ?? null,
    VERCEL: !!process.env.VERCEL,
  };

  checks.pool = dbInfo;

  try {
    const r = await pool.query("SELECT current_database() as db, version() as v");
    checks.connection = {
      ok: true,
      database: r.rows[0]?.db,
      server: String(r.rows[0]?.v ?? "").split(",")[0],
    };
  } catch (err: any) {
    checks.connection = {
      ok: false,
      code: err?.code ?? null,
      error: String(err?.message ?? err).slice(0, 200),
    };
    return NextResponse.json(
      {
        status: "CONNECTION_FAILED",
        fix: "Cek DATABASE_URL di Vercel. Gunakan Transaction pooler Supabase (port 6543).",
        checks,
      },
      { status: 500 },
    );
  }

  const tables = ["users", "products", "stock_movements", "audit_logs"];
  const tableStatus: Record<string, any> = {};
  for (const t of tables) {
    try {
      const r = await pool.query(`SELECT count(*)::int as c FROM ${t}`);
      tableStatus[t] = { exists: true, rows: r.rows[0].c };
    } catch (err: any) {
      tableStatus[t] = {
        exists: false,
        error: String(err?.message ?? err).slice(0, 150),
      };
    }
  }
  checks.tables = tableStatus;

  const allOk = tables.every((t) => tableStatus[t]?.exists);
  return NextResponse.json({
    status: allOk ? "OK" : "TABLES_MISSING",
    fix: allOk
      ? "Semua tabel siap. Silakan daftar akun di /register."
      : "Tabel belum dibuat. Jalankan SQL di Supabase SQL Editor (lihat DEPLOYMENT.md).",
    checks,
  });
}
