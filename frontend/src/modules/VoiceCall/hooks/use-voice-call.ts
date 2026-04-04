import * as React from "react"
import {
  ConnectionState,
  Room,
  RoomEvent,
  Track,
  type ChatMessage as LiveKitChatMessage,
  type Participant,
  type RemoteAudioTrack,
  type TrackPublication,
  type TranscriptionSegment,
} from "livekit-client"

import { requestVoiceToken } from "@/modules/VoiceCall/services/voice-call-service"

const DEFAULT_CANVAS_ID = "demo-canvas"
const DEFAULT_AGENT_NAME = "AI Agent"
const DEFAULT_AGENT_VOLUME = 100
const DEFAULT_REMOTE_VOLUME = 100

type MessageType = "user" | "person" | "agent"
type TranscriptAttributionSource = "participant" | "diarization" | "ambiguous"

type VoiceBootstrap = {
  canvasId: string
  userId: string
  displayName: string
}

type AttachedAudioTrack = {
  element: HTMLMediaElement
  track: RemoteAudioTrack
}

export type VoiceCallParticipantView = {
  id: string
  name: string
  status: string
  isMuted: boolean
  isSpeaking: boolean
  isLocal: boolean
  volume: number
  volumeDisabled: boolean
}

export type VoiceCallAgentView = {
  name: string
  status: string
  volume: number
  volumeDisabled: boolean
}

export type VoiceCallAgentMetadata = {
  enabled: boolean
  name: string
  wakePhrases: string[]
  transcriptionMode: "livekit_inference" | "mock"
  transcriptForwardingEnabled: boolean
  transcriptPartialsEnabled: boolean
  diarizationEnabled: boolean
}

export type VoiceCallTranscriptItem = {
  id: string
  segmentId: string
  participantIdentity: string | null
  participantName: string
  trackId: string | null
  text: string
  isFinal: boolean
  speakerId?: string
  attributionSource: TranscriptAttributionSource
  timestamp: number
  updatedAt: number
}

export type VoiceCallChatMessageView = {
  id: string
  type: MessageType
  author: string
  time: string
  text: string
  timestamp: number
  source: "transcript" | "chat"
  pending?: boolean
}

export type UseVoiceCallOptions = {
  canvasId?: string
  userId?: string
  displayName?: string
  apiBaseUrl?: string
}

function buildFallbackUserId() {
  return `user-${Math.random().toString(36).slice(2, 10)}`
}

function buildDefaultUserId() {
  if (
    typeof window !== "undefined" &&
    window.crypto &&
    typeof window.crypto.randomUUID === "function"
  ) {
    return `user-${window.crypto.randomUUID().slice(0, 8)}`
  }

  return buildFallbackUserId()
}

function resolveBootstrap(): VoiceBootstrap {
  const params = new URLSearchParams(window.location.search)
  const canvasId = params.get("canvas_id")?.trim() || DEFAULT_CANVAS_ID
  const userId = params.get("user_id")?.trim() || buildDefaultUserId()
  const displayName =
    params.get("display_name")?.trim() || `Guest ${userId.slice(-4)}`

  return { canvasId, userId, displayName }
}

function formatParticipantStatus(
  participant: Participant,
  options: {
    isLocal: boolean
    listenOnly: boolean
  }
) {
  if (participant.isSpeaking) {
    return "Speaking"
  }

  if (options.isLocal && options.listenOnly) {
    return "Listen only"
  }

  if (!participant.isMicrophoneEnabled) {
    return "Muted"
  }

  if (!participant.isActive) {
    return "Connecting"
  }

  return "Connected"
}

function formatAgentStatus(participant: Participant) {
  const agentState = participant.attributes?.["lk.agent.state"]
  if (agentState === "initializing") {
    return "Initializing"
  }
  if (agentState === "idle") {
    return "Ready"
  }
  if (agentState === "listening") {
    return "Listening"
  }
  if (agentState === "thinking") {
    return "Thinking"
  }
  if (agentState === "speaking") {
    return "Speaking"
  }

  if (participant.isSpeaking) {
    return "Speaking"
  }

  if (!participant.isActive) {
    return "Connecting"
  }

  return "Connected"
}

function buildDefaultAgentMetadata(): VoiceCallAgentMetadata {
  return {
    enabled: false,
    name: DEFAULT_AGENT_NAME,
    wakePhrases: [],
    transcriptionMode: "mock",
    transcriptForwardingEnabled: false,
    transcriptPartialsEnabled: true,
    diarizationEnabled: false,
  }
}

