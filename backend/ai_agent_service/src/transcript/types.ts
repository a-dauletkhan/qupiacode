export interface TranscriptEvent {
  room_id: string;
  speaker_id: string;
  speaker_name: string;
  text: string;
  timestamp: number;
  is_final: boolean;
}

export interface TranscriptSource {
  subscribe(roomId: string, handler: (event: TranscriptEvent) => void): void;
  unsubscribe(roomId: string): void;
}
