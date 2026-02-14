-- AlterTable
ALTER TABLE "Message" ADD COLUMN "groundingConfidence" TEXT;
ALTER TABLE "Message" ADD COLUMN "groundingReason" TEXT;
ALTER TABLE "Message" ADD COLUMN "groundingAvgSimilarity" REAL;
ALTER TABLE "Message" ADD COLUMN "groundingUsedChunkCount" INTEGER;

-- CreateTable
CREATE TABLE "MessageCitation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "messageId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "chunkIndex" INTEGER NOT NULL,
    "score" REAL NOT NULL,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MessageCitation_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MessageCitation_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "MessageCitation_messageId_idx" ON "MessageCitation"("messageId");

-- CreateIndex
CREATE INDEX "MessageCitation_documentId_idx" ON "MessageCitation"("documentId");
