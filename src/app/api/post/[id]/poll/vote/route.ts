import { dbConnect } from "@/lib/db/mongodb";
import { requireUserId } from "@/lib/auth/requireUser";
import { withPollViewerState } from "@/lib/poll/attachPollViewer";
import { isPollEnded } from "@/lib/poll/constants";
import { PostModel } from "@/models/Post";
import { isValidObjectId } from "mongoose";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();
    const auth = await requireUserId();
    if ("error" in auth) return auth.error;
    const { userId } = auth;

    const { id } = await params;
    if (!isValidObjectId(id)) {
      return NextResponse.json({ error: "Invalid post id." }, { status: 400 });
    }

    const body = await req.json().catch(() => null);
    const optionId = typeof body?.optionId === "string" ? body.optionId.trim() : "";
    if (!optionId) {
      return NextResponse.json({ error: "optionId is required." }, { status: 400 });
    }

    const post = await PostModel.findOne({ _id: id, isDeleted: false });
    if (!post) {
      return NextResponse.json({ error: "Post not found." }, { status: 404 });
    }

    if (!post.poll?.options?.length) {
      return NextResponse.json({ error: "This post has no poll." }, { status: 400 });
    }

    if (isPollEnded(post.poll.endsAt)) {
      return NextResponse.json({ error: "This poll has ended." }, { status: 400 });
    }

    const option = post.poll.options.find((o: { id: string }) => o.id === optionId);
    if (!option) {
      return NextResponse.json({ error: "Invalid poll option." }, { status: 400 });
    }

    const votes = post.poll.votes ?? [];
    const existingIdx = votes.findIndex(
      (v: { user: { toString(): string } }) => v.user.toString() === userId
    );

    if (existingIdx >= 0) {
      const existing = votes[existingIdx];
      if (existing.optionId === optionId) {
        const lean = post.toObject();
        return NextResponse.json(
          {
            poll: withPollViewerState(lean, userId).poll,
            myVoteOptionId: optionId,
          },
          { status: 200 }
        );
      }

      const prevOption = post.poll.options.find(
        (o: { id: string }) => o.id === existing.optionId
      );
      if (prevOption) {
        prevOption.votesCount = Math.max(0, (prevOption.votesCount ?? 0) - 1);
      }
      existing.optionId = optionId;
      existing.createdAt = new Date();
      option.votesCount = (option.votesCount ?? 0) + 1;
    } else {
      votes.push({ user: userId, optionId, createdAt: new Date() });
      option.votesCount = (option.votesCount ?? 0) + 1;
      post.poll.votesCount = (post.poll.votesCount ?? 0) + 1;
    }

    post.poll.votes = votes;
    post.markModified("poll");
    await post.save();

    const lean = post.toObject();
    const safe = withPollViewerState(lean, userId);

    return NextResponse.json(
      {
        poll: safe.poll,
        myVoteOptionId: safe.myVoteOptionId,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("POST /api/post/[id]/poll/vote error:", err);
    return NextResponse.json(
      { error: "Unexpected server error. Please try again later." },
      { status: 500 }
    );
  }
}
