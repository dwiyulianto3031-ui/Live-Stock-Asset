import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "LIVE STOCK ASSET — Sistem Manajemen Stok Gudang",
  description:
    "Aplikasi manajemen stok gudang dengan live stock, pencatatan barang masuk/keluar, dan autentikasi.",
  icons: {
    icon: [
      {
        url:
          "data:image/svg+xml," +
          encodeURIComponent(
            `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
              <defs>
                <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stop-color="#6366f1"/>
                  <stop offset="50%" stop-color="#8b5cf6"/>
                  <stop offset="100%" stop-color="#ec4899"/>
                </linearGradient>
              </defs>
              <rect width="64" height="64" rx="14" fill="url(#g)"/>
              <path d="M32 12 L50 21 L50 43 L32 52 L14 43 L14 21 Z" fill="none" stroke="#fff" stroke-width="3.5" stroke-linejoin="round"/>
              <path d="M14 21 L32 30 L50 21" fill="none" stroke="#fff" stroke-width="3.5" stroke-linejoin="round"/>
              <path d="M32 30 L32 52" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round"/>
              <path d="M20 27 L27 24 M37 24 L44 27" stroke="#fff" stroke-width="2.5" stroke-linecap="round" opacity="0.85"/>
            </svg>`,
          ),
        type: "image/svg+xml",
      },
    ],
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="id">
      <body className="bg-slate-100 text-slate-900 antialiased">{children}</body>
    </html>
  );
}
