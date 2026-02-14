import { NextRequest, NextResponse } from "next/server";
import { writeFile } from "fs/promises";
import { join } from "path";
import { prisma } from "@/lib/db";
import { createDocumentRecord, enqueueProcessing } from "@/lib/rag";
import type { IngestSource } from "@/lib/rag";

export async function GET() {
  const documents = await prisma.document.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      filename: true,
      sourceType: true,
      sourceUrl: true,
      fileSize: true,
      status: true,
      error: true,
      chunkCount: true,
      createdAt: true,
    },
  });
  return NextResponse.json(documents);
}

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") || "";

    let source: IngestSource;

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      if (!file) {
        return NextResponse.json({ error: "No file provided" }, { status: 400 });
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const uploadPath = join(process.cwd(), "uploads", file.name);
      await writeFile(uploadPath, buffer);

      source = { filepath: uploadPath, filename: file.name };
    } else {
      const body = await req.json();

      if (body.url) {
        source = { url: body.url, filename: body.filename || new URL(body.url).hostname };
      } else if (body.content) {
        source = { content: body.content, filename: body.filename || "untitled.md", sourceType: body.sourceType || "markdown" };
      } else {
        return NextResponse.json(
          { error: "Provide a file, url, or content" },
          { status: 400 }
        );
      }
    }

    const docId = await createDocumentRecord(source);

    enqueueProcessing(docId, source);

    return NextResponse.json({ id: docId });
  } catch (err) {
    console.error("POST /api/rag/documents error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
