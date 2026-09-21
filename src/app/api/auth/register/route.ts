import { NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import {
  createSessionToken,
  hashPassword,
  setSessionCookie,
} from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const username = String(body.username ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");

    if (!username || !password) {
      return NextResponse.json(
        { error: "Username dan password wajib diisi" },
        { status: 400 },
      );
    }
    if (username.length < 3 || password.length < 6) {
      return NextResponse.json(
        { error: "Username min 3 karakter, password min 6 karakter" },
        { status: 400 },
      );
    }

    const existing = await db
      .select()
      .from(users)
      .where(eq(users.username, username))
      .limit(1);

    if (existing.length > 0) {
      return NextResponse.json(
        { error: "Username sudah terdaftar" },
        { status: 409 },
      );
    }

    const fullName = String(body.fullName ?? username).trim() || username;
    const email = body.email ? String(body.email).trim() : null;
    const passwordHash = await hashPassword(password);

    // Cek apakah ini user pertama (akan jadi admin, sisanya PIC)
    const userCount = await db.select({ count: sql<number>`count(*)::int` }).from(users);
    const isFirstUser = (userCount[0]?.count ?? 0) === 0;
    const role = isFirstUser ? "admin" : "pic";

    const [user] = await db
      .insert(users)
      .values({
        username,
        passwordHash,
        fullName,
        email,
        role,
      })
      .returning({
        id: users.id,
        username: users.username,
        fullName: users.fullName,
        role: users.role,
      });

    const token = await createSessionToken({
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      role: user.role as "admin" | "pic",
    });
    await setSessionCookie(token);

    await logAudit({
      userId: user.id,
      userName: user.fullName,
      action: "CREATE",
      entityType: "user",
      entityId: user.id,
      description: `User baru terdaftar: ${user.username} (${user.role})`,
    });

    return NextResponse.json({
      user: {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        role: user.role,
        isFirstUser,
      },
    });
  } catch (err: any) {
    console.error("REGISTER ERROR:", err);
    const msg = String(err?.message ?? err ?? "");

    // Berikan pesan yang spesifik supaya mudah diperbaiki
    if (msg.includes("relation") && msg.includes("does not exist")) {
      return NextResponse.json(
        {
          error:
            "Tabel database belum dibuat. Buka Supabase > SQL Editor > jalankan SQL dari DEPLOYMENT.md",
        },
        { status: 500 },
      );
    }
    if (
      msg.includes("password authentication failed") ||
      msg.includes("Authentication failed") ||
      msg.includes("28P01")
    ) {
      return NextResponse.json(
        {
          error:
            "Password database salah. Cek ulang DATABASE_URL di Vercel (Settings > Environment Variables)",
        },
        { status: 500 },
      );
    }
    if (
      msg.includes("getaddrinfo ENOTFOUND") ||
      msg.includes("ENOTFOUND") ||
      msg.includes("ETIMEDOUT") ||
      msg.includes("connect ECONNREFUSED")
    ) {
      return NextResponse.json(
        {
          error:
            "Tidak bisa terhubung ke database. Host di DATABASE_URL kemungkinan salah.",
        },
        { status: 500 },
      );
    }
    if (msg.includes("SSL") || msg.includes("certificate")) {
      return NextResponse.json(
        { error: "Masalah koneksi SSL ke database. Cek connection string." },
        { status: 500 },
      );
    }
  } catch (err: any) {
    console.error("REGISTER ERROR:", err);
    const msg = String(err?.message ?? err ?? "");
    if (msg.includes("relation") && msg.includes("does not exist")) {
      return NextResponse.json(
        {
          error:
            "Tabel database belum dibuat. Jalankan SQL di Supabase SQL Editor.",
        },
        { status: 500 },
      );
    }
    if (
      msg.includes("password authentication failed") ||
      msg.includes("28P01")
    ) {
      return NextResponse.json(
        {
          error:
            "Password database salah. Cek DATABASE_URL di Vercel (pastikan password benar & tanpa spasi).",
        },
        { status: 500 },
      );
    }
    if (msg.includes("ENOTFOUND") || msg.includes("ETIMEDOUT")) {
      return NextResponse.json(
        {
          error:
            "Tidak bisa terhubung ke database. Cek host DATABASE_URL (harus .pooler.supabase.com).",
        },
        { status: 500 },
      );
    }
    return NextResponse.json(
      { error: `Gagal registrasi: ${msg.slice(0, 200)}` },
      { status: 500 },
    );
  }
}
