import path from "node:path";

import {
  validateProject,
  type ProjectValidationReport
} from "@caelis/project-index";

/** Return the read-only validation report for a project. */
export async function getValidationReport(
  projectRoot: string
): Promise<ProjectValidationReport> {
  return validateProject(path.resolve(projectRoot));
}
