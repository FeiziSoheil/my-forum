'use client';

import { useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ThreadComposeLayout } from '@/components/composer/ThreadComposeLayout';
import { useCreateReply } from '@/hook/useReplies';

type CreateReplyFormProps = {
  postId: string;
  parentReplyId?: string | null;
  placeholder?: string;
  context?: ReactNode;
};

export function CreateReplyForm({
  postId,
  parentReplyId = null,
  placeholder = "What's new?",
  context,
}: CreateReplyFormProps) {
  const router = useRouter();
  const createReply = useCreateReply(postId);
  const [content, setContent] = useState('');
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [error, setError] = useState<string>();

  const onSubmit = async () => {
    const trimmed = content.trim();
    if (!trimmed) return;

    setError(undefined);
    try {
      await createReply.mutateAsync({
        content: trimmed,
        parentReplyId,
        mediaFiles,
      });

      toast.success('Reply posted');
      setContent('');
      setMediaFiles([]);
      router.push(`/post/${postId}`);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      const message = e.response?.data?.error || 'Failed to post reply';
      setError(message);
      toast.error(message);
    }
  };

  return (
    <ThreadComposeLayout
      title="Reply"
      submitLabel="Post"
      placeholder={placeholder}
      content={content}
      onContentChange={setContent}
      mediaFiles={mediaFiles}
      onMediaChange={setMediaFiles}
      isSubmitting={createReply.isPending}
      onSubmit={onSubmit}
      error={error}
      context={context}
    />
  );
}
