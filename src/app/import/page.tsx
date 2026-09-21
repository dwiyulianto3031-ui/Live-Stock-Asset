"use client";

import { useState, useRef } from "react";
import { AppShell } from "@/components/AppShell";
import * as XLSX from "xlsx";
import { useAuth } from "@/lib/useAuth";

type ImportResult = {
  row: number;
  sku: string;
  status: "success" | "created" | "skipped" | "error";
  message?: string;
};

const PRODUCT_COLS = [
  { key: "sku", label: "sku", required: "Ya", desc: "Kode unik produk" },
  { key: "name", label: "name", required: "Ya", desc: "Nama produk" },
  { key: "unit", label: "unit", required: "-", desc: "Satuan (default: pcs)" },
  { key: "brand", label: "brand", required: "-", desc: "Merk (opsional)" },
  { key: "model", label: "model", required: "-", desc: "Tipe (opsional)" },
  { key: "minStock", label: "minStock", required: "-", desc: "Stok minimum (default: 10)" },
  { key: "newStock", label: "newStock", required: "-", desc: "Stok awal - Baru (default: 0)" },
  { key: "returnStock", label: "returnStock", required: "-", desc: "Stok awal - Retur (default: 0)" },
];

const MOVEMENT_COLS = [
  { label: "Aksi (Masuk/Keluar)", required: "Ya", desc: "Masuk atau Keluar" },
  { label: "Tanggal", required: "Ya", desc: "YYYY-MM-DD (default: hari ini)" },
  { label: "SKU", required: "Ya", desc: "SKU produk yang sudah terdaftar" },
  { label: "Jumlah", required: "Ya", desc: "Jumlah unit" },
  { label: "Sumber (Baru/Retur)", required: "-", desc: "default: Baru" },
  { label: "No PO / No Ticket", required: "-", desc: "No PO (masuk) / No Ticket (keluar)" },
  { label: "Nama Gerai", required: "-", desc: "Wajib untuk barang keluar" },
  { label: "Resi", required: "-", desc: "Bisa banyak, pisahkan dengan | atau baris baru" },
  { label: "Link Drive", required: "-", desc: "Link bukti serah terima" },
  { label: "Tipe Barang", required: "-", desc: "Kategori barang (opsional)" },
  { label: "Serial Number", required: "-", desc: "Bisa banyak, pisahkan dengan | atau baris baru" },
  { label: "Barcode", required: "-", desc: "Bisa banyak, pisahkan dengan | atau baris baru" },
  { label: "Status Asset", required: "-", desc: "Baik / Rusak / Service (default: Baik)" },
  { label: "Catatan", required: "-", desc: "Catatan transaksi" },
];

