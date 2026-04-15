import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/session";
import { uploadBufferToS3 } from "@/lib/aws/s3";
import {
  ACCEPTED_FILE_TYPES,
  MAX_FILE_SIZE_BYTES,
  MAX_FILES_PER_ORDER,
} from "@/lib/utils/constants";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { decoded } = await requireApiRole("customer");
    const formData = await request.formData();
    const files = formData
      .getAll("files")
      .filter((value): value is File => value instanceof File && value.size > 0);

    if (files.length === 0) {
      return NextResponse.json({ error: "No files uploaded." }, { status: 400 });
    }

    if (files.length > MAX_FILES_PER_ORDER) {
      return NextResponse.json(
        { error: `Maximum ${MAX_FILES_PER_ORDER} files allowed.` },
        { status: 400 },
      );
    }

    const uploadedFiles = await Promise.all(
      files.map(async (file) => {
        if (!ACCEPTED_FILE_TYPES.includes(file.type)) {
          throw new Error(`Unsupported file type for ${file.name}.`);
        }

        if (file.size > MAX_FILE_SIZE_BYTES) {
          throw new Error(`${file.name} exceeds the 15 MB limit.`);
        }

        const extension = file.name.includes(".")
          ? file.name.split(".").pop()
          : "bin";
        const key = `orders/${decoded.uid}/${Date.now()}-${randomUUID()}.${extension}`;
        const buffer = Buffer.from(await file.arrayBuffer());
        const upload = await uploadBufferToS3({
          key,
          buffer,
          contentType: file.type || "application/octet-stream",
        });

        return {
          originalFileName: file.name,
          s3Key: upload.key,
          s3Url: upload.url,
          mimeType: file.type || "application/octet-stream",
          size: file.size,
        };
      }),
    );

    return NextResponse.json({ files: uploadedFiles });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed." },
      { status: 400 },
    );
  }
}