function buildParticipantViews(
  room: Room,
  participantVolumes: Record<string, number>,
  listenOnly: boolean,
  agentMetadata: VoiceCallAgentMetadata
): {
  agent: VoiceCallAgentView
  users: VoiceCallParticipantView[]
} {
  const localParticipant = room.localParticipant
  const users: VoiceCallParticipantView[] = [
    {
      id: localParticipant.identity,
      name: localParticipant.name || localParticipant.identity,
      status: formatParticipantStatus(localParticipant, {
        isLocal: true,
        listenOnly,
      }),
      isMuted: !localParticipant.isMicrophoneEnabled,
      isSpeaking: localParticipant.isSpeaking,
      isLocal: true,
      volume: DEFAULT_REMOTE_VOLUME,
      volumeDisabled: true,
    },
  ]

  let agent: VoiceCallAgentView = {
    name: agentMetadata.name,
    status: agentMetadata.enabled
      ? room.state === ConnectionState.Connected
        ? "Awaiting worker"
        : "Offline"
      : "Disabled",
    volume: DEFAULT_AGENT_VOLUME,
    volumeDisabled: true,
  }

  for (const participant of room.remoteParticipants.values()) {
    const participantVolume =
      participantVolumes[participant.identity] ?? DEFAULT_REMOTE_VOLUME
    const view = {
      id: participant.identity,
      name: participant.name || participant.identity,
      status: formatParticipantStatus(participant, {
        isLocal: false,
        listenOnly: false,
      }),
      isMuted: !participant.isMicrophoneEnabled,
      isSpeaking: participant.isSpeaking,
      isLocal: false,
      volume: participantVolume,
      volumeDisabled: false,
    } satisfies VoiceCallParticipantView

    if (participant.isAgent) {
      agent = {
        name: participant.name || agentMetadata.name,
        status: formatAgentStatus(participant),
        volume: view.volume,
        volumeDisabled: false,
      }
      continue
    }

    users.push(view)
  }

  users.sort((left, right) => {
    if (left.isLocal !== right.isLocal) {
      return left.isLocal ? -1 : 1
    }

    if (left.isSpeaking !== right.isSpeaking) {
      return left.isSpeaking ? -1 : 1
    }

    return left.name.localeCompare(right.name)
  })

  return { agent, users }
}

function canUseMicrophone() {
  return Boolean(window.navigator.mediaDevices?.getUserMedia)
}

function formatVoiceError(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message
  }

  return "Voice call failed."
}

function getMicrophoneUnavailableMessage() {
  return `Microphone unavailable. Open this app on localhost or HTTPS and allow microphone access. origin=${window.location.origin} secureContext=${window.isSecureContext}`
}

function getAgentParticipant(activeRoom: Room | null) {
  if (!activeRoom) {
    return null
  }

  for (const participant of activeRoom.remoteParticipants.values()) {
    if (participant.isAgent) {
      return participant
    }
  }

  return null
}

function resolveMessageType(participant?: Participant): MessageType {
  if (participant?.isAgent) {
    return "agent"
  }

  if (participant?.isLocal) {
    return "user"
  }

  return "person"
}

function resolveParticipantName(participant?: Participant) {
  if (!participant) {
    return "Unknown participant"
  }

  return (
    participant.name?.trim() || participant.identity || "Unknown participant"
  )
}

function formatMessageTime(timestamp: number) {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  })
}

function buildTranscriptEntryId(
  participantIdentity: string | null,
  trackId: string | null,
  segmentId: string
) {
  return `${participantIdentity ?? "unknown"}:${trackId ?? "unknown"}:${segmentId}`
}

