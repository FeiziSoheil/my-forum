import { jwtVerify, SignJWT } from "jose"
import { cookies } from "next/headers";


const access_secret = new TextEncoder().encode(process.env.JWT_ACCESS_SECRET)
const refresh_secret = new TextEncoder().encode(process.env.JWT_REFRESH_SECRET)

export async function signAccessToken(payload:object)  {
    return new SignJWT({...payload})
    .setProtectedHeader({alg:"HS256"})
    .setExpirationTime('7d')
    .sign(access_secret);
}


export async function signRefreshToken(payload:object):Promise<string> {
    return new SignJWT({...payload})
    .setProtectedHeader({alg:"HS256"})
    .setExpirationTime('7d')
    .sign(refresh_secret)

}

export const verifyAccessToken = async (token:string) => {
        const {payload} = await jwtVerify(token,access_secret)
        return payload
}


