import { config } from "../config.js";
import type {
  AgentAction,
  PersistedRoomEvent,
  RecordingSystemEventPayload,
  TranscriptIngestionPayload,
} from "../types.js";

type JsonObject = Record<string, unknown>;

function authHeaders(extra?: Record<string, string>): Record<string, string> {
  return {
    "Content-Type": "application/json",
    apikey: config.supabase.serviceRoleKey,
    Authorization: `Bearer ${config.supabase.serviceRoleKey}`,
    ...extra,
  };
}

function tableUrl(table: string, params?: Record<string, string>): string {
  const url = new URL(`/rest/v1/${table}`, config.supabase.url);
  Object.entries(params ?? {}).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });
  return url.toString();
}

async function expectOk(response: Response, action: string): Promise<void> {
  if (response.ok) {
    return;
  }

  const detail = await response.text().catch(() => "");
  throw new Error(`${action} failed (${response.status}): ${detail || response.statusText}`);
}

async function insertRow(table: string, row: JsonObject, prefer = "return=minimal"): Promise<void> {
  const response = await fetch(tableUrl(table), {
    method: "POST",
    headers: authHeaders({ Prefer: prefer }),
    body: JSON.stringify(row),
  });
  await expectOk(response, `insert ${table}`);
}

async function upsertRow(
  table: string,
  row: JsonObject,
  conflictColumns: string[],
  prefer = "resolution=merge-duplicates,return=minimal",
): Promise<void> {
  const response = await fetch(
    tableUrl(table, {
      on_conflict: conflictColumns.join(","),
    }),
    {
      method: "POST",
      headers: authHeaders({ Prefer: prefer }),
      body: JSON.stringify(row),
    },
  );
  await expectOk(response, `upsert ${table}`);
}

async function patchRows(
  table: string,
  row: JsonObject,
  filters: Record<string, string>,
  prefer = "return=minimal",
): Promise<void> {
  const response = await fetch(tableUrl(table, filters), {
    method: "PATCH",
    headers: authHeaders({ Prefer: prefer }),
    body: JSON.stringify(row),
  });
  await expectOk(response, `patch ${table}`);
}

export class SupabaseRoomStore {
  async touchRoomSession(roomId: string, metadata: JsonObject = {}): Promise<void> {
    await upsertRow("room_sessions", {
      room_id: roomId,
      status: "active",
      last_activity_at: new Date().toISOString(),
      metadata,
    }, ["room_id"]);
  }

  async endRoomSession(roomId: string): Promise<void> {
    await patchRows(
      "room_sessions",
      {
        status: "ended",
        ended_at: new Date().toISOString(),
        last_activity_at: new Date().toISOString(),
      },
      {
        room_id: `eq.${roomId}`,
      },
    );
  }

  async appendRoomEvent(event: PersistedRoomEvent): Promise<void> {
    await insertRow("room_events", {
      room_id: event.roomId,
      event_type: event.eventType,
      source: event.source,
      actor_type: event.actorType,
      actor_id: event.actorId,
      occurred_at: event.occurredAt,
      payload: event.payload,
    });
  }

  async storeTranscript(event: TranscriptIngestionPayload): Promise<void> {
    await insertRow("transcript_utterances", {
      utterance_id: event.utterance_id,
      room_id: event.room_id,
      segment_id: event.segment_id,
      participant_identity: event.participant_identity,
      speaker_id: event.speaker_id,
      speaker_name: event.speaker_name,
      text: event.text,
      start_time_ms: event.start_time_ms,
      end_time_ms: event.end_time_ms,
      occurred_at: event.occurred_at,
      source: event.source,
    }, "resolution=ignore-duplicates,return=minimal");
  }

  async upsertAction(action: AgentAction & { roomId: string; requestedBy: string | null; summary?: string }): Promise<void> {
    await upsertRow("ai_actions", {
      action_id: action.actionId,
      room_id: action.roomId,
      command_id: action.commandId,
      requested_by: action.requestedBy,
      type: action.type,
      node_ids: action.nodeIds,
      edge_ids: action.edgeIds,
      status: action.status,
      summary: action.summary ?? null,
      updated_at: new Date(action.createdAt).toISOString(),
    }, ["action_id"]);
  }

  async updateActionStatus(roomId: string, actionId: string, status: "approved" | "rejected"): Promise<void> {
    await patchRows(
      "ai_actions",
      {
        status,
        updated_at: new Date().toISOString(),
      },
      {
        room_id: `eq.${roomId}`,
        action_id: `eq.${actionId}`,
      },
    );
  }

  async insertActionFeedback(
    roomId: string,
    actionId: string,
    userId: string,
    status: "approved" | "rejected",
    reason?: string,
  ): Promise<void> {
    await insertRow("ai_action_feedback", {
      room_id: roomId,
      action_id: actionId,
      user_id: userId,
      status,
      reason: reason ?? null,
    });
  }

  async upsertRecording(event: RecordingSystemEventPayload): Promise<void> {
    const timestampField =
      event.event_type === "recording.started"
        ? { started_at: event.occurred_at, ended_at: null }
        : { ended_at: event.occurred_at };

    await upsertRow("room_recordings", {
      recording_id: event.recording_id,
      room_id: event.room_id,
      room_name: event.room_name,
      egress_id: event.egress_id,
      status: event.status,
      storage_provider: event.storage_provider,
      storage_bucket: event.storage_bucket,
      object_path: event.object_path,
      playback_url: event.playback_url,
      metadata: event.metadata,
      updated_at: new Date().toISOString(),
      ...timestampField,
    }, ["recording_id"]);
  }
}
