import { defineConfig } from "tsup";

const banner = `/*:
 * @target MZ
 * @plugindesc Development-only Caelis bridge scaffold. Does not open network connections yet.
 * @author Caelis contributors
 * @help
 * CaelisBridge is a development-only bridge plugin for future playtest
 * communication with Caelis. The initial scaffold only reports status and
 * logs structured development metadata when enabled.
 *
 * Do not ship this plugin in production builds.
 *
 * @param enabled
 * @text Enabled
 * @type boolean
 * @default false
 *
 * @param port
 * @text Port
 * @type number
 * @default 8787
 *
 * @param sessionToken
 * @text Session Token
 * @type string
 * @default
 *
 * @param readOnlyMode
 * @text Read-only Mode
 * @type boolean
 * @default true
 *
 * @command ReportStatus
 * @text Report Status
 * @desc Logs the current Caelis bridge scaffold status.
 */`;

export default defineConfig({
  entry: ["src/CaelisBridge.ts"],
  format: ["iife"],
  globalName: "CaelisBridge",
  platform: "browser",
  target: "es2019",
  clean: true,
  dts: false,
  sourcemap: false,
  outDir: "dist",
  outExtension: () => ({ js: ".js" }),
  banner: { js: banner }
});
