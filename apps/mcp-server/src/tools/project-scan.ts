import path from "node:path";

import { scanProject, type ProjectScanResult } from "@caelis/project-index";

/** Return the full read-only project scan result. */
export async function getProjectScan(
  projectRoot: string
): Promise<ProjectScanResult> {
  return scanProject(path.resolve(projectRoot));
}
