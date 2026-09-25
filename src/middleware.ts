import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { SESSION_COOKIE } from "@/lib/auth";

// Endpoint yang boleh diakses tanpa login (read-only publik)
const PUBLIC_GET = [
  "/api/health",
  "/api/auth/me",
  "/api/auth/login",
  "/api/auth/register",
  "/api/products",
  "/api/movements",
  "/api/stats",
  "/api/reports",
  "/api/serial-search",
  "/api/activity-chart",
  "/api/audit",
  "/api/diagnostic",
  "/api/cron/stock-alert",
  "/api/source-zip",
  "/api/opname",
  "/api/stock-alerts",
  "/api/asset-status",
  "/api/products/archive",
  "/api/products/validate-duplicate",
];

// Semua method yang mengubah data WAJIB login
const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET ??
    "gudang-secret-dev-change-me-please-32chars!!",
);

async function isAuthed(req: NextRequest): Promise<boolean> {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return false;
  try {
    await jwtVerify(token, JWT_SECRET);
    return true;
  } catch {
    return false;
  }
}

export async function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;
  const method = req.method.toUpperCase();

  // 1. Semua method WRITE (POST/PUT/PATCH/DELETE) wajib login
  if (WRITE_METHODS.has(method)) {
    // Endpoint auth (login/register/logout) dikecualikan
    const isAuthEndpoint =
      pathname.startsWith("/api/auth/login") ||
      pathname.startsWith("/api/auth/register") ||
      pathname.startsWith("/api/auth/logout");

    if (!isAuthEndpoint) {
      const ok = await isAuthed(req);
      if (!ok) {
        return NextResponse.json(
          {
            error:
              "Mode pengunjung tidak dapat melakukan perubahan data. Silakan masuk terlebih dahulu.",
            code: "UNAUTHORIZED_GUEST",
          },
          { status: 401 },
        );
      }
    }
    return NextResponse.next();
  }

  // 2. Method GET/HEAD: izinkan hanya untuk endpoint publik (read-only)
  if (method === "GET" || method === "HEAD") {
    const isPublic = PUBLIC_GET.some(
      (p) => pathname === p || pathname.startsWith(p + "/") || pathname.startsWith(p),
    );
    if (isPublic) return NextResponse.next();

    // Endpoint API lain yang tidak terdaftar -> tolak
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "Endpoint tidak tersedia.", code: "NOT_FOUND" },
        { status: 404 },
      );
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}


export const config = {
  matcher: ["/api/:path*"],
};
