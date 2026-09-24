"use client";

import { useEffect, useState } from "react";

export type CurrentUser = {
  id: number;
  username: string;
  fullName: string;
  role: string;
};

/**
 * Hook untuk mengecek status login di client.
 * Guest = belum login -> tidak boleh input/edit/hapus (read-only).
 */
export function useAuth() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    fetch("/api/auth/me", {
      cache: "no-store",
      credentials: "same-origin",
      headers: { "Cache-Control": "no-cache" },
    })
      .then((r) => r.json())
      .then((d) => {
        if (mounted) setUser(d?.user ?? null);
      })
      .catch(() => {
        if (mounted) setUser(null);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  return {
    user,
    loading,
    isGuest: !loading && !user,
    isAdmin: user?.role === "admin",
  };
}
