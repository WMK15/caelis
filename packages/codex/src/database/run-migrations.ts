import { openCodexConnection } from "./connection.js";
import { runCodexMigrations } from "./migrations.js";

const projectRoot = process.argv[2] ?? process.cwd();
const connection = openCodexConnection(projectRoot);

try {
  await runCodexMigrations(connection);
} finally {
  connection.sqlite.close();
}
