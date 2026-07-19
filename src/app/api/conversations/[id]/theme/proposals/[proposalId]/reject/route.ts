import { requireUserId } from "@/lib/auth/requireUser";
import { dbConnect } from "@/lib/db/mongodb";
import { NotificationModel } from "@/models/Notification";
import { ThemeProposalModel } from "@/models/ThemeProposal";
import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/conversations/[id]/theme/proposals/[proposalId]/reject
 */
export async function POST(
  _req: NextRequest,
  {
    params,
  }: { params: Promise<{ id: string; proposalId: string }> }
) {
  try {
    await dbConnect();
    const auth = await requireUserId();
    if ("error" in auth) return auth.error;
    const { userId } = auth;
    const { id: conversationId, proposalId } = await params;

    const proposal = await ThemeProposalModel.findById(proposalId);
    if (!proposal || proposal.status !== "pending") {
      return NextResponse.json(
        { error: "Theme proposal not found." },
        { status: 404 }
      );
    }

    if (proposal.conversation.toString() !== conversationId) {
      return NextResponse.json({ error: "Mismatch." }, { status: 400 });
    }

    if (proposal.to.toString() !== userId) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    await ThemeProposalModel.deleteOne({ _id: proposalId });

    await NotificationModel.updateMany(
      {
        recipient: userId,
        type: "theme_proposal",
        themeProposal: proposalId,
        read: false,
      },
      { $set: { read: true } }
    );

    return NextResponse.json({ rejected: true });
  } catch (err) {
    console.error(
      "POST /api/conversations/[id]/theme/proposals/[proposalId]/reject error:",
      err
    );
    return NextResponse.json(
      { error: "Unexpected server error. Please try again later." },
      { status: 500 }
    );
  }
}
