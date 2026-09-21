"use client";

import { useEffect, useState, useCallback, FormEvent } from "react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/lib/useAuth";

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

type AlertHistory = {
  id: number;
  productSku: string | null;
  productName: string | null;
  currentTotal: number;
  minStock: number;
  recipient: string | null;
  sentAt: string;
  status: string;
};

export default function StockAlertsPage() {
  const { isGuest, loading: authLoading } = useAuth();
  const [low, setLow] = useState<LowItem[]>([]);
  const [history, setHistory] = useState<AlertHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [recipients, setRecipients] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [smtp, setSmtp] = useState<boolean | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/stock-alerts");
      const d = await res.json();
      if (res.ok) {
        setLow(d.lowStock ?? []);
        setHistory(d.history ?? []);
        setSmtp(d.smtpConfigured ?? false);
      } else {
        setErr(d.error ?? "Gagal memuat");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && !isGuest) load();
    else if (!authLoading && isGuest) setLoading(false);
  }, [authLoading, isGuest, load]);

  async function send(e: FormEvent) {
    e.preventDefault();
    setSending(true);
    setErr(null);
    setMsg(null);
    try {
      const res = await fetch("/api/stock-alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipients }),
      });
      const d = await res.json();
      if (!res.ok) {
        setErr(d.error ?? "Gagal mengirim");
        return;
      }
      setMsg(d.message ?? `Notifikasi terkirim ke ${d.sent} email.`);
      await load();
    } finally {
      setSending(false);
    }
  }

  if (authLoading) {
    return (
      <AppShell>
        <div className="p-12 text-center text-slate-500">Memuat...</div>
      </AppShell>
    );
  }

  if (isGuest) {
    return (
      <AppShell>
        <div className="max-w-2xl space-y-4">
          <h1 className="text-2xl font-bold text-slate-900">Notifikasi Stok Menipis</h1>
          <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-4 text-sm">
            <p className="font-semibold">Mode Pengunjung</p>
            <p className="mt-1">
              Notifikasi stok hanya untuk user yang login.{" "}
              <a href="/login" className="font-semibold underline">Masuk di sini</a>.
            </p>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-slate-900">
            Notifikasi Stok Menipis
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Kirim peringatan email untuk produk yang stoknya mencapai/di bawah batas minimum
          </p>
        </div>

        {!smtp && (
          <div className="bg-blue-50 border border-blue-200 text-blue-800 rounded-xl p-4 text-sm">
            <p className="font-semibold">Email server belum dikonfigurasi</p>
            <p className="mt-1">
              Untuk mengirim email nyata, tambahkan 2 Environment Variables di Vercel:
            </p>
            <ul className="list-disc ml-5 mt-1 font-mono text-xs">
              <li>RESEND_API_KEY (gratis di resend.com)</li>
              <li>EMAIL_FROM (contoh: GudangPro &lt;noreply@domainanda.com&gt;)</li>
            </ul>
            <p className="mt-1">
              Sementara ini tombol kirim akan mencatat notifikasi sebagai{" "}
              <b>pending</b> (riwayat tetap tampil di bawah).
            </p>
          </div>
        )}

        {/* Form kirim */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="font-bold text-slate-900 mb-3">Kirim Notifikasi Email</h2>
          <form onSubmit={send} className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Email Tujuan <span className="text-slate-400 font-normal">(pisahkan dengan koma)</span>
              </label>
              <input
                type="text"
                value={recipients}
                onChange={(e) => setRecipients(e.target.value)}
                placeholder="gudang@perusahaan.com, manager@perusahaan.com"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
              />
              <p className="text-xs text-slate-500 mt-1">
                Kosongkan untuk mengirim ke email akun Anda sendiri.
              </p>
            </div>
            <button
              type="submit"
              disabled={sending || low.length === 0}
              className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 text-white font-semibold px-5 py-2.5 rounded-lg"
            >
              {sending
                ? "Mengirim..."
                : low.length === 0
                ? "Tidak Ada Stok Menipis"
                : `Kirim Notifikasi (${low.length} produk menipis)`}
            </button>
          </form>
          {err && (
            <div className="mt-3 bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">
              {err}
            </div>
          )}
          {msg && (
            <div className="mt-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg p-3 text-sm">
              {msg}
            </div>
          )}
        </div>

        {/* Produk stok menipis */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200">
            <h2 className="font-bold text-slate-900">
              Produk Stok Menipis ({low.length})
            </h2>
          </div>
          {loading ? (
            <div className="p-12 text-center text-slate-500">Memuat...</div>
          ) : low.length === 0 ? (
            <div className="p-12 text-center text-slate-500 text-sm">
              Semua stok aman. Tidak ada produk di bawah batas minimum.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-600 text-xs uppercase">
                  <tr>
                    <th className="px-4 py-3 text-left">SKU</th>
                    <th className="px-4 py-3 text-left">Nama Produk</th>
                    <th className="px-4 py-3 text-right">Stok Baru</th>
                    <th className="px-4 py-3 text-right">Stok Retur</th>
                    <th className="px-4 py-3 text-right">Total</th>
                    <th className="px-4 py-3 text-right">Minimum</th>
                    <th className="px-4 py-3 text-left">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {low.map((p) => {
                    const habis = p.total === 0;
                    return (
                      <tr key={p.id} className={habis ? "bg-red-50/60" : "bg-amber-50/40"}>
                        <td className="px-4 py-2.5 font-mono text-xs">{p.sku}</td>
                        <td className="px-4 py-2.5 font-medium">{p.name}</td>
                        <td className="px-4 py-2.5 text-right text-emerald-600 font-semibold">
                          {p.newStock}
                        </td>
                        <td className="px-4 py-2.5 text-right text-amber-600 font-semibold">
                          {p.returnStock}
                        </td>
                        <td
                          className={`px-4 py-2.5 text-right font-bold ${
                            habis ? "text-red-600" : "text-amber-600"
                          }`}
                        >
                          {p.total} {p.unit}
                        </td>
                        <td className="px-4 py-2.5 text-right text-slate-500">
                          {p.minStock} {p.unit}
                        </td>
                        <td className="px-4 py-2.5">
                          {habis ? (
                            <span className="text-xs font-bold bg-red-600 text-white px-2 py-1 rounded">
                              Habis
                            </span>
                          ) : (
                            <span className="text-xs font-semibold bg-amber-100 text-amber-700 px-2 py-1 rounded">
                              Menipis
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Riwayat kirim */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200">
            <h2 className="font-bold text-slate-900">Riwayat Notifikasi</h2>
          </div>
          {history.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-sm">
              Belum ada riwayat pengiriman notifikasi
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-600 text-xs uppercase">
                  <tr>
                    <th className="px-4 py-3 text-left">Waktu</th>
                    <th className="px-4 py-3 text-left">SKU</th>
                    <th className="px-4 py-3 text-left">Produk</th>
                    <th className="px-4 py-3 text-right">Stok</th>
                    <th className="px-4 py-3 text-right">Min</th>
                    <th className="px-4 py-3 text-left">Tujuan</th>
                    <th className="px-4 py-3 text-left">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {history.map((h) => (
                    <tr key={h.id} className="hover:bg-slate-50">
                      <td className="px-4 py-2.5 text-xs whitespace-nowrap">
                        {new Date(h.sentAt).toLocaleString("id-ID")}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs">{h.productSku}</td>
                      <td className="px-4 py-2.5">{h.productName}</td>
                      <td className="px-4 py-2.5 text-right font-bold">{h.currentTotal}</td>
                      <td className="px-4 py-2.5 text-right text-slate-500">{h.minStock}</td>
                      <td className="px-4 py-2.5 text-xs text-slate-600 max-w-[200px] truncate">
                        {h.recipient ?? "-"}
                      </td>
                      <td className="px-4 py-2.5">
                        <span
                          className={`text-xs font-semibold px-2 py-1 rounded ${
                            h.status === "sent"
                              ? "bg-emerald-100 text-emerald-700"
                              : h.status === "failed"
                              ? "bg-red-100 text-red-700"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {h.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
