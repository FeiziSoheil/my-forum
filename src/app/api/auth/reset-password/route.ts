import { hashPassword, hashResetToken } from "@/lib/auth/helper";
import { dbConnect } from "@/lib/db/mongodb";
import { UserModel } from "@/models/User";
import { NextRequest, NextResponse } from "next/server";

export const POST = async (req: NextRequest) => {
    try {
        await dbConnect();

        const body = await req.json().catch(() => ({}));
        const token = (body?.token ?? "").toString().trim();
        const password = (body?.password ?? "").toString();

        if (!token) {
            return NextResponse.json({ error: "Reset token is required." }, { status: 400 });
        }
        if (!password || password.length < 6) {
            return NextResponse.json(
                { error: "Password must be at least 6 characters long." },
                { status: 400 }
            );
        }

        const tokenHash = hashResetToken(token);

        // Token must match AND still be valid (not expired).
        const user = await UserModel.findOne({
            resetPasswordToken: tokenHash,
            resetPasswordExpires: { $gt: new Date() },
            isDeleted: { $ne: true },
        }).select("+resetPasswordToken +resetPasswordExpires");

        if (!user) {
            return NextResponse.json(
                { error: "This reset link is invalid or has expired." },
                { status: 400 }
            );
        }

        user.password = await hashPassword(password);
        // Invalidate the token so it can't be reused.
        user.resetPasswordToken = null;
        user.resetPasswordExpires = null;
        await user.save();

        return NextResponse.json({ msg: "Password has been reset. You can now sign in." }, { status: 200 });
    } catch (err: any) {
        return NextResponse.json({ msg: err.message }, { status: 500 });
    }
};
