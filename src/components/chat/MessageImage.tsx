"use client";

import { cn } from "@/lib/utils";
import { Download, Expand, X } from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";

export default function MessageImage({
  src,
  alt,
  onOpen,
}: {
  src: string;
  alt?: string;
  onOpen?: (url: string) => void;
}) {
  const [loaded, setLoaded] = useState(false);

  const download = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await fetch(src);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = alt || "image";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      window.open(src, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-xl bg-muted/40",
        !loaded && "min-h-[120px] animate-pulse"
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt || "Image"}
        loading="lazy"
        decoding="async"
        draggable={false}
        onLoad={() => setLoaded(true)}
        onClick={() => onOpen?.(src)}
        className={cn(
          "max-h-64 w-full cursor-pointer object-cover transition-opacity duration-200",
          loaded ? "opacity-100" : "opacity-0"
        )}
      />

      <div
        className={cn(
          "pointer-events-none absolute inset-0 flex items-end justify-end gap-1 bg-gradient-to-t from-black/50 via-transparent to-transparent p-2 opacity-0 transition-opacity duration-150",
          "group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100"
        )}
      >
        <button
          type="button"
          onClick={() => onOpen?.(src)}
          className="pointer-events-auto grid size-8 place-items-center rounded-full bg-black/55 text-white backdrop-blur-sm transition-colors hover:bg-black/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          aria-label="Open image"
        >
          <Expand size={14} />
        </button>
        <button
          type="button"
          onClick={download}
          className="pointer-events-auto grid size-8 place-items-center rounded-full bg-black/55 text-white backdrop-blur-sm transition-colors hover:bg-black/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          aria-label="Download image"
        >
          <Download size={14} />
        </button>
      </div>
    </div>
  );
}

export function MessageLightbox({
  src,
  onClose,
}: {
  src: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Image preview"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/85 p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <button
        type="button"
        className="absolute end-4 top-4 grid size-10 place-items-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
        onClick={onClose}
        aria-label="Close image"
      >
        <X size={18} />
      </button>
      <div
        className="relative flex max-h-[90vh] max-w-[90vw] flex-col items-center animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <Image
          src={src}
          alt="Full size"
          width={1200}
          height={1200}
          className="max-h-[85vh] w-auto rounded-lg object-contain"
          unoptimized
          priority
        />
        <a
          href={src}
          download
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm text-white transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          <Download size={14} />
          Download
        </a>
      </div>
    </div>
  );
}
