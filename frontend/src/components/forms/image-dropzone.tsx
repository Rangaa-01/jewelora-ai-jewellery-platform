"use client";

import { ImagePlus, X } from "lucide-react";
import Image from "next/image";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const ACCEPT = ["image/jpeg", "image/png", "image/webp"];
export const MAX_IMAGE_BYTES = 12 * 1024 * 1024;

interface ImageDropzoneProps {
  file: File | null;
  onChange: (file: File | null) => void;
  label?: string;
  hint?: string;
  capture?: "user" | "environment";
  className?: string;
}

export function validateImageFile(file: File): string | null {
  if (!ACCEPT.includes(file.type)) return "Please choose a JPEG, PNG or WebP image.";
  if (file.size > MAX_IMAGE_BYTES)
    return "That image is larger than 12 MB. Please choose a smaller one.";
  return null;
}

export function ImageDropzone({
  file,
  onChange,
  label = "Upload a photo",
  hint = "JPEG, PNG or WebP up to 12 MB. A clear, front-facing photo in good light works best.",
  capture,
  className,
}: ImageDropzoneProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );

  const accept = (candidate: File | undefined) => {
    if (!candidate) return;
    const problem = validateImageFile(candidate);
    setError(problem);
    onChange(problem ? null : candidate);
  };

  return (
    <div className={className}>
      <label
        htmlFor={inputId}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          accept(e.dataTransfer.files[0]);
        }}
        className={cn(
          "bg-bg-muted/50 focus-within:border-gold-deep relative flex min-h-56 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-lg border-2 border-dashed p-6 text-center transition-colors",
          dragging ? "border-gold-deep bg-gold/10" : "border-border-strong hover:border-gold",
        )}
      >
        {preview ? (
          <Image
            src={preview}
            alt="Selected photo preview"
            fill
            className="object-contain"
            unoptimized
          />
        ) : (
          <>
            <ImagePlus className="text-accent-text size-8" aria-hidden />
            <span className="mt-3 font-medium">{label}</span>
            <span className="text-fg-muted mt-1 max-w-xs text-xs">{hint}</span>
          </>
        )}
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept={ACCEPT.join(",")}
          capture={capture}
          className="sr-only"
          onChange={(e) => accept(e.target.files?.[0])}
        />
      </label>
      {file && (
        <div className="text-fg-muted mt-2 flex items-center justify-between text-sm">
          <span className="truncate">{file.name}</span>
          <button
            type="button"
            onClick={() => {
              onChange(null);
              if (inputRef.current) inputRef.current.value = "";
            }}
            className="text-fg-soft hover:text-fg inline-flex min-h-10 items-center gap-1"
          >
            <X className="size-4" aria-hidden /> Remove
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className="text-danger mt-2 text-sm">
          {error}
        </p>
      )}
    </div>
  );
}
