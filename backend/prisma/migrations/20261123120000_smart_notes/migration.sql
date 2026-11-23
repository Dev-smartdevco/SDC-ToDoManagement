-- Extend existing notes so Smart Notes remain visible in the normal Notes module.
ALTER TABLE "Note"
  ADD COLUMN "originalDrawing" JSONB;

CREATE TABLE "SmartNoteRequest" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "noteId" TEXT,
  "createdTaskIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SmartNoteRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SmartNoteRequest_userId_requestId_key" ON "SmartNoteRequest"("userId", "requestId");
CREATE INDEX "SmartNoteRequest_userId_projectId_createdAt_idx" ON "SmartNoteRequest"("userId", "projectId", "createdAt");
ALTER TABLE "SmartNoteRequest" ADD CONSTRAINT "SmartNoteRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SmartNoteRequest" ADD CONSTRAINT "SmartNoteRequest_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