export default function ImportPage() {
  const { isGuest } = useAuth();
  const [tab, setTab] = useState<"products" | "movements">("products");
  const [rows, setRows] = useState<any[]>([]);
  const [fileName, setFileName] = useState<string>("");
  const [results, setResults] = useState<ImportResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setResults(null);
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = new Uint8Array(ev.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        // Gunakan header dari baris pertama
        const json = XLSX.utils.sheet_to_json(ws, { defval: "" });
        setRows(json as any[]);
      } catch (err) {
        setError("Gagal membaca file Excel");
        setRows([]);
      }
    };
    reader.readAsArrayBuffer(file);
  }

  function downloadTemplateProducts() {
    const template = [
      {
        sku: "SKU-001",
        name: "Contoh Produk A",
        unit: "pcs",
        brand: "MerkA",
        model: "Tipe-X",
        minStock: 10,
        newStock: 50,
        returnStock: 5,
      },
      {
        sku: "SKU-002",
        name: "Contoh Produk B",
        unit: "box",
        brand: "",
        model: "",
        minStock: 5,
        newStock: 20,
        returnStock: 2,
      },
    ];
    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Products");
    XLSX.writeFile(wb, "template-import-produk.xlsx");
  }

  function downloadTemplateMovements() {
    // Sheet Masuk
    const masuk = [
      {
        Aksi: "Masuk",
        Tanggal: "2026-09-09",
        SKU: "SKU-001",
        Jumlah: 10,
        Sumber: "Baru",
        "No PO": "PO-2026-001",
        "Nama Gerai": "",
        Resi: "",
        "Link Drive": "",
        "Tipe Barang": "Elektronik",
        "Serial Number": "SN-001|SN-002",
        Barcode: "BC-001|BC-002",
        "Status Asset": "Baik",
        Catatan: "Pembelian dari supplier",
      },
    ];
    const keluar = [
      {
        Aksi: "Keluar",
        Tanggal: "2026-09-09",
        SKU: "SKU-001",
        Jumlah: 3,
        Sumber: "Baru",
        "No Ticket": "TKT-2026-001",
        "Nama Gerai": "Gerai Jakarta Pusat",
        Resi: "RESI-001|RESI-002",
        "Link Drive": "https://drive.google.com/...",
        "Tipe Barang": "Elektronik",
        "Serial Number": "SN-001",
        Barcode: "BC-001",
        "Status Asset": "Baik",
        Catatan: "Kirim ke gerai",
      },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(masuk), "Masuk");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(keluar), "Keluar");
    XLSX.writeFile(wb, "template-import-transaksi.xlsx");
  }

  async function handleImport() {
    if (rows.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const url =
        tab === "products" ? "/api/import/products" : "/api/import/movements";
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Gagal import");
        return;
      }
      setResults(data.results);
    } catch (err) {
      setError("Terjadi kesalahan jaringan");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-slate-900">
            Import dari Excel
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Bulk upload produk dan transaksi stok masuk/keluar
          </p>
        </div>

        {isGuest && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-4 text-sm flex items-start gap-3">
            <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <div>
              <p className="font-semibold">Mode Pengunjung (hanya lihat)</p>
              <p className="mt-0.5">
                Untuk import data, silakan{" "}
                <a href="/login" className="font-semibold underline">masuk terlebih dahulu</a>.
              </p>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2">
          <button
            onClick={() => {
              setTab("products");
              setRows([]);
              setResults(null);
              setFileName("");
            }}
            className={`px-5 py-2.5 rounded-lg font-semibold text-sm transition ${
              tab === "products"
                ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/30"
                : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            Import Produk
          </button>
          <button
            onClick={() => {
              setTab("movements");
              setRows([]);
              setResults(null);
              setFileName("");
            }}
            className={`px-5 py-2.5 rounded-lg font-semibold text-sm transition ${
              tab === "movements"
                ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/30"
                : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            Import Transaksi (Masuk/Keluar)
          </button>
        </div>

        {/* Format Kolom */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="font-bold text-slate-900 mb-3">
            {tab === "products" ? "Format Kolom Produk" : "Format Kolom Transaksi"}
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border border-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-3 py-2 text-left border-b">Kolom</th>
                  <th className="px-3 py-2 text-left border-b">Wajib</th>
                  <th className="px-3 py-2 text-left border-b">Keterangan</th>
                </tr>
              </thead>
              <tbody>
                {(tab === "products" ? PRODUCT_COLS : MOVEMENT_COLS).map((c, i) => (
                  <tr key={i}>
                    <td className="px-3 py-2 font-mono text-xs">{c.label}</td>
                    <td className="px-3 py-2 text-xs">
                      {c.required === "Ya" ? (
                        <span className="text-red-600 font-semibold">Ya</span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-slate-600 text-xs">{c.desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {tab === "movements" && (
            <p className="text-xs text-amber-600 mt-3 bg-amber-50 border border-amber-200 rounded-lg p-3">
              <strong>Penting:</strong> Untuk barang Keluar, kolom "Nama Gerai" wajib
              diisi. SKU harus sudah terdaftar di halaman Produk. Multi-value (Resi, SN,
              Barcode) dipisahkan dengan tanda <code className="font-bold">|</code> atau
              baris baru dalam satu sel.
            </p>
          )}
          <div className="mt-4 flex gap-2">
            <button
              onClick={tab === "products" ? downloadTemplateProducts : downloadTemplateMovements}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-4 py-2 rounded-lg text-sm flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download Template
              {tab === "movements" && " (2 sheet: Masuk & Keluar)"}
            </button>
          </div>
        </div>

        {/* Upload */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="font-bold text-slate-900 mb-3">Upload File</h2>
          <input
            type="file"
            ref={fileInputRef}
            accept=".xlsx,.xls,.csv"
            onChange={handleFile}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full border-2 border-dashed border-slate-300 hover:border-indigo-500 rounded-xl p-8 text-center transition"
          >
            <svg
              className="w-12 h-12 mx-auto text-slate-400 mb-3"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            <p className="font-semibold text-slate-700">
              {fileName || "Klik untuk pilih file Excel"}
            </p>
            <p className="text-xs text-slate-500 mt-1">Format: .xlsx, .xls, .csv</p>
          </button>

          {error && (
            <div className="mt-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">
              {error}
            </div>
          )}

          {rows.length > 0 && !results && (
            <div className="mt-4">
              <p className="text-sm text-slate-700 mb-2">
                Preview: <span className="font-bold">{rows.length}</span> baris data
              </p>
              <div className="overflow-x-auto max-h-64 overflow-y-auto border border-slate-200 rounded-lg">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 sticky top-0">
                    <tr>
                      {Object.keys(rows[0]).map((k) => (
                        <th key={k} className="px-3 py-2 text-left font-semibold">
                          {k}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rows.slice(0, 15).map((r, idx) => (
                      <tr key={idx}>
                        {Object.keys(rows[0]).map((k) => (
                          <td key={k} className="px-3 py-1.5">
                            {String(r[k] ?? "")}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {rows.length > 15 && (
                <p className="text-xs text-slate-500 mt-2">
                  ...dan {rows.length - 15} baris lainnya
                </p>
              )}
              <button
                onClick={handleImport}
                disabled={loading}
                className="mt-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 text-white font-semibold px-6 py-2.5 rounded-lg"
              >
                {loading
                  ? "Mengimport..."
                  : `Import ${rows.length} ${tab === "products" ? "Produk" : "Transaksi"}`}
              </button>
            </div>
          )}

          {results && (
            <div className="mt-4">
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-emerald-600">
                    {results.filter(
                      (r) => r.status === "success" || r.status === "created",
                    ).length}
                  </p>
                  <p className="text-xs text-emerald-700">Sukses</p>
                </div>
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-red-600">
                    {results.filter((r) => r.status === "error").length}
                  </p>
                  <p className="text-xs text-red-700">Error</p>
                </div>
              </div>
              {results.some((r) => r.status === "error") && (
                <div className="max-h-48 overflow-y-auto border border-red-200 rounded-lg mb-4">
                  <table className="w-full text-xs">
                    <thead className="bg-red-50 sticky top-0">
                      <tr>
                        <th className="px-3 py-1.5 text-left">Baris</th>
                        <th className="px-3 py-1.5 text-left">SKU</th>
                        <th className="px-3 py-1.5 text-left">Pesan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {results
                        .filter((r) => r.status === "error")
                        .map((r, idx) => (
                          <tr key={idx}>
                            <td className="px-3 py-1.5">{r.row}</td>
                            <td className="px-3 py-1.5 font-mono">{r.sku}</td>
                            <td className="px-3 py-1.5 text-red-600">{r.message}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
              <button
                onClick={() => {
                  setRows([]);
                  setResults(null);
                  setFileName("");
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
                className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
              >
                ← Import lagi
              </button>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
