import { verifyPassword } from "@/lib/auth/helper";
import { signAccessToken, signRefreshToken } from "@/lib/auth/jwt";
import { dbConnect } from "@/lib/db/mongodb";
import { UserModel } from "@/models/User";
import { loginRequest, User } from "@/types/user";
import { NextRequest, NextResponse } from "next/server";

export const POST  = async (req:NextRequest) => {
    try{

        await dbConnect()

        const body : loginRequest =await req.json()
        const {loginId ,password } = body

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

    const user = await UserModel.findOne({$or:[{email:loginId},{username:loginId}]})

    if(!user){
        return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const isValidPass : boolean = await verifyPassword(password,user.password)
    if(!isValidPass){
        return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }
    
    const accessToken = await signAccessToken({uid:user._id.toString()})
    const refreshToken = await signRefreshToken({uid:user._id.toString()})

    const resp = NextResponse.json({ msg: 'ok', data: user }, { status: 200 });
    resp.cookies.set('atk', accessToken, { httpOnly: true, secure: false, sameSite: 'lax', path: '/', maxAge: 15 * 60 });

    resp.cookies.set('rtk', refreshToken, { httpOnly: true, secure: false, sameSite: 'lax', path: '/', maxAge: 7 * 24 * 3600 });
    return resp;
  } catch (err: any) {
    return NextResponse.json({ msg: err.message }, { status: 500 });

    }
}