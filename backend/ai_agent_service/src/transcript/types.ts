export interface TranscriptEvent {
  room_id: string;
  utterance_id: string;
  segment_id: string;
  participant_identity: string | null;
  speaker_id: string | null;
  speaker_name: string;
  text: string;
  occurred_at: string;
  start_time_ms: number | null;
  end_time_ms: number | null;
  is_final: boolean;
  source: "livekit";
}

export interface TranscriptSource {
  subscribe(roomId: string, handler: (event: TranscriptEvent) => void): void;
  unsubscribe(roomId: string): void;
}
