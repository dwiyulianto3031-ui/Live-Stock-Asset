"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { AppShell } from "@/components/AppShell";

type ActivityPeriod = "day" | "week" | "month";

type ActivityData = {
  period: ActivityPeriod;
  labels: string[];
  masuk: number[];
  keluar: number[];
};

type Movement = {
  id: number;
  type: "in" | "out";
  quantity: number;
  productName: string;
  productSku: string;
  unit: string;
  ticketNo?: string | null;
  storeName?: string | null;
  createdAt: string;
};

type TopProduct = {
  productId: number;
  productName: string;
  productSku: string;
  totalOut: number;
  unit: string;
};

type Stats = {
  totalProducts: number;
  totalStock: number;
  totalNewStock: number;
  totalReturnStock: number;
  lowStock: number;
  categories: { category: string; count: number }[];
  topProducts: TopProduct[];
  recentMovements: Movement[];
  inflowToday: number;
  outflowToday: number;
};

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

function formatNumber(n: number) {
  return n.toLocaleString("id-ID");
}

function formatDate(d: string) {
  const date = new Date(d);
  return date.toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatChartLabel(label: string, period: ActivityPeriod) {
  const d = new Date(label + "T00:00:00");
  if (period === "month") {
    return d.toLocaleDateString("id-ID", { month: "short", year: "2-digit" });
  }
  const today = new Date();
  const diffDays = Math.round(
    (new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime() -
      new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) /
      86400000,
  );
  // Tampilkan label H, H-1, H-2
  if (diffDays === 0) return "H (hari ini)";
  if (diffDays === 1) return "H-1";
  return `H-${diffDays}`;
}

function periodLabel(period: ActivityPeriod) {
  if (period === "day") return "H s/d H-2 (3 hari)";
  if (period === "week") return "7 hari terakhir";
  return "12 bulan terakhir";
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [lowStockProducts, setLowStockProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [activityPeriod, setActivityPeriod] = useState<ActivityPeriod>("day");
  const [activityData, setActivityData] = useState<ActivityData | null>(null);
  const [activityLoading, setActivityLoading] = useState(true);

  const loadActivity = useCallback(async (period: ActivityPeriod) => {
    try {
      const res = await fetch(`/api/activity-chart?period=${period}`);
      if (res.ok) {
        const data = await res.json();
        setActivityData(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setActivityLoading(false);
    }
  }, []);

  const load = useCallback(async () => {
    try {
      const [statsRes, prodRes] = await Promise.all([
        fetch("/api/stats"),
        fetch("/api/products"),
      ]);
      if (statsRes.ok) {
        const s = await statsRes.json();
        setStats(s);
      }
      if (prodRes.ok) {
        const p = await prodRes.json();
        const low = (p.products as Product[]).filter(
          (x) => x.newStock + x.returnStock <= x.minStock,
        );
        setLowStockProducts(low);
      }
      setLastUpdate(new Date());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    loadActivity(activityPeriod);
    const interval = setInterval(load, 5000); // auto-refresh setiap 5 detik untuk live stok
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  useEffect(() => {
    setActivityLoading(true);
    loadActivity(activityPeriod);
  }, [activityPeriod, loadActivity]);

  if (loading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center h-64">
          <div className="text-slate-500">Memuat data...</div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-slate-500 text-sm mt-1">
            Ringkasan stok gudang Anda — diperbarui otomatis
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          Update terakhir:{" "}
          {lastUpdate
            ? lastUpdate.toLocaleTimeString("id-ID")
            : "-"}
          <button
            onClick={load}
            className="ml-2 px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard
          label="Total Produk"
          value={formatNumber(stats?.totalProducts ?? 0)}
          sub="Jenis barang terdaftar"
          color="from-indigo-500 to-purple-600"
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          }
        />
        <StatCard
          label="Total Stok"
          value={formatNumber(stats?.totalStock ?? 0)}
          sub="Unit barang tersedia"
          color="from-emerald-500 to-teal-600"
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 7v10c0 2 1 3 3 3h10c2 0 3-1 3-3V7c0-2-1-3-3-3H7C5 4 4 5 4 7z M4 12h16" />
            </svg>
          }
        />
        <StatCard
          label="Stok Baru"
          value={formatNumber(stats?.totalNewStock ?? 0)}
          sub="Unit kondisi baru"
          color="from-emerald-400 to-green-600"
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          }
        />
        <StatCard
          label="Stok Retur"
          value={formatNumber(stats?.totalReturnStock ?? 0)}
          sub="Unit kondisi retur"
          color="from-amber-400 to-orange-600"
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          }
        />
        <StatCard
          label="Masuk Hari Ini"
          value={`+${formatNumber(stats?.inflowToday ?? 0)}`}
          sub="Unit ditambahkan"
          color="from-blue-500 to-cyan-600"
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m0 0l-6-6m6 6l6-6" />
            </svg>
          }
        />
        <StatCard
          label="Keluar Hari Ini"
          value={`-${formatNumber(stats?.outflowToday ?? 0)}`}
          sub="Unit digunakan"
          color="from-orange-500 to-red-600"
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 20V4m0 0l-6 6m6-6l6 6" />
            </svg>
          }
        />
      </div>

      {/* Alert low stock */}
      {(stats?.lowStock ?? 0) > 0 && (
        <div className="bg-gradient-to-r from-amber-50 to-red-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-500 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M12 2l10 18H2L12 2z" />
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-amber-900">
              Peringatan Stok Menipis!
            </h3>
            <p className="text-sm text-amber-800 mt-0.5">
              Ada {stats?.lowStock} produk dengan stok di bawah batas minimum. Segera lakukan restok.
            </p>
          </div>
          <Link
            href="#low-stock"
            className="text-sm font-semibold text-amber-700 hover:text-amber-900"
          >
            Lihat →
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Grafik Aktivitas Stok */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-bold text-slate-900">Aktivitas Stok</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Diagram batang barang masuk & keluar
              </p>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={activityPeriod}
                onChange={(e) => setActivityPeriod(e.target.value as ActivityPeriod)}
                className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white"
              >
                <option value="day">Per Hari (H s/d H-2)</option>
                <option value="week">Per Minggu (7 hari terakhir)</option>
                <option value="month">Per Bulan (12 bulan)</option>
              </select>
              <Link
                href="/movements"
                className="text-sm text-indigo-600 hover:text-indigo-700 font-medium whitespace-nowrap"
              >
                Detail →
              </Link>
            </div>
          </div>

          {activityLoading ? (
            <div className="p-12 text-center text-slate-500 text-sm">
              Memuat grafik...
            </div>
          ) : !activityData ? (
            <div className="p-8 text-center text-slate-500 text-sm">
              Gagal memuat grafik
            </div>
          ) : (
            <div className="p-4">
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={activityData.labels.map((label, i) => ({
                      label: formatChartLabel(label, activityPeriod),
                      Masuk: activityData.masuk[i],
                      Keluar: activityData.keluar[i],
                    }))}
                    margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 11, fill: "#64748b" }}
                      angle={activityPeriod === "month" ? -20 : 0}
                      textAnchor={activityPeriod === "month" ? "end" : "middle"}
                      height={activityPeriod === "month" ? 50 : 30}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fontSize: 11, fill: "#64748b" }}
                    />
                    <Tooltip
                      formatter={(value, name) => [
                        `${formatNumber(Number(value ?? 0))} unit`,
                        String(name),
                      ]}
                      contentStyle={{
                        borderRadius: 8,
                        border: "1px solid #e2e8f0",
                        fontSize: 12,
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar
                      dataKey="Masuk"
                      fill="#10b981"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={40}
                    />
                    <Bar
                      dataKey="Keluar"
                      fill="#ef4444"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={40}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Ringkasan periode */}
              <div className="grid grid-cols-2 gap-3 mt-4">
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-emerald-500 flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m0 0l-6-6m6 6l6-6" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs text-emerald-700 font-medium">
                      Total Masuk ({periodLabel(activityPeriod)})
                    </p>
                    <p className="text-xl font-bold text-emerald-700">
                      +{formatNumber(activityData.masuk.reduce((a, b) => a + b, 0))} unit
                    </p>
                  </div>
                </div>
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-red-500 flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 20V4m0 0l-6 6m6-6l6 6" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs text-red-700 font-medium">
                      Total Keluar ({periodLabel(activityPeriod)})
                    </p>
                    <p className="text-xl font-bold text-red-700">
                      -{formatNumber(activityData.keluar.reduce((a, b) => a + b, 0))} unit
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Top Products (Fast Moving) */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h2 className="font-bold text-slate-900">Top Products</h2>
              <p className="text-xs text-slate-500 mt-0.5">Paling sering keluar</p>
            </div>
            <span className="text-xs font-medium bg-red-50 text-red-700 px-2 py-1 rounded-md">
              Fast Moving
            </span>
          </div>
          {!stats?.topProducts || stats.topProducts.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-sm">
              Belum ada data barang keluar
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {stats.topProducts.slice(0, 5).map((p, idx) => {
                const max = stats.topProducts[0]?.totalOut ?? 1;
                const pct = Math.round((p.totalOut / max) * 100);
                return (
                  <div key={p.productId} className="px-5 py-3">
                    <div className="flex items-center gap-3 mb-1.5">
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
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-900 truncate">
                          {p.productName}
                        </p>
                        <p className="text-xs text-slate-500 font-mono">{p.productSku}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-red-600">
                          {formatNumber(p.totalOut)}
                        </p>
                        <p className="text-[10px] text-slate-500">{p.unit}</p>
                      </div>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden ml-10">
                      <div
                        className="h-full bg-gradient-to-r from-red-400 to-orange-500 rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Low stock table */}
      {lowStockProducts.length > 0 && (
        <div id="low-stock" className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200">
            <h2 className="font-bold text-slate-900">
              Produk dengan Stok Menipis
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600 text-xs uppercase">
                <tr>
                  <th className="px-5 py-3 text-left">SKU</th>
                  <th className="px-5 py-3 text-left">Nama Produk</th>
                  <th className="px-5 py-3 text-right">Stok</th>
                  <th className="px-5 py-3 text-right">Minimum</th>
                  <th className="px-5 py-3 text-left">Status</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {lowStockProducts.slice(0, 10).map((p) => {
                  const total = p.newStock + p.returnStock;
                  const empty = total === 0;
                  return (
                    <tr
                      key={p.id}
                      className={`hover:bg-slate-50 ${
                        empty ? "bg-red-50/60" : "bg-amber-50/30"
                      }`}
                    >
                      <td className="px-5 py-3 font-mono text-xs text-slate-600">
                        {p.sku}
                      </td>
                      <td className="px-5 py-3 font-medium text-slate-900">
                        {p.name}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <span className={`font-bold ${empty ? "text-red-600" : "text-amber-600"}`}>
                          {formatNumber(total)}
                        </span>
                        <span className="text-slate-500 ml-1">{p.unit}</span>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          Baru: {p.newStock} · Retur: {p.returnStock}
                        </div>
                      </td>
                      <td className="px-5 py-3 text-right text-slate-500">
                        {formatNumber(p.minStock)} {p.unit}
                      </td>
                      <td className="px-5 py-3">
                        {empty ? (
                          <span className="inline-flex items-center gap-1 text-xs font-bold bg-red-600 text-white px-2.5 py-1 rounded-md">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                            </svg>
                            Habis
                          </span>
                        ) : (
                          <span className="text-xs font-semibold bg-amber-100 text-amber-700 px-2.5 py-1 rounded-md">
                            Menipis
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <Link
                          href="/movements"
                          className="text-xs font-semibold text-indigo-600 hover:text-indigo-700"
                        >
                          Restok →
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
    </AppShell>
  );
}

function StatCard({
  label,
  value,
  sub,
  color,
  icon,
}: {
  label: string;
  value: string;
  sub: string;
  color: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md transition">
      <div className="flex items-start justify-between mb-3">
        <div
          className={`w-11 h-11 rounded-xl bg-gradient-to-br ${color} text-white flex items-center justify-center shadow-md`}
        >
          {icon}
        </div>
      </div>
      <p className="text-2xl lg:text-3xl font-bold text-slate-900">{value}</p>
      <p className="text-sm font-semibold text-slate-700 mt-1">{label}</p>
      <p className="text-xs text-slate-500 mt-0.5">{sub}</p>
    </div>
  );
}
