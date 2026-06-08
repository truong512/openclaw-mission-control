"use client";

import { useEffect, useState } from "react";

import {
  fetchAuthenticatedBlob,
  isTaskAttachmentUrl,
  resolveApiUrl,
} from "@/lib/authenticated-fetch";
import { cn } from "@/lib/utils";

type AuthenticatedMarkdownImageProps = {
  src?: string;
  alt?: string;
  title?: string;
  className?: string;
};

export function AuthenticatedMarkdownImage({
  src,
  alt,
  title,
  className,
}: AuthenticatedMarkdownImageProps) {
  const [resolvedSrc, setResolvedSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!src) {
      setResolvedSrc(null);
      setFailed(true);
      return;
    }

    let cancelled = false;
    let objectUrl: string | null = null;

    const load = async () => {
      setFailed(false);
      setResolvedSrc(null);
      try {
        if (isTaskAttachmentUrl(src)) {
          objectUrl = await fetchAuthenticatedBlob(src);
          if (!cancelled) {
            setResolvedSrc(objectUrl);
          }
          return;
        }
        if (!cancelled) {
          setResolvedSrc(resolveApiUrl(src));
        }
      } catch {
        if (!cancelled) {
          setFailed(true);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [src]);

  if (!src || failed) {
    return (
      <span className="my-2 inline-flex rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-500">
        {alt?.trim() || "Attachment unavailable"}
      </span>
    );
  }

  if (!resolvedSrc) {
    return (
      <span className="my-2 inline-flex rounded-md border border-dashed border-slate-200 px-2 py-1 text-xs text-slate-400">
        Loading image…
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- markdown attachments use authenticated blob URLs.
    <img
      src={resolvedSrc}
      alt={alt ?? ""}
      title={title}
      className={cn(
        "my-3 max-h-[420px] max-w-full rounded-lg border border-slate-200 bg-white object-contain",
        className,
      )}
    />
  );
}
