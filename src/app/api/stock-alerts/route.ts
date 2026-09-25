import { NextResponse } from "next/server";
import { db } from "@/db";
import { products, stockAlerts, users } from "@/db/schema";
import { eq, and, sql, desc } from "drizzle-orm";
import { getSession, type SessionUser } from "@/lib/auth";
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

// Ambil produk stok menipis
async function getLowStock(): Promise<LowItem[]> {
  const rows = await db
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
    )
    .orderBy(products.name);

  return rows.map((p) => ({
    id: p.id,
    sku: p.sku,
    name: p.name,
    unit: p.unit,
    minStock: p.minStock,
    newStock: p.newStock,
    returnStock: p.returnStock,
    total: p.newStock + p.returnStock,
  }));
}

// Catat log pengiriman
async function logAlerts(items: LowItem[], recipient: string, status: string) {
  if (items.length === 0) return;
  await db.insert(stockAlerts).values(
    items.map((p) => ({
      productId: p.id,
      productSku: p.sku,
      productName: p.name,
      currentTotal: p.total,
      minStock: p.minStock,
      recipient,
      status,
    })),
  );
}

// GET /api/stock-alerts - daftar menipis + riwayat notifikasi
export async function GET(request: Request) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json(
        { error: "Silakan login untuk melihat notifikasi" },
        { status: 401 },
      );
    }

    const url = new URL(request.url);
    const limit = Math.min(Number(url.searchParams.get("limit") ?? 50), 200);

    const [lowStock, history, admins] = await Promise.all([
      getLowStock(),
      db
        .select()
        .from(stockAlerts)
        .orderBy(desc(stockAlerts.sentAt))
        .limit(limit),
      db
        .select({ email: users.email, username: users.username, role: users.role })
        .from(users),
    ]);

    return NextResponse.json({
      lowStock,
      history,
      admins: admins
        .filter((a) => a.role === "admin" && a.email)
        .map((a) => a.email),
      smtpConfigured: isSmtpConfigured(),
      autoRecipients: getAdminRecipients(),
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Gagal memuat notifikasi stok" },
      { status: 500 },
    );
  }
}

// POST /api/stock-alerts
// mode:
//  - "auto"    : kirim ke ALERT_EMAIL_TO / email admin (dipakai cron)
//  - "manual"  : kirim ke email yang diketik user (default)
//  - "test"    : tes kirim ke 1 email
export async function POST(request: Request) {
  try {
    const user: SessionUser | null = await getSession().catch(() => null);
    const body = await request.json().catch(() => ({}));
    const mode = body.mode === "auto" ? "auto" : body.mode === "test" ? "test" : "manual";

    // Auto mode (cron) tidak butuh session; manual/test wajib login
    if (mode !== "auto") {
      const auth = await getSession();
      if (!auth) {
        return NextResponse.json({ error: "Silakan login" }, { status: 401 });
      }
    }

    const lowStock = await getLowStock();

    if (lowStock.length === 0) {
      return NextResponse.json({
        ok: true,
        sent: 0,
        message: "Semua stok aman. Tidak ada produk menipis — tidak ada email dikirim.",
      });
    }

    // Tentukan penerima
    let recipients: string[] = [];
    if (mode === "test") {
      recipients = [String(body.email ?? "").trim()].filter(Boolean);
      if (!recipients[0]) {
        return NextResponse.json({ error: "Isi email tujuan untuk tes" }, { status: 400 });
      }
    } else if (mode === "auto") {
      recipients = getAdminRecipients();
      if (recipients.length === 0) {
        const admins = await db
          .select({ email: users.email })
          .from(users)
          .where(and(eq(users.role, "admin"), sql`${users.email} IS NOT NULL`));
        recipients = admins.map((a) => a.email!).filter(Boolean);
      }
    } else {
      const raw = body.recipients ?? body.email ?? "";
      recipients = String(raw)
        .split(/[,\n;]/)
        .map((s: string) => s.trim())
        .filter(Boolean);
      if (recipients.length === 0) {
        if (user?.email) recipients = [user.email];
      }
    }

    if (recipients.length === 0) {
      return NextResponse.json(
        {
          error:
            "Tidak ada alamat email tujuan. Isi kolom email, atau set ALERT_EMAIL_TO di Vercel untuk auto-kirim.",
        },
        { status: 400 },
      );
    }

    const { subject, html } = buildLowStockEmail(lowStock);
    const recipientStr = recipients.join(", ");
    const recipLog = recipientStr.slice(0, 150);

    // Kirim
    const { sent, errors } = await sendEmail(recipients, subject, html);
    const status = sent > 0 ? "sent" : isSmtpConfigured() ? "failed" : "pending";

    await logAlerts(lowStock, recipLog, status);

    return NextResponse.json({
      ok: sent > 0,
      mode,
      sent,
      totalRecipients: recipients.length,
      products: lowStock.length,
      status,
      errors,
      smtpConfigured: isSmtpConfigured(),
      message:
        sent > 0
          ? `Notifikasi terkirim ke ${sent}/${recipients.length} email untuk ${lowStock.length} produk menipis.`
          : isSmtpConfigured()
          ? `Gagal mengirim: ${errors.join(" | ")}`
          : "Email server belum dikonfigurasi (RESEND_API_KEY). Notifikasi dicatat sebagai pending.",
      lowStock: lowStock.map((p) => ({
        sku: p.sku,
        name: p.name,
        total: p.total,
        min: p.minStock,
      })),
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Gagal mengirim notifikasi" }, { status: 500 });
  }
}
