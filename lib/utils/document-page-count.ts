const IMAGE_MIME_TYPES = new Set(["image/png", "image/jpeg"]);

function detectPdfPageCount(buffer: Buffer) {
  const rawText = buffer.toString("latin1");
  const matches = rawText.match(/\/Type\s*\/Page\b/g);
  return matches?.length ?? 0;
}

export function detectDocumentPageCount(params: {
  buffer: Buffer;
  mimeType: string;
  fileName: string;
}) {
  if (IMAGE_MIME_TYPES.has(params.mimeType)) {
    return 1;
  }

  if (params.mimeType === "application/pdf") {
    const pageCount = detectPdfPageCount(params.buffer);

    if (pageCount > 0) {
      return pageCount;
    }

    throw new Error(
      `Could not detect page count for ${params.fileName}. Please export it as a standard PDF and upload again.`,
    );
  }

  throw new Error(
    `${params.fileName} must be uploaded as PDF, PNG, or JPG so page count can be detected automatically.`,
  );
}
