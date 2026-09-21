"use client";

import { useEffect, useState, useCallback } from "react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/lib/useAuth";

type OpnameRow = {
  id: number;
  periode: string;
  opnameDate: string;
  userName: string | null;
  status: string;
  note: string | null;
  itemCount: number;
  diffCount: number;
};

type OpnameItem = {
  id: number;
  productId: number;
  productSku: string | null;
  productName: string | null;
  systemNew: number;
  systemReturn: number;
  countedNew: number;
  countedReturn: number;
  diffNew: number;
  diffReturn: number;
  adjusted: boolean;
  note: string | null;
};

export default function OpnamePage() {
  const { isGuest, loading: authLoading } = useAuth();
  const [list, setList] = useState<OpnameRow[]>([]);
  const [detail, setDetail] = useState<{ opname: any; items: OpnameItem[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/opname");
      if (res.ok) {
        const d = await res.json();
        setList(d.opnames ?? []);
      } else if (res.status === 401) {
        setErr("Stock opname hanya untuk user yang login.");
      }
    } catch (e) {
      setErr("Gagal memuat data opname");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && !isGuest) load();
    else if (!authLoading && isGuest) setLoading(false);
  }, [authLoading, isGuest, load]);

  async function openDetail(id: number) {
    setMsg(null);
    setErr(null);
    const res = await fetch(`/api/opname?id=${id}`);
    if (res.ok) {
      const d = await res.json();
      setDetail(d);
    }
  }

  async function createOpname() {
    setCreating(true);
    setErr(null);
    setMsg(null);
    try {
      const res = await fetch("/api/opname", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const d = await res.json();
      if (!res.ok) {
        setErr(d.error ?? "Gagal membuat opname");
        return;
      }
      setMsg(`Stock opname dibuat dengan ${d.itemCount} produk.`);
      await load();
      if (d.opname?.id) await openDetail(d.opname.id);
    } finally {
      setCreating(false);
    }
  }

  function updateItem(idx: number, patch: Partial<OpnameItem>) {
    setDetail((prev) => {
      if (!prev) return prev;
      const items = [...prev.items];
      items[idx] = { ...items[idx], ...patch };
      return { ...prev, items };
    });
  }

  async function saveOpname(adjust: boolean) {
    if (!detail) return;
    setSaving(true);
    setErr(null);
    setMsg(null);
    try {
      const res = await fetch(`/api/opname?id=${detail.opname.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: detail.items.map((it) => ({
            itemId: it.id,
            countedNew: it.countedNew,
            countedReturn: it.countedReturn,
            note: it.note,
            adjust,
          })),
          status: adjust ? "adjusted" : "open",
        }),
      });
      const d = await res.json();
      if (!res.ok) {
        setErr(d.error ?? "Gagal menyimpan");
        return;
      }
      setMsg(
        adjust
          ? `Tersimpan. ${d.adjustedCount} produk dikoreksi stoknya sesuai hasil hitung fisik.`
          : "Hasil hitung fisik tersimpan (belum ada koreksi stok).",
      );
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function removeOpname(id: number) {
    if (!confirm("Hapus stock opname ini? Riwayat koreksi ikut hilang.")) return;
    const res = await fetch(`/api/opname?id=${id}`, { method: "DELETE" });
    if (res.ok) {
      setDetail(null);
      await load();
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
          <h1 className="text-2xl font-bold text-slate-900">Stock Opname</h1>
          <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-4 text-sm">
            <p className="font-semibold">Mode Pengunjung</p>
            <p className="mt-1">
              Stock opname hanya untuk user yang login.{" "}
              <a href="/login" className="font-semibold underline">
                Masuk di sini
              </a>
              .
            </p>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-slate-900">Stock Opname</h1>
            <p className="text-slate-500 text-sm mt-1">
              Hitung fisik stok tiap akhir bulan, bandingkan dengan stok sistem, lalu koreksi
            </p>
          </div>
          <button
            onClick={createOpname}
            disabled={creating}
            className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-semibold px-5 py-2.5 rounded-lg shadow-lg shadow-indigo-500/30 disabled:opacity-60"
          >
            {creating ? "Membuat..." : "+ Buat Opname Bulan Ini"}
          </button>
        </div>

        {err && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm">
            {err}
          </div>
        )}
        {msg && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl p-4 text-sm">
            {msg}
          </div>
        )}

        {/* Detail Opname */}
        {detail && (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-gradient-to-r from-indigo-50 to-purple-50">
              <div>
                <h2 className="font-bold text-slate-900">
                  Opname Periode {detail.opname.periode}
                </h2>
                <p className="text-xs text-slate-600 mt-0.5">
                  Dibuat {new Date(detail.opname.opnameDate).toLocaleString("id-ID")} oleh{" "}
                  {detail.opname.userName} · Status:{" "}
                  <span className="font-semibold">{detail.opname.status}</span>
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => saveOpname(false)}
                  disabled={saving}
                  className="px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 text-sm font-semibold hover:bg-slate-50 disabled:opacity-60"
                >
                  Simpan Hitungan
                </button>
                <button
                  onClick={() => {
                    if (
                      confirm(
                        "Koreksi stok sistem sesuai hasil hitung fisik untuk SEMUA produk yang ada selisihnya?",
                      )
                    )
                      saveOpname(true);
                  }}
                  disabled={saving}
                  className="px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold disabled:opacity-60"
                >
                  Koreksi Stok Sesuai Fisik
                </button>
                <button
                  onClick={() => setDetail(null)}
                  className="px-3 py-2 rounded-lg text-slate-600 hover:bg-slate-100 text-sm"
                >
                  Tutup
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-600 text-xs uppercase">
                  <tr>
                    <th className="px-3 py-3 text-left">SKU</th>
                    <th className="px-3 py-3 text-left">Produk</th>
                    <th className="px-3 py-3 text-center">Sistem (Baru)</th>
                    <th className="px-3 py-3 text-center">Fisik (Baru)</th>
                    <th className="px-3 py-3 text-center">Selisih</th>
                    <th className="px-3 py-3 text-center">Sistem (Retur)</th>
                    <th className="px-3 py-3 text-center">Fisik (Retur)</th>
                    <th className="px-3 py-3 text-center">Selisih</th>
                    <th className="px-3 py-3 text-left">Catatan</th>
                    <th className="px-3 py-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {detail.items.map((it, idx) => {
                    const hasDiff = it.diffNew !== 0 || it.diffReturn !== 0;
                    return (
                      <tr
                        key={it.id}
                        className={hasDiff ? "bg-amber-50/60" : "hover:bg-slate-50"}
                      >
                        <td className="px-3 py-2 font-mono text-xs">{it.productSku}</td>
                        <td className="px-3 py-2 font-medium">{it.productName}</td>
                        <td className="px-3 py-2 text-center text-slate-600">
                          {it.systemNew}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <input
                            type="number"
                            min={0}
                            value={it.countedNew}
                            onChange={(e) =>
                              updateItem(idx, { countedNew: Number(e.target.value) })
                            }
                            className="w-20 px-2 py-1 border border-slate-300 rounded text-center focus:ring-2 focus:ring-indigo-500 outline-none"
                          />
                        </td>
                        <td
                          className={`px-3 py-2 text-center font-bold ${
                            it.diffNew === 0
                              ? "text-slate-400"
                              : it.diffNew > 0
                              ? "text-emerald-600"
                              : "text-red-600"
                          }`}
                        >
                          {it.diffNew > 0 ? "+" : ""}
                          {it.diffNew}
                        </td>
                        <td className="px-3 py-2 text-center text-slate-600">
                          {it.systemReturn}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <input
                            type="number"
                            min={0}
                            value={it.countedReturn}
                            onChange={(e) =>
                              updateItem(idx, { countedReturn: Number(e.target.value) })
                            }
                            className="w-20 px-2 py-1 border border-slate-300 rounded text-center focus:ring-2 focus:ring-indigo-500 outline-none"
                          />
                        </td>
                        <td
                          className={`px-3 py-2 text-center font-bold ${
                            it.diffReturn === 0
                              ? "text-slate-400"
                              : it.diffReturn > 0
                              ? "text-emerald-600"
                              : "text-red-600"
                          }`}
                        >
                          {it.diffReturn > 0 ? "+" : ""}
                          {it.diffReturn}
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            value={it.note ?? ""}
                            onChange={(e) => updateItem(idx, { note: e.target.value })}
                            placeholder="alasan selisih..."
                            className="w-36 px-2 py-1 border border-slate-300 rounded text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
                          />
                        </td>
                        <td className="px-3 py-2 text-center">
                          {it.adjusted ? (
                            <span className="text-xs font-semibold bg-emerald-100 text-emerald-700 px-2 py-1 rounded">
                              Dikoreksi
                            </span>
                          ) : hasDiff ? (
                            <span className="text-xs font-semibold bg-amber-100 text-amber-700 px-2 py-1 rounded">
                              Selisih
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400">Cocok</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 text-xs text-slate-600">
              Baris kuning = ada selisih antara stok sistem & hasil hitung fisik. Klik
              "Koreksi Stok Sesuai Fisik" untuk menyetel ulang stok sistem.
            </div>
          </div>
        )}

        {/* Daftar Opname */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200">
            <h2 className="font-bold text-slate-900">Riwayat Stock Opname</h2>
          </div>
          {loading ? (
            <div className="p-12 text-center text-slate-500">Memuat...</div>
          ) : list.length === 0 ? (
            <div className="p-12 text-center">
              <p className="font-semibold text-slate-700">Belum ada stock opname</p>
              <p className="text-sm text-slate-500 mt-1">
                Klik "Buat Opname Bulan Ini" untuk memulai penghitungan fisik
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-600 text-xs uppercase">
                  <tr>
                    <th className="px-4 py-3 text-left">Periode</th>
                    <th className="px-4 py-3 text-left">Tanggal</th>
                    <th className="px-4 py-3 text-left">Oleh</th>
                    <th className="px-4 py-3 text-right">Jumlah Produk</th>
                    <th className="px-4 py-3 text-right">Ada Selisih</th>
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {list.map((o) => (
                    <tr key={o.id} className="hover:bg-slate-50">
                      <td className="px-4 py-2.5 font-semibold">{o.periode}</td>
                      <td className="px-4 py-2.5 text-xs">
                        {new Date(o.opnameDate).toLocaleDateString("id-ID")}
                      </td>
                      <td className="px-4 py-2.5 text-xs">{o.userName ?? "-"}</td>
                      <td className="px-4 py-2.5 text-right">{o.itemCount}</td>
                      <td className="px-4 py-2.5 text-right">
                        {o.diffCount > 0 ? (
                          <span className="font-bold text-amber-600">{o.diffCount}</span>
                        ) : (
                          <span className="text-slate-400">0</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <span
                          className={`text-xs font-semibold px-2 py-1 rounded ${
                            o.status === "adjusted"
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {o.status}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right whitespace-nowrap">
                        <button
                          onClick={() => openDetail(o.id)}
                          className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 mr-3"
                        >
                          Buka
                        </button>
                        <button
                          onClick={() => removeOpname(o.id)}
                          className="text-xs font-semibold text-red-600 hover:text-red-700"
                        >
                          Hapus
                        </button>
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
