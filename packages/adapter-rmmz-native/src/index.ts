import type {
  AdapterDetectionContext,
  PluginAdapter,
  PluginCapability
} from "@caelis/adapter-sdk";

const nativeCapabilities: PluginCapability[] = [
  {
    id: "rmmz.switches",
    kind: "switches",
    displayName: "RPG Maker MZ Switches"
  },
  {
    id: "rmmz.variables",
    kind: "variables",
    displayName: "RPG Maker MZ Variables"
  },
  {
    id: "rmmz.common-events",
    kind: "common-events",
    displayName: "RPG Maker MZ Common Events"
  },
  {
    id: "rmmz.map-events",
    kind: "map-events",
    displayName: "RPG Maker MZ Map Events"
  },
  {
    id: "rmmz.plugin-commands",
    kind: "plugin-commands",
    displayName: "RPG Maker MZ Plugin Commands"
  },
  {
    id: "rmmz.script-commands",
    kind: "script-commands",
    displayName: "RPG Maker MZ Script Commands"
  },
  {
    id: "rmmz.database-records",
    kind: "database-records",
    displayName: "RPG Maker MZ Database Records"
  }
];

/** Native RPG Maker MZ adapter. */
export class RmmzNativeAdapter implements PluginAdapter {
  public readonly id = "rmmz-native";
  public readonly displayName = "RPG Maker MZ Native";

  public detect(context: AdapterDetectionContext): Promise<boolean> {
    return Promise.resolve(
      context.dataFiles.some((file) => file.endsWith("System.json"))
    );
  }

  public getCapabilities(): PluginCapability[] {
    return nativeCapabilities;
  }
}

/** Singleton native adapter instance. */
export const rmmzNativeAdapter = new RmmzNativeAdapter();
