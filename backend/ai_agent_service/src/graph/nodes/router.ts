import type { AgentStateType } from "../state.js";
import type { PersonasFile } from "../../persona-loader.js";

export function createRouterNode(personasFile: PersonasFile) {
  const { personas, pipelines } = personasFile;

  return (state: AgentStateType): Partial<AgentStateType> => {
    const message = state.command?.message?.toLowerCase() ?? "";
    const targetFromCommand = state.command?.targetPersona;

    console.info(`[router] message: "${message}", targetFromCommand: ${targetFromCommand}`);

    // Priority 1: Direct persona from command
    if (targetFromCommand && personas[targetFromCommand]) {
      console.info(`[router] → direct: ${targetFromCommand}`);
      return { mode: "direct", targetPersona: targetFromCommand, pipelineSteps: [], currentStep: 0 };
    }

    // Priority 2: @mention in message
    for (const [id, persona] of Object.entries(personas)) {
      if (message.includes(persona.triggers.mention)) {
        return { mode: "direct", targetPersona: id, pipelineSteps: [], currentStep: 0 };
      }
    }

    // Priority 3: Pipeline triggers
    for (const [, pipeline] of Object.entries(pipelines)) {
      for (const trigger of pipeline.triggers) {
        if (message.includes(trigger.toLowerCase())) {
          return { mode: "pipeline", targetPersona: pipeline.steps[0], pipelineSteps: pipeline.steps, currentStep: 0 };
        }
      }
    }

    // Priority 4: Action verbs always go to Designer (modify/delete/move/add/connect/remove)
    const actionVerbs = ["remove", "delete", "move", "add", "connect", "disconnect", "rearrange", "group", "rename", "resize", "place", "put"];
    if (actionVerbs.some((verb) => message.includes(verb))) {
      return { mode: "auto", targetPersona: "designer", pipelineSteps: [], currentStep: 0 };
    }

    // Priority 5: Auto-detect by keyword
    let bestPersona: string | null = null;
    let bestScore = 0;
    for (const [id, persona] of Object.entries(personas)) {
      const score = persona.triggers.keywords.filter((kw) => message.includes(kw.toLowerCase())).length;
      if (score > bestScore) { bestScore = score; bestPersona = id; }
    }

    return { mode: "auto", targetPersona: bestPersona ?? "designer", pipelineSteps: [], currentStep: 0 };
  };
}
