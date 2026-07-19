import { NextRequest, NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db/mongodb';

export const POST = async (req: NextRequest) => {
	try {
		// keep same pattern as other auth routes
		await dbConnect();

		const res = NextResponse.json({ msg: 'logged out' }, { status: 200 });

		// Clear cookies by setting empty value and maxAge: 0
		res.cookies.set('atk', '', {
			httpOnly: true,
			secure: process.env.NODE_ENV === 'production',
			sameSite: 'lax',
			path: '/',
			maxAge: 0,
		});

		res.cookies.set('rtk', '', {
			httpOnly: true,
			secure: process.env.NODE_ENV === 'production',
			sameSite: 'lax',
			path: '/',
			maxAge: 0,
		});

		return res;
	} catch (err: any) {
		return NextResponse.json({ msg: err?.message ?? 'Unknown error' }, { status: 500 });
	}
};
