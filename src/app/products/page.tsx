"use client";

import { useEffect, useState, FormEvent } from "react";
import { AppShell } from "@/components/AppShell";
import { downloadCSV } from "@/lib/export";
import { useAuth } from "@/lib/useAuth";
import Pagination from "@/components/Pagination";

const PER_PAGE = 10;

type Product = {
  id: number;
  sku: string;
  name: string;
  category: string;
  unit: string;
  brand: string | null;
  model: string | null;
  minStock: number;
  newStock: number;
  returnStock: number;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
};

function formatNumber(n: number) {
  return n.toLocaleString("id-ID");
}

function formatDate(d: string) {
  return new Date(d).toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

const CATEGORIES = [
  "Elektronik",
  "Makanan",
  "Minuman",
  "ATK",
  "Bahan Baku",
  "Spare Part",
  "Alat Tulis",
  "Umum",
];
const UNITS = ["pcs", "kg", "gram", "liter", "meter", "box", "lusin", "pack"];

type SerialItem = {
  serialNumber: string;
  barcode: string | null;
  assetStatus: string | null;
  movementId: number;
  ticketNo: string | null;
  storeName: string | null;
  userName: string;
  createdAt: string;
};

type ProductDetail = {
  product: Product & { totalStock: number };
  serialBreakdown: {
    new: SerialItem[];
    return: SerialItem[];
    outgoing: SerialItem[];
  };
};

export default function ProductsPage() {
  const { user, isGuest, loading: authLoading } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [detailProductId, setDetailProductId] = useState<number | null>(null);
  const [detailData, setDetailData] = useState<ProductDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [form, setForm] = useState({
    sku: "",
    name: "",
    category: "Umum",
    unit: "pcs",
    brand: "",
    model: "",
    minStock: 10,
    newStock: 0,
    returnStock: 0,
  });

  async function load() {
    try {
      setPage(1);
      const params = new URLSearchParams();
      if (query) params.set("q", query);
      if (categoryFilter) params.set("category", categoryFilter);
      const res = await fetch(`/api/products?${params}${showArchived ? "&archived=true" : ""}`);
      if (res.ok) {
        const data = await res.json();
        setProducts(data.products);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, categoryFilter, showArchived]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          brand: form.brand.trim() || null,
          model: form.model.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Gagal menambah produk");
        return;
      }
      setForm({
        sku: "",
        name: "",
        category: "Umum",
        unit: "pcs",
        brand: "",
        model: "",
        minStock: 10,
        newStock: 0,
        returnStock: 0,
      });
      setShowForm(false);
      await load();
    } catch (err) {
      setError("Terjadi kesalahan jaringan");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: number, name: string) {
    if (!confirm(`Hapus produk "${name}"? Stok terkait juga akan dihapus.`)) return;
    await fetch(`/api/products/${id}`, { method: "DELETE" });
    await load();
  }

  async function handleArchive(id: number, name: string, unarchive = false) {
    const msg = unarchive
      ? `Pulihkan produk "${name}" dari arsip?`
      : `Arsipkan produk "${name}"?\n\nProduk tidak tampil di daftar utama, namun riwayat transaksinya tetap tersimpan dan bisa dipulihkan.`;
    if (!confirm(msg)) return;
    setArchiving(true);
    try {
      await fetch(`/api/products/archive?id=${id}`, {
        method: unarchive ? "PUT" : "POST",
      });
      await load();
    } finally {
      setArchiving(false);
    }
  }

  async function handleOpenDetail(id: number) {
    setDetailProductId(id);
    setDetailLoading(true);
    setDetailData(null);
    try {
      const res = await fetch(`/api/products/${id}/detail`);
      if (res.ok) {
        const data = await res.json();
        setDetailData(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setDetailLoading(false);
    }
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-slate-900">
              {showArchived ? "Arsip Produk" : "Produk"}
            </h1>
            <p className="text-slate-500 text-sm mt-1">
              {showArchived
                ? "Menampilkan produk yang diarsipkan (tidak aktif)"
                : "Kelola daftar produk gudang Anda"}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                if (products.length === 0) {
                  alert("Tidak ada produk untuk di-export");
                  return;
                }
                downloadCSV(
                  `produk-${new Date().toISOString().slice(0, 10)}.csv`,
                  products.map((p) => ({
                    SKU: p.sku,
                    "Nama Produk": p.name,
                    Satuan: p.unit,
                    "Stok Baru": p.newStock,
                    "Stok Retur": p.returnStock,
                    "Total Stok": p.newStock + p.returnStock,
                    "Min. Stok": p.minStock,
                    "Tanggal Dibuat": p.createdAt,
                  })),
                );
              }}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-4 py-2.5 rounded-lg flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Export CSV
            </button>
            {!isGuest && (
              <button
                onClick={() => setShowForm((s) => !s)}
                className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-semibold px-4 py-2.5 rounded-lg shadow-lg shadow-indigo-500/30 flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Tambah Produk
              </button>
            )}
          </div>
        </div>

        {isGuest && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-4 text-sm flex items-start gap-3">
            <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <div>
              <p className="font-semibold">Mode Pengunjung (hanya lihat)</p>
              <p className="mt-0.5">
                Untuk menambah, mengubah, atau menghapus produk, silakan{" "}
                <a href="/login" className="font-semibold underline">
                  masuk terlebih dahulu
                </a>
                .
              </p>
            </div>
          </div>
        )}

        {showForm && (
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h2 className="font-bold text-slate-900 mb-4">Tambah Produk Baru</h2>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  SKU *
                </label>
                <input
                  type="text"
                  required
                  value={form.sku}
                  onChange={(e) => setForm({ ...form, sku: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                  placeholder="SKU-001"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Nama Produk *
                </label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                  placeholder="Nama produk"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Merk <span className="text-slate-400 font-normal">(opsional)</span>
                </label>
                <input
                  type="text"
                  value={form.brand}
                  onChange={(e) => setForm({ ...form, brand: e.target.value })}
                  maxLength={100}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                  placeholder="contoh: Epson, Dell, Samsung"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Tipe <span className="text-slate-400 font-normal">(opsional)</span>
                </label>
                <input
                  type="text"
                  value={form.model}
                  onChange={(e) => setForm({ ...form, model: e.target.value })}
                  maxLength={150}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                  placeholder="contoh: L3250, XPS 13, S23"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Satuan
                </label>
                <select
                  value={form.unit}
                  onChange={(e) => setForm({ ...form, unit: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                >
                  {UNITS.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Stok Minimum (Total)
                </label>
                <input
                  type="number"
                  min={0}
                  value={form.minStock}
                  onChange={(e) =>
                    setForm({ ...form, minStock: Number(e.target.value) })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Stok Awal - Baru
                </label>
                <input
                  type="number"
                  min={0}
                  value={form.newStock}
                  onChange={(e) =>
                    setForm({ ...form, newStock: Number(e.target.value) })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Stok Awal - Retur
                </label>
                <input
                  type="number"
                  min={0}
                  value={form.returnStock}
                  onChange={(e) =>
                    setForm({ ...form, returnStock: Number(e.target.value) })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                />
              </div>

              {error && (
                <div className="md:col-span-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">
                  {error}
                </div>
              )}

              <div className="md:col-span-2 flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 font-medium"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold disabled:opacity-60"
                >
                  {submitting ? "Menyimpan..." : "Simpan Produk"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-wrap gap-3">
          <div className="flex-1 min-w-[200px]">
            <input
              type="text"
              placeholder="Cari SKU atau nama produk..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
            />
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
          >
            <option value="">Semua Kategori</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700 bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 cursor-pointer whitespace-nowrap">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
              className="w-4 h-4"
            />
            Tampilkan Arsip
          </label>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-slate-500">Memuat...</div>
          ) : products.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-16 h-16 mx-auto rounded-full bg-slate-100 flex items-center justify-center mb-3">
                <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
              <p className="font-semibold text-slate-700">Belum ada produk</p>
              <p className="text-sm text-slate-500 mt-1">
                Klik "Tambah Produk" untuk memulai
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-600 text-xs uppercase">
                  <tr>
                    <th className="px-5 py-3 text-left">SKU</th>
                    <th className="px-5 py-3 text-left">Nama Produk</th>
                    <th className="px-5 py-3 text-right">
                      <span className="inline-flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        Baru
                      </span>
                    </th>
                    <th className="px-5 py-3 text-right">
                      <span className="inline-flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-amber-500" />
                        Retur
                      </span>
                    </th>
                    <th className="px-5 py-3 text-right">Total</th>
                    <th className="px-5 py-3 text-right">Min. Stok</th>
                    <th className="px-5 py-3 text-left">Status</th>
                    <th className="px-5 py-3 text-left">Dibuat</th>
                    <th className="px-5 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {products
                    .slice((page - 1) * PER_PAGE, page * PER_PAGE)
                    .map((p) => {
                    const total = p.newStock + p.returnStock;
                    const low = total <= p.minStock;
                    const empty = total === 0;
                    return (
                      <tr
                        key={p.id}
                        className={`hover:bg-slate-50 ${
                          empty ? "bg-red-50/70" : low ? "bg-amber-50/40" : ""
                        }`}
                      >
                        <td className="px-5 py-3 font-mono text-xs text-slate-600">
                          {p.sku}
                        </td>
                        <td className="px-5 py-3 font-medium text-slate-900">
                          {p.name}
                          {(p.brand || p.model) && (
                            <div className="text-xs text-slate-500 font-normal mt-0.5">
                              {p.brand && <span className="font-medium text-slate-600">{p.brand}</span>}
                              {p.brand && p.model && " · "}
                              {p.model && <span>{p.model}</span>}
                            </div>
                          )}
                        </td>
                        <td className="px-5 py-3 text-right">
                          <span className="font-bold text-emerald-600">
                            {formatNumber(p.newStock)}
                          </span>
                          <span className="text-slate-500 ml-1 text-xs">{p.unit}</span>
                        </td>
                        <td className="px-5 py-3 text-right">
                          <span className="font-bold text-amber-600">
                            {formatNumber(p.returnStock)}
                          </span>
                          <span className="text-slate-500 ml-1 text-xs">{p.unit}</span>
                        </td>
                        <td className="px-5 py-3 text-right">
                          <span className={`font-bold ${empty ? "text-red-600" : low ? "text-amber-600" : "text-slate-900"}`}>
                            {formatNumber(total)}
                          </span>
                          <span className="text-slate-500 ml-1 text-xs">{p.unit}</span>
                        </td>
                        <td className="px-5 py-3 text-right text-slate-500">
                          {formatNumber(p.minStock)} {p.unit}
                        </td>
                        <td className="px-5 py-3">
                          {empty ? (
                            <span className="inline-flex items-center gap-1 text-xs font-bold bg-red-600 text-white px-2.5 py-1 rounded-md shadow-sm">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                              </svg>
                              Habis
                            </span>
                          ) : low ? (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold bg-amber-100 text-amber-700 px-2.5 py-1 rounded-md">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                              </svg>
                              Menipis
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-md">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4" />
                              </svg>
                              Aman
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-slate-500 text-xs">
                          {formatDate(p.createdAt)}
                          {p.isArchived && (
                            <div className="mt-0.5">
                              <span className="text-[10px] font-semibold bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded">
                                Diarsipkan
                              </span>
                            </div>
                          )}
                        </td>
                        <td className="px-5 py-3 text-right whitespace-nowrap">
                          <button
                            onClick={() => handleOpenDetail(p.id)}
                            className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 mr-3"
                          >
                            Detail
                          </button>
                          {!isGuest && !showArchived && (
                          <button
                            onClick={() => handleArchive(p.id, p.name, false)}
                            disabled={archiving}
                            className="text-xs font-semibold text-amber-600 hover:text-amber-700"
                            title="Arsipkan (tidak tampil di daftar utama)"
                          >
                            Arsip
                          </button>
                          )}
                          {!isGuest && showArchived && (
                          <button
                            onClick={() => handleArchive(p.id, p.name, true)}
                            disabled={archiving}
                            className="text-xs font-semibold text-emerald-600 hover:text-emerald-700"
                          >
                            Pulihkan
                          </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <Pagination
            page={page}
            totalPages={Math.max(1, Math.ceil(products.length / PER_PAGE))}
            totalItems={products.length}
            perPage={PER_PAGE}
            onPageChange={setPage}
          />
        </div>
      </div>

      {/* Modal Detail Produk */}
      {detailProductId !== null && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setDetailProductId(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {detailLoading || !detailData ? (
              <div className="p-12 text-center">
                <div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full mx-auto mb-3" />
                <p className="text-slate-600">Memuat detail produk...</p>
              </div>
            ) : (
              <>
                {/* Header Modal */}
                <div className="px-6 py-4 border-b border-slate-200 flex items-start justify-between bg-gradient-to-r from-indigo-50 to-purple-50">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-mono bg-slate-200 text-slate-700 px-2 py-0.5 rounded">
                        {detailData.product.sku}
                      </span>
                      <span className="text-xs text-slate-600">
                        Satuan: <span className="font-semibold">{detailData.product.unit}</span>
                      </span>
                      {detailData.product.brand && (
                        <span className="text-xs text-slate-600">
                          Merk: <span className="font-semibold">{detailData.product.brand}</span>
                        </span>
                      )}
                      {detailData.product.model && (
                        <span className="text-xs text-slate-600">
                          Tipe: <span className="font-semibold">{detailData.product.model}</span>
                        </span>
                      )}
                    </div>
                    <h2 className="text-xl font-bold text-slate-900 truncate">
                      {detailData.product.name}
                    </h2>
                    <div className="flex gap-4 mt-2 text-sm">
                      <span className="text-slate-600">
                        <span className="font-semibold text-emerald-600">{formatNumber(detailData.product.newStock)}</span> Baru
                      </span>
                      <span className="text-slate-600">
                        <span className="font-semibold text-amber-600">{formatNumber(detailData.product.returnStock)}</span> Retur
                      </span>
                      <span className="text-slate-600">
                        = <span className="font-bold text-slate-900">{formatNumber(detailData.product.totalStock)}</span> {detailData.product.unit}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => setDetailProductId(null)}
                    className="p-2 hover:bg-white/60 rounded-lg transition"
                    aria-label="Close"
                  >
                    <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Body Modal */}
                <div className="flex-1 overflow-y-auto p-6 space-y-5">
                  {/* Barang Baru */}
                  <DetailSection
                    title="Barang Baru"
                    subtitle="Serial Number & Barcode untuk stok kondisi baru"
                    color="emerald"
                    items={detailData.serialBreakdown.new}
                  />

                  {/* Barang Retur */}
                  <DetailSection
                    title="Barang Retur"
                    subtitle="Serial Number & Barcode untuk stok kondisi retur"
                    color="amber"
                    items={detailData.serialBreakdown.return}
                  />

                  {/* Barang Keluar */}
                  <DetailSection
                    title="Barang Keluar"
                    subtitle="Riwayat unit yang sudah keluar dari gudang"
                    color="red"
                    items={detailData.serialBreakdown.outgoing}
                  />
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </AppShell>
  );
}

function DetailSection({
  title,
  subtitle,
  color,
  items,
}: {
  title: string;
  subtitle: string;
  color: "emerald" | "amber" | "red";
  items: SerialItem[];
}) {
  const colorClasses = {
    emerald: "border-emerald-200 bg-emerald-50/50",
    amber: "border-amber-200 bg-amber-50/50",
    red: "border-red-200 bg-red-50/50",
  };

  return (
    <div className={`border rounded-xl ${colorClasses[color]} overflow-hidden`}>
      <div className="px-4 py-3 border-b border-slate-200 bg-white/50">
        <h3 className="font-bold text-slate-900">{title}</h3>
        <p className="text-xs text-slate-600 mt-0.5">{subtitle}</p>
      </div>
      {items.length === 0 ? (
        <div className="p-6 text-center text-sm text-slate-500">
          Belum ada data serial number atau barcode
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-white/80 text-slate-600 text-xs uppercase">
              <tr>
                <th className="px-4 py-2 text-left">#</th>
                <th className="px-4 py-2 text-left">Serial Number</th>
                <th className="px-4 py-2 text-left">Barcode</th>
                <th className="px-4 py-2 text-left">Status Asset</th>
                <th className="px-4 py-2 text-left">No PO/Ticket</th>
                <th className="px-4 py-2 text-left">Oleh</th>
                <th className="px-4 py-2 text-left">Tanggal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((item, idx) => (
                <tr key={`${item.movementId}-${idx}`} className="hover:bg-white/50">
                  <td className="px-4 py-2 text-slate-500">{idx + 1}</td>
                  <td className="px-4 py-2 font-mono text-xs">
                    {item.serialNumber}
                  </td>
                  <td className="px-4 py-2 font-mono text-xs">
                    {item.barcode || <span className="text-slate-400">-</span>}
                  </td>
                  <td className="px-4 py-2">
                    {item.assetStatus ? (
                      <span className="text-xs font-semibold bg-blue-50 text-blue-700 px-2 py-0.5 rounded">
                        {item.assetStatus}
                      </span>
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                  </td>
                  <td className="px-4 py-2 font-mono text-xs">
                    {item.ticketNo || <span className="text-slate-400">-</span>}
                  </td>
                  <td className="px-4 py-2 text-xs">{item.userName}</td>
                  <td className="px-4 py-2 text-xs whitespace-nowrap">
                    {formatDate(item.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-4 py-2 bg-white/50 text-xs text-slate-600 border-t border-slate-200">
            Total: <span className="font-semibold">{items.length}</span> unit tercatat
          </div>
        </div>
      )}
    </div>
  );
}
