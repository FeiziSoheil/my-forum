import { NextRequest, NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db/mongodb';
import { verifyAccessToken } from '@/lib/auth/jwt';
import { UserModel } from '@/models/User';

export async function GET(req: NextRequest) {
  try {
    await dbConnect();

    const atk = req.cookies.get('atk')?.value;
    if (!atk) return NextResponse.json({ msg: 'Unauthorized' }, { status: 401 });

    const payload = await verifyAccessToken(atk);
    const userId = payload.uid as string;

    const user = await UserModel.findById(userId).select('-password');
    if (!user) return NextResponse.json({ msg: 'User not found' }, { status: 404 });

    return NextResponse.json({ user });
  } catch (err: any) {
    return NextResponse.json({ msg: err.message }, { status: 500 });
  }
}