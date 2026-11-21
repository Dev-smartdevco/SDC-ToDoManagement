-- Read-path indexes for the queries the app actually runs.
-- Task lists filter by owner, parent row, status, and due date, then sort by sort order.
-- Project listings group tasks by project and status.
-- Activity and notes lists sort by time for one user.

CREATE INDEX "Task_userId_parentTaskId_dueDate_idx" ON "Task"("userId", "parentTaskId", "dueDate");

CREATE INDEX "Task_userId_parentTaskId_status_dueDate_idx" ON "Task"("userId", "parentTaskId", "status", "dueDate");

CREATE INDEX "Task_projectId_status_createdAt_idx" ON "Task"("projectId", "status", "createdAt");

CREATE INDEX "Task_userId_createdAt_idx" ON "Task"("userId", "createdAt");

CREATE INDEX "ActivityLog_userId_createdAt_idx" ON "ActivityLog"("userId", "createdAt");

CREATE INDEX "ActivityLog_actorId_createdAt_idx" ON "ActivityLog"("actorId", "createdAt");

CREATE INDEX "Note_userId_updatedAt_idx" ON "Note"("userId", "updatedAt");
