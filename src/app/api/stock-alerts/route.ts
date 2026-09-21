import { NextResponse } from "next/server";
import { db } from "@/db";
import { products, stockAlerts, users } from "@/db/schema";
import { eq, and, sql, desc } from "drizzle-orm";
import { getSession } from "@/lib/auth";

// GET /api/stock-alerts - daftar produk menipis + riwayat notifikasi terkirim
export async function GET(request: Request) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json(
        { error: "Silakan login untuk melihat notifikasi" },
        { status: 401 },
      );
    }

    const lowStock = await db
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

    const history = await db
      .select()
      .from(stockAlerts)
      .orderBy(desc(stockAlerts.sentAt))
      .limit(50);

    return NextResponse.json({
      lowStock: lowStock.map((p) => ({
        ...p,
        total: p.newStock + p.returnStock,
      })),
      history,
      smtpConfigured: !!process.env.RESEND_API_KEY,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Gagal memuat notifikasi stok" },
      { status: 500 },
    );
  }
}

// POST /api/stock-alerts - kirim notifikasi email stok menipis
// Body: { recipients: "a@b.com,c@d.com" }
export async function POST(request: Request) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: "Silakan login" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    let recipients: string[] = Array.isArray(body.recipients)
      ? body.recipients.map((r: any) => String(r).trim()).filter(Boolean)
      : String(body.recipients ?? "")
          .split(/[,\n;]/)
          .map((r: string) => r.trim())
          .filter(Boolean);

    // Fallback: pakai email user yang login
    if (recipients.length === 0) {
      const me = await db
        .select({ email: users.email })
        .from(users)
        .where(eq(users.id, user.id))
        .limit(1);
      if (me[0]?.email) recipients = [me[0].email];
    }

    if (recipients.length === 0) {
      return NextResponse.json(
        {
          error:
            "Tidak ada alamat email tujuan. Isi email di form atau tambahkan email pada profil user.",
        },
        { status: 400 },
      );
    }

    // Ambil produk yang stoknya menipis
    const lowStock = await db
      .select()
      .from(products)
      .where(
        and(
          eq(products.isArchived, false),
          sql`(${products.newStock} + ${products.returnStock}) <= ${products.minStock}`,
        ),
      )
      .orderBy(products.name);

    if (lowStock.length === 0) {
      return NextResponse.json({
        ok: true,
        sent: 0,
        message: "Tidak ada produk dengan stok menipis. Tidak ada email dikirim.",
      });
    }

    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.EMAIL_FROM ?? "GudangPro <onboarding@resend.dev>";

    if (!apiKey) {
      // Catat sebagai pending karena SMTP belum dikonfigurasi
      await db.insert(stockAlerts).values(
        lowStock.map((p) => ({
          productId: p.id,
          productSku: p.sku,
          productName: p.name,
          currentTotal: p.newStock + p.returnStock,
          minStock: p.minStock,
          recipient: recipients.join(", "),
          status: "pending",
        })),
      );

      return NextResponse.json(
        {
          ok: false,
          sent: 0,
          logged: lowStock.length,
          smtpConfigured: false,
          message:
            "Email server belum dikonfigurasi. Tambahkan RESEND_API_KEY & EMAIL_FROM di Environment Variables Vercel. Notifikasi dicatat sebagai 'pending'.",
          lowStock: lowStock.map((p) => ({
            sku: p.sku,
            name: p.name,
            total: p.newStock + p.returnStock,
            min: p.minStock,
          })),
        },
        { status: 200 },
      );
    }

    // Kirim via Resend
    const rows = lowStock
      .map(
        (p) =>
          `<tr><td style="padding:6px 10px;border:1px solid #eee">${p.sku}</td>` +
          `<td style="padding:6px 10px;border:1px solid #eee">${p.name}</td>` +
          `<td style="padding:6px 10px;border:1px solid #eee;text-align:right;color:#dc2626;font-weight:700">${p.newStock + p.returnStock} ${p.unit}</td>` +
          `<td style="padding:6px 10px;border:1px solid #eee;text-align:right">${p.minStock} ${p.unit}</td></tr>`,
      )
      .join("");

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:640px">
        <h2 style="color:#b91c1c">Peringatan Stok Menipis</h2>
        <p>Berikut produk yang stoknya mencapai atau di bawah batas minimum:</p>
        <table style="border-collapse:collapse;width:100%;font-size:14px">
          <thead>
            <tr style="background:#f8fafc">
              <th style="padding:8px 10px;border:1px solid #eee;text-align:left">SKU</th>
              <th style="padding:8px 10px;border:1px solid #eee;text-align:left">Nama</th>
              <th style="padding:8px 10px;border:1px solid #eee">Stok</th>
              <th style="padding:8px 10px;border:1px solid #eee">Minimum</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <p style="margin-top:16px;font-size:12px;color:#64748b">
          Dikirim otomatis oleh GudangPro pada ${new Date().toLocaleString("id-ID")}
        </p>
      </div>`;

    let sent = 0;
    const errors: string[] = [];

    for (const to of recipients) {
      try {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from,
            to,
            subject: `Peringatan Stok Menipis (${lowStock.length} produk)`,
            html,
          }),
        });
        if (res.ok) sent++;
        else {
          const t = await res.text();
          errors.push(`${to}: ${t.slice(0, 100)}`);
        }
      } catch (e: any) {
        errors.push(`${to}: ${String(e?.message ?? e).slice(0, 100)}`);
      }
    }

    await db.insert(stockAlerts).values(
      lowStock.map((p) => ({
        productId: p.id,
        productSku: p.sku,
        productName: p.name,
        currentTotal: p.newStock + p.returnStock,
        minStock: p.minStock,
        recipient: recipients.join(", "),
        status: sent > 0 ? "sent" : "failed",
      })),
    );

    return NextResponse.json({
      ok: sent > 0,
      sent,
      total: recipients.length,
      logged: lowStock.length,
      errors,
      smtpConfigured: true,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Gagal mengirim notifikasi" }, { status: 500 });
  }
}
