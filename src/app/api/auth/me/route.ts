import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

// GET /api/auth/me - info user yang sedang login (atau null untuk guest)
export async function GET() {
  const user = await getSession();
  if (!user) {
    return NextResponse.json({ user: null, guest: true });
  }
  return NextResponse.json({
    user: {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      role: user.role,
    },
    guest: false,
  });
}
