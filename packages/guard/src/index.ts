import { NotImplementedError } from "@caelis/core";

export interface CreateFileOperation {
  type: "create-file";
  path: string;
  content: string;
}

export interface UpdateFileOperation {
  type: "update-file";
  path: string;
  previousSha256?: string;
  content: string;
}

export interface DeleteFileOperation {
  type: "delete-file";
  path: string;
  previousSha256?: string;
}

/** File operation planned by Caelis guard. */
export type ChangeOperation =
  CreateFileOperation | UpdateFileOperation | DeleteFileOperation;

/** Guarded change set. */
export interface ChangeSet {
  id: string;
  description: string;
  status: "planned" | "approved" | "applied" | "reverted" | "failed";
  operations: ChangeOperation[];
}

export interface ChangeSetValidationIssue {
  severity: "error" | "warning";
  message: string;
  path?: string;
}

export interface ChangeSetValidationReport {
  valid: boolean;
  issues: ChangeSetValidationIssue[];
}

/** Create a planned change set without applying it. */
export function planChangeSet(input: Omit<ChangeSet, "status">): ChangeSet {
  return { ...input, status: "planned" };
}

/** Validate basic change-set safety rules without touching project files. */
export function validateChangeSet(
  changeSet: ChangeSet
): ChangeSetValidationReport {
  const issues: ChangeSetValidationIssue[] = [];
  const paths = new Set<string>();

  for (const operation of changeSet.operations) {
    if (pathIsUnsafe(operation.path)) {
      issues.push({
        severity: "error",
        message: "Change operation path is unsafe.",
        path: operation.path
      });
    }
    if (paths.has(operation.path)) {
      issues.push({
        severity: "warning",
        message: "Multiple operations target the same path.",
        path: operation.path
      });
    }
    paths.add(operation.path);
  }

  return {
    valid: issues.every((issue) => issue.severity !== "error"),
    issues
  };
}

/** Applying project writes is intentionally deferred until guarded previews exist. */
export function applyChangeSet(_changeSet: ChangeSet): Promise<never> {
  return Promise.reject(new NotImplementedError("Applying change sets"));
}

/** Reverting project writes is intentionally deferred until guarded previews exist. */
export function revertChangeSet(_changeSet: ChangeSet): Promise<never> {
  return Promise.reject(new NotImplementedError("Reverting change sets"));
}

function pathIsUnsafe(filePath: string): boolean {
  return (
    filePath.startsWith("/") ||
    filePath.includes("..") ||
    filePath.trim().length === 0
  );
}
