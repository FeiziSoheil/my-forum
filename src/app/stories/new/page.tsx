"use client";

import { useCreateStory } from "@/hook/useStories";
import { STORY_BACKGROUND_COLORS } from "@/types/story";
import { cn } from "@/lib/utils";
import { ArrowLeft, ImagePlus, Loader2, Type, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

type Mode = "text" | "image";

const ALLOWED_VIDEO_TYPES = ["video/mp4", "video/webm"];
const STORY_VIDEO_MAX_SIZE = 50 * 1024 * 1024; // 50MB

export default function NewStoryPage() {
  const router = useRouter();
  const createStory = useCreateStory();
  const fileRef = useRef<HTMLInputElement>(null);

  const [mode, setMode] = useState<Mode>("text");
  const [content, setContent] = useState("");
  const [backgroundColor, setBackgroundColor] = useState<string>(
    STORY_BACKGROUND_COLORS[0]
  );
  const [file, setFile] = useState<File | null>(null);
  const [mediaKind, setMediaKind] = useState<"image" | "video" | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const handleFile = (selected: File | null) => {
    if (preview) URL.revokeObjectURL(preview);
    if (!selected) {
      setFile(null);
      setMediaKind(null);
      setPreview(null);
      return;
    }
    const isImage = selected.type.startsWith("image/");
    const isVideo = ALLOWED_VIDEO_TYPES.includes(selected.type);
    if (!isImage && !isVideo) return;
    if (isVideo && selected.size > STORY_VIDEO_MAX_SIZE) return;
    setFile(selected);
    setMediaKind(isVideo ? "video" : "image");
    setPreview(URL.createObjectURL(selected));
    setMode("image");
  };

  const canShare =
    mode === "text" ? content.trim().length > 0 : !!file;

  const handleShare = async () => {
    if (!canShare || createStory.isPending) return;
    await createStory.mutateAsync({
      content: content.trim(),
      backgroundColor: mode === "text" ? backgroundColor : undefined,
      media: mode === "image" ? file : null,
    });
    router.push("/");
  };

  return (
    <main className="fixed inset-0 z-50 flex flex-col bg-black text-white">
      <header className="flex items-center justify-between px-3 py-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="grid size-10 place-items-center rounded-full hover:bg-white/10"
          aria-label="Back"
        >
          <ArrowLeft className="size-5" />
        </button>
        <p className="text-sm font-semibold">New story</p>
        <button
          type="button"
          onClick={handleShare}
          disabled={!canShare || createStory.isPending}
          className="rounded-full bg-white px-4 py-1.5 text-sm font-semibold text-black disabled:opacity-40"
        >
          {createStory.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            "Share"
          )}
        </button>
      </header>

      <div className="relative mx-auto flex min-h-0 w-full max-w-lg flex-1 flex-col">
        {mode === "text" ? (
          <div
            className="relative flex flex-1 items-center justify-center px-6"
            style={{ backgroundColor }}
          >
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Type something…"
              maxLength={500}
              className="w-full resize-none bg-transparent text-center text-2xl font-semibold leading-snug text-white placeholder:text-white/40 outline-none"
              rows={4}
              autoFocus
            />
          </div>
        ) : (
          <div className="relative flex flex-1 items-center justify-center bg-neutral-950">
            {preview ? (
              <>
                {mediaKind === "video" ? (
                  <video
                    src={preview}
                    className="max-h-full max-w-full object-contain"
                    controls
                    playsInline
                    autoPlay
                    muted
                    loop
                  />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={preview}
                    alt=""
                    className="max-h-full max-w-full object-contain"
                  />
                )}
                <button
                  type="button"
                  onClick={() => handleFile(null)}
                  className="absolute end-3 top-3 grid size-9 place-items-center rounded-full bg-black/50"
                  aria-label="Remove media"
                >
                  <X className="size-4" />
                </button>
                <input
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Add a caption…"
                  maxLength={500}
                  className="absolute inset-x-4 bottom-4 rounded-full border border-white/20 bg-black/40 px-4 py-2 text-sm outline-none backdrop-blur-sm placeholder:text-white/50"
                />
              </>
            ) : (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex flex-col items-center gap-2 text-white/70"
              >
                <ImagePlus className="size-10" />
                <span className="text-sm">Choose a photo or video</span>
              </button>
            )}
          </div>
        )}
      </div>

      <footer className="mx-auto w-full max-w-lg space-y-3 px-4 py-4">
        {mode === "text" && (
          <div className="flex flex-wrap justify-center gap-2">
            {STORY_BACKGROUND_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setBackgroundColor(c)}
                className={cn(
                  "size-8 rounded-full ring-offset-2 ring-offset-black",
                  backgroundColor === c && "ring-2 ring-white"
                )}
                style={{ backgroundColor: c }}
                aria-label={`Color ${c}`}
              />
            ))}
          </div>
        )}

        <div className="flex justify-center gap-2">
          <button
            type="button"
            onClick={() => {
              setMode("text");
              handleFile(null);
            }}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm",
              mode === "text" ? "bg-white text-black" : "bg-white/10"
            )}
          >
            <Type className="size-4" />
            Text
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("image");
              if (!file) fileRef.current?.click();
            }}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm",
              mode === "image" ? "bg-white text-black" : "bg-white/10"
            )}
          >
            <ImagePlus className="size-4" />
            Media
          </button>
        </div>
      </footer>

      <input
        ref={fileRef}
        type="file"
        accept="image/*,video/mp4,video/webm"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
      />
    </main>
  );
}
