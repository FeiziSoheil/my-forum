import { sanitizeUser, verifyPassword } from "@/lib/auth/helper";
import { signAccessToken, signRefreshToken } from "@/lib/auth/jwt";
import { dbConnect } from "@/lib/db/mongodb";
import { UserModel } from "@/models/User";
import { loginRequest, User } from "@/types/user";
import { NextRequest, NextResponse } from "next/server";

export const POST  = async (req:NextRequest) => {
    try{

        await dbConnect()

        const body : loginRequest =await req.json()
        const {loginId ,password, remember } = body

        if (!password) {
            return NextResponse.json(
              { error: 'Password is required' },
              { status: 400 }
            );
          }
          if (!loginId) {
            return NextResponse.json(
              { error: 'loginId is required' },
              { status: 400 }
            );
          }

    const user = await UserModel.findOne({$or:[{email:loginId},{username:loginId}], isDeleted: { $ne: true }})

    if(!user){
        return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const isValidPass : boolean = await verifyPassword(password,user.password)
    if(!isValidPass){
        return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }
    
    const accessToken = await signAccessToken({uid:user._id.toString()})
    const refreshToken = await signRefreshToken({uid:user._id.toString()})

    // "Remember me": persist the refresh cookie for 30 days. Otherwise omit
    // maxAge so it becomes a session cookie that is cleared when the browser
    // closes. The JWT itself still carries its own 7d expiry (see jwt.ts).
    const refreshCookieOpts: {
        httpOnly: boolean; secure: boolean; sameSite: 'lax'; path: string; maxAge?: number;
    } = {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
    };
    if (remember) {
        refreshCookieOpts.maxAge = 30 * 24 * 3600;
    }

    const resp = NextResponse.json({ msg: 'ok', data: sanitizeUser(user) }, { status: 200 });
    resp.cookies.set('atk', accessToken, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 15 * 60 });

    resp.cookies.set('rtk', refreshToken, refreshCookieOpts);
    return resp;
  } catch (err: any) {
    return NextResponse.json({ msg: err.message }, { status: 500 });

    }
}