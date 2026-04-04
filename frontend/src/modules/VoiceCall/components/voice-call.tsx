import * as React from "react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  CallAgentCard,
  CallUserCard,
} from "@/modules/VoiceCall/components/call-user-card"
import { VoiceCallControlPanel } from "@/modules/VoiceCall/components/voice-call-control-panel"
import { useVoiceCall } from "@/modules/VoiceCall/hooks/use-voice-call"

type VoiceCallProps = React.ComponentProps<"section"> & {
  canvasId?: string
  userId?: string
  displayName?: string
  apiBaseUrl?: string
}

export function VoiceCall({
  className,
  canvasId,
  userId,
  displayName,
  apiBaseUrl = import.meta.env.VITE_VOICE_API_BASE_URL,
  ...props
}: VoiceCallProps) {
  const {
    agent,
    audioContainerRef,
    enableSpeakerAudio,
    errorMessage,
    inCall,
    isJoining,
    isMicrophoneEnabled,
    joinCall,
    leaveCall,
    microphoneAvailable,
    needsAudioResume,
    participantIdentity,
    participants,
    resolvedCanvasId,
    resolvedUserId,
    roomName,
    setAgentVolume,
    setParticipantVolumeByIdentity,
    statusMessage,
    toggleMicrophone,
  } = useVoiceCall({
    canvasId,
    userId,
    displayName,
    apiBaseUrl,
  })

  return (
    <section
      className={cn(
        "flex h-full w-full flex-col justify-between bg-sidebar p-2",
        className
      )}
      {...props}
    >
      <div className="relative flex min-h-0 flex-1 flex-col overflow-y-auto pb-18">
        <CallAgentCard
          className="mb-3"
          name={agent.name}
          status={agent.status}
          volume={agent.volume}
          volumeDisabled={agent.volumeDisabled}
          onVolumeChange={setAgentVolume}
        />

        <div className="mb-3 border border-sidebar-border bg-sidebar p-2 text-xs">
          <p className="font-semibold text-foreground">
            {roomName || `Canvas ${resolvedCanvasId}`}
          </p>
          <p className="mt-1 text-muted-foreground">
            {participantIdentity || `User ${resolvedUserId}`}
          </p>
          <p className="mt-2 text-muted-foreground">{statusMessage}</p>
          {errorMessage ? (
            <p className="mt-2 text-destructive">{errorMessage}</p>
          ) : null}
          {needsAudioResume ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={enableSpeakerAudio}
            >
              Enable speaker audio
            </Button>
          ) : null}
        </div>

        {participants.length > 0 ? (
          participants.map((participant, index) => (
            <CallUserCard
              key={participant.id}
              name={
                participant.isLocal
                  ? `${participant.name} (You)`
                  : participant.name
              }
              status={participant.status}
              isMuted={participant.isMuted}
              isSpeaking={participant.isSpeaking}
              volume={participant.volume}
              volumeDisabled={participant.volumeDisabled}
              onVolumeChange={(nextVolume) =>
                setParticipantVolumeByIdentity(participant.id, nextVolume)
              }
              className={index === 0 ? "border-t" : ""}
            />
          ))
        ) : (
          <div className="border border-sidebar-border bg-sidebar px-2 py-3 text-center text-sm text-muted-foreground">
            Join the call to see participants.
          </div>
        )}

        <VoiceCallControlPanel
          className="absolute bottom-0 left-1/2 -translate-x-1/2"
          inCall={inCall}
          isWorking={isJoining}
          microphoneEnabled={isMicrophoneEnabled}
          microphoneAvailable={microphoneAvailable}
          needsAudioResume={needsAudioResume}
          onJoinCall={() => {
            void joinCall()
          }}
          onToggleMicrophone={() => {
            void toggleMicrophone()
          }}
          onResumeAudio={() => {
            void enableSpeakerAudio()
          }}
          onEndCall={() => {
            void leaveCall()
          }}
        />
      </div>

      <div ref={audioContainerRef} className="hidden" aria-hidden="true" />
    </section>
  )
}
