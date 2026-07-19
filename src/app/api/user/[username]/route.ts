import { dbConnect } from "@/lib/db/mongodb";
import { UserModel } from "@/models/User";
import { FollowRequestModel } from "@/models/FollowRequest";
import {
  canViewPrivateAuthorAsync,
  getOptionalUserId,
  viewerFollowsAuthor,
} from "@/lib/auth/session";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    await dbConnect();

    const { username } = await params;
    // #region agent log
    fetch('http://127.0.0.1:7385/ingest/27384de2-f316-4d6a-b6d8-d9cfebf966d1',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'0d5c0f'},body:JSON.stringify({sessionId:'0d5c0f',runId:'pre-fix',hypothesisId:'A',location:'user/[username]/route.ts:GET',message:'username route hit (route conflict probe)',data:{username,method:req.method},timestamp:Date.now()})}).catch(()=>{});
    // #endregion

    const user = await UserModel.findOne({ username, isDeleted: { $ne: true } })
      .select(
        "username fullname avatar banner bio location isPrivate followersCount followingCount createdAt"
      )
      .lean();

    if (!user) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    const viewerId = await getOptionalUserId(req);
    const u = user as unknown as {
      _id: unknown;
      username: string;
      fullname: string;
      avatar?: string;
      banner?: string;
      bio?: string;
      location?: string;
      isPrivate?: boolean;
      createdAt?: Date;
      followersCount?: number;
      followingCount?: number;
    };

    const authorId = (u._id as { toString(): string }).toString();
    const isFollowing = await viewerFollowsAuthor(viewerId, authorId);
    const isPrivate = !!u.isPrivate;
    const canView = await canViewPrivateAuthorAsync(
      {
        _id: u._id as { toString(): string },
        isPrivate: u.isPrivate,
      },
      viewerId
    );

    let isRequested = false;
    if (viewerId && isPrivate && !isFollowing) {
      const pending = await FollowRequestModel.findOne({
        from: viewerId,
        to: u._id,
        status: "pending",
      })
        .select("_id")
        .lean();
      isRequested = !!pending;
    }

    const publicUser = {
      _id: u._id,
      username: u.username,
      fullname: u.fullname,
      avatar: u.avatar,
      banner: u.banner,
      bio: canView ? u.bio : undefined,
      location: canView ? u.location : undefined,
      createdAt: canView ? u.createdAt : undefined,
      followersCount: u.followersCount ?? 0,
      followingCount: u.followingCount ?? 0,
      isFollowing,
      isRequested,
      isPrivate,
      canView,
    };

    return NextResponse.json({ user: publicUser }, { status: 200 });
  } catch (err) {
    console.error("GET /api/user/[username] error:", err);
    return NextResponse.json(
      { error: "Failed to fetch user" },
      { status: 500 }
    );
  }
}
