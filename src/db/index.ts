import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

// Supabase memerlukan koneksi SSL
const needsSSL =
  databaseUrl.includes("supabase.co") ||
  databaseUrl.includes("supabase.com") ||
  /sslmode=require|sslmode=verify-full/i.test(databaseUrl);

// Deteksi mode pooler:
// - Session pooler    : port 5432 (limit 15 client, mudah penuh)
// - Transaction pooler: port 6543 (rekomendasi untuk serverless)
const isTransactionPooler = /:6543\//.test(databaseUrl);
const isSupabasePooler = /\.pooler\.supabase\.(com|co)/.test(databaseUrl);

const isServerless =
  !!process.env.VERCEL || process.env.NODE_ENV === "production";

const globalForDb = globalThis as typeof globalThis & {
  __gudangproPgPool?: Pool;
};

export const pool =
  globalForDb.__gudangproPgPool ??
  new Pool({
    connectionString: databaseUrl,
    ssl: needsSSL ? { rejectUnauthorized: false } : undefined,
    // Pool mini agar total koneksi lintas instance tetap di bawah limit
    max: isServerless ? (isTransactionPooler ? 3 : 1) : 5,
    min: 0,
    // Tutup koneksi idle cepat agar slot pooler segera dilepas
    idleTimeoutMillis: isServerless ? 5_000 : 30_000,
    connectionTimeoutMillis: 15_000,
    keepAlive: true,
  });

// Cegah proses crash & koneksi zombie saat error background
pool.on("error", (err) => {
  console.error("PG pool error:", err?.message ?? err);
});

globalForDb.__gudangproPgPool = pool;

export const db = drizzle(pool);

export const dbInfo = {
  isTransactionPooler,
  isSupabasePooler,
  maxConnections: pool.options.max,
  ssl: !!needsSSL,
};
