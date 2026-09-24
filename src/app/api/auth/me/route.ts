import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET /api/auth/me - info user yang sedang login (atau null untuk guest)
export async function GET() {
  const user = await getSession();
  const payload = user
    ? {
        user: {
          id: user.id,
          username: user.username,
          fullName: user.fullName,
          role: user.role,
        },
        guest: false,
      }
    : { user: null, guest: true };

  return NextResponse.json(payload, {
    headers: { "Cache-Control": "no-store, max-age=0, must-revalidate" },
  });
}
