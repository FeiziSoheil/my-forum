import { jwtVerify, SignJWT } from "jose"

// Ensure secrets exist at runtime and encode them safely
const ACCESS_SECRET_RAW = process.env.JWT_ACCESS_SECRET
const REFRESH_SECRET_RAW = process.env.JWT_REFRESH_SECRET

if (!ACCESS_SECRET_RAW || !REFRESH_SECRET_RAW) {
    throw new Error('Missing JWT_ACCESS_SECRET or JWT_REFRESH_SECRET environment variables')
}

const access_secret = new TextEncoder().encode(ACCESS_SECRET_RAW)
const refresh_secret = new TextEncoder().encode(REFRESH_SECRET_RAW)

export async function signAccessToken(payload: object): Promise<string> {
    // Access tokens should be short lived (15 minutes) — cookie maxAge elsewhere is 15*60
    return new SignJWT({ ...payload })
        .setProtectedHeader({ alg: "HS256" })
        .setExpirationTime('15m')
        .sign(access_secret)
}

export async function signRefreshToken(payload: object): Promise<string> {
    // Refresh tokens are long lived (7 days)
    return new SignJWT({ ...payload })
        .setProtectedHeader({ alg: "HS256" })
        .setExpirationTime('7d')
        .sign(refresh_secret)
}

export const verifyAccessToken = async (token: string) => {
    const { payload } = await jwtVerify(token, access_secret)
    return payload
}

export const verifyRefreshToken = async (token: string) => {
    const { payload } = await jwtVerify(token, refresh_secret)
    return payload
}


