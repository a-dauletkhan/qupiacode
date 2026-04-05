import { describe, it, expect } from "vitest";
import { loadPersonas } from "./persona-loader.js";
import { resolve } from "node:path";

describe("persona-loader", () => {
  it("loads all personas from YAML", () => {
    const { personas } = loadPersonas(resolve(import.meta.dirname, "personas.yaml"));
    expect(Object.keys(personas)).toEqual(["designer", "critique", "marketing"]);
  });

  it("parses persona fields correctly", () => {
    const { personas } = loadPersonas(resolve(import.meta.dirname, "personas.yaml"));
    const designer = personas.designer;

    expect(designer.name).toBe("Designer");
    expect(designer.color).toContain("oklch");
    expect(designer.triggers.mention).toBe("@designer");
    expect(designer.triggers.keywords).toContain("layout");
    expect(designer.tools).toContain("createNode");
    expect(designer.tools).toContain("sendMessage");
    expect(designer.system_prompt).toContain("Designer persona");
  });

  it("loads pipeline definitions", () => {
    const { pipelines } = loadPersonas(resolve(import.meta.dirname, "personas.yaml"));
    expect(Object.keys(pipelines)).toEqual(["campaign", "review"]);
    expect(pipelines.campaign.steps).toEqual(["designer", "critique", "marketing"]);
    expect(pipelines.campaign.triggers).toContain("campaign");
  });

  it("validates pipeline steps reference existing personas", () => {
    const { personas, pipelines } = loadPersonas(resolve(import.meta.dirname, "personas.yaml"));
    for (const pipeline of Object.values(pipelines)) {
      for (const step of pipeline.steps) {
        expect(personas[step]).toBeDefined();
      }
    }
  });
});
