"use client";

import { useEffect, useState, FormEvent } from "react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/lib/useAuth";
import Pagination from "@/components/Pagination";

const PER_PAGE = 10;

type Product = {
  id: number;
  sku: string;
  name: string;
  category: string;
  unit: string;
  minStock: number;
  newStock: number;
  returnStock: number;
};

type Movement = {
  id: number;
  productId: number;
  productName: string;
  productSku: string;
  unit: string;
  type: "in" | "out";
  source: "new" | "return";
  quantity: number;
  ticketNo: string | null;
  storeName: string | null;
  serialNumber: string | null;
  barcode: string | null;
  serialNumbers: string[];
  barcodes: string[];
  assetStatus: string | null;
  itemType: string | null;
  resis: string[];
  driveLink: string | null;
  note: string | null;
  createdAt: string;
  userName: string;
};

const ASSET_STATUS_OPTIONS = ["Baik", "Rusak", "Service"];

function formatNumber(n: number) {
  return n.toLocaleString("id-ID");
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function MovementsPage() {
  const { isGuest } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [page, setPage] = useState(1);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(true);

  // form state
  const [type, setType] = useState<"in" | "out">("in");
  const [source, setSource] = useState<"new" | "return">("new");
  const [productId, setProductId] = useState<string>("");
  const [quantity, setQuantity] = useState<number>(1);
  const [ticketNo, setTicketNo] = useState(""); // untuk barang keluar
  const [poNumber, setPoNumber] = useState(""); // untuk barang masuk
  const [storeName, setStoreName] = useState("");
  const [serialNumbersText, setSerialNumbersText] = useState(""); // multi-line
  const [barcodesText, setBarcodesText] = useState(""); // multi-line
  const [assetStatus, setAssetStatus] = useState("Baik");
  const [itemType, setItemType] = useState(""); // tipe barang (opsional)
  const [resiText, setResiText] = useState(""); // multi-line: nomor resi &/atau link bukti (opsional)
  const [note, setNote] = useState("");
  // Mode bulk
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkItems, setBulkItems] = useState<
    {
      productId: string;
      source: "new" | "return";
      quantity: number;
      storeName: string;
      serialNumbers: string;
      barcodes: string;
      resiText: string;
    }[]
  >([
    {
      productId: "",
      source: "new",
      quantity: 1,
      storeName: "",
      serialNumbers: "",
      barcodes: "",
      resiText: "",
    },
  ]);
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  const [bulkResults, setBulkResults] = useState<
    { row: number; sku: string; status: string; message: string }[] | null
  >(null);
  const [transactionDate, setTransactionDate] = useState<string>(
    new Date().toISOString().slice(0, 10),
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [snLookupLoading, setSnLookupLoading] = useState(false);
  const [showTransactionForm, setShowTransactionForm] = useState(false);
  const [snLookupResults, setSnLookupResults] = useState<
    Record<
      string,
      {
        found: boolean;
        available: boolean;
        barcode: string | null;
        barcodeAvailable: boolean;
        assetStatus: string | null;
        source: "new" | "return" | null;
      }
    >
  >({});

  // Parse multi-line text menjadi array
  const serialNumbersList = serialNumbersText
    .split("\n")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  const barcodesList = barcodesText
    .split("\n")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  const resiList = resiText
    .split("\n")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  // filters
  const [filterType, setFilterType] = useState<"all" | "in" | "out">("all");
  const [filterProductId, setFilterProductId] = useState<string>("");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");
  const [filterTicket, setFilterTicket] = useState("");

  async function loadProducts() {
    const res = await fetch("/api/products");
    if (res.ok) {
      const data = await res.json();
      setProducts(data.products);
    }
  }

  async function loadMovements() {
    const params = new URLSearchParams();
    if (filterType !== "all") params.set("type", filterType);
    if (filterProductId) params.set("productId", filterProductId);
    if (filterFrom) params.set("from", filterFrom);
    if (filterTo) params.set("to", filterTo);
    if (filterTicket.trim()) params.set("ticket", filterTicket.trim());
    params.set("limit", "200");
    const res = await fetch(`/api/movements?${params}`);
    if (res.ok) {
      const data = await res.json();
      setMovements(data.movements);
    }
  }

  useEffect(() => {
    Promise.all([loadProducts(), loadMovements()]).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadMovements();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterType, filterProductId, filterFrom, filterTo, filterTicket]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!productId) {
      setError("Pilih produk terlebih dahulu");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/movements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: Number(productId),
          type,
          source,
          quantity,
          date: transactionDate,
          ticketNo: type === "out" ? ticketNo.trim() || null : null,
          poNumber: type === "in" ? poNumber.trim() || null : null,
          storeName: type === "out" ? storeName.trim() || null : null,
          serialNumbers: serialNumbersList,
          barcodes: barcodesList,
          assetStatus: assetStatus || null,
          itemType: itemType.trim() || null,
          resi: type === "out" ? resiList : null,
          note: note.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Gagal mencatat pergerakan");
        return;
      }
      const selected = products.find((p) => p.id === Number(productId));
      const sourceLabel = source === "new" ? "Baru" : "Retur";
      setSuccess(
        `Berhasil ${type === "in" ? "menambah" : "mengurangi"} ${formatNumber(
          quantity,
        )} ${selected?.unit ?? "unit"} pada ${selected?.name ?? "produk"} (${sourceLabel}). Stok: Baru ${formatNumber(
          data.newStockBreakdown?.new ?? 0,
        )} / Retur ${formatNumber(data.newStockBreakdown?.return ?? 0)} ${selected?.unit ?? "unit"}`,
      );
      setQuantity(1);
      setTicketNo("");
      setPoNumber("");
      setStoreName("");
      setSerialNumbersText("");
      setBarcodesText("");
      setAssetStatus("Baik");
      setItemType("");
      setResiText("");
      setNote("");
      setTransactionDate(new Date().toISOString().slice(0, 10));
      setSnLookupResults({});
      setBarcodeManuallyEdited(false);
      setShowTransactionForm(false);
      await Promise.all([loadProducts(), loadMovements()]);
    } catch (err) {
      setError("Terjadi kesalahan jaringan");
    } finally {
      setSubmitting(false);
    }
  }

  const selectedProduct = products.find((p) => p.id === Number(productId));

  // Track apakah user sudah manual edit barcode (supaya tidak di-override auto-fill)
  const [barcodeManuallyEdited, setBarcodeManuallyEdited] = useState(false);

  // Auto-lookup SN untuk barang keluar (dengan debounce)
  useEffect(() => {
    if (type !== "out" || !productId || serialNumbersList.length === 0) {
      if (serialNumbersList.length === 0) setSnLookupResults({});
      return;
    }

    setSnLookupLoading(true);
    const timeout = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/products/${productId}/serial-lookup?sn=${encodeURIComponent(
            serialNumbersList.join(","),
          )}`,
        );
        if (res.ok) {
          const data = await res.json();
          const results = data.results ?? {};
          setSnLookupResults(results);

          // Auto-fill barcode dari SN yang matched (jika user belum edit manual)
          if (!barcodeManuallyEdited) {
            const newBarcodes = serialNumbersList.map((sn) => {
              const match = results[sn];
              return match?.found && match.available ? match.barcode ?? "" : "";
            });
            const hasAnyMatch = newBarcodes.some((b) => b !== "");
            if (hasAnyMatch) {
              setBarcodesText(newBarcodes.join("\n"));
            }
          }

          // Auto-set source dari SN pertama yang match
          const firstMatch = serialNumbersList
            .map((sn) => results[sn])
            .find((r) => r?.found && r.available);
          if (firstMatch?.source) {
            setSource(firstMatch.source);
          }

          // Auto-set asset status dari SN pertama
          if (firstMatch?.assetStatus) {
            setAssetStatus(firstMatch.assetStatus);
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setSnLookupLoading(false);
      }
    }, 400); // 400ms debounce

    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serialNumbersText, productId, type]);

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-slate-900">
              Stok Masuk & Keluar
            </h1>
            <p className="text-slate-500 text-sm mt-1">
              Catat transaksi penambahan dan pengurangan stok barang
            </p>
          </div>
          {!isGuest && (
            <button
              onClick={() => setShowTransactionForm(true)}
              className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-semibold px-5 py-2.5 rounded-lg shadow-lg shadow-indigo-500/30 flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Catat Transaksi
            </button>
          )}
        </div>

        {isGuest && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-4 text-sm flex items-start gap-3">
            <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <div>
              <p className="font-semibold">Mode Pengunjung (hanya lihat)</p>
              <p className="mt-0.5">
                Untuk mencatat transaksi masuk/keluar, silakan{" "}
                <a href="/login" className="font-semibold underline">
                  masuk terlebih dahulu
                </a>
                .
              </p>
            </div>
          </div>
        )}

        {/* Modal Catat Transaksi */}
        {showTransactionForm && (
          <div
            className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center p-4 overflow-y-auto"
            onClick={() => setShowTransactionForm(false)}
          >
            <div
              className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white z-10 rounded-t-2xl">
                <h2 className="font-bold text-slate-900">Catat Transaksi</h2>
                <div className="flex items-center gap-2">
                  {type === "in" ? (
                    <span className="text-xs font-semibold bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-md">
                      Stok Masuk
                    </span>
                  ) : (
                    <span className="text-xs font-semibold bg-red-100 text-red-700 px-2.5 py-1 rounded-md">
                      Stok Keluar
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowTransactionForm(false)}
                    className="p-2 rounded-lg hover:bg-slate-100 transition"
                    aria-label="Tutup"
                  >
                    <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
              <div className="p-5 max-h-[calc(100vh-160px)] overflow-y-auto">

            <div className="grid grid-cols-2 gap-2 mb-4">
              <button
                type="button"
                onClick={() => setType("in")}
                className={`py-3 rounded-lg font-semibold transition flex items-center justify-center gap-2 ${
                  type === "in"
                    ? "bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/30"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m0 0l-6-6m6 6l6-6" />
                </svg>
                Masuk
              </button>
              <button
                type="button"
                onClick={() => setType("out")}
                className={`py-3 rounded-lg font-semibold transition flex items-center justify-center gap-2 ${
                  type === "out"
                    ? "bg-gradient-to-r from-orange-500 to-red-600 text-white shadow-lg shadow-red-500/30"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 20V4m0 0l-6 6m6-6l6 6" />
                </svg>
                Keluar
              </button>
            </div>

            {/* Toggle mode: Satuan / Bulk */}
            <div className="grid grid-cols-2 gap-2 mb-4">
              <button
                type="button"
                onClick={() => {
                  setBulkMode(false);
                  setBulkResults(null);
                }}
                className={`py-2 rounded-lg font-semibold text-sm transition border ${
                  !bulkMode
                    ? "bg-indigo-50 border-indigo-500 text-indigo-700"
                    : "bg-white border-slate-300 text-slate-600 hover:bg-slate-50"
                }`}
              >
                ✍ Input Satuan
              </button>
              <button
                type="button"
                onClick={() => {
                  setBulkMode(true);
                  setBulkResults(null);
                }}
                className={`py-2 rounded-lg font-semibold text-sm transition border ${
                  bulkMode
                    ? "bg-purple-50 border-purple-500 text-purple-700"
                    : "bg-white border-slate-300 text-slate-600 hover:bg-slate-50"
                }`}
              >
                Input Bulk (Banyak Baris)
              </button>
            </div>

            {/* ===== FORM SINGLE ===== */}
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Produk *
                </label>
                <select
                  value={productId}
                  onChange={(e) => setProductId(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                >
                  <option value="">-- Pilih Produk --</option>
                  {products.map((p) => {
                    const total = p.newStock + p.returnStock;
                    const status =
                      total === 0 ? " - HABIS" : total <= p.minStock ? " - MENIPIS" : "";
                    return (
                      <option key={p.id} value={p.id}>
                        {p.sku} - {p.name} (Baru: {p.newStock} / Retur: {p.returnStock} {p.unit}
                        {status})
                      </option>
                    );
                  })}
                </select>
              </div>

              {selectedProduct && (
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Stok Baru:</span>
                    <span className="font-bold text-emerald-600">
                      {formatNumber(selectedProduct.newStock)} {selectedProduct.unit}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Stok Retur:</span>
                    <span className="font-bold text-amber-600">
                      {formatNumber(selectedProduct.returnStock)} {selectedProduct.unit}
                    </span>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-slate-200">
                    <span className="text-slate-700 font-medium">Total:</span>
                    <span className="font-bold text-slate-900">
                      {formatNumber(selectedProduct.newStock + selectedProduct.returnStock)}{" "}
                      {selectedProduct.unit}
                    </span>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Sumber Stok {type === "out" ? "(Ambil dari)" : "(Tambah ke)"}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSource("new")}
                    className={`py-2 rounded-lg font-semibold text-sm transition border ${
                      source === "new"
                        ? "bg-emerald-50 border-emerald-500 text-emerald-700"
                        : "bg-white border-slate-300 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    Baru
                  </button>
                  <button
                    type="button"
                    onClick={() => setSource("return")}
                    className={`py-2 rounded-lg font-semibold text-sm transition border ${
                      source === "return"
                        ? "bg-amber-50 border-amber-500 text-amber-700"
                        : "bg-white border-slate-300 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    Retur
                  </button>
                </div>
              </div>

              {type === "in" ? (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    No PO (Purchase Order)
                  </label>
                  <input
                    type="text"
                    value={poNumber}
                    onChange={(e) => setPoNumber(e.target.value)}
                    maxLength={50}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                    placeholder="contoh: PO-2026-001"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    No Ticket
                  </label>
                  <input
                    type="text"
                    value={ticketNo}
                    onChange={(e) => setTicketNo(e.target.value)}
                    maxLength={50}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                    placeholder="contoh: TKT-2026-001"
                  />
                </div>
              )}

              {type === "out" && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Nama Gerai <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={storeName}
                    onChange={(e) => setStoreName(e.target.value)}
                    maxLength={150}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                    placeholder="contoh: Gerai Jakarta Pusat"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Jumlah *
                </label>
                <input
                  type="number"
                  min={1}
                  required
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Tipe Barang <span className="text-slate-400 font-normal">(opsional)</span>
                </label>
                <input
                  type="text"
                  value={itemType}
                  onChange={(e) => setItemType(e.target.value)}
                  maxLength={100}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                  placeholder="contoh: Elektronik, ATK"
                />
              </div>

              {type === "out" && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Resi{" "}
                    <span className="text-slate-400 font-normal">
                      (opsional - nomor resi dan/atau link bukti, 1 baris = 1 item)
                    </span>
                  </label>
                  <textarea
                    value={resiText}
                    onChange={(e) => setResiText(e.target.value)}
                    rows={Math.max(2, Math.min(resiList.length + 1, 5))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none font-mono text-xs resize-y"
                    placeholder={`Bisa nomor resi dan/atau link Google Drive\nContoh:\nRESI-001\nhttps://drive.google.com/...`}
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    {resiList.length > 0
                      ? `${resiList.length} item resi/link diisi`
                      : "Tidak wajib - bisa dikosongkan"}
                  </p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Tanggal Transaksi *
                </label>
                <input
                  type="date"
                  required
                  value={transactionDate}
                  max={new Date().toISOString().slice(0, 10)}
                  onChange={(e) => setTransactionDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Bisa diubah untuk input transaksi yang terlewat (backdating)
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Serial Number{" "}
                  <span className="text-xs text-slate-500 font-normal">(opsional)</span>
                </label>
                <textarea
                  value={serialNumbersText}
                  onChange={(e) => setSerialNumbersText(e.target.value)}
                  rows={Math.max(3, Math.min(quantity, 8))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none font-mono text-xs resize-y"
                  placeholder={`Satu serial number per baris\nContoh:\nSN-001\nSN-002`}
                />
                <div className="flex justify-between items-center mt-1">
                  <p className="text-xs text-slate-500">
                    {serialNumbersList.length > 0
                      ? `${serialNumbersList.length} serial number diisi`
                      : "Tidak wajib - bisa dikosongkan"}
                  </p>
                  {type === "out" && serialNumbersList.length > 0 && snLookupLoading && (
                    <p className="text-xs text-slate-400">Mencari...</p>
                  )}
                  {serialNumbersList.length > 0 && serialNumbersList.length !== quantity && (
                    <p className="text-xs text-amber-600 font-medium">
                      Jumlah: {serialNumbersList.length} / {quantity}
                    </p>
                  )}
                </div>

                {type === "out" &&
                  serialNumbersList.length > 0 &&
                  !snLookupLoading &&
                  Object.keys(snLookupResults).length > 0 && (
                    <div className="mt-2 p-2 bg-slate-50 border border-slate-200 rounded-lg space-y-1 max-h-32 overflow-y-auto">
                      {serialNumbersList.map((sn, idx) => {
                        const result = snLookupResults[sn];
                        if (!result) return null;
                        return (
                          <div key={idx} className="flex items-center gap-2 text-xs">
                            {result.found && result.available ? (
                              <>
                                <span className="text-emerald-600">OK</span>
                                <span className="font-mono text-slate-700">{sn}</span>
                                <span className="text-slate-500">
                                  Barcode:
                                  <span
                                    className={`font-mono ml-1 ${
                                      result.barcodeAvailable
                                        ? "text-indigo-600"
                                        : "text-red-600 line-through"
                                    }`}
                                  >
                                    {result.barcode || "(tidak ada)"}
                                  </span>
                                </span>
                                <span
                                  className={`ml-auto px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                                    result.source === "new"
                                      ? "bg-emerald-100 text-emerald-700"
                                      : "bg-amber-100 text-amber-700"
                                  }`}
                                >
                                  {result.source === "new" ? "Baru" : "Retur"}
                                </span>
                              </>
                            ) : (
                              <>
                                <span className="text-red-600">X</span>
                                <span className="font-mono text-red-700">{sn}</span>
                                <span className="text-red-600">
                                  {result.found ? "(sudah keluar)" : "(tidak ditemukan)"}
                                </span>
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Barcode{" "}
                  <span className="text-xs text-slate-500 font-normal">(opsional)</span>
                </label>
                <textarea
                  value={barcodesText}
                  onChange={(e) => {
                    setBarcodesText(e.target.value);
                    setBarcodeManuallyEdited(true);
                  }}
                  rows={Math.max(3, Math.min(quantity, 8))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none font-mono text-xs resize-y"
                  placeholder={`Satu barcode per baris\nContoh:\nBC-001\nBC-002`}
                />
                <p className="text-xs text-slate-500 mt-1">
                  {barcodesList.length > 0
                    ? `${barcodesList.length} barcode diisi (otomatis dari SN jika kosong)`
                    : "Tidak wajib - bisa dikosongkan"}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Status Asset
                </label>
                <select
                  value={assetStatus}
                  onChange={(e) => setAssetStatus(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                >
                  {ASSET_STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Catatan (opsional)
                </label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                  maxLength={500}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-none"
                  placeholder="mis. Pembelian dari supplier"
                />
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">
                  {error}
                </div>
              )}
              {success && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded-lg p-3">
                  {success}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className={`w-full font-semibold py-2.5 rounded-lg text-white transition disabled:opacity-60 ${
                  type === "in"
                    ? "bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 shadow-lg shadow-emerald-500/30"
                    : "bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 shadow-lg shadow-red-500/30"
                }`}
              >
                {submitting
                  ? "Menyimpan..."
                  : type === "in"
                  ? "Catat Stok Masuk"
                  : "Catat Stok Keluar"}
              </button>
            </form>
              </div>
            </div>
          </div>
        )}

        {/* ===== RIWAYAT TRANSAKSI ===== */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 space-y-3">
            <h2 className="font-bold text-slate-900">Riwayat Transaksi</h2>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Cari No Ticket / No PO
              </label>
              <input
                type="text"
                value={filterTicket}
                onChange={(e) => setFilterTicket(e.target.value)}
                placeholder="Contoh: TKT-2026-001 atau PO-2026-001"
                className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Tipe Transaksi
                </label>
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value as "all" | "in" | "out")}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                  <option value="all">Semua Tipe</option>
                  <option value="in">Masuk</option>
                  <option value="out">Keluar</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Produk
                </label>
                <select
                  value={filterProductId}
                  onChange={(e) => setFilterProductId(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                  <option value="">Semua Produk</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
              <label className="block text-xs font-medium text-slate-700 mb-2">
                Range Tanggal
              </label>
              <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center">
                <div>
                  <label className="block text-[10px] text-slate-500 mb-0.5">
                    Dari Tanggal
                  </label>
                  <input
                    type="date"
                    value={filterFrom}
                    onChange={(e) => setFilterFrom(e.target.value)}
                    className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
                <span className="text-slate-400 text-sm pt-4">-</span>
                <div>
                  <label className="block text-[10px] text-slate-500 mb-0.5">
                    Sampai Tanggal
                  </label>
                  <input
                    type="date"
                    value={filterTo}
                    min={filterFrom || undefined}
                    onChange={(e) => setFilterTo(e.target.value)}
                    className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
              </div>
              {(filterFrom || filterTo || filterTicket || filterType !== "all" || filterProductId) && (
                <button
                  onClick={() => {
                    setFilterFrom("");
                    setFilterTo("");
                    setFilterTicket("");
                    setFilterType("all");
                    setFilterProductId("");
                  }}
                  className="mt-2 text-xs text-red-600 hover:text-red-700 font-medium"
                >
                  Reset Filter
                </button>
              )}
            </div>
          </div>

          {loading ? (
            <div className="p-8 text-center text-slate-500">Memuat...</div>
          ) : movements.length === 0 ? (
            <div className="p-12 text-center">
              <p className="font-semibold text-slate-700">Belum ada transaksi</p>
              <p className="text-sm text-slate-500 mt-1">
                Transaksi stok masuk/keluar akan muncul di sini
              </p>
            </div>
          ) : (
            <>
            <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-600 text-xs uppercase sticky top-0">
                  <tr>
                    <th className="px-3 py-3 text-left whitespace-nowrap">Tipe</th>
                    <th className="px-3 py-3 text-left whitespace-nowrap">Sumber</th>
                    <th className="px-3 py-3 text-left whitespace-nowrap">No PO / Ticket</th>
                    <th className="px-3 py-3 text-left">Produk</th>
                    <th className="px-3 py-3 text-left whitespace-nowrap">Tipe Barang</th>
                    <th className="px-3 py-3 text-left whitespace-nowrap min-w-[220px]">Resi</th>
                    <th className="px-3 py-3 text-left whitespace-nowrap">Serial Number</th>
                    <th className="px-3 py-3 text-left whitespace-nowrap">Barcode</th>
                    <th className="px-3 py-3 text-left whitespace-nowrap">Nama Gerai</th>
                    <th className="px-3 py-3 text-left whitespace-nowrap">Status Asset</th>
                    <th className="px-3 py-3 text-right whitespace-nowrap">Jumlah</th>
                    <th className="px-3 py-3 text-left whitespace-nowrap">Tanggal</th>
                    <th className="px-3 py-3 text-left whitespace-nowrap">Oleh</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {movements
                    .slice((page - 1) * PER_PAGE, page * PER_PAGE)
                    .map((m) => (
                    <tr key={m.id} className="hover:bg-slate-50">
                      <td className="px-3 py-3">
                        <span
                          className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-md whitespace-nowrap ${
                            m.type === "in"
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-red-100 text-red-700"
                          }`}
                        >
                          {m.type === "in" ? "Masuk" : "Keluar"}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={`text-xs font-semibold px-2 py-1 rounded-md whitespace-nowrap ${
                            m.source === "new"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "bg-amber-50 text-amber-700 border border-amber-200"
                          }`}
                        >
                          {m.source === "new" ? "Baru" : "Retur"}
                        </span>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        {m.ticketNo ? (
                          <div>
                            <div className="font-mono text-xs text-slate-700">
                              {m.ticketNo}
                            </div>
                            <div className="text-[10px] text-slate-500 mt-0.5">
                              {m.type === "in" ? "No PO" : "No Ticket"}
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <div className="font-medium text-slate-900">{m.productName}</div>
                        <div className="text-xs text-slate-500 font-mono">{m.productSku}</div>
                      </td>
                      <td className="px-3 py-3 text-xs text-slate-700 whitespace-nowrap">
                        {m.itemType || <span className="text-slate-400">-</span>}
                      </td>
                      <td className="px-3 py-3">
                        {m.resis && m.resis.length > 0 ? (
                          <div className="flex flex-wrap gap-1 items-center">
                            {m.resis.map((rs: string, idx: number) =>
                              /^https?:\/\//i.test(rs) ? (
                                <a
                                  key={idx}
                                  href={rs}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 font-mono text-xs text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded hover:underline whitespace-nowrap"
                                >
                                  <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                  </svg>
                                  Link Bukti
                                </a>
                              ) : (
                                <span
                                  key={idx}
                                  className="inline-flex font-mono text-xs text-slate-700 bg-blue-50 px-1.5 py-0.5 rounded whitespace-nowrap"
                                >
                                  {rs}
                                </span>
                              ),
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 text-xs">-</span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        {m.serialNumbers && m.serialNumbers.length > 0 ? (
                          <div className="flex flex-wrap gap-1 items-center">
                            {m.serialNumbers.map((sn: string, idx: number) => (
                              <span
                                key={idx}
                                className="inline-flex font-mono text-xs text-slate-700 bg-slate-50 px-1.5 py-0.5 rounded whitespace-nowrap"
                              >
                                {sn}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-400 text-xs">-</span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        {m.barcodes && m.barcodes.length > 0 ? (
                          <div className="flex flex-wrap gap-1 items-center">
                            {m.barcodes.map((bc: string, idx: number) => (
                              <span
                                key={idx}
                                className="inline-flex font-mono text-xs text-slate-700 bg-slate-50 px-1.5 py-0.5 rounded whitespace-nowrap"
                              >
                                {bc}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-400 text-xs">-</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-slate-700 text-sm">
                        {m.storeName ? (
                          <span className="inline-flex items-center gap-1 whitespace-nowrap">
                            <svg className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M3 21V7l9-4 9 4v14M9 21V12h6v9" />
                            </svg>
                            {m.storeName}
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        {m.assetStatus ? (
                          <span
                            className={`text-xs font-semibold px-2 py-1 rounded-md whitespace-nowrap ${
                              m.assetStatus === "Baik"
                                ? "bg-blue-50 text-blue-700"
                                : m.assetStatus === "Rusak"
                                ? "bg-red-50 text-red-700"
                                : m.assetStatus === "Service"
                                ? "bg-amber-50 text-amber-700"
                                : "bg-slate-100 text-slate-700"
                            }`}
                          >
                            {m.assetStatus}
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td
                        className={`px-3 py-3 text-right font-bold whitespace-nowrap ${
                          m.type === "in" ? "text-emerald-600" : "text-red-600"
                        }`}
                      >
                        {m.type === "in" ? "+" : "-"}
                        {formatNumber(m.quantity)} {m.unit}
                      </td>
                      <td className="px-3 py-3 text-slate-600 text-xs whitespace-nowrap">
                        {formatDate(m.createdAt)}
                      </td>
                      <td className="px-3 py-3 text-slate-600 text-xs whitespace-nowrap">
                        {m.userName}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              page={page}
              totalPages={Math.max(1, Math.ceil(movements.length / PER_PAGE))}
              totalItems={movements.length}
              perPage={PER_PAGE}
              onPageChange={setPage}
            />
            </>
          )}
        </div>
      </div>
    </AppShell>
  );
}
