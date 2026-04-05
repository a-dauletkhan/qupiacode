import { readFileSync } from "node:fs";
import { parse as parseYaml } from "yaml";

export interface PersonaTriggers {
  keywords: string[];
  mention: string;
}

export interface PersonaConfig {
  name: string;
  description: string;
  icon: string;
  color: string;
  triggers: PersonaTriggers;
  tools: string[];
  system_prompt: string;
}

export interface PipelineConfig {
  triggers: string[];
  steps: string[];
}

export interface PersonasFile {
  personas: Record<string, PersonaConfig>;
  pipelines: Record<string, PipelineConfig>;
}

export function loadPersonas(filePath: string): PersonasFile {
  const raw = readFileSync(filePath, "utf-8");
  const parsed = parseYaml(raw) as PersonasFile;

  if (!parsed.personas || Object.keys(parsed.personas).length === 0) {
    throw new Error("personas.yaml must define at least one persona");
  }

  if (!parsed.pipelines) {
    parsed.pipelines = {};
  }

  for (const [name, pipeline] of Object.entries(parsed.pipelines)) {
    for (const step of pipeline.steps) {
      if (!parsed.personas[step]) {
        throw new Error(`Pipeline "${name}" references unknown persona "${step}"`);
      }
    }
  }

  return parsed;
}
