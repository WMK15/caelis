/*:
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
 */

declare const PluginManager:
  | {
      parameters(pluginName: string): Record<string, string | undefined>;
      registerCommand(
        pluginName: string,
        commandName: string,
        callback: () => void
      ): void;
    }
  | undefined;

interface BridgeParameters {
  enabled: boolean;
  port: number;
  sessionTokenConfigured: boolean;
  readOnlyMode: boolean;
}

const pluginName = "CaelisBridge";

function readParameters(): BridgeParameters {
  const raw =
    typeof PluginManager === "undefined"
      ? {}
      : PluginManager.parameters(pluginName);

  return {
    enabled: raw.enabled === "true",
    port: Number.parseInt(raw.port ?? "8787", 10),
    sessionTokenConfigured: (raw.sessionToken ?? "").length > 0,
    readOnlyMode: raw.readOnlyMode !== "false"
  };
}

function reportStatus(): void {
  const parameters = readParameters();
  console.info(
    JSON.stringify({
      source: "CaelisBridge",
      developmentOnly: true,
      networkingEnabled: false,
      ...parameters
    })
  );
}

if (typeof PluginManager !== "undefined") {
  PluginManager.registerCommand(pluginName, "ReportStatus", reportStatus);
}

if (readParameters().enabled) {
  reportStatus();
}
