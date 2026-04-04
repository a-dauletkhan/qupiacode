declare global {
  interface Liveblocks {
    Presence: {
      cursor: { x: number; y: number } | null;
      type?: "user" | "ai_agent";
      status?: "watching" | "acting";
      intensity?: "quiet" | "balanced" | "active";
    };

    Storage: {
      agentIntensity: "quiet" | "balanced" | "active";
    };

    UserMeta: {
      id: string;
      info: {
        name: string;
      };
    };

    RoomEvent: Record<string, never>;

    ThreadMetadata: Record<string, never>;

    RoomInfo: Record<string, never>;
  }
}

export {};
