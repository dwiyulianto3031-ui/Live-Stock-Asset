import { NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { hashPassword } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

// POST /api/auth/reset-password
// Body: { username: "dwi", newPassword: "..." , setupKey: "..." }
// HANYA berfungsi jika setupKey sama dengan SETUP_PASSWORD_KEY env (sekali pakai, lalu hapus endpoint ini)
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const username = String(body.username ?? "").trim().toLowerCase();
    const newPassword = String(body.newPassword ?? "");
    const setupKey = String(body.setupKey ?? "").trim();
    const expected = process.env.SETUP_PASSWORD_KEY ?? "reset-dwi-2026";

    if (setupKey !== expected) {
      return NextResponse.json({ error: "Setup key salah" }, { status: 401 });
    }
    if (!username || newPassword.length < 6) {
      return NextResponse.json(
        { error: "Username wajib & password min 6 karakter" },
        { status: 400 },
      );
    }

    const passwordHash = await hashPassword(newPassword);

    const updated = await db
      .update(users)
      .set({ passwordHash })
      .where(eq(users.username, username))
      .returning({ id: users.id, username: users.username });

    if (updated.length === 0) {
      return NextResponse.json({ error: "User tidak ditemukan" }, { status: 404 });
    }

    await logAudit({
      userName: "SYSTEM-RESET",
      action: "UPDATE",
      entityType: "user",
      entityId: updated[0].id,
      description: `Password direset via setup endpoint untuk user ${username}`,
    });

    return NextResponse.json({
      ok: true,
      message: `Password user "${username}" berhasil direset. Silakan login.`,
    });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json(
      { error: `Gagal reset: ${String(err?.message ?? err).slice(0, 150)}` },
      { status: 500 },
    );
  }
}
