import { describe, it, expect } from "vitest";
import { canvasTools } from "../canvas-tools.js";

describe("canvasTools", () => {
  it("defines all required tool names", () => {
    const toolNames = canvasTools.map((t) => t.name);
    expect(toolNames).toContain("createDiagram");
    expect(toolNames).toContain("createNode");
    expect(toolNames).toContain("createEdge");
    expect(toolNames).toContain("sendMessage");
  });

  it("each tool has a description and parameters", () => {
    for (const tool of canvasTools) {
      expect(tool.description).toBeTruthy();
      expect(tool.parameters).toBeDefined();
      expect(tool.parameters.type).toBe("object");
    }
  });
});
