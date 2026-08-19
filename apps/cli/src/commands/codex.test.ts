import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { SqliteCodexRepository } from "@caelis/codex";
import { flushLogger } from "@caelis/shared";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createProgram } from "../program.js";

describe("codex command logging", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("keeps routine lifecycle logs out of normal output", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "caelis-cli-codex-"));
    const output = captureOutput();

    try {
      await createProgram().parseAsync([
        "node",
        "caelis",
        "codex",
        "rebuild-index",
        root
      ]);
      flushLogger();

      expect(output.stdout).toBe("Codex search index rebuilt.\n");
      expect(output.stdout).not.toContain('{"level"');
      expect(output.stderr).not.toContain("Initializing Codex database");
      expect(output.stderr).not.toContain("Starting Codex migrations");
      expect(output.stderr).not.toContain("Rebuilding Codex FTS index");
      expect(output.stderr).not.toContain("Closed Codex database");
    } finally {
      output.restore();
      await rm(root, { force: true, recursive: true });
    }
  });

  it("prints structured lifecycle logs in debug mode after awaiting rebuild", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "caelis-cli-codex-"));
    const output = captureOutput();
    const rebuildStarted = deferred();
    const rebuildFinished = deferred();

    vi.spyOn(
      SqliteCodexRepository.prototype,
      "rebuildIndex"
    ).mockImplementation(() => {
      rebuildStarted.resolve();
      return rebuildFinished.promise;
    });

    try {
      const command = createProgram().parseAsync([
        "node",
        "caelis",
        "--debug",
        "codex",
        "rebuild-index",
        root
      ]);

      await rebuildStarted.promise;
      expect(output.stdout).not.toContain("Codex search index rebuilt.");

      rebuildFinished.resolve();
      await command;
      flushLogger();

      expect(output.stdout).toContain("Codex search index rebuilt.");
      expect(output.stderr).toContain('{"level":30');
      expect(output.stderr).toContain("Initializing Codex database");
      expect(output.stderr).toContain("Starting Codex migrations");
      expect(output.stderr).toContain("Closed Codex database");
    } finally {
      output.restore();
      await rm(root, { force: true, recursive: true });
    }
  });
});

function captureOutput(): {
  readonly stdout: string;
  readonly stderr: string;
  restore: () => void;
} {
  let stdout = "";
  let stderr = "";
  const consoleLog = vi.spyOn(console, "log").mockImplementation((...args) => {
    stdout += `${args.map((arg) => String(arg)).join(" ")}\n`;
  });

  const stdoutWrite = vi
    .spyOn(process.stdout, "write")
    .mockImplementation(
      (
        chunk: string | Uint8Array,
        encodingOrCallback?: BufferEncoding | (() => void),
        callback?: () => void
      ) => {
        stdout +=
          typeof chunk === "string" ? chunk : Buffer.from(chunk).toString();
        if (typeof encodingOrCallback === "function") {
          encodingOrCallback();
        }
        callback?.();
        return true;
      }
    );

  const stderrWrite = vi
    .spyOn(process.stderr, "write")
    .mockImplementation(
      (
        chunk: string | Uint8Array,
        encodingOrCallback?: BufferEncoding | (() => void),
        callback?: () => void
      ) => {
        stderr +=
          typeof chunk === "string" ? chunk : Buffer.from(chunk).toString();
        if (typeof encodingOrCallback === "function") {
          encodingOrCallback();
        }
        callback?.();
        return true;
      }
    );

  return {
    get stdout() {
      return stdout;
    },
    get stderr() {
      return stderr;
    },
    restore() {
      consoleLog.mockRestore();
      stdoutWrite.mockRestore();
      stderrWrite.mockRestore();
    }
  };
}

function deferred(): {
  promise: Promise<void>;
  resolve: () => void;
} {
  let resolve!: () => void;
  const promise = new Promise<void>((innerResolve) => {
    resolve = innerResolve;
  });

  return { promise, resolve };
}
