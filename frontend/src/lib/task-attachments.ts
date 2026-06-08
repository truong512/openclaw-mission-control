import { customFetch } from "@/api/mutator";
import { downloadTaskAttachment, isTaskAttachmentUrl } from "@/lib/authenticated-fetch";

export type TaskAttachmentRead = {
  id: string;
  board_id: string;
  task_id: string | null;
  filename: string;
  content_type: string;
  byte_size: number;
  url: string;
  is_image?: boolean;
  created_at: string;
};

type UploadTaskAttachmentResponse = {
  data: TaskAttachmentRead;
  status: number;
};

export const TASK_ATTACHMENT_ACCEPT = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "application/pdf",
  "text/plain",
  "text/markdown",
  "text/csv",
  ".pdf",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".txt",
  ".md",
  ".csv",
].join(",");

export async function uploadTaskAttachment(
  boardId: string,
  file: File,
  options?: { taskId?: string | null },
): Promise<TaskAttachmentRead> {
  const formData = new FormData();
  formData.append("file", file);
  const taskId = options?.taskId?.trim();
  const query = taskId ? `?task_id=${encodeURIComponent(taskId)}` : "";
  const result = await customFetch<UploadTaskAttachmentResponse>(
    `/api/v1/boards/${boardId}/tasks/attachments${query}`,
    {
      method: "POST",
      body: formData,
    },
  );
  if (result.status !== 200) {
    throw new Error("Unable to upload attachment.");
  }
  return result.data;
}

export function isImageContentType(contentType: string): boolean {
  return contentType.split(";", 1)[0]?.trim().toLowerCase().startsWith("image/");
}

export function attachmentMarkdownForFile(
  filename: string,
  url: string,
  contentType: string,
  isImage = isImageContentType(contentType),
): string {
  const label = filename.replace(/[\[\]()]/g, "").trim() || "attachment";
  if (isImage) {
    return `\n![${label}](${url})\n`;
  }
  return `\n[${label}](${url})\n`;
}

export function insertTextAtSelection(
  value: string,
  insertion: string,
  selectionStart: number,
  selectionEnd: number,
): { nextValue: string; nextCursor: number } {
  const nextValue =
    value.slice(0, selectionStart) + insertion + value.slice(selectionEnd);
  return {
    nextValue,
    nextCursor: selectionStart + insertion.length,
  };
}

export function readClipboardUploadFile(
  clipboardData: DataTransfer | null,
): File | null {
  if (!clipboardData) return null;
  for (const item of Array.from(clipboardData.items)) {
    if (item.kind !== "file") continue;
    const file = item.getAsFile();
    if (file) return file;
  }
  return null;
}

export { downloadTaskAttachment, isTaskAttachmentUrl };
