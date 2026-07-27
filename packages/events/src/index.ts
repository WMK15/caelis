import { NotImplementedError } from "@caelis/core";

/** Minimal RPG Maker event command shape used by the AST compiler. */
export interface EventCommand {
  code: number;
  indent: number;
  parameters: unknown[];
}

export interface DialogueNode {
  type: "dialogue";
  speaker?: string;
  text: string;
}

export interface ShowChoicesNode {
  type: "show-choices";
  choices: string[];
}

export interface ConditionalBranchNode {
  type: "conditional-branch";
  condition: string;
  then: EventNode[];
  else?: EventNode[];
}

export interface SetSwitchNode {
  type: "set-switch";
  switchId: number;
  value: boolean;
}

export interface SetVariableNode {
  type: "set-variable";
  variableId: number;
  value: number;
}

export interface CallCommonEventNode {
  type: "call-common-event";
  commonEventId: number;
}

export interface TransferPlayerNode {
  type: "transfer-player";
  mapId: number;
  x: number;
  y: number;
}

export interface PluginCommandNode {
  type: "plugin-command";
  pluginName: string;
  commandName: string;
  args: Record<string, string>;
}

export interface ScriptCommandNode {
  type: "script-command";
  script: string;
}

export interface CommentNode {
  type: "comment";
  text: string;
}

export interface WaitNode {
  type: "wait";
  frames: number;
}

export interface ExitEventProcessingNode {
  type: "exit-event-processing";
}

/** Initial event AST node set. */
export type EventNode =
  | DialogueNode
  | ShowChoicesNode
  | ConditionalBranchNode
  | SetSwitchNode
  | SetVariableNode
  | CallCommonEventNode
  | TransferPlayerNode
  | PluginCommandNode
  | ScriptCommandNode
  | CommentNode
  | WaitNode
  | ExitEventProcessingNode;

/** Parse supported RPG Maker event commands into the Caelis event AST. */
export function parseEventCommands(commands: EventCommand[]): EventNode[] {
  return commands
    .filter((command) => command.code !== 0)
    .map((command) => {
      switch (command.code) {
        case 108:
        case 408:
          return {
            type: "comment",
            text: stringifyParameter(command.parameters[0])
          } satisfies CommentNode;
        case 115:
          return {
            type: "exit-event-processing"
          } satisfies ExitEventProcessingNode;
        case 230:
          return {
            type: "wait",
            frames: Number(command.parameters[0] ?? 0)
          } satisfies WaitNode;
        default:
          throw new NotImplementedError(
            `Parsing event command ${String(command.code)}`
          );
      }
    });
}

function stringifyParameter(value: unknown): string {
  if (value === undefined || value === null) {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return JSON.stringify(value);
}

/** Compile supported Caelis event AST nodes to RPG Maker event commands. */
export function compileEventCommands(nodes: EventNode[]): EventCommand[] {
  const commands = nodes.map((node): EventCommand => {
    switch (node.type) {
      case "comment":
        return { code: 108, indent: 0, parameters: [node.text] };
      case "wait":
        return { code: 230, indent: 0, parameters: [node.frames] };
      case "exit-event-processing":
        return { code: 115, indent: 0, parameters: [] };
      case "dialogue":
      case "show-choices":
      case "conditional-branch":
      case "set-switch":
      case "set-variable":
      case "call-common-event":
      case "transfer-player":
      case "plugin-command":
      case "script-command":
        throw new NotImplementedError(`Compiling ${node.type} event nodes`);
    }
  });

  return [...commands, { code: 0, indent: 0, parameters: [] }];
}
