import { signAccessToken, signRefreshToken } from "@/lib/auth/jwt";
import { dbConnect } from "@/lib/db/mongodb";
import { UserModel } from "@/models/User";
import { RegisterRequest, User } from "@/types/user";
import { NextRequest, NextResponse } from "next/server";

export const POST = async (req: NextRequest) => {
    try {
        await dbConnect()
        const body: RegisterRequest = await req.json()
        const { username, fullname, email, password, confirmPassword } = body
        if (!username || !fullname || !email || !password || !confirmPassword) {
            return new Response(JSON.stringify({ error: "All fields are required." }), { status: 400 });
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return NextResponse.json({ error: "Invalid email format." }, { status: 400 });
        }

        if (password !== confirmPassword) {
            return NextResponse.json({ error: "Passwords do not match." }, { status: 400 });
        }

        if (password.length < 6) {
            return NextResponse.json({ error: "Password must be at least 6 characters long." }, { status: 400 });
        }

        const existsUser = await UserModel.findOne({ $or: [{ email }, { username }] })
        if (existsUser) {
            return NextResponse.json({ msg: 'User exists' }, { status: 409 });
        }

        const user: User = await UserModel.create({ username, fullname, email, password })

        const accessToken = await signAccessToken({ uid: user._id })
        const refreshToken = await signRefreshToken({ uid: user._id })

        const resp = NextResponse.json({ msg: 'ok' }, { status: 201 })
        resp.cookies.set('atk', accessToken, { httpOnly: true, secure: false, sameSite: 'lax', path: '/', maxAge: 15 * 60 });
        resp.cookies.set('rtk', refreshToken, { httpOnly: true, secure: false, sameSite: 'lax', path: '/', maxAge: 7 * 24 * 3600 });

        return resp;
    } catch (err: any) {
        return NextResponse.json({ msg: err.message }, { status: 500 });
    }
}