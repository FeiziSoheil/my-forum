import { compare, hash } from "bcrypt"
import { randomBytes, createHash } from "crypto"
import { User } from "@/types/user"

// Password reset tokens live for 30 minutes.
export const RESET_TOKEN_TTL_MS = 30 * 60 * 1000

export const hashPassword = async (password:string) => {
    return await hash(password,12)
}
export const verifyPassword = async (password:string,hashedPassword:string) => {
   return await compare(password,hashedPassword) 
}

// Generates a random reset token. The raw token is sent to the user (via email
// in production) while only its SHA-256 hash is stored in the database.
export const generateResetToken = (): { token: string; tokenHash: string; expires: Date } => {
    const token = randomBytes(32).toString("hex")
    const tokenHash = hashResetToken(token)
    const expires = new Date(Date.now() + RESET_TOKEN_TTL_MS)
    return { token, tokenHash, expires }
}

export const hashResetToken = (token: string): string => {
    return createHash("sha256").update(token).digest("hex")
}

export const sanitizeUser = (user: User & { toObject?: () => User }): Omit<User, "password"> => {
   const obj = typeof user.toObject === "function" ? user.toObject() : { ...user }
   delete (obj as Partial<User>).password
   return obj
}