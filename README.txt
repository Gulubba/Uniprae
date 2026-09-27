======================================================================
Uniprae 2.2.0 Premiere editor expansion
======================================================================

Universal MCP automation for Adobe After Effects and Premiere Pro.


----------------------------------------------------------------------
Included
----------------------------------------------------------------------

  * After Effects MCP tools and CEP bridge (port 3006)
  * Premiere Pro MCP tools and CEP bridge (port 3005)
  * Groq caption transcription and SRT import
  * Video silence removal into a separate Silenced sequence, preserving the source timeline
  * Matching Adobe panels with Start Server, Stop Server and automatic listener recovery
  * Automatic host detection through adobegetstatus, adoberunscript, and adobe_trigger
  * Expanded Premiere editor tools: media/bins, timeline targeting, markers, existing effect controls, keyframes, editable MOGRT templates and preset export. See PREMIERE-EDITOR.md for the exact feature list and remaining limitations.


----------------------------------------------------------------------
Install
----------------------------------------------------------------------

1. Install Node.js 20 or later. This Windows package includes server dependencies, but not Node.js or Adobe applications.
2. Extract the entire ZIP to a local folder.
3. Run Install-Uniprae.bat inside the Uniprae folder. Installation is per user and registers Codex, Claude Code and Antigravity automatically.
4. Save your work and reload the Adobe applications and your AI client.
5. Open Window > Extensions > Uniprae in each Adobe application and press Start Server.
6. Activate a Premiere sequence or After Effects composition before requesting edits.

The installer uses absolute executable paths; adding Uniprae to PATH is optional.
Other local stdio MCP clients can use the generated configuration at
%LOCALAPPDATA%\Uniprae\mcp-config.example.json. Cloud-only clients need a local execution connection.

Existing client settings and Adobe extension files are backed up before changes.
The default installer does not change PATH or Adobe developer registry settings.
For a fresh development installation where unsigned CEP panels are hidden, the optional PowerShell flag
-EnableDeveloperExtensions enables Adobe CEP developer mode. Review that setting before using it.

Invocation routes are installed for each client: Codex uses $ae and $pr; Claude Code
uses /ae and /pr; MCP prompt clients such as Antigravity expose the ae and pr prompts.

Open the Premiere Transcriber tab and paste your Groq API key into the visible password field.
Save key remembers it locally (unencrypted); Show/Hide reveals it and Forget key removes the saved value.
An unsaved key works for the current session. GROQAPIKEY in the environment is also supported.
Keys are passed to Python through its environment, not command-line arguments.
Python 3 and auto-editor are required for the optional Premiere workflows.
Set ADOBEMCPPYTHON to your Python executable if automatic discovery fails.
Personal API keys and .env files are excluded from this archive; configure your own credentials.


----------------------------------------------------------------------
Silence cuts and undo
----------------------------------------------------------------------

Import the source media into the project and select the intended clip.
Cuts are constrained to the selected clip's source In/Out range. For nested sequences, open the
nested sequence and select its original media clip so source timing is unambiguous. The default
0.20-second margin and Original Automatic sensitivity match the standalone Video silence remover.
The default workflow imports the analyzed Premiere XML as a separate sequence named Silenced and
opens it. The source sequence is not edited. Repeated runs may be disambiguated by Premiere if a
Silenced sequence already exists. Render mode remains available for a standalone output file.


----------------------------------------------------------------------
After Effects design guidance
----------------------------------------------------------------------

The ae skill, Claude /ae command and MCP ae prompt now guide editable typography, visual hierarchy,
spacing, palette, eased motion and preview checks. These improve agent instructions; they do not add
new Adobe effects or guarantee visual quality without reviewing a preview.


----------------------------------------------------------------------
Connection lifetime
----------------------------------------------------------------------

Start Server remembers its state and retries listener failures while the extension remains loaded.
Keep Adobe and the extension running. Closing the application, unloading the panel or sleeping the
computer interrupts access; this package cannot guarantee uninterrupted sessions in those states.


----------------------------------------------------------------------
Validation and limits
----------------------------------------------------------------------

The server retains the previous After Effects tools and adds the Premiere editor tool suite. Build, configuration,
simulated panel/timeline tests and real silence-analysis tests passed. Both Adobe hosts responded
during live MCP checks. Native client refresh, live timeline insertion and custom undo still need
acceptance testing after the updated panels load. Existing After Effects license requirements remain.

See SETUP-AND-VALIDATION.md for the detailed operating guide and test results.
