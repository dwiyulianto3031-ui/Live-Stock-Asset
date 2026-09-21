import { NextResponse } from "next/server";
import { db } from "@/db";
import { auditLogs, users } from "@/db/schema";
import { desc, eq, and, gte, lte } from "drizzle-orm";
import { getSession } from "@/lib/auth";

// GET /api/audit - WAJIB LOGIN (audit log hanya untuk user yang login)
export async function GET(request: Request) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json(
        {
          error: "Audit log hanya dapat dilihat oleh user yang sudah login.",
          code: "LOGIN_REQUIRED",
        },
        { status: 401 },
      );
    }

    const url = new URL(request.url);
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    const action = url.searchParams.get("action");
    const userId = url.searchParams.get("userId");
    const limit = Math.min(Number(url.searchParams.get("limit") ?? 200), 500);

    const conditions: any[] = [];
    if (user.role !== "admin") {
      conditions.push(eq(auditLogs.userId, user.id));
    } else if (userId) {
      conditions.push(eq(auditLogs.userId, Number(userId)));
    }

    if (from) conditions.push(gte(auditLogs.createdAt, new Date(from)));
    if (to) {
      const toDate = new Date(to);
      toDate.setHours(23, 59, 59, 999);
      conditions.push(lte(auditLogs.createdAt, toDate));
    }
    if (action) conditions.push(eq(auditLogs.action, action));

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const rows = await db
      .select()
      .from(auditLogs)
      .where(where)
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit);

    let userList: any[] = [];
    if (user.role === "admin") {
      userList = await db
        .select({
          id: users.id,
          fullName: users.fullName,
          role: users.role,
        })
        .from(users);
    }

    return NextResponse.json({ logs: rows, users: userList, role: user.role });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Gagal memuat audit log" }, { status: 500 });
  }
}
