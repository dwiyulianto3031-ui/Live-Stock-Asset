import { NextResponse } from "next/server";
import { db } from "@/db";
import { products, stockAlerts, users } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import {
  buildLowStockEmail,
  sendEmail,
  getAdminRecipients,
  isSmtpConfigured,
} from "@/lib/email";

export const dynamic = "force-dynamic";

type LowItem = {
  id: number;
  sku: string;
  name: string;
  unit: string;
  minStock: number;
  newStock: number;
  returnStock: number;
  total: number;
};

// GET /api/cron/stock-alert
// Auto-kirim email notifikasi stok menipis (jalankan via Vercel Cron / CRONJOB.org)
// Secara otomatis:
//  - hanya kirim sekali per hari per produk (anti spam)
//  - kirim ke ALERT_EMAIL_TO atau email semua admin
async function runAlert(): Promise<NextResponse> {
  const low = (await db
    .select({
      id: products.id,
      sku: products.sku,
      name: products.name,
      unit: products.unit,
      minStock: products.minStock,
      newStock: products.newStock,
      returnStock: products.returnStock,
    })
    .from(products)
    .where(
      and(
        eq(products.isArchived, false),
        sql`(${products.newStock} + ${products.returnStock}) <= ${products.minStock}`,
      ),
    )) as Array<Omit<LowItem, "total">>;

  const items: LowItem[] = low.map((p) => ({
    ...p,
    total: p.newStock + p.returnStock,
  }));

  if (items.length === 0) {
    return NextResponse.json({
      ok: true,
      skipped: "no_low_stock",
      message: "Semua stok aman, tidak ada email dikirim.",
      checkedAt: new Date().toISOString(),
    });
  }

  // Tentukan penerima
  let recipients = getAdminRecipients();
  if (recipients.length === 0) {
    const admins = await db
      .select({ email: users.email })
      .from(users)
      .where(and(eq(users.role, "admin"), sql`${users.email} IS NOT NULL`));
    recipients = admins.map((a) => a.email!).filter(Boolean);
  }

  if (recipients.length === 0) {
    await db.insert(stockAlerts).values(
      items.map((p) => ({
        productId: p.id,
        productSku: p.sku,
        productName: p.name,
        currentTotal: p.total,
        minStock: p.minStock,
        recipient: "-",
        status: "pending",
      })),
    );
    return NextResponse.json(
      {
        ok: false,
        skipped: "no_recipient",
        message:
          "Tidak ada email penerima. Set ALERT_EMAIL_TO (contoh: a@b.com,c@d.com) di Environment Variables, atau isi email admin di profil user.",
        products: items.length,
      },
      { status: 200 },
    );
  }

  // Anti-spam: cek apakah hari ini sudah pernah kirim untuk produk yang sama
  const today = items.map((i) => i.id);
  const alreadyToday = await db
    .select({ productId: stockAlerts.productId })
    .from(stockAlerts)
    .where(
      and(
        sql`${stockAlerts.sentAt} >= CURRENT_DATE`,
        sql`${stockAlerts.status} = 'sent'`,
      ),
    );
  const sentTodaySet = new Set(alreadyToday.map((r) => r.productId));
  const newItems = items.filter((i) => !sentTodaySet.has(i.id));

  if (newItems.length === 0) {
    return NextResponse.json({
      ok: true,
      skipped: "already_sent_today",
      message: "Notifikasi stok menipis sudah dikirim hari ini. Tidak ada email baru.",
      products: items.length,
      checkedAt: new Date().toISOString(),
    });
  }

  const { subject, html } = buildLowStockEmail(newItems);
  const { sent, errors } = await sendEmail(recipients, subject, html);
  const status = sent > 0 ? "sent" : isSmtpConfigured() ? "failed" : "pending";

  await db.insert(stockAlerts).values(
    newItems.map((p) => ({
      productId: p.id,
      productSku: p.sku,
      productName: p.name,
      currentTotal: p.total,
      minStock: p.minStock,
      recipient: recipients.join(", ").slice(0, 150),
      status,
    })),
  );

  return NextResponse.json({
    ok: sent > 0,
    sent,
    recipients: recipients.length,
    products: newItems.length,
    status,
    errors,
    checkedAt: new Date().toISOString(),
  });
}

// GET (Vercel Cron memakai GET) + POST (cronjob.org)
export async function GET(request: Request) {
  // Proteksi dengan secret (opsional tapi disarankan)
  const url = new URL(request.url);
  const secret = url.searchParams.get("key");
  const expected = process.env.CRON_SECRET;
  if (expected && secret !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return runAlert();
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  const secret = url.searchParams.get("key");
  const expected = process.env.CRON_SECRET;
  // Cronjob.org biasanya kirim header Authorization
  const auth = request.headers.get("authorization");
  if (
    expected &&
    secret !== expected &&
    auth !== `Bearer ${expected}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return runAlert();
}
