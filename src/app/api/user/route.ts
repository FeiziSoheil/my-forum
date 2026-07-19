import { verifyAccessToken } from "@/lib/auth/jwt";
import { dbConnect } from "@/lib/db/mongodb";
import { saveFile } from "@/lib/fileHandler";
import { sanitizeUser, verifyPassword } from "@/lib/auth/helper";
import { requireUserId } from "@/lib/auth/requireUser";
import { UserModel } from "@/models/User";
import { PostModel } from "@/models/Post";
import { ReplyModel } from "@/models/Reply";
import { StoryModel } from "@/models/Story";
import { FollowRequestModel } from "@/models/FollowRequest";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export async function PATCH(req: NextRequest) {
    try {
        await dbConnect();

        const cookieStore = cookies();
        const atk = (await cookieStore).get('atk')?.value
        if (!atk) {
            return NextResponse.json({ error: 'Authentication token missing.' }, { status: 401 });
        }

        const payload = await verifyAccessToken(atk)
        const userId = payload.uid as string

        const formData = await req.formData();
        const fullname = formData.get('fullname') as string | null
        const bio = formData.get('bio') as string | null
        const location = formData.get('location') as string | null
        const avatarFile = formData.get('avatar') as File | null
        const bannerFile = formData.get('banner') as File | null
        const isPrivate = formData.get('isPrivate') as string | null

        const updates: Partial<{ fullname: string; bio: string; location: string; avatar: string; banner: string; isPrivate: boolean }> = {}

        if (fullname !== null && fullname.trim().length > 0) {
            if (fullname.trim().length < 3) {
                return NextResponse.json({ error: 'Fullname must be at least 3 characters.' }, { status: 400 });
            }
            updates.fullname = fullname.trim()
        }

        if (bio !== null) {
            if (bio.length > 160) {
                return NextResponse.json({ error: 'Bio cannot be more than 160 characters.' }, { status: 400 });
            }
            updates.bio = bio
        }

        if (location !== null) {
            if (location.length > 100) {
                return NextResponse.json({ error: 'Location cannot be more than 100 characters.' }, { status: 400 });
            }
            updates.location = location
        }

        if (avatarFile && avatarFile.size > 0) {
            const media = await saveFile(avatarFile)
            if (!media) {
                return NextResponse.json({ error: 'Failed to upload avatar.' }, { status: 400 });
            }
            updates.avatar = media.url
        }

        if (bannerFile && bannerFile.size > 0) {
            const media = await saveFile(bannerFile)
            if (!media) {
                return NextResponse.json({ error: 'Failed to upload banner.' }, { status: 400 });
            }
            updates.banner = media.url
        }

        // Account-level privacy toggle. Sent as a stringified boolean via FormData.
        if (isPrivate !== null) {
            updates.isPrivate = isPrivate === 'true'
        }

        const user = await UserModel.findByIdAndUpdate(
            userId,
            { $set: updates },
            // strict:false so a hot-reloaded model missing the new `banner`
            // path still persists the field (Next.js HMR keeps the first schema).
            { new: true, runValidators: true, strict: false }
        )
        if (!user) {
            return NextResponse.json({ error: 'User not found.' }, { status: 404 });
        }

        return NextResponse.json({ user: sanitizeUser(user) }, { status: 200 })
    } catch (err) {
        console.error('PATCH /api/user error:', err);
        return NextResponse.json(
            { error: 'Unexpected server error. Please try again later.' },
            { status: 500 }
        );
    }
}

/**
 * Soft-deletes the currently authenticated account after confirming the password.
 *
 * MVP cleanup (inline, no job queue):
 * 1. Tombstone identity fields so the handle/email can never log in or appear
 *    as a real profile (unique username/email preserved via deleted_* suffix).
 * 2. Clear bio/avatar/banner/location.
 * 3. Soft-delete the user's posts + replies so they leave public feeds.
 * 4. Expire active stories immediately (TTL will purge them).
 * 5. Cancel pending follow requests involving this user.
 * Chat messages are left in place (referential integrity) but the sender
 * will show the anonymized tombstone name if still populated.
 */
export async function DELETE(req: NextRequest) {
    try {
        await dbConnect();

        const auth = await requireUserId();
        if ("error" in auth) return auth.error;
        const { userId } = auth;

        const body = await req.json().catch(() => ({}));
        const password = (body?.password ?? "").toString();
        if (!password) {
            return NextResponse.json(
                { error: "Password confirmation is required." },
                { status: 400 }
            );
        }

        const user = await UserModel.findById(userId);
        if (!user || user.isDeleted) {
            return NextResponse.json({ error: "User not found." }, { status: 404 });
        }

        const isValid = await verifyPassword(password, user.password);
        if (!isValid) {
            return NextResponse.json({ error: "Password is incorrect." }, { status: 400 });
        }

        const suffix = userId.toString();
        const tombstoneUsername = `deleted_${suffix}`;
        const tombstoneEmail = `deleted_${suffix}@deleted.local`;

        user.isDeleted = true;
        user.deletedAt = new Date();
        user.username = tombstoneUsername;
        user.email = tombstoneEmail;
        user.fullname = "Deleted user";
        user.bio = "";
        user.avatar = "";
        user.banner = "";
        user.location = "";
        user.resetPasswordToken = null;
        user.resetPasswordExpires = null;
        // Scramble password so leftover credentials cannot be reused even if
        // soft-delete flags were somehow bypassed.
        user.password = `deleted:${userId}:${Date.now()}`;
        await user.save();

        await Promise.all([
            PostModel.updateMany(
                { author: userId, isDeleted: false },
                { isDeleted: true }
            ),
            ReplyModel.updateMany(
                { author: userId, isDeleted: false },
                { isDeleted: true }
            ),
            // Expire stories now so they drop out of the rail immediately.
            StoryModel.updateMany(
                { author: userId, expiresAt: { $gt: new Date() } },
                { expiresAt: new Date() }
            ),
            // Drop pending requests; schema only stores pending docs.
            FollowRequestModel.deleteMany({
                $or: [{ from: userId }, { to: userId }],
            }),
        ]);

        const res = NextResponse.json({ msg: "Account deleted." }, { status: 200 });
        res.cookies.set('atk', '', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 0 });
        res.cookies.set('rtk', '', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 0 });
        return res;
    } catch (err) {
        console.error('DELETE /api/user error:', err);
        return NextResponse.json(
            { error: 'Unexpected server error. Please try again later.' },
            { status: 500 }
        );
    }
}
