"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  ImagePlus,
  Send,
  Smile,
  X,
} from "lucide-react";
import { useSendMessage, useTypingEmitter } from "@/hook/useChat";
import { ChatMessage } from "@/types/chat";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const COMPOSER_EMOJIS = [
  "😀",
  "😂",
  "😍",
  "🔥",
  "👍",
  "❤️",
  "🙏",
  "🎉",
  "😎",
  "🤔",
  "😢",
  "👏",
] as const;

const ALLOWED_VIDEO_TYPES = ["video/mp4", "video/webm"];
const CHAT_IMAGE_MAX_SIZE = 10 * 1024 * 1024; // 10MB
const CHAT_VIDEO_MAX_SIZE = 50 * 1024 * 1024; // 50MB

function isAllowedMedia(file: File) {
  if (file.type.startsWith("image/")) {
    return file.size <= CHAT_IMAGE_MAX_SIZE;
  }
  if (ALLOWED_VIDEO_TYPES.includes(file.type)) {
    return file.size <= CHAT_VIDEO_MAX_SIZE;
  }
  return false;
}

function replyPreview(message: ChatMessage) {
  const sender = message.sender;
  const name =
    typeof sender === "string"
      ? "message"
      : sender.fullname || sender.username || "message";

  let snippet = "Message";
  if (message.type === "shared_post") {
    snippet = "Shared a post";
  } else if (message.type === "story_reply") {
    snippet = message.content?.trim() || "Replied to a story";
  } else if (
    message.type === "image" ||
    (message.media && message.media.length > 0)
  ) {
    const hasVideo = message.media?.some((m) => m.type === "video");
    snippet =
      message.content?.trim() || (hasVideo ? "Video" : "Photo");
  } else {
    snippet = message.content?.trim() || "Message";
  }

  return {
    name,
    snippet:
      snippet.slice(0, 72) + (snippet.length > 72 ? "…" : ""),
  };
}

function resizeTextarea(el: HTMLTextAreaElement | null) {
  if (!el) return;
  el.style.height = "auto";
  el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
}

