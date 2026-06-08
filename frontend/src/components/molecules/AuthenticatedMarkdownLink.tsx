"use client";

import { useCallback, useState } from "react";
import type { ReactNode } from "react";

import {
  downloadTaskAttachment,
  isTaskAttachmentUrl,
} from "@/lib/authenticated-fetch";
import { cn } from "@/lib/utils";

type AuthenticatedMarkdownLinkProps = {
  href?: string;
  children?: ReactNode;
  className?: string;
  title?: string;
};

export function AuthenticatedMarkdownLink({
  href,
  children,
  className,
  title,
}: AuthenticatedMarkdownLinkProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [failed, setFailed] = useState(false);

  const handleDownload = useCallback(async () => {
    if (!href || !isTaskAttachmentUrl(href)) return;
    setIsDownloading(true);
    setFailed(false);
    try {
      const label =
        typeof children === "string" ? children : title?.trim() || "attachment";
      await downloadTaskAttachment(href, label);
    } catch {
      setFailed(true);
    } finally {
      setIsDownloading(false);
    }
  }, [children, href, title]);

  if (!href) {
    return <span className={className}>{children}</span>;
  }

  if (isTaskAttachmentUrl(href)) {
    return (
      <button
        type="button"
        onClick={() => void handleDownload()}
        disabled={isDownloading}
        title={title}
        className={cn(
          "inline font-medium text-sky-700 underline decoration-sky-400 underline-offset-2 transition-colors hover:text-sky-800 hover:decoration-sky-600 disabled:cursor-wait disabled:opacity-70",
          className,
        )}
      >
        {isDownloading ? "Downloading…" : failed ? "Download failed" : children}
      </button>
    );
  }

  return (
    <a
      href={href}
      title={title}
      className={cn(
        "font-medium text-sky-700 underline decoration-sky-400 underline-offset-2 transition-colors hover:text-sky-800 hover:decoration-sky-600",
        className,
      )}
      target="_blank"
      rel="noopener noreferrer"
    >
      {children}
    </a>
  );
}
