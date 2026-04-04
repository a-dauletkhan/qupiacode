LiveKit docs › Agents framework › Events and error handling

---

# Events and error handling

> Guides and reference for events and error handling in LiveKit Agents.

## Events

`AgentSession` emits events to notify you of state changes. Each event is emitted with an event object as its sole argument.

### user_input_transcribed

A `UserInputTranscribedEvent` is emitted when user transcription is available.

#### Properties

- `transcript`: str - The transcribed text
- `is_final`: bool - Whether this is a final transcription
- `speaker_id`: str | None - Only available if speaker diarization is supported in your STT plugin
- `language`: str | None - The detected language of the transcription

#### Example

**Python**:

```python
from livekit.agents import UserInputTranscribedEvent

@session.on("user_input_transcribed")
def on_user_input_transcribed(event: UserInputTranscribedEvent):
    print(f"User input transcribed: {event.transcript}, "
          f"language: {event.language}, "
          f"final: {event.is_final}, "
          f"speaker id: {event.speaker_id}")

```

---

**Node.js**:

```ts
import { voice } from '@livekit/agents';

session.on(voice.AgentSessionEventTypes.UserInputTranscribed, (event) => {
  console.log(`User input transcribed: ${event.transcript}, language: ${event.language}, final: ${event.isFinal}, speaker id: ${event.speakerId}`);
});

```

### conversation_item_added

A `ConversationItemAddedEvent` is emitted when an item is committed to the chat history. This event is emitted for both user and agent items.

#### Properties

