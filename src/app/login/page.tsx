"use client";

import { useState, FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Login gagal");
        return;
      }
      router.push("/");
      router.refresh();
    } catch (err) {
      setError("Terjadi kesalahan jaringan");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="relative inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-gradient-to-br from-indigo-500 via-violet-500 to-pink-500 shadow-xl shadow-indigo-500/40 mb-4 overflow-hidden">
            <svg
              className="relative w-9 h-9 text-white drop-shadow"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              viewBox="0 0 24 24"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5v-9Z" />
              <path d="M3 7.5 12 12l9-4.5" />
              <path d="M12 12v9" />
              <path d="M7.5 5.25 16.5 9.75" opacity=".7" strokeWidth="1.4" />
            </svg>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">
            LIVE STOCK{" "}
            <span className="bg-gradient-to-r from-indigo-400 to-pink-400 bg-clip-text text-transparent">
              ASSET
            </span>
          </h1>
          <p className="text-slate-400 mt-1 tracking-wider uppercase text-xs">
            Asset Management System
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h2 className="text-2xl font-bold text-slate-900 mb-1">Selamat datang kembali</h2>
          <p className="text-slate-500 text-sm mb-6">
            Masuk untuk mengelola stok gudang Anda
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoFocus
                autoComplete="username"
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                placeholder="masukkan username"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                placeholder="masukkan password"
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 disabled:opacity-60 text-white font-semibold py-2.5 rounded-lg transition shadow-lg shadow-indigo-500/30"
            >
              {loading ? "Memproses..." : "Masuk"}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-slate-600">
            Belum punya akun?{" "}
            <Link
              href="/register"
              className="text-indigo-600 hover:text-indigo-700 font-semibold"
            >
              Daftar di sini
            </Link>
          </div>
        </div>

        <p className="text-center text-slate-500 text-xs mt-6">
          © 2026 LIVE STOCK ASSET. Dibuat dengan Next.js & PostgreSQL
        </p>
      </div>
    </div>
  );
}
