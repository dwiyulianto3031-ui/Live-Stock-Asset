// ====== Konfigurasi & pengiriman email stok menipis ======

export type LowStockItem = {
  sku: string;
  name: string;
  unit: string;
  total: number;
  minStock: number;
  newStock: number;
  returnStock: number;
};

const BRAND = process.env.BRAND_NAME ?? "LIVE STOCK ASSET";

export function getEmailFrom(): string {
  return process.env.EMAIL_FROM ?? `${BRAND} <onboarding@resend.dev>`;
}

export function getAdminRecipients(): string[] {
  const raw = process.env.ALERT_EMAIL_TO ?? "";
  return raw
    .split(/[,\n;]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function isSmtpConfigured(): boolean {
  return !!process.env.RESEND_API_KEY;
}

export function buildLowStockEmail(items: LowStockItem[]) {
  const habis = items.filter((i) => i.total === 0);
  const menipis = items.filter((i) => i.total > 0);

  const rows = items
    .map((p) => {
      const status = p.total === 0 ? "HABIS" : "MENIPIS";
      const color = p.total === 0 ? "#dc2626" : "#d97706";
      return `<tr>
        <td style="padding:8px 12px;border:1px solid #e2e8f0;font-family:monospace;font-size:12px">${p.sku}</td>
        <td style="padding:8px 12px;border:1px solid #e2e8f0">${p.name}</td>
        <td style="padding:8px 12px;border:1px solid #e2e8f0;text-align:center">${p.newStock}</td>
        <td style="padding:8px 12px;border:1px solid #e2e8f0;text-align:center">${p.returnStock}</td>
        <td style="padding:8px 12px;border:1px solid #e2e8f0;text-align:right;font-weight:700;color:${color}">${p.total} ${p.unit}</td>
        <td style="padding:8px 12px;border:1px solid #e2e8f0;text-align:right;color:#64748b">${p.minStock} ${p.unit}</td>
        <td style="padding:8px 12px;border:1px solid #e2e8f0;text-align:center;font-weight:700;color:${color}">${status}</td>
      </tr>`;
    })
    .join("");

  const html = `
  <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:680px;margin:0 auto;background:#f8fafc;padding:24px">
    <div style="background:linear-gradient(135deg,#6366f1,#8b5cf6 50%,#ec4899);border-radius:14px;padding:20px 24px;color:#fff">
      <div style="font-size:20px;font-weight:800;letter-spacing:.5px">${BRAND}</div>
      <div style="font-size:11px;letter-spacing:3px;opacity:.85;text-transform:uppercase">Asset Management System</div>
    </div>

    <div style="background:#fff;border-radius:14px;margin-top:14px;padding:24px;border:1px solid #e2e8f0">
      <h2 style="margin:0 0 6px;color:#b91c1c;display:flex;align-items:center;gap:8px">
        ⚠️ Peringatan Stok ${habis.length ? "Habis" : ""}${habis.length && menipis.length ? " / " : ""}${menipis.length ? "Menipis" : ""}
      </h2>
      <p style="margin:0 0 16px;color:#475569;font-size:14px">
        Terdeteksi <b>${items.length} produk</b> dengan stok mencapai / di bawah batas minimum.
        Mohon segera lakukan restock.
      </p>

      ${habis.length ? `<div style="background:#fef2f2;border:1px solid #fecaca;color:#991b1b;border-radius:10px;padding:10px 14px;font-size:13px;margin-bottom:12px">
        <b>${habis.length} produk HABIS</b> — stok nol, tidak bisa melayani pengeluaran.
      </div>` : ""}

      <table style="border-collapse:collapse;width:100%;font-size:13px">
        <thead>
          <tr style="background:#f1f5f9">
            <th style="padding:8px 12px;border:1px solid #e2e8f0;text-align:left">SKU</th>
            <th style="padding:8px 12px;border:1px solid #e2e8f0;text-align:left">Nama Produk</th>
            <th style="padding:8px 12px;border:1px solid #e2e8f0">Baru</th>
            <th style="padding:8px 12px;border:1px solid #e2e8f0">Retur</th>
            <th style="padding:8px 12px;border:1px solid #e2e8f0">Total</th>
            <th style="padding:8px 12px;border:1px solid #e2e8f0">Minimum</th>
            <th style="padding:8px 12px;border:1px solid #e2e8f0">Status</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>

      <div style="margin-top:18px">
        <a href="${process.env.APP_URL ?? "#"}"
           style="display:inline-block;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;text-decoration:none;
                  padding:10px 20px;border-radius:10px;font-weight:700;font-size:14px">
          Buka ${BRAND}
        </a>
      </div>
    </div>

    <p style="text-align:center;color:#94a3b8;font-size:11px;margin-top:14px">
      Email otomatis dari ${BRAND} · ${new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })} WIB
    </p>
  </div>`;

  const subject = `[${BRAND}] Peringatan Stok Menipis — ${items.length} produk (${habis.length} habis)`;

  return { subject, html };
}

// Kirim email via Resend API
export async function sendEmail(
  to: string[],
  subject: string,
  html: string,
): Promise<{ sent: number; errors: string[] }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = getEmailFrom();
  const errors: string[] = [];
  let sent = 0;

  if (!apiKey) {
    return { sent: 0, errors: ["RESEND_API_KEY belum dikonfigurasi"] };
  }

  for (const toAddr of to) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ from, to: toAddr, subject, html }),
      });
      if (res.ok) {
        sent++;
      } else {
        const t = await res.text();
        errors.push(`${toAddr}: ${t.slice(0, 120)}`);
      }
    } catch (e: any) {
      errors.push(`${toAddr}: ${String(e?.message ?? e).slice(0, 120)}`);
    }
  }

  return { sent, errors };
}
