import { LINE_WINDOW, MAX_LINES_READ } from "@/lib/discovery/server/types";
import type { ServerScopeValues } from "@/lib/discovery/server/types";

export type LineWindowResult = {
  lines: string[];
  totalLines: number;
  capped: boolean;
};

const NUL_BYTE = String.fromCharCode(0);

/** Decode a buffer as UTF-8 text and take a bounded line window. */
export function windowLines(
  buffer: Buffer,
  scope: ServerScopeValues,
): LineWindowResult {
  const text = buffer.toString("utf8");

  // Binary content decoded as UTF-8 tends to contain NUL bytes or a high
  // density of the replacement character — treat as unreadable rather than
  // running detection on garbage.
  const replacementCount = (text.match(/�/g)?.length ?? 0);
  if (text.includes(NUL_BYTE) || (text.length > 0 && replacementCount > text.length * 0.02)) {
    return { lines: [], totalLines: 0, capped: false };
  }

  const allLines = text.split(/\r?\n/).filter((line) => line.length > 0);
  const totalLines = allLines.length;
  const bounded = allLines.slice(0, MAX_LINES_READ);

  if (scope.coverageMode === "full") {
    return { lines: bounded, totalLines, capped: totalLines > MAX_LINES_READ };
  }

  if (bounded.length <= LINE_WINDOW * 2) {
    return { lines: bounded, totalLines, capped: false };
  }

  switch (scope.lineSample) {
    case "head":
      return { lines: bounded.slice(0, LINE_WINDOW * 2), totalLines, capped: true };
    case "tail":
      return { lines: bounded.slice(-LINE_WINDOW * 2), totalLines, capped: true };
    case "random": {
      const copy = [...bounded];
      for (let i = copy.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
      }
      return { lines: copy.slice(0, LINE_WINDOW * 2), totalLines, capped: true };
    }
    case "head_tail":
    default:
      return {
        lines: [...bounded.slice(0, LINE_WINDOW), ...bounded.slice(-LINE_WINDOW)],
        totalLines,
        capped: true,
      };
  }
}
