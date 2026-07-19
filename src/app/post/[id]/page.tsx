'use client';

import { useParams, useRouter } from 'next/navigation';
import { PostCard } from '@/components/PostCard';
import { ReplyThread } from '@/components/comments';
import { usePost } from '@/hook/usePosts';
import { useReplies } from '@/hook/useReplies';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Reply } from '@/types/post';
import { toast } from 'sonner';
import { MAX_THREAD_LEVEL } from '@/lib/replies/constants';

export default function PostDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const { isAuthenticated } = useAuth();
  const { data: post, isLoading: isPostLoading, isError } = usePost(id);
  const {
    data: repliesData,
    isLoading: isRepliesLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useReplies(id);

  const goToReply = (parentReplyId?: string) => {
    if (!isAuthenticated) {
      router.push('/auth');
      return;
    }
    const href = parentReplyId
      ? `/post/${id}/reply?parentReplyId=${parentReplyId}`
      : `/post/${id}/reply`;
    router.push(href);
  };

  const handleNestedReply = (reply: Reply) => {
    if ((reply.threadLevel ?? 0) >= MAX_THREAD_LEVEL) {
      toast.error(`Replies can only nest up to ${MAX_THREAD_LEVEL} levels.`);
      return;
    }
    goToReply(reply._id);
  };

  if (isPostLoading) {
    return (
      <div className="mx-auto flex w-full max-w-xl items-center justify-center px-4 py-12 lg:max-w-2xl xl:max-w-3xl">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError || !post) {
    return (
      <div className="mx-auto w-full max-w-xl p-8 text-center text-muted-foreground lg:max-w-2xl xl:max-w-3xl">
        Post not found.
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-xl px-4 pb-32 lg:max-w-2xl lg:pb-10 xl:max-w-3xl">
      <div className="sticky top-14 z-30 flex items-center gap-3 border-b border-border bg-background p-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.back()}
          className="h-8 w-8 p-0"
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <h1 className="text-lg font-semibold">Post</h1>
      </div>

      <PostCard
        post={post}
        showFollowButton
        onReply={() => goToReply()}
        onDeleted={() => router.push('/')}
      />

      {!isAuthenticated && (
        <div className="border-b border-border p-4 text-center text-sm text-muted-foreground">
          <button
            onClick={() => router.push('/auth')}
            className="text-primary hover:underline"
          >
            Sign in
          </button>{' '}
          to reply to this post.
        </div>
      )}

      <div>
        {isRepliesLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <ReplyThread
              pages={repliesData?.pages}
              showFollowButton
              onReply={handleNestedReply}
            />

            {hasNextPage && (
              <div className="flex items-center justify-center py-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => fetchNextPage()}
                  disabled={isFetchingNextPage}
                  className="min-h-11"
                >
                  {isFetchingNextPage ? 'Loading...' : 'Load more replies'}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
