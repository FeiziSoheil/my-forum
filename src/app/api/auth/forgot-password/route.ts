import { generateResetToken } from "@/lib/auth/helper";
import { dbConnect } from "@/lib/db/mongodb";
import { UserModel } from "@/models/User";
import { NextRequest, NextResponse } from "next/server";

// Always responds with 200 + a generic message so an attacker cannot use this
// endpoint to enumerate which emails/usernames exist in the system.
const GENERIC_MESSAGE =
    "If an account matches that email or username, a password reset link has been generated.";

export const POST = async (req: NextRequest) => {
    try {
        await dbConnect();

        const body = await req.json().catch(() => ({}));
        const loginId = (body?.loginId ?? "").toString().trim();

        if (!loginId) {
            return NextResponse.json({ error: "loginId is required" }, { status: 400 });
        }

        const user = await UserModel.findOne({
            $or: [{ email: loginId }, { username: loginId }],
            isDeleted: { $ne: true },
        });

        // Dev-only shortcut: since there's no email service wired up yet, we surface
        // the raw token so the flow can be tested end-to-end. In production this
        // token must ONLY be delivered via email and never returned in the response.
        // TODO: replace with a real transactional email service (e.g. Resend/SES).
        let devToken: string | undefined;

        if (user) {
            const { token, tokenHash, expires } = generateResetToken();
            user.resetPasswordToken = tokenHash;
            user.resetPasswordExpires = expires;
            await user.save();

            if (process.env.NODE_ENV !== "production") {
                devToken = token;
                console.log(
                    `[DEV] Password reset token for "${user.username}": ${token}\n` +
                    `[DEV] Reset link: /auth/reset?token=${token}`
                );
            }
        }

        const payload: { msg: string; devToken?: string } = { msg: GENERIC_MESSAGE };
        // Only leak the token in non-production to keep the dev flow usable.
        if (devToken) payload.devToken = devToken;

        return NextResponse.json(payload, { status: 200 });
    } catch (err: any) {
        return NextResponse.json({ msg: err.message }, { status: 500 });
    }
};