- `item`: [ChatMessage](https://github.com/livekit/agents/blob/3ee369e7783a2588cffecc0725e582cac10efa39/livekit-agents/livekit/agents/llm/chat_context.py#L105)

#### Example

**Python**:

```python
from livekit.agents import ConversationItemAddedEvent
from livekit.agents.llm import ImageContent, AudioContent

...

@session.on("conversation_item_added")
def on_conversation_item_added(event: ConversationItemAddedEvent):
    print(f"Conversation item added from {event.item.role}: {event.item.text_content}. interrupted: {event.item.interrupted}")
    # to iterate over all types of content:
    for content in event.item.content:
        if isinstance(content, str):
            print(f" - text: {content}")
        elif isinstance(content, ImageContent):
            # image is either a rtc.VideoFrame or URL to the image
            print(f" - image: {content.image}")
        elif isinstance(content, AudioContent):
            # frame is a list[rtc.AudioFrame]
            print(f" - audio: {content.frame}, transcript: {content.transcript}")

```

---

**Node.js**:

```ts
import { voice } from '@livekit/agents';

// ...

session.on(voice.AgentSessionEventTypes.ConversationItemAdded, (event) => {
  console.log(`Conversation item added from ${event.item.role}: ${event.item.textContent}. interrupted: ${event.item.interrupted}`);
  
  // to iterate over all types of content:
  for (const content of event.item.content) {
    switch (typeof content === 'string' ? 'string' : content.type) {
      case 'string':
        console.log(` - text: ${content}`);
        break;
      case 'image_content':
        // image is either a VideoFrame or URL to the image
        console.log(` - image: ${content.image}`);
        break;
      case 'audio_content':
        // frame is an array of AudioFrame
        console.log(` - audio: ${content.frame}, transcript: ${content.transcript}`);
        break;
    }
  }
});

```

### function_tools_executed

`FunctionToolsExecutedEvent` is emitted after all function tools have been executed for a given user input.

#### Methods

- `zipped()` returns a list of tuples of function calls and their outputs.
- `cancel_tool_reply()` cancels the automatic reply after tool execution.
- `cancel_agent_handoff()` cancels any pending agent handoff.

#### Properties

- `function_calls`: list[[FunctionCall](https://docs.livekit.io/reference/python/v1/livekit/agents/llm/index.html.md#livekit.agents.llm.FunctionCall)]
- `function_call_outputs`: list[[FunctionCallOutput](https://docs.livekit.io/reference/python/v1/livekit/agents/llm/index.html.md#livekit.agents.llm.FunctionCallOutput)]
- `has_tool_reply`: bool - Whether a tool reply is required
- `has_agent_handoff`: bool - Whether an agent handoff is required

### metrics_collected

`MetricsCollectedEvent` is emitted when new metrics are available to be reported. Metrics include STT, LLM, TTS, VAD, EOU, and when [adaptive interruption handling](https://docs.livekit.io/agents/logic/turns/adaptive-interruption-handling.md) is enabled, [InterruptionMetrics](https://docs.livekit.io/deploy/observability/data.md#interruptionmetrics) for barge-in detection latency and request volume. For more information on metrics, see [Metrics and usage data](https://docs.livekit.io/deploy/observability/data.md#metrics).

#### Properties

- `metrics`: Union[STTMetrics, LLMMetrics, TTSMetrics, VADMetrics, EOUMetrics, InterruptionMetrics]

### speech_created

`SpeechCreatedEvent` is emitted when new agent speech is created. Speech could be created for any of the following reasons:

- the user has provided input
- `session.say` is used to create agent speech
- `session.generate_reply` is called to create a reply

#### Properties

- `user_initiated`: str - True if speech was created using public methods like `say` or `generate_reply`
- `source`: str - "say", "generate_reply", or "tool_response"
- `speech_handle`: [SpeechHandle](https://docs.livekit.io/agents/build/audio.md#speechhandle) - handle to track speech playout.

### agent_state_changed

`AgentStateChangedEvent` is emitted when the agent's state changes. The `lk.agent.state` attribute on the agent participant is updated to reflect the new state, allowing frontend code to easily respond to changes.

#### Properties

- `old_state`: AgentState
- `new_state`: AgentState

#### AgentState

The agent could be in one of the following states:

- `initializing` - agent is starting up. This should be brief.
- `idle` - agent is ready but not actively processing
- `listening` - agent is waiting for user input
- `thinking` - agent is processing user input
- `speaking` - agent is speaking

### user_state_changed

`UserStateChangedEvent` is emitted when the user's state changes. This change is driven by the VAD module running on the user's audio input.

#### Properties

- `old_state`: UserState
- `new_state`: UserState

#### UserState

The user's state can be one of the following:

- `speaking` - VAD detected user has started speaking
- `listening` - VAD detected the user has stopped speaking
- `away` - The user hasn't responded for a while (default: 15s). Specify a custom timeout with `AgentSession(user_away_timeout=...)`.

#### Example

- **[Handling idle user](https://github.com/livekit/agents/blob/main/examples/voice_agents/inactive_user.py)**: Check in with the user after they go idle.

### overlapping_speech

`OverlappingSpeechEvent` with type `overlapping_speech` is emitted when adaptive interruption handling is enabled and user speech is detected. The `is_interruption` property indicates whether the speech is an interruption.

#### Properties

- `type`: str - "overlapping_speech".
- `detected_at`: float - Timestamp (in seconds) when the event was fired.
- `is_interruption`: bool - Whether interruption is detected.
- `total_duration`: float - Round trip time (RTT) taken to perform the inference, in seconds.
- `prediction_duration`: float - Time taken to perform the inference from the model side, in seconds.
- `detection_delay`: float - Total time from the onset of the speech to the final prediction, in seconds.
- `overlap_started_at`: float | None - Timestamp (in seconds) when the overlap speech started.
- `speech_input`: array[int16] | None - The audio input that was used for the inference.
- `probabilities`: array[float32] | None - The raw probabilities for the interruption detection.
- `probability`: float - The conservative estimated probability of the interruption event.
- `num_requests`: int - Number of requests sent to the interruption detection model for this event.

### agent_false_interruption

`AgentFalseInterruptionEvent` is emitted when the agent detects a [false interruption](https://docs.livekit.io/agents/logic/turns.md#false-interruptions), that is, user speech that initially appeared to interrupt the agent, but is determined not to be a true interruption.

#### Properties

- `type`: str - The type of false interruption: "agent_false_interruption".
- `resumed`: bool - Whether the false interruption was resumed automatically.
- `created_at`: datetime - The timestamp when the false interruption was created.

### close

The `CloseEvent` is emitted when the AgentSession has closed and the agent is no longer running. This can occur for several reasons:

- The user ended the conversation
- `session.aclose()` was called
- The room was deleted, disconnecting the agent
- An unrecoverable error occurred during the session

#### Properties

- `error`: LLMError | STTError | TTSError | RealtimeModelError | None - The error that caused the session to close, if applicable
- `reason`: CloseReason - The reason why the session closed

#### CloseReason

The close reason can be one of the following:

- `error` - Session closed due to an error
- `job_shutdown` - Agent job was shut down
- `participant_disconnected` - Participant disconnected from the room
- `user_initiated` - User explicitly closed the session
- `task_completed` - Task was completed successfully

## Handling errors

In addition to state changes, it's important to handle errors that may occur during a session. In real-time conversations, inference API failures can disrupt the flow, potentially leaving the agent unable to continue.

### FallbackAdapter

For STT, LLM, and TTS, the Agents framework includes a `FallbackAdapter` that can fall back to secondary providers if the primary one fails.

> ℹ️ **FallbackAdapter support for Node.js**
> 
> In Node.js, the `FallbackAdapter` is only available for LLM.

When in use, `FallbackAdapter` handles the following:

- Automatically resubmits the failed request to backup providers when the primary provider fails.
- Marks the failed provider as unhealthy and stops sending requests to it.
- Continues to use the backup providers until the primary provider recovers.
- Periodically checks the primary provider's status in the background.

**Python**:

```python
from livekit.agents import llm, stt, tts
from livekit.plugins import assemblyai, deepgram, elevenlabs, openai, groq

session = AgentSession(
    stt=stt.FallbackAdapter(
        [
            assemblyai.STT(),
            deepgram.STT(),
        ]
    ),
    llm=llm.FallbackAdapter(
        [
            openai.responses.LLM(model="gpt-4o"),
            openai.LLM.with_azure(model="gpt-4o", ...),
        ]
    ),
    tts=tts.FallbackAdapter(
        [
            elevenlabs.TTS(...),
            groq.TTS(...),
        ]
    ),
)

```

---

**Node.js**:

```typescript
import { llm, voice } from '@livekit/agents';
import * as openai from '@livekit/agents-plugin-openai';


const session = new voice.AgentSession({
  llm: new llm.FallbackAdapter({
    llms: [
        new openai.LLM({ model: 'openai/gpt-4o' }),
        new openai.LLM.withAzure({ model: 'openai/gpt-4o' }),
    ],
  }),
  // ... stt, tts, etc.
});

```

For a complete example, see the [Node.js example in GitHub](https://github.com/livekit/agents-js/blob/main/examples/src/llm_fallback_adapter.ts).

### Error event

`AgentSession` emits `ErrorEvent` when errors occur during the session. It includes an `error` object with a `recoverable` field indicating whether the session retries the failed operation.

- If `recoverable` is `True`, the event is informational, and the session continues as expected.
- If `recoverable` is `False` (for example, after exhausting retries), the session requires intervention. You can handle the error—for instance, by using `.say()` to inform the user of an issue.

#### Properties

- `model_config`: dict - a dictionary representing the current model's configuration
- `error`: [LLMError | STTError | TTSError | RealtimeModelError](https://github.com/livekit/agents/blob/db551d2/livekit-agents/livekit/agents/voice/events.py#L138) - the error that occurred. `recoverable` is a field within `error`.
- `source`: LLM | STT | TTS | RealtimeModel - the source object responsible for the error

### Example

- **[Error handling](https://github.com/livekit/agents/blob/main/examples/voice_agents/error_callback.py)**: Handling unrecoverable errors with a presynthesized message.

---

This document was rendered at 2026-04-04T16:01:27.936Z.
For the latest version of this document, see [https://docs.livekit.io/reference/agents/events.md](https://docs.livekit.io/reference/agents/events.md).

To explore all LiveKit documentation, see [llms.txt](https://docs.livekit.io/llms.txt).
