"use client";

import { useState } from "react";
import { AppShell } from "@/components/AppShell";

type SearchResult = {
  movementId: number;
  productId: number;
  productName: string;
  productSku: string;
  type: "in" | "out";
  source: "new" | "return";
  serialNumber: string | null;
  barcode: string | null;
  assetStatus: string | null;
  ticketNo: string | null;
  storeName: string | null;
  userName: string;
  createdAt: string;
};

function formatDate(d: string) {
  return new Date(d).toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  async function handleSearch(e?: React.FormEvent) {
    e?.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setSearched(true);
    try {
      const res = await fetch(
        `/api/serial-search?q=${encodeURIComponent(query.trim())}`,
      );
      if (res.ok) {
        const data = await res.json();
        setResults(data.results ?? []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-slate-900">
            Cari Serial Number / Barcode
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Lacak riwayat unit berdasarkan Serial Number atau Barcode
          </p>
        </div>

        <form
          onSubmit={handleSearch}
          className="bg-white rounded-xl border border-slate-200 p-5"
        >
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <svg
                className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ketik Serial Number atau Barcode (min 2 karakter)"
                autoFocus
                className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={loading || query.trim().length < 2}
              className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 text-white font-semibold px-6 py-3 rounded-lg"
            >
              {loading ? "Mencari..." : "Cari"}
            </button>
          </div>
          <p className="text-xs text-slate-500 mt-2">
            Tip: Bisa cari dengan partial match. Contoh: "SN-00" akan menampilkan
            SN-001, SN-002, dst.
          </p>
        </form>

        {loading && (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
            <div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full mx-auto mb-3" />
            <p className="text-slate-500">Mencari...</p>
          </div>
        )}

        {!loading && searched && results.length === 0 && (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
            <div className="w-16 h-16 mx-auto rounded-full bg-slate-100 flex items-center justify-center mb-3">
              <svg
                className="w-8 h-8 text-slate-400"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <p className="font-semibold text-slate-700">Tidak ditemukan</p>
            <p className="text-sm text-slate-500 mt-1">
              Tidak ada data yang cocok dengan "{query}"
            </p>
          </div>
        )}

        {!loading && results.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <p className="text-sm text-slate-700">
                Ditemukan{" "}
                <span className="font-bold text-indigo-600">{results.length}</span>{" "}
                hasil untuk "{query}"
              </p>
            </div>
            <div className="divide-y divide-slate-100">
              {results.map((r, idx) => (
                <div key={`${r.movementId}-${idx}`} className="p-4 hover:bg-slate-50">
                  <div className="flex items-start gap-4">
                    <div
                      className={`w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        r.type === "in"
                          ? "bg-emerald-100 text-emerald-600"
                          : "bg-red-100 text-red-600"
                      }`}
                    >
                      {r.type === "in" ? (
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m0 0l-6-6m6 6l6-6" />
                        </svg>
                      ) : (
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 20V4m0 0l-6 6m6-6l6 6" />
                        </svg>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className={`text-xs font-semibold px-2 py-0.5 rounded-md ${
                            r.type === "in"
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-red-100 text-red-700"
                          }`}
                        >
                          {r.type === "in" ? "MASUK" : "KELUAR"}
                        </span>
                        <span
                          className={`text-xs font-semibold px-2 py-0.5 rounded-md ${
                            r.source === "new"
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-amber-50 text-amber-700"
                          }`}
                        >
                          {r.source === "new" ? "Baru" : "Retur"}
                        </span>
                        {r.assetStatus && (
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700">
                            {r.assetStatus}
                          </span>
                        )}
                      </div>
                      <p className="font-bold text-slate-900">{r.productName}</p>
                      <p className="text-xs text-slate-500 font-mono">
                        {r.productSku}
                      </p>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-3">
                        {r.serialNumber && (
                          <div className="bg-slate-50 rounded-lg p-2">
                            <p className="text-[10px] uppercase text-slate-500 font-semibold">
                              Serial Number
                            </p>
                            <p className="font-mono text-sm text-slate-900 break-all">
                              {r.serialNumber}
                            </p>
                          </div>
                        )}
                        {r.barcode && (
                          <div className="bg-slate-50 rounded-lg p-2">
                            <p className="text-[10px] uppercase text-slate-500 font-semibold">
                              Barcode
                            </p>
                            <p className="font-mono text-sm text-slate-900 break-all">
                              {r.barcode}
                            </p>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-3 mt-3 text-xs text-slate-600">
                        <span>{formatDate(r.createdAt)}</span>
                        <span>{r.userName}</span>
                        {r.ticketNo && <span>{r.ticketNo}</span>}
                        {r.storeName && <span>{r.storeName}</span>}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
