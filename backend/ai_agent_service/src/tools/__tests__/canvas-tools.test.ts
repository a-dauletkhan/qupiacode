import { describe, it, expect } from "vitest";
import { canvasTools } from "../canvas-tools.js";

describe("canvasTools", () => {
  it("defines all required tool names", () => {
    const toolNames = canvasTools.map((t) => t.name);
    expect(toolNames).toContain("createNode");
    expect(toolNames).toContain("updateNode");
    expect(toolNames).toContain("deleteNode");
    expect(toolNames).toContain("createEdge");
    expect(toolNames).toContain("deleteEdge");
    expect(toolNames).toContain("sendMessage");
    expect(toolNames).toContain("groupNodes");
    expect(toolNames).toContain("rearrangeNodes");
  });

  it("each tool has a description and parameters", () => {
    for (const tool of canvasTools) {
      expect(tool.description).toBeTruthy();
      expect(tool.parameters).toBeDefined();
      expect(tool.parameters.type).toBe("object");
    }
  });
});
