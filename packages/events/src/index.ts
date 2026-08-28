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
  cancelType?: number;
  defaultType?: number;
  positionType?: number;
  background?: number;
  branches?: { choice: string; nodes: EventNode[] }[];
  cancel?: EventNode[];
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
  const nodes: EventNode[] = [];
  for (let index = 0; index < commands.length; index += 1) {
    const command = commands[index];
    if (!command || command.code === 0) continue;
    switch (command.code) {
      case 101: {
        const lines: string[] = [];
        while (commands[index + 1]?.code === 401) {
          index += 1;
          lines.push(stringifyParameter(commands[index]?.parameters[0]));
        }
        nodes.push({
          type: "dialogue",
          ...(typeof command.parameters[4] === "string" && command.parameters[4]
            ? { speaker: command.parameters[4] }
            : {}),
          text: lines.join("\n")
        });
        break;
      }
      case 102:
        nodes.push({
          type: "show-choices",
          choices: Array.isArray(command.parameters[0])
            ? command.parameters[0].map(stringifyParameter)
            : [],
          cancelType: Number(command.parameters[1] ?? -1),
          defaultType: Number(command.parameters[2] ?? 0),
          positionType: Number(command.parameters[3] ?? 2),
          background: Number(command.parameters[4] ?? 0)
        });
        break;
      case 108: {
        const lines = [stringifyParameter(command.parameters[0])];
        while (commands[index + 1]?.code === 408) {
          index += 1;
          lines.push(stringifyParameter(commands[index]?.parameters[0]));
        }
        nodes.push({ type: "comment", text: lines.join("\n") });
        break;
      }
      case 115:
        nodes.push({ type: "exit-event-processing" });
        break;
      case 117:
        nodes.push({
          type: "call-common-event",
          commonEventId: Number(command.parameters[0])
        });
        break;
      case 121:
        nodes.push({
          type: "set-switch",
          switchId: Number(command.parameters[0]),
          value: Number(command.parameters[2]) === 0
        });
        break;
      case 122:
        if (
          Number(command.parameters[2]) !== 0 ||
          Number(command.parameters[3]) !== 0
        ) {
          throw new NotImplementedError(
            "Parsing non-constant variable operations"
          );
        }
        nodes.push({
          type: "set-variable",
          variableId: Number(command.parameters[0]),
          value: Number(command.parameters[4])
        });
        break;
      case 201:
        if (Number(command.parameters[0]) !== 0) {
          throw new NotImplementedError(
            "Parsing variable-based player transfers"
          );
        }
        nodes.push({
          type: "transfer-player",
          mapId: Number(command.parameters[1]),
          x: Number(command.parameters[2]),
          y: Number(command.parameters[3])
        });
        break;
      case 230:
        nodes.push({
          type: "wait",
          frames: Number(command.parameters[0] ?? 0)
        });
        break;
      case 355: {
        const lines = [stringifyParameter(command.parameters[0])];
        while (commands[index + 1]?.code === 655) {
          index += 1;
          lines.push(stringifyParameter(commands[index]?.parameters[0]));
        }
        nodes.push({ type: "script-command", script: lines.join("\n") });
        break;
      }
      case 357:
        nodes.push({
          type: "plugin-command",
          pluginName: stringifyParameter(command.parameters[0]),
          commandName: stringifyParameter(command.parameters[1]),
          args: isStringRecord(command.parameters[3])
            ? command.parameters[3]
            : {}
        });
        break;
      default:
        throw new NotImplementedError(
          `Parsing event command ${String(command.code)}`
        );
    }
  }
  return nodes;
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
  return [...compileNodes(nodes, 0), { code: 0, indent: 0, parameters: [] }];
}

function compileNodes(nodes: EventNode[], indent: number): EventCommand[] {
  return nodes.flatMap((node): EventCommand[] => {
    switch (node.type) {
      case "comment": {
        const lines = node.text.split("\n");
        return lines.map((line, index) => ({
          code: index === 0 ? 108 : 408,
          indent,
          parameters: [line]
        }));
      }
      case "wait":
        return [{ code: 230, indent, parameters: [node.frames] }];
      case "exit-event-processing":
        return [{ code: 115, indent, parameters: [] }];
      case "dialogue":
        return [
          { code: 101, indent, parameters: ["", 0, 0, 2, node.speaker ?? ""] },
          ...node.text
            .split("\n")
            .map((line) => ({ code: 401, indent, parameters: [line] }))
        ];
      case "show-choices": {
        const start: EventCommand = {
          code: 102,
          indent,
          parameters: [
            node.choices,
            node.cancelType ?? -1,
            node.defaultType ?? 0,
            node.positionType ?? 2,
            node.background ?? 0
          ]
        };
        if (!node.branches?.length && !node.cancel) return [start];
        const branches = (node.branches ?? []).flatMap((branch) => {
          const choiceIndex = node.choices.indexOf(branch.choice);
          return [
            { code: 402, indent, parameters: [choiceIndex, branch.choice] },
            ...compileNodes(branch.nodes, indent + 1)
          ];
        });
        const cancel = node.cancel
          ? [
              { code: 403, indent, parameters: [] },
              ...compileNodes(node.cancel, indent + 1)
            ]
          : [];
        return [
          start,
          ...branches,
          ...cancel,
          { code: 404, indent, parameters: [] }
        ];
      }
      case "conditional-branch":
        return [
          { code: 111, indent, parameters: [12, node.condition] },
          ...compileNodes(node.then, indent + 1),
          ...(node.else
            ? [
                { code: 411, indent, parameters: [] },
                ...compileNodes(node.else, indent + 1)
              ]
            : []),
          { code: 412, indent, parameters: [] }
        ];
      case "set-switch":
        return [
          {
            code: 121,
            indent,
            parameters: [node.switchId, node.switchId, node.value ? 0 : 1]
          }
        ];
      case "set-variable":
        return [
          {
            code: 122,
            indent,
            parameters: [node.variableId, node.variableId, 0, 0, node.value]
          }
        ];
      case "call-common-event":
        return [{ code: 117, indent, parameters: [node.commonEventId] }];
      case "transfer-player":
        return [
          {
            code: 201,
            indent,
            parameters: [0, node.mapId, node.x, node.y, 0, 0]
          }
        ];
      case "plugin-command":
        return [
          {
            code: 357,
            indent,
            parameters: [
              node.pluginName,
              node.commandName,
              node.commandName,
              node.args
            ]
          }
        ];
      case "script-command": {
        const lines = node.script.split("\n");
        return lines.map((line, index) => ({
          code: index === 0 ? 355 : 655,
          indent,
          parameters: [line]
        }));
      }
    }
  });
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.values(value).every((item) => typeof item === "string")
  );
}
