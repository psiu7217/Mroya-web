# Voice input

This change requires [Backend PR #93](https://github.com/psiu7217/Mroya-api/pull/93) and its
`api.0001_speechquota` migration. Repository changes do not imply deployment.
Backend configuration: `GROQ_API_KEY` in `/opt/mroya-api/.env`; never in Web.
Canonical API details: [Backend speech contract](https://github.com/psiu7217/Mroya-api/blob/feat/speech-to-text/docs/SPEECH-TO-TEXT.md).

`MroyaApi.transcribeAudio` uses the existing session/CSRF transport for
`POST /api/v1/chat/transcriptions/`, multipart `{file: Blob}`, returning
`{"text":"..."}`. The transcription request contains only the recorded audio.

The provider's `useSpeechInput` owns the MediaRecorder controller, microphone,
timers and request. Typed presentation state/actions pass through WorkspaceModel
to the existing ChatWorkspace. An audio level meter uses samples from the
microphone. Stop appends the result to the latest draft, including edits made
during recognition. The arrow appends the result and submits that draft through
the ordinary chat flow. The recording time limit works like Stop. The ordinary
Send and Enter controls are disabled during recording and recognition.

Browser capture selects an available MediaRecorder type: Opus WebM, MP4 (Safari),
WebM or Opus OGG/OGG, falling back to the browser's recorder default. Audio bitrate
is requested at 64 kbps; unsupported encoders may choose their own bitrate.
The actual recorder MIME type is used for the Blob. Backend validates bytes,
container and duration independently. Server formats: WebM, MP4/M4A, OGG, WAV,
FLAC and MP3, one audio stream, no video; maximum 12 MiB and two minutes.
Browser stops at 119.5 seconds to allow encoder padding. Six requests/minute and
30/hour per signed-in user are enforced server-side, including failed attempts.

Microphone tracks are stopped on Stop, Cancel, recorder failure, chat/section
change, component disposal, pagehide and backgrounding. Cancel also aborts a
pending upload and ignores late permission/results. Transcription has a browser
60-second timeout. No audio or result is persisted to storage. Guest voice opens
Sign in without requesting microphone permission or making transcription calls.
Design Mode remains offline; no synthetic speech is presented as a real result.

## Checks

Ubuntu, existing Node runtime: `node --test tests/speech-input.test.mjs`,
`npm run lint`, `npm run build:production`, `node scripts/check-production.mjs`.
The targeted tests simulate MediaRecorder/transport; there are no real Groq calls.
The optional `check:boundaries` currently reports pre-existing runtime imports in
AiTaskConfirmationCard and AiTasksDrawer; those files are unchanged in this PR.

## Manual acceptance after approved deployment

Check Safari and installed PWA on iPhone, Chrome and installed PWA on Android,
and a desktop browser over HTTPS:

1. Allow and deny microphone permission. After denial, enable permission in
   browser/OS settings and record again. Unsupported capture shows a helpful error.
2. Speak Russian, English and Polish. Stop: microphone indicator disappears,
   recognition status appears, original-language text appends to an existing draft.
   Edit while recognition is pending and verify those edits are retained.
3. Verify Stop leaves an editable draft. Record again and press the arrow.
   Verify the latest draft and transcript are sent together exactly once.
4. Cancel while recording, while permission is pending and during recognition.
   Switch chats/sections, close or background the PWA, and verify no active mic,
   stale insertion into another chat, or automatic submission.
5. Check a two-minute recording, silence, network failure, expired session,
   unavailable Backend/key and repeated requests. Errors preserve the draft and
   offer a new recording; there is no automatic replay of audio requests.
6. Check light/dark themes and both interface languages, including small screens.

No merge, helper installation, runtime/proxy change or deployment is performed by
this PR. The existing Traefik API route bypasses Web Nginx; no Nginx update is needed.
