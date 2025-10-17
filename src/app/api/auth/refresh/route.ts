import { NextRequest, NextResponse } from 'next/server';

import { UserModel } from '@/models/User';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '@/lib/auth/jwt';
import { dbConnect } from '@/lib/db/mongodb';
import { User } from '@/types/user';

export async function POST(req: NextRequest) {
  try {
    await dbConnect();

 
    const rtk = req.cookies.get('rtk')?.value;
    if (!rtk) return NextResponse.json({ msg: 'No refresh token' }, { status: 401 });

    
    let payload;
    try {
      payload = await verifyRefreshToken(rtk);
    } catch {
      return NextResponse.json({ msg: 'Invalid refresh token' }, { status: 401 });
    }

    const userId = payload.uid as string;
    const user  = await UserModel.findById(userId).lean<User>();
    if (!user) return NextResponse.json({ msg: 'User not found' }, { status: 401 });


    const newAtk = await signAccessToken({ uid: user._id?.toString() });
    const newRtk = await signRefreshToken({ uid: user._id?.toString() }); 


    const res = NextResponse.json({ msg: 'token refreshed' });
    res.cookies.set('atk', newAtk, { httpOnly: true, secure: false, sameSite: 'lax', path: '/', maxAge: 15 * 60 });
    res.cookies.set('rtk', newRtk, { httpOnly: true, secure: false, sameSite: 'lax', path: '/', maxAge: 7 * 24 * 3600 });
    return res;
  } catch (err: any) {
    return NextResponse.json({ msg: err.message }, { status: 500 });
  }
}