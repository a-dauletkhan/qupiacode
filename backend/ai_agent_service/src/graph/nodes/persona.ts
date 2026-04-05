import type { AgentStateType, PendingAction } from "../state.js";
import type { PersonasFile } from "../../persona-loader.js";
import type { LLMProvider, Message, Tool } from "../../llm/types.js";
import { canvasTools } from "../../tools/canvas-tools.js";
import { randomUUID } from "node:crypto";

export function createPersonaNode(personasFile: PersonasFile, llm: LLMProvider) {
  const { personas } = personasFile;

  return async (state: AgentStateType): Promise<Partial<AgentStateType>> => {
    const personaId = state.targetPersona;
    if (!personaId || !personas[personaId]) {
      return { error: `Unknown persona: ${personaId}`, done: true };
    }

    const persona = personas[personaId];
    const actionId = `act-${randomUUID().slice(0, 8)}`;

    // Filter tools to persona's allowed list
    const allowedTools: Tool[] = canvasTools.filter((t) => persona.tools.includes(t.name));

    // Build context — readable format so LLM can identify nodes by name
    const contextParts: string[] = [];
    const { nodes, edges } = state.canvasSnapshot;
    const selectedIds = new Set(state.command?.selectedNodeIds ?? []);

    if (nodes.length > 0 || edges.length > 0) {
      const nodeDesc = nodes.map((n) => {
        const data = n.data as Record<string, unknown>;
        const content = data.content as Record<string, unknown> | undefined;
        const label = (content?.label as string) ?? (content?.text as string) ?? "";
        const selected = selectedIds.has(n.id) ? " [SELECTED]" : "";
        return `  - id="${n.id}" type=${n.type} label="${label}" pos=(${n.position.x},${n.position.y})${selected}`;
      });
      const edgeDesc = edges.map((e) => `  - id="${e.id}": "${e.source}" -> "${e.target}"${e.label ? ` label="${e.label}"` : ""}`);
      contextParts.push(`## Canvas State\nNodes (${nodes.length}):\n${nodeDesc.join("\n")}\n\nEdges (${edges.length}):\n${edgeDesc.join("\n") || "  (none)"}`);
    } else {
      contextParts.push("## Canvas State\nThe canvas is empty.");
    }

    if (state.transcript.length > 0) {
      const lines = state.transcript.map((t) => `  [${t.speakerName}]: ${t.text}`);
      contextParts.push(`## Recent Conversation\n${lines.join("\n")}`);
    }

    if (state.userEvents.length > 0) {
      const lines = state.userEvents.slice(-10).map((e) => `  - ${e.type} ${JSON.stringify(e.data)}`);
      contextParts.push(`## Recent User Activity\n${lines.join("\n")}`);
    }

    const context = contextParts.join("\n\n");
    const rawCommandText = state.command?.message ?? "Analyze the canvas and help where appropriate.";
    const commandUser = state.command?.userName ?? "System";

    // When nodes are selected (from canvas "Ask AI"), make it explicit
    let commandText = rawCommandText;
    if (selectedIds.size > 0) {
      const selectedNodes = nodes.filter((n) => selectedIds.has(n.id));
      const selectedDesc = selectedNodes.map((n) => {
        const data = n.data as Record<string, unknown>;
        const content = data.content as Record<string, unknown> | undefined;
        const label = (content?.label as string) ?? (content?.text as string) ?? "";
        return `"${label}" (id="${n.id}", type=${n.type})`;
      }).join(", ");
      commandText = `The user selected these nodes: ${selectedDesc}. Their request: "${rawCommandText}". Apply the action directly to the selected node(s) using their IDs.`;
    }

    const messages: Message[] = [
      { role: "system", content: persona.system_prompt },
      { role: "user", content: `${commandUser} asked: "${commandText}"\n\nHere is the current context:\n\n${context}` },
    ];

    try {
      const response = await llm.chat(messages, allowedTools);
      console.info(`[${personaId}] LLM response:`, {
        text: response.text?.slice(0, 200),
        toolCalls: response.toolCalls.map((tc) => `${tc.name}(${JSON.stringify(tc.arguments).slice(0, 100)})`),
      });

      const action: PendingAction = {
        persona: personaId,
        personaColor: persona.color,
        actionId,
        toolCalls: response.toolCalls,
        chatMessage: response.text,
      };
      return { pendingActions: [action] };
    } catch (err) {
      console.error(`Persona ${personaId} LLM call failed:`, err);
      return { error: `${persona.name} failed to respond`, done: true };
    }
  };
}
