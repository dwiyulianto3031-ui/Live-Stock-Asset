import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "GudangPro — Sistem Manajemen Stok Gudang",
  description:
    "Aplikasi manajemen stok gudang dengan live stock, pencatatan barang masuk/keluar, dan autentikasi.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="id">
      <body className="bg-slate-100 text-slate-900 antialiased">{children}</body>
    </html>
  );
}
