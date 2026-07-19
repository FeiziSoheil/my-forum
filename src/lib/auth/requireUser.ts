import { verifyAccessToken } from "@/lib/auth/jwt";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function requireUserId(): Promise<
  { userId: string } | { error: NextResponse }
> {
  const cookieStore = cookies();
  const atk = (await cookieStore).get("atk")?.value;
  if (!atk) {
    return {
      error: NextResponse.json(
        { error: "Authentication token missing." },
        { status: 401 }
      ),
    };
  }

  try {
    const payload = await verifyAccessToken(atk);
    const userId = payload.uid as string;
    if (!userId) {
      return {
        error: NextResponse.json(
          { error: "Invalid authentication token." },
          { status: 401 }
        ),
      };
    }
    return { userId };
  } catch {
    return {
      error: NextResponse.json(
        { error: "Invalid or expired authentication token." },
        { status: 401 }
      ),
    };
  }
}
