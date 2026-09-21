"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { downloadCSV } from "@/lib/export";

type ReportType = "in" | "out" | "product" | "movement" | "store" | "top";

type ReportRow = {
  id?: number;
  date?: string;
  type?: string;
  source?: string;
  totalQty?: number;
  txCount?: number;
  productId?: number;
  productName?: string;
  productSku?: string;
  unit?: string;
  totalOut?: number;
  storeName?: string | null;
  uniqueProducts?: number;
  createdAt?: string;
  ticketNo?: string | null;
  quantity?: number;
  serialNumbers?: string[];
  barcodes?: string[];
  assetStatus?: string | null;
  note?: string | null;
  userName?: string;
};

const REPORT_OPTIONS: { value: ReportType; label: string }[] = [
  { value: "in", label: "Barang Masuk" },
  { value: "out", label: "Barang Keluar" },
  { value: "product", label: "Total Masuk & Keluar per Produk" },
  { value: "movement", label: "Pergerakan Stok (Harian)" },
  { value: "store", label: "Per Gerai" },
  { value: "top", label: "Top Products (Fast Moving)" },
];

function formatNumber(n: number) {
  return n.toLocaleString("id-ID");
}

function formatDate(d: string) {
  return new Date(d).toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ReportsPage() {
  const [reportType, setReportType] = useState<ReportType>("in");
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");
  const [data, setData] = useState<ReportRow[]>([]);
  const [totalQty, setTotalQty] = useState<number>(0);
  const [totalIn, setTotalIn] = useState<number>(0);
  const [totalOut, setTotalOut] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setFetchError(null);
    try {
      const params = new URLSearchParams({ type: reportType });
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      const res = await fetch(`/api/reports?${params}`);
      const json = await res.json();
      if (!res.ok) {
        setFetchError(json?.error ?? "Gagal memuat laporan");
        setData([]);
        setTotalQty(0);
        return;
      }
      setData(json.data ?? []);
      setTotalQty(json.totalQty ?? 0);
      setTotalIn(json.totalIn ?? 0);
      setTotalOut(json.totalOut ?? 0);
    } catch (err) {
      console.error(err);
      setFetchError("Koneksi ke server terputus. Silakan muat ulang halaman.");
      setData([]);
      setTotalQty(0);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportType, from, to]);

  function handleExport() {
    if (data.length === 0) {
      alert("Tidak ada data untuk di-export");
      return;
    }
    const filename = `laporan-${reportType}-${new Date().toISOString().slice(0, 10)}.csv`;

    if (reportType === "in" || reportType === "out") {
      downloadCSV(
        filename,
        data.map((d) => ({
          Tanggal: formatDate(d.createdAt ?? ""),
          [reportType === "in" ? "No PO" : "No Ticket"]: d.ticketNo ?? "",
          Produk: d.productName,
          SKU: d.productSku,
          Sumber: d.source === "new" ? "Baru" : "Retur",
          Jumlah: `${d.quantity} ${d.unit}`,
          "Serial Number": (d.serialNumbers ?? []).join(" | "),
          Barcode: (d.barcodes ?? []).join(" | "),
          "Status Asset": d.assetStatus ?? "",
          Gerai: d.storeName ?? "",
          Catatan: d.note ?? "",
          Oleh: d.userName ?? "",
        })),
      );
    } else if (reportType === "product") {
      downloadCSV(
        filename,
        data.map((d: any) => ({
          SKU: d.productSku,
          "Nama Produk": d.productName,
          Satuan: d.unit,
          "Total Masuk": d.totalIn,
          "Total Keluar": d.totalOut,
          "Stok Baru Sekarang": d.currentNewStock,
          "Stok Retur Sekarang": d.currentReturnStock,
          "Total Stok Sekarang": d.currentTotalStock,
          "Jumlah Transaksi": d.txCount,
        })),
      );
    } else if (reportType === "movement") {
      downloadCSV(
        filename,
        data.map((d) => ({
          Tanggal: d.date,
          Tipe: d.type === "in" ? "Masuk" : "Keluar",
          Sumber: d.source === "new" ? "Baru" : "Retur",
          "Total Jumlah": d.totalQty,
          "Jumlah Transaksi": d.txCount,
        })),
      );
    } else if (reportType === "store") {
      downloadCSV(
        filename,
        data.map((d) => ({
          "Nama Gerai": d.storeName ?? "(Tanpa Gerai)",
          "Total Keluar": d.totalQty,
          "Jumlah Transaksi": d.txCount,
          "Produk Unik": d.uniqueProducts,
        })),
      );
    } else if (reportType === "top") {
      downloadCSV(
        filename,
        data.map((d) => ({
          SKU: d.productSku,
          "Nama Produk": d.productName,
          Satuan: d.unit,
          "Total Keluar": d.totalOut,
          "Jumlah Transaksi": d.txCount,
        })),
      );
    }
  }

  function handlePrint() {
    window.print();
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-slate-900">Laporan</h1>
            <p className="text-slate-500 text-sm mt-1">
              Laporan transaksi barang masuk, keluar, dan analisis stok
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleExport}
              disabled={data.length === 0}
              className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold px-4 py-2 rounded-lg flex items-center gap-2 text-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              Export CSV
            </button>
            <button
              onClick={handlePrint}
              className="bg-slate-700 hover:bg-slate-800 text-white font-semibold px-4 py-2 rounded-lg flex items-center gap-2 text-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              Print PDF
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 print:hidden">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Jenis Laporan
              </label>
              <select
                value={reportType}
                onChange={(e) => setReportType(e.target.value as ReportType)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
              >
                {REPORT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Dari Tanggal
              </label>
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Sampai Tanggal
              </label>
              <input
                type="date"
                value={to}
                min={from || undefined}
                onChange={(e) => setTo(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button
              onClick={() => {
                const today = new Date();
                setFrom(today.toISOString().slice(0, 10));
                setTo(today.toISOString().slice(0, 10));
              }}
              className="text-xs px-3 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700"
            >
              Hari Ini
            </button>
            <button
              onClick={() => {
                const today = new Date();
                const week = new Date(today);
                week.setDate(week.getDate() - 7);
                setFrom(week.toISOString().slice(0, 10));
                setTo(today.toISOString().slice(0, 10));
              }}
              className="text-xs px-3 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700"
            >
              7 Hari Terakhir
            </button>
            <button
              onClick={() => {
                const today = new Date();
                const month = new Date(today);
                month.setMonth(month.getMonth() - 1);
                setFrom(month.toISOString().slice(0, 10));
                setTo(today.toISOString().slice(0, 10));
              }}
              className="text-xs px-3 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700"
            >
              30 Hari Terakhir
            </button>
            <button
              onClick={() => {
                setFrom("");
                setTo("");
              }}
              className="text-xs px-3 py-1 rounded-md bg-red-50 hover:bg-red-100 text-red-700"
            >
              Reset
            </button>
          </div>
        </div>

        {/* Report Content (printable) */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden print:border-0 print:shadow-none">
          <div className="px-5 py-4 border-b border-slate-200 print:border-b-2 print:border-black">
            <h2 className="font-bold text-slate-900 text-lg">
              {reportType === "in" && "Laporan Detail Barang Masuk"}
              {reportType === "product" && "Laporan Total Masuk & Keluar per Produk"}
              {reportType === "out" && "Laporan Detail Barang Keluar"}
              {reportType === "movement" && "Laporan Pergerakan Stok Harian"}
              {reportType === "store" && "Laporan Barang Keluar per Gerai"}
              {reportType === "top" && "Laporan Top Products (Fast Moving)"}
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Periode: {from || "Semua"} — {to || "Sekarang"} · Dicetak:{" "}
              {new Date().toLocaleString("id-ID")}
            </p>
          </div>

          {/* Summary cards untuk laporan detail masuk/keluar */}
          {((reportType === "in" || reportType === "out" || reportType === "product")) && !loading && !fetchError && (
            <div className="grid grid-cols-2 gap-3 p-4 bg-slate-50 border-b border-slate-200 print:bg-white">
              <div className="bg-white rounded-lg border border-slate-200 p-3">
                <p className="text-xs text-slate-500">Total Transaksi</p>
                <p className="text-2xl font-bold text-slate-900">
                  {formatNumber(data.length)}
                </p>
              </div>
              <div className="bg-white rounded-lg border border-slate-200 p-3">
                <p className="text-xs text-slate-500">
                  Total {reportType === "in" ? "Masuk" : "Keluar"}
                </p>
                <p
                  className={`text-2xl font-bold ${
                    reportType === "in" ? "text-emerald-600" : "text-red-600"
                  }`}
                >
                  {formatNumber(totalQty)}
                </p>
              </div>
            </div>
          )}

          {loading ? (
            <div className="p-12 text-center text-slate-500">Memuat data...</div>
          ) : fetchError ? (
            <div className="p-12 text-center">
              <div className="w-16 h-16 mx-auto rounded-full bg-red-50 flex items-center justify-center mb-3">
                <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
              </div>
              <p className="font-semibold text-red-700">Terjadi Kesalahan</p>
              <p className="text-sm text-slate-600 mt-1">{fetchError}</p>
              <button
                onClick={load}
                className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg text-sm"
              >
                Coba Lagi
              </button>
            </div>
          ) : data.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-slate-500">Tidak ada data untuk periode ini</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              {/* Detail Barang Masuk */}
              {reportType === "in" && (
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-slate-600 text-xs uppercase">
                    <tr>
                      <th className="px-4 py-3 text-left">Tanggal</th>
                      <th className="px-4 py-3 text-left">No PO</th>
                      <th className="px-4 py-3 text-left">Produk</th>
                      <th className="px-4 py-3 text-left">Sumber</th>
                      <th className="px-4 py-3 text-right">Jumlah</th>
                      <th className="px-4 py-3 text-left">SN / Barcode</th>
                      <th className="px-4 py-3 text-left">Status Asset</th>
                      <th className="px-4 py-3 text-left">Catatan</th>
                      <th className="px-4 py-3 text-left">Oleh</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.map((d, idx) => (
                      <tr key={d.id ?? idx} className="hover:bg-slate-50">
                        <td className="px-4 py-2.5 text-xs whitespace-nowrap">
                          {formatDate(d.createdAt ?? "")}
                        </td>
                        <td className="px-4 py-2.5 font-mono text-xs">
                          {d.ticketNo || "-"}
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="font-semibold">{d.productName}</div>
                          <div className="text-xs text-slate-500 font-mono">
                            {d.productSku}
                          </div>
                        </td>
                        <td className="px-4 py-2.5">
                          <span
                            className={`text-xs font-semibold px-2 py-1 rounded-md ${
                              d.source === "new"
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-amber-50 text-amber-700"
                            }`}
                          >
                            {d.source === "new" ? "Baru" : "Retur"}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right font-bold text-emerald-600">
                          +{formatNumber(d.quantity ?? 0)} {d.unit}
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="max-h-16 overflow-y-auto">
                            {(d.serialNumbers ?? []).map((sn, i) => (
                              <div key={i} className="font-mono text-[10px] text-slate-600">
                                {sn}
                                {d.barcodes?.[i] ? ` / ${d.barcodes[i]}` : ""}
                              </div>
                            ))}
                            {(d.serialNumbers ?? []).length === 0 && (
                              <span className="text-slate-400 text-xs">-</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-2.5">
                          {d.assetStatus ? (
                            <span className="text-xs font-semibold bg-blue-50 text-blue-700 px-2 py-0.5 rounded">
                              {d.assetStatus}
                            </span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-xs max-w-[150px] truncate">
                          {d.note || <span className="text-slate-400">-</span>}
                        </td>
                        <td className="px-4 py-2.5 text-xs">{d.userName}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {/* Detail Barang Keluar */}
              {reportType === "out" && (
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-slate-600 text-xs uppercase">
                    <tr>
                      <th className="px-4 py-3 text-left">Tanggal</th>
                      <th className="px-4 py-3 text-left">No Ticket</th>
                      <th className="px-4 py-3 text-left">Produk</th>
                      <th className="px-4 py-3 text-left">Gerai</th>
                      <th className="px-4 py-3 text-left">Sumber</th>
                      <th className="px-4 py-3 text-right">Jumlah</th>
                      <th className="px-4 py-3 text-left">SN / Barcode</th>
                      <th className="px-4 py-3 text-left">Status Asset</th>
                      <th className="px-4 py-3 text-left">Catatan</th>
                      <th className="px-4 py-3 text-left">Oleh</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.map((d, idx) => (
                      <tr key={d.id ?? idx} className="hover:bg-slate-50">
                        <td className="px-4 py-2.5 text-xs whitespace-nowrap">
                          {formatDate(d.createdAt ?? "")}
                        </td>
                        <td className="px-4 py-2.5 font-mono text-xs">
                          {d.ticketNo || "-"}
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="font-semibold">{d.productName}</div>
                          <div className="text-xs text-slate-500 font-mono">
                            {d.productSku}
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-xs font-medium">
                          {d.storeName || "-"}
                        </td>
                        <td className="px-4 py-2.5">
                          <span
                            className={`text-xs font-semibold px-2 py-1 rounded-md ${
                              d.source === "new"
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-amber-50 text-amber-700"
                            }`}
                          >
                            {d.source === "new" ? "Baru" : "Retur"}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right font-bold text-red-600">
                          -{formatNumber(d.quantity ?? 0)} {d.unit}
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="max-h-16 overflow-y-auto">
                            {(d.serialNumbers ?? []).map((sn, i) => (
                              <div key={i} className="font-mono text-[10px] text-slate-600">
                                {sn}
                                {d.barcodes?.[i] ? ` / ${d.barcodes[i]}` : ""}
                              </div>
                            ))}
                            {(d.serialNumbers ?? []).length === 0 && (
                              <span className="text-slate-400 text-xs">-</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-2.5">
                          {d.assetStatus ? (
                            <span className="text-xs font-semibold bg-blue-50 text-blue-700 px-2 py-0.5 rounded">
                              {d.assetStatus}
                            </span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-xs max-w-[150px] truncate">
                          {d.note || <span className="text-slate-400">-</span>}
                        </td>
                        <td className="px-4 py-2.5 text-xs">{d.userName}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {/* Total Masuk & Keluar per Produk */}
              {reportType === "product" && (
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-slate-600 text-xs uppercase">
                    <tr>
                      <th className="px-4 py-3 text-left">#</th>
                      <th className="px-4 py-3 text-left">SKU</th>
                      <th className="px-4 py-3 text-left">Nama Produk</th>
                      <th className="px-4 py-3 text-right">Total Masuk</th>
                      <th className="px-4 py-3 text-right">Total Keluar</th>
                      <th className="px-4 py-3 text-right">Stok Sekarang</th>
                      <th className="px-4 py-3 text-right">Transaksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.map((d: any, idx: number) => {
                      const curr = d.currentNewStock + d.currentReturnStock;
                      return (
                        <tr key={d.productId} className="hover:bg-slate-50">
                          <td className="px-4 py-2.5 text-slate-500">{idx + 1}</td>
                          <td className="px-4 py-2.5 font-mono text-xs text-slate-600">
                            {d.productSku}
                          </td>
                          <td className="px-4 py-2.5 font-semibold">{d.productName}</td>
                          <td className="px-4 py-2.5 text-right font-bold text-emerald-600">
                            +{formatNumber(d.totalIn)} {d.unit}
                          </td>
                          <td className="px-4 py-2.5 text-right font-bold text-red-600">
                            -{formatNumber(d.totalOut)} {d.unit}
                          </td>
                          <td className="px-4 py-2.5 text-right font-bold text-slate-900">
                            {formatNumber(curr)} {d.unit}
                            <div className="text-[10px] text-slate-500 font-normal">
                              Baru: {d.currentNewStock} / Retur: {d.currentReturnStock}
                            </div>
                          </td>
                          <td className="px-4 py-2.5 text-right text-slate-600">
                            {formatNumber(d.txCount)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}

              {/* Pergerakan Stok Harian */}
              {reportType === "movement" && (
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-slate-600 text-xs uppercase">
                    <tr>
                      <th className="px-5 py-3 text-left">Tanggal</th>
                      <th className="px-5 py-3 text-left">Tipe</th>
                      <th className="px-5 py-3 text-left">Sumber</th>
                      <th className="px-5 py-3 text-right">Total Jumlah</th>
                      <th className="px-5 py-3 text-right">Jumlah Transaksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.map((d, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="px-5 py-2.5">{d.date}</td>
                        <td className="px-5 py-2.5">
                          <span
                            className={`text-xs font-semibold px-2 py-1 rounded-md ${
                              d.type === "in"
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-red-100 text-red-700"
                            }`}
                          >
                            {d.type === "in" ? "↓ Masuk" : "↑ Keluar"}
                          </span>
                        </td>
                        <td className="px-5 py-2.5">
                          <span
                            className={`text-xs font-semibold px-2 py-1 rounded-md ${
                              d.source === "new"
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-amber-50 text-amber-700"
                            }`}
                          >
                            {d.source === "new" ? "Baru" : "Retur"}
                          </span>
                        </td>
                        <td className="px-5 py-2.5 text-right font-bold">
                          {formatNumber(d.totalQty ?? 0)}
                        </td>
                        <td className="px-5 py-2.5 text-right text-slate-600">
                          {formatNumber(d.txCount ?? 0)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {/* Per Gerai */}
              {reportType === "store" && (
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-slate-600 text-xs uppercase">
                    <tr>
                      <th className="px-5 py-3 text-left">#</th>
                      <th className="px-5 py-3 text-left">Nama Gerai</th>
                      <th className="px-5 py-3 text-right">Total Keluar</th>
                      <th className="px-5 py-3 text-right">Jumlah Transaksi</th>
                      <th className="px-5 py-3 text-right">Produk Unik</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.map((d, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="px-5 py-2.5 text-slate-500">{idx + 1}</td>
                        <td className="px-5 py-2.5 font-semibold">
                          {d.storeName ?? "(Tanpa Gerai)"}
                        </td>
                        <td className="px-5 py-2.5 text-right font-bold text-red-600">
                          {formatNumber(d.totalQty ?? 0)}
                        </td>
                        <td className="px-5 py-2.5 text-right text-slate-600">
                          {formatNumber(d.txCount ?? 0)}
                        </td>
                        <td className="px-5 py-2.5 text-right text-slate-600">
                          {formatNumber(d.uniqueProducts ?? 0)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {/* Top Products */}
              {reportType === "top" && (
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-slate-600 text-xs uppercase">
                    <tr>
                      <th className="px-5 py-3 text-left">Rank</th>
                      <th className="px-5 py-3 text-left">SKU</th>
                      <th className="px-5 py-3 text-left">Nama Produk</th>
                      <th className="px-5 py-3 text-right">Total Keluar</th>
                      <th className="px-5 py-3 text-right">Transaksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.map((d, idx) => (
                      <tr key={d.productId ?? idx} className="hover:bg-slate-50">
                        <td className="px-5 py-2.5">
                          <div
                            className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                              idx === 0
                                ? "bg-gradient-to-br from-yellow-400 to-orange-500 text-white"
                                : idx === 1
                                ? "bg-gradient-to-br from-slate-300 to-slate-400 text-white"
                                : idx === 2
                                ? "bg-gradient-to-br from-amber-600 to-amber-700 text-white"
                                : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {idx + 1}
                          </div>
                        </td>
                        <td className="px-5 py-2.5 font-mono text-xs text-slate-600">
                          {d.productSku}
                        </td>
                        <td className="px-5 py-2.5 font-semibold">{d.productName}</td>
                        <td className="px-5 py-2.5 text-right font-bold text-red-600">
                          {formatNumber(d.totalOut ?? 0)} {d.unit}
                        </td>
                        <td className="px-5 py-2.5 text-right text-slate-600">
                          {formatNumber(d.txCount ?? 0)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {data.length > 0 && (
            <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 text-xs text-slate-600">
              Total: {data.length} baris data
              {totalQty > 0 && (
                <span className="ml-2 font-semibold">
                  · Total {reportType === "in" ? "masuk" : "keluar"}:{" "}
                  {formatNumber(totalQty)}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
