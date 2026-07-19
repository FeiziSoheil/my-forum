'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { api } from '@/lib/api/axios';
import {
  ThreadComposeLayout,
  type PostVisibility,
} from '@/components/composer/ThreadComposeLayout';
import {
  emptyPollDraft,
  isPollDraftValid,
  type PollDraft,
} from '@/components/post/PollComposer';

export function CreatePostForm() {
  const router = useRouter();
  const [content, setContent] = useState('');
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [visibility, setVisibility] = useState<PostVisibility>('public');
  const [pollDraft, setPollDraft] = useState<PollDraft | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string>();

  const pollOpen = !!pollDraft;
  const pollValid = pollDraft ? isPollDraftValid(pollDraft) : false;
  const canSubmit =
    (content.trim().length > 0 || pollValid) &&
    content.length <= 500 &&
    (!pollOpen || pollValid);

  const openPoll = () => {
    setMediaFiles([]);
    setPollDraft(emptyPollDraft());
  };

  const closePoll = () => setPollDraft(null);

  const onMediaChange = (files: File[]) => {
    if (files.length > 0 && pollOpen) {
      toast.message('Remove the poll to add media');
      return;
    }
    setMediaFiles(files);
  };

  const onSubmit = async () => {
    if (!canSubmit) return;

    setIsSubmitting(true);
    setError(undefined);

    try {
      const formData = new FormData();
      formData.append('content', content.trim());
      formData.append('visibility', visibility);

      if (pollDraft && pollValid) {
        formData.append(
          'poll',
          JSON.stringify({
            options: pollDraft.options.map((o) => o.trim()).filter(Boolean),
            duration: pollDraft.duration,
          })
        );
      } else {
        mediaFiles.forEach((file) => formData.append('media', file));
      }

      await api.post('/post', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      toast.success('Post created successfully!');
      setContent('');
      setMediaFiles([]);
      setPollDraft(null);
      router.push('/');
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      const message = e.response?.data?.error || 'Failed to create post';
      setError(message);
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ThreadComposeLayout
      title="New thread"
      submitLabel="Post"
      placeholder="What's new?"
      content={content}
      onContentChange={setContent}
      mediaFiles={mediaFiles}
      onMediaChange={onMediaChange}
      isSubmitting={isSubmitting}
      onSubmit={onSubmit}
      error={error}
      showVisibility
      visibility={visibility}
      onVisibilityChange={setVisibility}
      canSubmit={canSubmit}
      pollDraft={pollDraft}
      onPollDraftChange={setPollDraft}
      onOpenPoll={openPoll}
      onClosePoll={closePoll}
    />
  );
}
