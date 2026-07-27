import { getProjectScan } from "./project-scan.js";

/** Concise project summary returned by the MCP tool. */
export interface ProjectSummary {
  projectName: string;
  engine: "RPG_MAKER_MZ";
  dataFiles: number;
  maps: number;
  plugins: number;
  assetCounts: Record<string, number>;
}

/** Return a compact project summary. */
export async function getProjectSummary(
  projectRoot: string
): Promise<ProjectSummary> {
  const scan = await getProjectScan(projectRoot);

  return {
    projectName: scan.projectName,
    engine: scan.engine,
    dataFiles: scan.dataJsonFiles.length,
    maps: scan.mapCount,
    plugins: scan.pluginFiles.length,
    assetCounts: Object.fromEntries(
      scan.assetCounts.map((asset) => [asset.folder, asset.count])
    )
  };
}