function upsertTranscriptItems(
  currentItems: VoiceCallTranscriptItem[],
  segments: TranscriptionSegment[],
  participant?: Participant,
  publication?: TrackPublication,
  includePartials = true
) {
  if (!includePartials) {
    segments = segments.filter((segment) => segment.final)
  }
  if (segments.length === 0) {
    return currentItems
  }

  const nextItems = [...currentItems]
  const participantIdentity = participant?.identity ?? null
  const participantName = resolveParticipantName(participant)
  const trackId = publication?.trackSid ?? null
  const attributionSource: TranscriptAttributionSource = participantIdentity
    ? "participant"
    : "ambiguous"

  for (const segment of segments) {
    const itemId = buildTranscriptEntryId(
      participantIdentity,
      trackId,
      segment.id
    )
    const item: VoiceCallTranscriptItem = {
      id: itemId,
      segmentId: segment.id,
      participantIdentity,
      participantName,
      trackId,
      text: segment.text,
      isFinal: segment.final,
      attributionSource,
      timestamp: segment.firstReceivedTime || Date.now(),
      updatedAt: segment.lastReceivedTime || Date.now(),
    }

    const existingIndex = nextItems.findIndex(
      (currentItem) => currentItem.id === itemId
    )
    if (existingIndex === -1) {
      nextItems.push(item)
      continue
    }

    nextItems[existingIndex] = {
      ...nextItems[existingIndex],
      ...item,
    }
  }

  nextItems.sort((left, right) => {
    if (left.timestamp !== right.timestamp) {
      return left.timestamp - right.timestamp
    }
    return left.id.localeCompare(right.id)
  })

  return nextItems
}

function upsertChatFeedMessage(
  currentMessages: VoiceCallChatMessageView[],
  message: VoiceCallChatMessageView
) {
  const nextMessages = [...currentMessages]
  const existingIndex = nextMessages.findIndex(
    (currentMessage) => currentMessage.id === message.id
  )

  if (existingIndex === -1) {
    nextMessages.push(message)
  } else {
    nextMessages[existingIndex] = message
  }

  nextMessages.sort((left, right) => {
    if (left.timestamp !== right.timestamp) {
      return left.timestamp - right.timestamp
    }
    return left.id.localeCompare(right.id)
  })

  return nextMessages
}

