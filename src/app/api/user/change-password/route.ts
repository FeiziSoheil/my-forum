import { hashPassword, verifyPassword } from "@/lib/auth/helper";
import { requireUserId } from "@/lib/auth/requireUser";
import { dbConnect } from "@/lib/db/mongodb";
import { UserModel } from "@/models/User";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
    try {
        await dbConnect();

        const auth = await requireUserId();
        if ("error" in auth) return auth.error;
        const { userId } = auth;

        const body = await req.json().catch(() => ({}));
        const currentPassword = (body?.currentPassword ?? "").toString();
        const newPassword = (body?.newPassword ?? "").toString();

        if (!currentPassword || !newPassword) {
            return NextResponse.json(
                { error: "Current and new password are required." },
                { status: 400 }
            );
        }
        if (newPassword.length < 6) {
            return NextResponse.json(
                { error: "New password must be at least 6 characters long." },
                { status: 400 }
            );
        }

        const user = await UserModel.findById(userId);
        if (!user || user.isDeleted) {
            return NextResponse.json({ error: "User not found." }, { status: 404 });
        }

        const isValid = await verifyPassword(currentPassword, user.password);
        if (!isValid) {
            return NextResponse.json({ error: "Current password is incorrect." }, { status: 400 });
        }

        if (currentPassword === newPassword) {
            return NextResponse.json(
                { error: "New password must be different from the current one." },
                { status: 400 }
            );
        }

        user.password = await hashPassword(newPassword);
        await user.save();

        return NextResponse.json({ msg: "Password updated successfully." }, { status: 200 });
    } catch (err) {
        console.error("POST /api/user/change-password error:", err);
        return NextResponse.json(
            { error: "Unexpected server error. Please try again later." },
            { status: 500 }
        );
    }
}
