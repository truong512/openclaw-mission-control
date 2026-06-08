import { describe, expect, it } from "vitest";

import {
  attachmentMarkdownForFile,
  isImageContentType,
} from "@/lib/task-attachments";

describe("task-attachments", () => {
  it("inserts image markdown for image content types", () => {
    expect(
      attachmentMarkdownForFile(
        "shot.png",
        "/api/v1/boards/a/tasks/attachments/b",
        "image/png",
      ),
    ).toBe("\n![shot.png](/api/v1/boards/a/tasks/attachments/b)\n");
  });

  it("inserts link markdown for document content types", () => {
    expect(
      attachmentMarkdownForFile(
        "spec.pdf",
        "/api/v1/boards/a/tasks/attachments/b",
        "application/pdf",
      ),
    ).toBe("\n[spec.pdf](/api/v1/boards/a/tasks/attachments/b)\n");
  });

  it("detects image content types", () => {
    expect(isImageContentType("image/jpeg")).toBe(true);
    expect(isImageContentType("application/pdf")).toBe(false);
  });
});