export function useVoiceCall({
  canvasId,
  userId,
  displayName,
  apiBaseUrl,
}: UseVoiceCallOptions) {
  const bootstrap = React.useMemo(() => resolveBootstrap(), [])
  const resolvedCanvasId = canvasId ?? bootstrap.canvasId
  const resolvedUserId = userId ?? bootstrap.userId
  const resolvedDisplayName = displayName ?? bootstrap.displayName

  const audioContainerRef = React.useRef<HTMLDivElement | null>(null)
  const roomRef = React.useRef<Room | null>(null)
  const attachedAudioTracksRef = React.useRef<Map<string, AttachedAudioTrack>>(
    new Map()
  )
  const participantVolumesRef = React.useRef<Record<string, number>>({})
  const isLeavingRef = React.useRef(false)
  const agentMetadataRef = React.useRef<VoiceCallAgentMetadata>(
    buildDefaultAgentMetadata()
  )

  const [participants, setParticipants] = React.useState<
    VoiceCallParticipantView[]
  >([])
  const [agent, setAgent] = React.useState<VoiceCallAgentView>({
    name: DEFAULT_AGENT_NAME,
    status: "Offline",
    volume: DEFAULT_AGENT_VOLUME,
    volumeDisabled: true,
  })
  const [agentMetadata, setAgentMetadata] =
    React.useState<VoiceCallAgentMetadata>(buildDefaultAgentMetadata())
  const [transcripts, setTranscripts] = React.useState<
    VoiceCallTranscriptItem[]
  >([])
  const [chatMessages, setChatMessages] = React.useState<
    VoiceCallChatMessageView[]
  >([])
  const [connectionState, setConnectionState] = React.useState(
    ConnectionState.Disconnected
  )
  const [isJoining, setIsJoining] = React.useState(false)
  const [isMicrophoneEnabled, setIsMicrophoneEnabled] = React.useState(false)
  const [microphoneAvailable, setMicrophoneAvailable] = React.useState(true)
  const [needsAudioResume, setNeedsAudioResume] = React.useState(false)
  const [roomName, setRoomName] = React.useState<string | null>(null)
  const [participantIdentity, setParticipantIdentity] = React.useState<
    string | null
  >(null)
  const [statusMessage, setStatusMessage] = React.useState(
    `Ready for canvas ${resolvedCanvasId}`
  )
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)

  const syncParticipants = React.useCallback(
    (activeRoom: Room | null) => {
      if (!activeRoom) {
        React.startTransition(() => {
          setParticipants([])
          setAgent({
            name: agentMetadataRef.current.name,
            status: agentMetadataRef.current.enabled ? "Offline" : "Disabled",
            volume: DEFAULT_AGENT_VOLUME,
            volumeDisabled: true,
          })
        })
        return
      }

      const nextViews = buildParticipantViews(
        activeRoom,
        participantVolumesRef.current,
        !microphoneAvailable,
        agentMetadataRef.current
      )

      React.startTransition(() => {
        setParticipants(nextViews.users)
        setAgent(nextViews.agent)
      })
      setIsMicrophoneEnabled(activeRoom.localParticipant.isMicrophoneEnabled)
    },
    [microphoneAvailable]
  )

  const detachAllAudioTracks = React.useCallback(() => {
    for (const { element, track } of attachedAudioTracksRef.current.values()) {
      track.detach(element)
      element.remove()
    }

    attachedAudioTracksRef.current.clear()
  }, [])

  const detachRemoteAudioTrack = React.useCallback(
    (participantIdentity: string, trackSid: string) => {
      const trackKey = `${participantIdentity}:${trackSid}`
      const attachedTrack = attachedAudioTracksRef.current.get(trackKey)
      if (!attachedTrack) {
        return
      }

      attachedTrack.track.detach(attachedTrack.element)
      attachedTrack.element.remove()
      attachedAudioTracksRef.current.delete(trackKey)
    },
    []
  )

  const attachRemoteAudioTrack = React.useCallback(
    (participantIdentity: string, track: RemoteAudioTrack) => {
      const trackKey = `${participantIdentity}:${track.sid}`
      if (attachedAudioTracksRef.current.has(trackKey)) {
        return
      }

      const element = track.attach()
      element.autoplay = true
      element.dataset.voiceTrackKey = trackKey
      audioContainerRef.current?.appendChild(element)

      attachedAudioTracksRef.current.set(trackKey, {
        element,
        track,
      })
    },
    []
  )

  const attachExistingRemoteAudioTracks = React.useCallback(
    (activeRoom: Room) => {
      for (const participant of activeRoom.remoteParticipants.values()) {
        const publication = participant.getTrackPublication(
          Track.Source.Microphone
        )
        if (publication?.track?.kind === Track.Kind.Audio) {
          attachRemoteAudioTrack(
            participant.identity,
            publication.track as RemoteAudioTrack
          )
        }
      }
    },
    [attachRemoteAudioTrack]
  )

  const resetVoiceState = React.useCallback(() => {
    detachAllAudioTracks()
    roomRef.current = null
    agentMetadataRef.current = buildDefaultAgentMetadata()
    setConnectionState(ConnectionState.Disconnected)
    setParticipants([])
    setAgent({
      name: DEFAULT_AGENT_NAME,
      status: "Offline",
      volume: DEFAULT_AGENT_VOLUME,
      volumeDisabled: true,
    })
    setAgentMetadata(buildDefaultAgentMetadata())
    setTranscripts([])
    setChatMessages([])
    setIsMicrophoneEnabled(false)
    setNeedsAudioResume(false)
    setRoomName(null)
    setParticipantIdentity(null)
    setStatusMessage(`Ready for canvas ${resolvedCanvasId}`)
  }, [detachAllAudioTracks, resolvedCanvasId])

  const leaveCall = React.useCallback(async () => {
    const activeRoom = roomRef.current
    if (!activeRoom) {
      return
    }

    isLeavingRef.current = true
    try {
      await activeRoom.disconnect()
    } finally {
      isLeavingRef.current = false
      resetVoiceState()
    }
  }, [resetVoiceState])

  const setParticipantVolumeByIdentity = React.useCallback(
    (participantIdentity: string, nextVolume: number) => {
      const activeRoom = roomRef.current
      const participant =
        activeRoom?.remoteParticipants.get(participantIdentity)
      if (!participant) {
        return
      }

      participantVolumesRef.current[participantIdentity] = nextVolume
      participant.setVolume(nextVolume / 100, Track.Source.Microphone)
      syncParticipants(activeRoom)
    },
    [syncParticipants]
  )

  const setAgentVolume = React.useCallback(
    (nextVolume: number) => {
      const activeRoom = roomRef.current
      const participant = getAgentParticipant(activeRoom)
      if (!participant) {
        return
      }

      participantVolumesRef.current[participant.identity] = nextVolume
      participant.setVolume(nextVolume / 100, Track.Source.Microphone)
      syncParticipants(activeRoom)
    },
    [syncParticipants]
  )

  const enableSpeakerAudio = React.useCallback(async () => {
    const activeRoom = roomRef.current
    if (!activeRoom || typeof activeRoom.startAudio !== "function") {
      return
    }

    try {
      await activeRoom.startAudio()
      setNeedsAudioResume(!activeRoom.canPlaybackAudio)
    } catch (error) {
      setErrorMessage(formatVoiceError(error))
    }
  }, [])

  const toggleMicrophone = React.useCallback(async () => {
    const activeRoom = roomRef.current
    if (!activeRoom) {
      return
    }

    if (!canUseMicrophone()) {
      setMicrophoneAvailable(false)
      setErrorMessage(getMicrophoneUnavailableMessage())
      return
    }

    try {
      const nextState = !activeRoom.localParticipant.isMicrophoneEnabled
      await activeRoom.localParticipant.setMicrophoneEnabled(nextState)
      setMicrophoneAvailable(true)
      setErrorMessage(null)
      setStatusMessage(nextState ? "Microphone enabled" : "Microphone muted")
      setIsMicrophoneEnabled(nextState)
      syncParticipants(activeRoom)
    } catch (error) {
      setErrorMessage(formatVoiceError(error))
    }
  }, [syncParticipants])

  const joinCall = React.useCallback(async () => {
    if (roomRef.current || isJoining) {
      return
    }

    setIsJoining(true)
    setErrorMessage(null)
    setStatusMessage(`Requesting token for canvas ${resolvedCanvasId}`)

    const activeRoom = new Room({
      adaptiveStream: true,
      dynacast: true,
    })
    roomRef.current = activeRoom

    activeRoom.on(RoomEvent.ConnectionStateChanged, (nextState) => {
      setConnectionState(nextState)
      if (nextState === ConnectionState.Connected) {
        setStatusMessage(`Connected to ${activeRoom.name}`)
      }
      if (nextState === ConnectionState.Disconnected && !isLeavingRef.current) {
        resetVoiceState()
      }
    })
    activeRoom.on(RoomEvent.ParticipantConnected, () => {
      syncParticipants(activeRoom)
    })
    activeRoom.on(RoomEvent.ParticipantDisconnected, () => {
      syncParticipants(activeRoom)
    })
    activeRoom.on(RoomEvent.ParticipantAttributesChanged, () => {
      syncParticipants(activeRoom)
    })
    activeRoom.on(RoomEvent.ActiveSpeakersChanged, () => {
      syncParticipants(activeRoom)
    })
    activeRoom.on(RoomEvent.TrackMuted, () => {
      syncParticipants(activeRoom)
    })
    activeRoom.on(RoomEvent.TrackUnmuted, () => {
      syncParticipants(activeRoom)
    })
    activeRoom.on(
      RoomEvent.TrackSubscribed,
      (track, _publication, participant) => {
        if (track.kind === Track.Kind.Audio && participant.identity) {
          attachRemoteAudioTrack(
            participant.identity,
            track as RemoteAudioTrack
          )
        }
        syncParticipants(activeRoom)
      }
    )
    activeRoom.on(
      RoomEvent.TrackUnsubscribed,
      (track, _publication, participant) => {
        if (participant?.identity && track.sid) {
          detachRemoteAudioTrack(participant.identity, track.sid)
        }
        syncParticipants(activeRoom)
      }
    )
    activeRoom.on(
      RoomEvent.TranscriptionReceived,
      (segments, participant, publication) => {
        setTranscripts((currentTranscripts) =>
          upsertTranscriptItems(
            currentTranscripts,
            segments,
            participant,
            publication,
            agentMetadataRef.current.transcriptPartialsEnabled
          )
        )
      }
    )
    activeRoom.on(RoomEvent.ChatMessage, (message, participant) => {
      const nextMessage: VoiceCallChatMessageView = {
        id: message.id,
        type: resolveMessageType(participant),
        author: resolveParticipantName(participant),
        time: formatMessageTime(message.timestamp),
        text: message.message,
        timestamp: message.timestamp,
        source: "chat",
      }
      setChatMessages((currentMessages) =>
        upsertChatFeedMessage(currentMessages, nextMessage)
      )
    })
    activeRoom.on(RoomEvent.AudioPlaybackStatusChanged, () => {
      setNeedsAudioResume(!activeRoom.canPlaybackAudio)
    })
    activeRoom.on(RoomEvent.MediaDevicesError, (error) => {
      setMicrophoneAvailable(false)
      setErrorMessage(formatVoiceError(error))
      syncParticipants(activeRoom)
    })
    activeRoom.on(RoomEvent.Disconnected, (reason) => {
      if (!isLeavingRef.current) {
        setErrorMessage(reason ? `Disconnected: ${reason}` : null)
      }
      resetVoiceState()
    })

    try {
      const tokenResponse = await requestVoiceToken({
        canvasId: resolvedCanvasId,
        userId: resolvedUserId,
        displayName: resolvedDisplayName,
        apiBaseUrl,
      })
      const nextAgentMetadata: VoiceCallAgentMetadata = {
        enabled: tokenResponse.agent?.enabled ?? false,
        name: tokenResponse.agent?.name ?? DEFAULT_AGENT_NAME,
        wakePhrases: tokenResponse.agent?.wake_phrases ?? [],
        transcriptionMode: tokenResponse.agent?.transcription_mode ?? "mock",
        transcriptForwardingEnabled:
          tokenResponse.agent?.transcript_forwarding_enabled ?? false,
        transcriptPartialsEnabled:
          tokenResponse.agent?.transcript_partials_enabled ?? true,
        diarizationEnabled: tokenResponse.agent?.diarization_enabled ?? false,
      }
      agentMetadataRef.current = nextAgentMetadata
      setAgentMetadata(nextAgentMetadata)
      setRoomName(tokenResponse.room_name)
      setParticipantIdentity(tokenResponse.participant_identity)

      await activeRoom.connect(tokenResponse.server_url, tokenResponse.token)
      attachExistingRemoteAudioTracks(activeRoom)
      setNeedsAudioResume(!activeRoom.canPlaybackAudio)
      syncParticipants(activeRoom)

      if (typeof activeRoom.startAudio === "function") {
        try {
          await activeRoom.startAudio()
          setNeedsAudioResume(!activeRoom.canPlaybackAudio)
        } catch {
          setNeedsAudioResume(true)
        }
      }

      if (canUseMicrophone()) {
        await activeRoom.localParticipant.setMicrophoneEnabled(true)
        setMicrophoneAvailable(true)
        setIsMicrophoneEnabled(true)
        setStatusMessage(`Joined as ${tokenResponse.participant_identity}`)
      } else {
        setMicrophoneAvailable(false)
        setIsMicrophoneEnabled(false)
        setStatusMessage("Connected in listen-only mode.")
        setErrorMessage(getMicrophoneUnavailableMessage())
      }

      syncParticipants(activeRoom)
    } catch (error) {
      setErrorMessage(formatVoiceError(error))
      await activeRoom.disconnect()
      resetVoiceState()
    } finally {
      setIsJoining(false)
    }
  }, [
    apiBaseUrl,
    attachExistingRemoteAudioTracks,
    attachRemoteAudioTrack,
    detachRemoteAudioTrack,
    isJoining,
    resetVoiceState,
    resolvedCanvasId,
    resolvedDisplayName,
    resolvedUserId,
    syncParticipants,
  ])

  React.useEffect(() => {
    return () => {
      detachAllAudioTracks()
      void roomRef.current?.disconnect()
      roomRef.current = null
    }
  }, [detachAllAudioTracks])

  const inCall =
    isJoining ||
    connectionState !== ConnectionState.Disconnected ||
    roomRef.current !== null

  const timelineMessages = [
    ...transcripts.map((transcript) => ({
      id: transcript.id,
      type:
        transcript.participantIdentity === participantIdentity
          ? ("user" as const)
          : ("person" as const),
      author:
        transcript.participantIdentity === participantIdentity
          ? "You"
          : transcript.participantName,
      time: formatMessageTime(transcript.timestamp),
      text: transcript.text,
      timestamp: transcript.timestamp,
      source: "transcript" as const,
      pending: !transcript.isFinal,
    })),
    ...chatMessages,
  ].sort((left, right) => {
    if (left.timestamp !== right.timestamp) {
      return left.timestamp - right.timestamp
    }
    return left.id.localeCompare(right.id)
  })

  return {
    agent,
    agentMetadata,
    audioContainerRef,
    chatMessages: timelineMessages,
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
    transcripts,
  }
}

export type UseVoiceCallResult = ReturnType<typeof useVoiceCall>