export default function MessageComposer({
  conversationId,
  replyTo,
  onCancelReply,
}: {
  conversationId: string;
  replyTo?: ChatMessage | null;
  onCancelReply?: () => void;
}) {
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const emojiRef = useRef<HTMLDivElement>(null);
  const dragDepth = useRef(0);
  const sendMessage = useSendMessage(conversationId);
  const { onTypingActivity, stopTyping } = useTypingEmitter(conversationId);

  useEffect(() => {
    if (replyTo) {
      // preventScroll: avoid browser scrolling the document to keep the
      // focused field in view — that scroll often sticks after cancel reply.
      textareaRef.current?.focus({ preventScroll: true });
    }
  }, [replyTo]);

  useEffect(() => {
    resizeTextarea(textareaRef.current);
  }, [text]);

  useEffect(() => {
    if (!emojiOpen) return;
    const onPointer = (e: PointerEvent) => {
      if (emojiRef.current && !emojiRef.current.contains(e.target as Node)) {
        setEmojiOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setEmojiOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [emojiOpen]);

  const addMedia = useCallback(
    (list: FileList | File[] | null) => {
      if (!list) return;
      const incoming = Array.from(list).filter((f) => {
        const ok = isAllowedMedia(f);
        if (!ok) {
          if (
            f.type.startsWith("video/") &&
            !ALLOWED_VIDEO_TYPES.includes(f.type)
          ) {
            toast.error("Only mp4/webm videos are allowed");
          } else if (
            f.type.startsWith("image/") &&
            f.size > CHAT_IMAGE_MAX_SIZE
          ) {
            toast.error("Image is too large (max 10MB)");
          } else if (
            ALLOWED_VIDEO_TYPES.includes(f.type) &&
            f.size > CHAT_VIDEO_MAX_SIZE
          ) {
            toast.error("Video is too large (max 50MB)");
          } else if (
            !f.type.startsWith("image/") &&
            !ALLOWED_VIDEO_TYPES.includes(f.type)
          ) {
            toast.error("Only images or mp4/webm videos are allowed");
          }
        }
        return ok;
      });
      if (incoming.length === 0) return;
      setFiles((prev) => {
        const next = [...prev, ...incoming].slice(0, 4);
        setPreviews((old) => {
          old.forEach((p, i) => {
            if (i >= next.length) URL.revokeObjectURL(p);
          });
          return next.map((f, i) => {
            if (i < prev.length && prev[i] === f) return old[i];
            return URL.createObjectURL(f);
          });
        });
        return next;
      });
    },
    []
  );

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
    setPreviews((prev) => {
      URL.revokeObjectURL(prev[index]);
      return prev.filter((_, i) => i !== index);
    });
  };

  const onSubmit = async (e?: FormEvent) => {
    e?.preventDefault();
    const content = text.trim();
    if (!content && files.length === 0) return;
    if (sendMessage.isPending) return;

    try {
      stopTyping();
      await sendMessage.mutateAsync({
        content,
        media: files.length ? files : undefined,
        replyTo: replyTo?._id,
      });
      setText("");
      previews.forEach((p) => URL.revokeObjectURL(p));
      setFiles([]);
      setPreviews([]);
      setEmojiOpen(false);
      onCancelReply?.();
      requestAnimationFrame(() => {
        if (textareaRef.current) {
          textareaRef.current.style.height = "auto";
          textareaRef.current.focus({ preventScroll: true });
        }
      });
    } catch {
      toast.error("Failed to send message");
    }
  };

  const insertEmoji = (emoji: string) => {
    const el = textareaRef.current;
    if (!el) {
      setText((t) => t + emoji);
      onTypingActivity();
      return;
    }
    const start = el.selectionStart ?? text.length;
    const end = el.selectionEnd ?? text.length;
    const next = text.slice(0, start) + emoji + text.slice(end);
    setText(next);
    onTypingActivity();
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + emoji.length;
      el.setSelectionRange(pos, pos);
    });
  };

  const canSend =
    !sendMessage.isPending && (!!text.trim() || files.length > 0);

  const reply = replyTo ? replyPreview(replyTo) : null;

  return (
    <form
      onSubmit={(e) => void onSubmit(e)}
      onDragEnter={(e) => {
        e.preventDefault();
        dragDepth.current += 1;
        setDragging(true);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        dragDepth.current -= 1;
        if (dragDepth.current <= 0) {
          dragDepth.current = 0;
          setDragging(false);
        }
      }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        dragDepth.current = 0;
        setDragging(false);
        addMedia(e.dataTransfer.files);
      }}
      className={cn(
        "relative border-t border-border/40 bg-[var(--chat-surface-base,var(--background))] px-2 py-2 transition-[box-shadow,background-color] duration-150",
        dragging && "bg-muted/30 ring-2 ring-inset ring-primary/30"
      )}
    >
      {dragging && (
        <div
          className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-background/60 text-sm font-medium text-foreground backdrop-blur-[1px]"
          aria-hidden
        >
          Drop photos or videos to attach
        </div>
      )}

      {replyTo && reply && (
        <div className="mb-2 flex items-start gap-2 rounded-xl bg-muted/40 px-3 py-2">
          <div className="min-w-0 flex-1">
            <div className="flex gap-2">
              <span className="w-0.5 shrink-0 self-stretch rounded-full bg-primary" />
              <div className="min-w-0">
                <p className="truncate text-[13px] font-semibold text-primary">
                  {reply.name}
                </p>
                <p className="truncate text-[13px] text-muted-foreground">
                  {reply.snippet}
                </p>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancelReply}
            className="grid size-7 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Cancel reply"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {previews.length > 0 && (
        <div className="mb-2 flex gap-2 overflow-x-auto px-1 pb-1">
          {previews.map((src, i) => (
            <div key={src} className="relative shrink-0">
              {files[i]?.type.startsWith("video/") ? (
                <video
                  src={src}
                  muted
                  playsInline
                  preload="metadata"
                  className="size-16 rounded-xl object-cover"
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={src}
                  alt=""
                  className="size-16 rounded-xl object-cover"
                />
              )}
              <button
                type="button"
                onClick={() => removeFile(i)}
                className="absolute -end-1 -top-1 grid size-5 place-items-center rounded-full bg-destructive text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Remove attachment"
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-end gap-0.5">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/mp4,video/webm"
          multiple
          className="hidden"
          onChange={(e) => {
            addMedia(e.target.files);
            e.target.value = "";
          }}
        />

        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-10 shrink-0 rounded-full text-muted-foreground hover:bg-muted/60 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => fileInputRef.current?.click()}
          aria-label="Attach photo or video"
        >
          <ImagePlus size={20} />
        </Button>

        <div className="relative shrink-0" ref={emojiRef}>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn(
              "size-10 rounded-full text-muted-foreground hover:bg-muted/60 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
              emojiOpen && "bg-muted/60 text-foreground"
            )}
            onClick={() => setEmojiOpen((o) => !o)}
            aria-label="Insert emoji"
            aria-expanded={emojiOpen}
          >
            <Smile size={20} />
          </Button>

          {emojiOpen && (
            <div
              className="absolute bottom-full start-0 z-20 mb-2 grid w-[220px] grid-cols-6 gap-0.5 rounded-2xl border border-border/60 bg-background p-2 shadow-lg animate-in fade-in zoom-in-95 duration-150"
              role="listbox"
              aria-label="Emoji picker"
            >
              {COMPOSER_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  role="option"
                  className="grid size-8 place-items-center rounded-lg text-lg transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={() => insertEmoji(emoji)}
                  aria-label={`Insert ${emoji}`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>

        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            if (e.target.value.trim()) onTypingActivity();
            else stopTyping();
          }}
          onPaste={(e) => {
            const items = e.clipboardData?.items;
            if (!items) return;
            const imageFiles: File[] = [];
            for (const item of items) {
              if (item.type.startsWith("image/")) {
                const file = item.getAsFile();
                if (file) imageFiles.push(file);
              }
            }
            if (imageFiles.length) {
              e.preventDefault();
              addMedia(imageFiles);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void onSubmit();
            }
          }}
          placeholder={replyTo ? "Write a reply…" : "Message…"}
          rows={1}
          maxLength={2000}
          aria-label="Message"
          className="max-h-32 min-h-10 flex-1 resize-none bg-transparent px-2 py-2.5 text-base leading-snug outline-none placeholder:text-muted-foreground focus-visible:outline-none"
        />

        <Button
          type="submit"
          variant="ghost"
          size="icon"
          className={cn(
            "size-10 shrink-0 rounded-full transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ring",
            canSend
              ? "text-[var(--chat-accent,var(--primary))] hover:bg-[color-mix(in_oklab,var(--chat-accent,var(--primary))_12%,transparent)] hover:text-[var(--chat-accent,var(--primary))]"
              : "text-muted-foreground/45"
          )}
          disabled={!canSend}
          aria-label="Send message"
        >
          <Send size={20} />
        </Button>
      </div>
    </form>
  );
}
