import { describe, expect, it } from "vitest";
import { ActionExecutor } from "./action-executor.js";
import type { ToolCall } from "./llm/types.js";

describe("ActionExecutor", () => {
  it("collects createNode tool calls as frontend actions", async () => {
    const executor = new ActionExecutor({
      commandId: "cmd-001",
      requestedBy: "user-1",
    });

    const toolCall: ToolCall = {
      name: "createNode",
      arguments: {
        nodeType: "sticky_note",
        position: { x: 100, y: 200 },
        text: "Hello",
      },
    };

    await executor.execute([toolCall]);

    expect(executor.actions).toHaveLength(1);
    expect(executor.actions[0]).toMatchObject({
      type: "create_node",
      nodeType: "sticky_note",
      position: { x: 100, y: 200 },
      content: { text: "Hello" },
    });
    expect(executor.createdNodeIds).toHaveLength(1);
  });

  it("collects createEdge tool calls as frontend actions", async () => {
    const executor = new ActionExecutor();

    await executor.execute([{ name: "createEdge", arguments: { source: "n1", target: "n2", label: "test" } }]);

    expect(executor.actions).toHaveLength(1);
    expect(executor.actions[0]).toMatchObject({
      type: "create_edge",
      source: "n1",
      target: "n2",
      label: "test",
    });
    expect(executor.createdEdgeIds).toHaveLength(1);
  });

  it("collects sendMessage tool calls", async () => {
    const executor = new ActionExecutor();

    await executor.execute([{ name: "sendMessage", arguments: { text: "I organized the board" } }]);

    expect(executor.messages).toEqual(["I organized the board"]);
  });

  it("sizes long sticky-note text for readability", async () => {
    const executor = new ActionExecutor();

    await executor.execute([
      {
        name: "createNode",
        arguments: {
          nodeType: "sticky_note",
          position: { x: 0, y: 0 },
          text: "Oil-based, Water-based, Micellar water, balm cleanser, and gentle gel cleanser options",
        },
      },
    ]);

    expect(executor.actions[0]).toMatchObject({
      type: "create_node",
      nodeType: "sticky_note",
    });
    const action = executor.actions[0] as Extract<(typeof executor.actions)[number], { type: "create_node" }>;
    expect(action.width).toBeGreaterThanOrEqual(280);
    expect(action.height).toBeGreaterThanOrEqual(168);
  });

  it("expands createDiagram into multiple node and edge actions", async () => {
    const executor = new ActionExecutor({
      canvasSnapshot: {
        roomId: "room-1",
        projectId: "project-1",
        nodes: [],
        edges: [],
        selectedNodeIds: [],
        viewport: { x: 0, y: 0, zoom: 1 },
      },
    });

    await executor.execute([
      {
        name: "createDiagram",
        arguments: {
          diagramType: "mindmap",
          summary: "Prepared a five-step routine mindmap.",
          nodes: [
            { key: "root", nodeType: "shape", label: "Skincare Routine" },
            { key: "cleanser", nodeType: "sticky_note", text: "Cleanser" },
            { key: "toner", nodeType: "sticky_note", text: "Toner" },
            { key: "vitc", nodeType: "sticky_note", text: "Vitamin C" },
          ],
          edges: [
            { sourceKey: "root", targetKey: "cleanser" },
            { sourceKey: "cleanser", targetKey: "toner" },
            { sourceKey: "toner", targetKey: "vitc" },
          ],
        },
      },
    ]);

    expect(executor.actions.filter((action) => action.type === "create_node")).toHaveLength(4);
    expect(executor.actions.filter((action) => action.type === "create_edge")).toHaveLength(3);
    expect(executor.messages).toContain("Prepared a five-step routine mindmap.");
  });

  it("can reuse an existing selected node as a diagram root", async () => {
    const executor = new ActionExecutor({
      canvasSnapshot: {
        roomId: "room-1",
        projectId: "project-1",
        nodes: [
          {
            id: "existing-root",
            type: "shape",
            position: { x: 500, y: 180 },
            data: {
              objectType: "shape",
              content: { label: "Skincare Routine" },
              style: { color: "oklch(0.8 0.1 40)" },
            },
          },
        ],
        edges: [],
        selectedNodeIds: ["existing-root"],
        viewport: { x: 0, y: 0, zoom: 1 },
      },
    });

    await executor.execute([
      {
        name: "createDiagram",
        arguments: {
          diagramType: "mindmap",
          rootKey: "root",
          nodes: [
            { key: "root", existingNodeId: "existing-root", nodeType: "shape" },
            { key: "cleanser", nodeType: "sticky_note", text: "Cleanser" },
            { key: "moisturizer", nodeType: "sticky_note", text: "Moisturizer" },
          ],
          edges: [
            { sourceKey: "root", targetKey: "cleanser" },
            { sourceKey: "root", targetKey: "moisturizer" },
          ],
        },
      },
    ]);

    expect(executor.actions.filter((action) => action.type === "create_node")).toHaveLength(2);
    expect(executor.actions.filter((action) => action.type === "create_edge")).toHaveLength(2);
    expect(
      executor.actions.find(
        (action): action is Extract<(typeof executor.actions)[number], { type: "create_edge" }> =>
          action.type === "create_edge",
      ),
    ).toMatchObject({
      source: "existing-root",
    });
  });

  it("creates update_node actions for explicit edits to existing nodes", async () => {
    const executor = new ActionExecutor({
      canvasSnapshot: {
        roomId: "room-1",
        projectId: "project-1",
        nodes: [
          {
            id: "node-1",
            type: "shape",
            position: { x: 120, y: 140 },
            width: 220,
            height: 112,
            data: {
              objectType: "shape",
              shapeKind: "rectangle",
              content: { label: "Process A" },
              style: { color: "oklch(0.72 0.16 240)", paintStyle: "solid", strokeWidth: 2 },
              zIndex: 0,
            },
          },
        ],
        edges: [],
        selectedNodeIds: ["node-1"],
        viewport: { x: 0, y: 0, zoom: 1 },
      },
    });

    await executor.execute([
      {
        name: "updateNode",
        arguments: {
          nodeId: "node-1",
          color: "oklch(0.86 0.18 95)",
          position: { x: 360, y: 180 },
          label: "Step 1",
        },
      },
    ]);

    expect(executor.actions).toHaveLength(1);
    expect(executor.actions[0]).toMatchObject({
      type: "update_node",
      nodeId: "node-1",
      before: {
        position: { x: 120, y: 140 },
        content: { label: "Process A" },
      },
      after: {
        position: { x: 360, y: 180 },
        content: { label: "Step 1" },
        style: { color: "oklch(0.86 0.18 95)" },
      },
    });
  });

  it("rearranges selected existing nodes even when nodeIds are omitted", async () => {
    const executor = new ActionExecutor({
      canvasSnapshot: {
        roomId: "room-1",
        projectId: "project-1",
        nodes: [
          {
            id: "root",
            type: "shape",
            position: { x: 200, y: 200 },
            width: 220,
            height: 112,
            data: {
              objectType: "shape",
              shapeKind: "ellipse",
              content: { label: "Root" },
              style: { color: "oklch(0.72 0.16 240)", paintStyle: "solid", strokeWidth: 2 },
              zIndex: 0,
            },
          },
          {
            id: "a",
            type: "shape",
            position: { x: 230, y: 220 },
            width: 220,
            height: 112,
            data: {
              objectType: "shape",
              shapeKind: "rectangle",
              content: { label: "A" },
              style: { color: "oklch(0.72 0.16 240)", paintStyle: "solid", strokeWidth: 2 },
              zIndex: 0,
            },
          },
          {
            id: "b",
            type: "shape",
            position: { x: 245, y: 235 },
            width: 220,
            height: 112,
            data: {
              objectType: "shape",
              shapeKind: "rectangle",
              content: { label: "B" },
              style: { color: "oklch(0.72 0.16 240)", paintStyle: "solid", strokeWidth: 2 },
              zIndex: 0,
            },
          },
        ],
        edges: [
          { id: "e1", source: "root", target: "a" },
          { id: "e2", source: "root", target: "b" },
        ],
        selectedNodeIds: ["root", "a", "b"],
        viewport: { x: 0, y: 0, zoom: 1 },
      },
    });

    await executor.execute([
      {
        name: "rearrangeNodes",
        arguments: {
          layout: "force",
        },
      },
    ]);

    const updates = executor.actions.filter(
      (action): action is Extract<(typeof executor.actions)[number], { type: "update_node" }> =>
        action.type === "update_node",
    );

    expect(updates.length).toBeGreaterThanOrEqual(2);
    expect(updates.some((action) => action.nodeId === "a")).toBe(true);
    expect(updates.some((action) => action.nodeId === "b")).toBe(true);
  });

  it("ignores unsupported tool calls", async () => {
    const executor = new ActionExecutor();

    await executor.execute([{ name: "deleteNode", arguments: { nodeId: "node-1" } }]);

    expect(executor.actions).toHaveLength(0);
    expect(executor.messages).toHaveLength(0);
  });

  it("keeps an action id for pending frontend approval", async () => {
    const executor = new ActionExecutor();

    await executor.execute([
      { name: "createNode", arguments: { nodeType: "shape", position: { x: 0, y: 0 } } },
    ]);

    expect(executor.actionId).toMatch(/^act-/);
  });
});
