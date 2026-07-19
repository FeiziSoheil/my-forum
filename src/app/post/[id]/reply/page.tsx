'use client';

import { Suspense, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { CreateReplyForm } from '@/components/post/CreateReplyForm';
import { usePost } from '@/hook/usePosts';
import { useReply } from '@/hook/useReplies';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2 } from 'lucide-react';
import { renderRichText } from '@/components/RichText';
import { MAX_THREAD_LEVEL } from '@/lib/replies/constants';
import { toast } from 'sonner';

function ReplyTargetPreview({
  authorUsername,
  authorName,
  authorAvatar,
  content,
}: {
  authorUsername: string;
  authorName?: string;
  authorAvatar?: string;
  content: string;
}) {
  const displayName = authorName || authorUsername;
  const initials = displayName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="flex gap-3 border-b border-border/50 pb-4">
      <div className="flex flex-col items-center">
        <Avatar className="size-10 shrink-0">
          <AvatarImage src={authorAvatar} />
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
        <div className="mt-1 w-0.5 flex-1 min-h-4 rounded-full bg-border" />
      </div>
      <div className="min-w-0 flex-1 pb-1">
        <p className="truncate text-[15px] font-semibold text-foreground">
          {authorUsername}
        </p>
        <div className="mt-0.5 line-clamp-4 text-[15px] leading-relaxed text-foreground/90">
          {renderRichText(content)}
        </div>
      </div>
    </div>
  );
}

function ReplyPageContent() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const postId = params?.id as string;
  const parentReplyId = searchParams.get('parentReplyId');

  const { data: post, isLoading: isPostLoading, isError: isPostError } = usePost(postId);
  const {
    data: parentReply,
    isLoading: isReplyLoading,
    isError: isReplyError,
  } = useReply(postId, parentReplyId);

  useEffect(() => {
    if (!parentReply) return;
    if ((parentReply.threadLevel ?? 0) >= MAX_THREAD_LEVEL) {
      toast.error(`Replies can only nest up to ${MAX_THREAD_LEVEL} levels.`);
      router.replace(`/post/${postId}`);
    }
  }, [parentReply, postId, router]);

  const isLoading = isPostLoading || (!!parentReplyId && isReplyLoading);

  if (isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isPostError || !post) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background p-8 text-muted-foreground">
        Post not found.
      </div>
    );
  }

  if (parentReplyId && (isReplyError || !parentReply)) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background p-8 text-muted-foreground">
        Reply not found.
      </div>
    );
  }

  const targetAuthor = parentReply?.author ?? post.author;
  const targetContent = parentReply?.content ?? post.content;
  const placeholder = parentReply
    ? `Reply to @${parentReply.author.username}…`
    : "What's new?";

  return (
    <CreateReplyForm
      postId={postId}
      parentReplyId={parentReplyId}
      placeholder={placeholder}
      context={
        <ReplyTargetPreview
          authorUsername={targetAuthor.username}
          authorName={targetAuthor.fullname}
          authorAvatar={targetAuthor.avatar}
          content={targetContent}
        />
      }
    />
  );
}

export default function ReplyPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center bg-background">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <ReplyPageContent />
    </Suspense>
  );
}
