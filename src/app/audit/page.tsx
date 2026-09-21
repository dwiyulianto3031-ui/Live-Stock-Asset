"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";

type AuditLog = {
  id: number;
  userId: number | null;
  userName: string | null;
  action: string;
  entityType: string;
  entityId: number | null;
  description: string | null;
  metadata: string | null;
  ipAddress: string | null;
  createdAt: string;
};

type User = { id: number; fullName: string; role: string };

const ACTION_COLORS: Record<string, string> = {
  LOGIN: "bg-blue-100 text-blue-700",
  LOGOUT: "bg-slate-100 text-slate-700",
  CREATE: "bg-emerald-100 text-emerald-700",
  UPDATE: "bg-amber-100 text-amber-700",
  DELETE: "bg-red-100 text-red-700",
  EXPORT: "bg-purple-100 text-purple-700",
  IMPORT: "bg-indigo-100 text-indigo-700",
  ADJUST: "bg-orange-100 text-orange-700",
  STOCK_IN: "bg-emerald-100 text-emerald-700",
  STOCK_OUT: "bg-red-100 text-red-700",
};

function formatDate(d: string) {
  return new Date(d).toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [action, setAction] = useState("");
  const [userId, setUserId] = useState("");

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      if (action) params.set("action", action);
      if (userId) params.set("userId", userId);
      const res = await fetch(`/api/audit?${params}`);
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs ?? []);
        setUsers(data.users ?? []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [from, to, action, userId]);

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-slate-900">
            Audit Log
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Riwayat aktivitas semua user - untuk tracking selisih stok fisik vs sistem
          </p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Aksi
              </label>
              <select
                value={action}
                onChange={(e) => setAction(e.target.value)}
                className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm outline-none"
              >
                <option value="">Semua Aksi</option>
                <option value="LOGIN">Login</option>
                <option value="LOGOUT">Logout</option>
                <option value="CREATE">Create</option>
                <option value="UPDATE">Update</option>
                <option value="DELETE">Delete</option>
                <option value="STOCK_IN">Stok Masuk</option>
                <option value="STOCK_OUT">Stok Keluar</option>
                <option value="EXPORT">Export</option>
                <option value="IMPORT">Import</option>
                <option value="ADJUST">Adjustment</option>
              </select>
            </div>
            {users.length > 0 && (
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  User
                </label>
                <select
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm outline-none"
                >
                  <option value="">Semua User</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.fullName} ({u.role})
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Dari Tanggal
              </label>
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Sampai Tanggal
              </label>
              <input
                type="date"
                value={to}
                min={from || undefined}
                onChange={(e) => setTo(e.target.value)}
                className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm outline-none"
              />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-slate-500">Memuat...</div>
          ) : logs.length === 0 ? (
            <div className="p-12 text-center">
              <p className="font-semibold text-slate-700">Tidak ada log</p>
              <p className="text-sm text-slate-500 mt-1">
                Belum ada aktivitas yang tercatat
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-600 text-xs uppercase">
                  <tr>
                    <th className="px-4 py-3 text-left">Waktu</th>
                    <th className="px-4 py-3 text-left">User</th>
                    <th className="px-4 py-3 text-left">Aksi</th>
                    <th className="px-4 py-3 text-left">Entitas</th>
                    <th className="px-4 py-3 text-left">Deskripsi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50">
                      <td className="px-4 py-2.5 text-xs whitespace-nowrap text-slate-600">
                        {formatDate(log.createdAt)}
                      </td>
                      <td className="px-4 py-2.5 text-sm font-medium">
                        {log.userName || <span className="text-slate-400">-</span>}
                      </td>
                      <td className="px-4 py-2.5">
                        <span
                          className={`text-xs font-semibold px-2 py-1 rounded-md ${
                            ACTION_COLORS[log.action] ?? "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {log.action}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-xs font-mono">
                        {log.entityType}
                        {log.entityId ? ` #${log.entityId}` : ""}
                      </td>
                      <td className="px-4 py-2.5 text-slate-700 max-w-md truncate">
                        {log.description || (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="px-4 py-2 bg-slate-50 border-t border-slate-200 text-xs text-slate-600">
            Total: {logs.length} log tercatat
          </div>
        </div>
      </div>
    </AppShell>
  );
}
