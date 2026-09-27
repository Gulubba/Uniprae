# Premiere editor expansion

This build extends the existing unified Uniprae server and retains the separate Premiere server and its project-file utilities in the development workspace. It does not merge binary project-file patching into the unified server. Existing After Effects tools, transcription and silence-removal workflows remain in place.

## New MCP controls

- Discovery: editor_capabilities, inspect_timeline, list_project_items.
- Project organization: import_media, create_bin, move_project_item.
- Timeline: clone_sequence, set_playhead, set_sequence_range, place_media, remove_clip, set_clip_enabled, select_clip, set_track_mute.
- Effects and animation: inspect_components, set_component_value, set_keyframes. These operate on existing components including Motion, Opacity and audio properties; they do not add arbitrary effects.
- Graphics: import_mogrt, inspect_mogrt, set_mogrt_value. A local author-created .mogrt template is required. Editable controls depend on what the template author exposed.
- Markers and delivery: add_marker, list_markers, export_sequence with a local .epr preset.

Every tool above uses the `ppro_` prefix. The tools are automatically listed through standard MCP in Codex, Claude Code, Antigravity and other local stdio clients. They execute through the existing Premiere CEP bridge and require no new UXP plugin.

## Editing workflow

1. Start the Uniprae server in Premiere and activate the desired sequence.
2. Ask the agent to inspect capabilities and timeline. Clip mutations require the inspected sequence ID, clip ID, track type and zero-based track/clip indices.
3. Clone a sequence before a substantial edit. Reinspect after structural changes. Stale IDs cause an error instead of silently targeting another clip.
4. Import a MOGRT onto an empty video track, inspect its editable controls and set values using the exact returned format. Native caption-to-graphic conversion is not implemented here.
5. Inspect components before animation. Position often uses normalized coordinates; other properties have different units. Keyframes use source-time seconds: clip inPoint plus offset within the clip, not sequence time. Existing keys are retained; setting a static value on an animated property is refused.
6. Inspect the resulting timeline and preview in Premiere. Save when satisfied.

## Validation and limits

TypeScript build and focused simulated-host tests cover input rejection, stale clip/sequence protection, non-ripple removal defaults and protection of existing animation. These are not a substitute for visual acceptance testing in Premiere. Runtime capabilities are probed on the connected host. Each new mutation needs acceptance testing against the user's Adobe version and actual media/templates.

This is an expanded editing API, not everything a human editor can do. Missing dedicated operations include arbitrary native text creation, caption-to-graphic conversion, adding effects/transitions, advanced trimming/slip/slide/retiming, multicam, masks/tracking and full Lumetri authoring. Existing effect parameters can be edited when exposed. There is no universal menu-click API or guaranteed multi-operation undo transaction. Errors may occur after partial host changes; clone first and inspect before retrying. Do not retry timed-out exports blindly.

Reference: Adobe's Premiere CEP sample API declarations: https://github.com/Adobe-CEP/Samples/blob/master/PProPanel/jsx/PremierePro.23.0.d.ts

## Installation

Build verification: 23 new tools registered, 128 total tools (34 Premiere, 91 After Effects, 3 shared). Read-only capability discovery and timeline inspection passed against Premiere 25.6.3. Focused tests: 5/5 passed. Full existing suite: 22/23 passed; the unrelated watcher test expects an 8-second heartbeat threshold while the existing bridge uses 10 seconds. That existing AE behavior has been preserved. New editing mutations have not all been live-tested.

Extract the complete ZIP, run Install-Uniprae.bat and restart the AI client to refresh its tool list. Open the Adobe Uniprae panel and Start Server. Existing installation/client configuration is handled by the included installer. The package contains no personal API keys. See README.md and SETUP-AND-VALIDATION.md for prerequisites and transcription configuration.
