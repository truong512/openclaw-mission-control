"use client";

import { useCallback, useRef, useState } from "react";
import { Loader2, Paperclip } from "lucide-react";

import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  TASK_ATTACHMENT_ACCEPT,
  attachmentMarkdownForFile,
  insertTextAtSelection,
  readClipboardUploadFile,
  uploadTaskAttachment,
} from "@/lib/task-attachments";
import { ApiError } from "@/api/mutator";

const formatUploadError = (error: unknown, fallback: string): string => {
  if (error instanceof ApiError) {
    const detail = error.data;
    if (typeof detail === "object" && detail !== null) {
      const message = (detail as { message?: unknown }).message;
      if (typeof message === "string" && message.trim()) {
        return message;
      }
      const nestedDetail = (detail as { detail?: unknown }).detail;
      if (typeof nestedDetail === "string" && nestedDetail.trim()) {
        return nestedDetail;
      }
    }
    if (error.message.trim()) return error.message;
  }
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return fallback;
};

type TaskDescriptionEditorProps = {
  boardId?: string;
  taskId?: string | null;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  minHeightClassName?: string;
};

export function TaskDescriptionEditor({
  boardId,
  taskId = null,
  value,
  onChange,
  disabled = false,
  placeholder = "Optional details. Paste or attach files.",
  className,
  minHeightClassName = "min-h-[140px]",
}: TaskDescriptionEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const insertAttachmentMarkdown = useCallback(
    (filename: string, url: string, contentType: string, isImage?: boolean) => {
      const textarea = textareaRef.current;
      const selectionStart = textarea?.selectionStart ?? value.length;
      const selectionEnd = textarea?.selectionEnd ?? value.length;
      const markdown = attachmentMarkdownForFile(
        filename,
        url,
        contentType,
        isImage,
      );
      const { nextValue, nextCursor } = insertTextAtSelection(
        value,
        markdown,
        selectionStart,
        selectionEnd,
      );
      onChange(nextValue);
      requestAnimationFrame(() => {
        if (!textareaRef.current) return;
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(nextCursor, nextCursor);
      });
    },
    [onChange, value],
  );

  const uploadFile = useCallback(
    async (file: File) => {
      if (!boardId || disabled) return;
      setIsUploading(true);
      setUploadError(null);
      try {
        const attachment = await uploadTaskAttachment(boardId, file, { taskId });
        insertAttachmentMarkdown(
          attachment.filename,
          attachment.url,
          attachment.content_type,
          attachment.is_image,
        );
      } catch (error) {
        setUploadError(formatUploadError(error, "Unable to upload attachment."));
      } finally {
        setIsUploading(false);
      }
    },
    [boardId, disabled, insertAttachmentMarkdown, taskId],
  );

  const handlePaste = useCallback(
    (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
      if (disabled || isUploading) return;
      const uploadFileFromClipboard = readClipboardUploadFile(event.clipboardData);
      if (!uploadFileFromClipboard) return;
      event.preventDefault();
      void uploadFile(uploadFileFromClipboard);
    },
    [disabled, isUploading, uploadFile],
  );

  const handleFileChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file) return;
      void uploadFile(file);
    },
    [uploadFile],
  );

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-slate-500">
          Markdown supported. Attach images or documents (PDF, DOCX, XLSX, TXT,
          CSV).
        </p>
        <div className="flex items-center gap-2">
          {isUploading ? (
            <span className="inline-flex items-center gap-1 text-xs text-slate-500">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Uploading…
            </span>
          ) : null}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || isUploading || !boardId}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-50",
              (disabled || isUploading || !boardId) &&
                "cursor-not-allowed opacity-50",
            )}
          >
            <Paperclip className="h-3.5 w-3.5" />
            Attach file
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept={TASK_ATTACHMENT_ACCEPT}
            className="hidden"
            onChange={handleFileChange}
            disabled={disabled || isUploading || !boardId}
          />
        </div>
      </div>
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onPaste={handlePaste}
        placeholder={placeholder}
        className={minHeightClassName}
        disabled={disabled || isUploading}
      />
      {uploadError ? (
        <p className="text-xs text-rose-600">{uploadError}</p>
      ) : null}
    </div>
  );
}
