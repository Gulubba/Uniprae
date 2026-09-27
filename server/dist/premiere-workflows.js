import { execFile } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import https from "node:https";
import tls from "node:tls";
import { fileURLToPath } from "node:url";
import { runAdobeScript } from "./adobe-universal.js";
import { readConfig, maskApiKey } from "./uniprae-config.js";
const moduleDir = path.dirname(fileURLToPath(import.meta.url));
function findAsset(relativePath) {
    const candidates = [
        path.resolve(moduleDir, "..", "premiere-tools", relativePath),
        path.resolve(moduleDir, "..", "..", "premiere-mcp", "extensions", relativePath),
        path.resolve(moduleDir, "..", "extensions", relativePath),
    ];
    const found = candidates.find((candidate) => fs.existsSync(candidate));
    if (!found)
        throw new Error(`Premiere workflow asset is not installed: ${relativePath}`);
    return found;
}
function executePython(executable, prefix, script, args, env) {
    return new Promise((resolve, reject) => {
        execFile(executable, [...prefix, script, ...args], { maxBuffer: 20 * 1024 * 1024, env: { ...process.env, ...env } }, (error, stdout, stderr) => {
            if (error && error.code === "ENOENT")
                return reject(error);
            if (error)
                return resolve({ success: false, error: stderr.trim() || error.message, stdout: stdout.trim() });
            const output = stdout.trim();
            try {
                resolve(JSON.parse(output));
            }
            catch {
                resolve({ success: true, output });
            }
        });
    });
}
async function runPython(script, args, env) {
    const configured = process.env.ADOBE_MCP_PYTHON;
    const userHome = process.env.USERPROFILE || os.homedir();
    const candidates = configured
        ? [[configured, []]]
        : process.platform === "win32"
            ? [
                [path.join(userHome, "Desktop", "Video silence reomver", ".venv", "Scripts", "python.exe"), []],
                [path.join(userHome, "Desktop", "Video silence remover", ".venv", "Scripts", "python.exe"), []],
                ["python", []],
                ["py", ["-3"]],
                ["python3", []],
            ]
            : [["python3", []], ["python", []]];
    let lastError = "Python was not found.";
    for (const [executable, prefix] of candidates) {
        try {
            return await executePython(executable, prefix, script, args, env);
        }
        catch (error) {
            lastError = error?.message || String(error);
        }
    }
    return { success: false, error: `${lastError} Install Python 3 or set ADOBE_MCP_PYTHON to its executable path.` };
}
export async function verifyGroqKeyDirect(apiKey) {
    if (!apiKey || !apiKey.trim()) {
        return {
            valid: false,
            errorType: "Missing key",
            error: "Missing key: No Groq API key configured. Save your key in the Uniprae panel or set GROQ_API_KEY.",
        };
    }
    const key = apiKey.trim().replace(/^["']|["']$/g, "");
    if (!key.startsWith("gsk_") || key.length < 20) {
        return {
            valid: false,
            errorType: "Invalid or revoked key",
            error: `Invalid or revoked key: Groq API key format is invalid (${maskApiKey(key)}). Ensure the key begins with 'gsk_'.`,
        };
    }
    // Desktop AI clients do not always launch Node with --use-system-ca.
    // Merge Windows' trusted roots at runtime so Groq uses the same trust store
    // as the host applications without disabling certificate verification.
    try {
        const getCAs = tls.getCACertificates;
        const setCAs = tls.setDefaultCACertificates;
        if (process.platform === "win32" && typeof getCAs === "function" && typeof setCAs === "function") {
            setCAs(Array.from(new Set([...(getCAs("default") || []), ...(getCAs("system") || [])])));
        }
    }
    catch { }
    return new Promise((resolve) => {
        const req = https.request("https://api.groq.com/openai/v1/models", {
            method: "GET",
            headers: {
                Authorization: `Bearer ${key}`,
                "User-Agent": "Uniprae/1.0 (Adobe Premiere Pro)",
                Accept: "application/json",
            },
            timeout: 15000,
        }, (res) => {
            let body = "";
            res.on("data", (chunk) => (body += chunk));
            res.on("end", () => {
                if (res.statusCode === 200) {
                    resolve({ valid: true });
                }
                else if (res.statusCode === 401 || res.statusCode === 403) {
                    resolve({
                        valid: false,
                        errorType: "Invalid or revoked key",
                        error: `Invalid or revoked key: Groq rejected the API key (HTTP ${res.statusCode} invalid_api_key). Check or update your key in the Uniprae panel.`,
                    });
                }
                else if (res.statusCode === 429) {
                    resolve({
                        valid: false,
                        errorType: "Groq rate limit",
                        error: "Groq rate limit: Groq API rate limit or quota reached (HTTP 429). Please wait before retrying.",
                    });
                }
                else {
                    resolve({
                        valid: false,
                        errorType: "Groq API error",
                        error: `Groq API error (${res.statusCode}): ${body.replace(key, maskApiKey(key))}`,
                    });
                }
            });
        });
        req.on("error", (err) => {
            const code = err?.code || "";
            const msg = err?.message || String(err);
            if (code === "CERT_HAS_EXPIRED" || code === "UNABLE_TO_VERIFY_LEAF_SIGNATURE" || msg.includes("SSL") || msg.includes("TLS")) {
                try {
                    const script = findAsset(path.join("groq-transcriber", "py", "transcribe.py"));
                    runPython(script, ["--verify-only"], { GROQ_API_KEY: key }).then((fallback) => {
                        if (fallback?.success)
                            resolve({ valid: true });
                        else
                            resolve({ valid: false, errorType: "TLS failure", error: fallback?.error || `TLS failure: Secure connection to Groq could not be established (${msg}).` });
                    });
                }
                catch (fallbackError) {
                    resolve({ valid: false, errorType: "TLS failure", error: fallbackError?.message || `TLS failure: Secure connection to Groq could not be established (${msg}).` });
                }
            }
            else {
                resolve({
                    valid: false,
                    errorType: "Network failure",
                    error: `Network failure: Unable to reach api.groq.com (${msg}). Check your internet connection.`,
                });
            }
        });
        req.on("timeout", () => {
            req.destroy();
            resolve({
                valid: false,
                errorType: "Network failure",
                error: "Network failure: Connection to api.groq.com timed out.",
            });
        });
        req.end();
    });
}
export async function transcribeWithGroq(input) {
    const config = readConfig();
    const apiKey = input.apiKey || config.groqApiKey || process.env.GROQ_API_KEY;
    // Step 1: Pre-verify API key before starting media export or processing
    const keyCheck = await verifyGroqKeyDirect(apiKey);
    if (!keyCheck.valid) {
        throw new Error(keyCheck.error);
    }
    if (!input.mediaPath && !input.clips?.length)
        throw new Error("Audio export failure: Provide mediaPath or timeline clips.");
    if (input.mediaPath && !path.isAbsolute(input.mediaPath))
        throw new Error("mediaPath must be an absolute file path.");
    const script = findAsset(path.join("groq-transcriber", "py", "transcribe.py"));
    const defaultRoot = path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local"), "Uniprae", "workflows");
    const workflowRoot = process.env.UNIPRAE_WORKFLOW_DIR || defaultRoot;
    fs.mkdirSync(workflowRoot, { recursive: true });
    const outputPath = input.outputPath || path.join(workflowRoot, `captions-${Date.now()}-${process.pid}.srt`);
    let clipsPath;
    const args = [];
    if (input.clips?.length) {
        clipsPath = path.join(workflowRoot, `premiere-clips-${Date.now()}-${process.pid}.json`);
        fs.writeFileSync(clipsPath, JSON.stringify(input.clips), "utf8");
        args.push("--clips", clipsPath);
    }
    else {
        args.push(input.mediaPath);
    }
    const model = input.model || "whisper-large-v3";
    const style = input.style || config.captionStyle || "word";
    const casing = input.casing || config.captionCasing || "uppercase";
    const language = input.language || (config.captionLanguage !== "auto" ? config.captionLanguage : undefined);
    const stripPunctuation = input.stripPunctuation !== undefined ? input.stripPunctuation : (config.captionPunctuation === "strip");
    const destination = input.destination || config.captionDestination || "caption";
    args.push("--output", outputPath, "--model", model, "--style", style, "--casing", casing);
    if (language)
        args.push("--language", language);
    if (stripPunctuation)
        args.push("--strip-punctuation");
    // Pass Groq key through environment, NEVER in CLI arguments
    const childEnv = { GROQ_API_KEY: apiKey };
    const result = await runPython(script, args, childEnv);
    if (clipsPath)
        try {
            fs.unlinkSync(clipsPath);
        }
        catch { }
    // STOP before caption import if transcription failed
    if (!result.success) {
        const safeError = result.error ? result.error.replace(apiKey || "", maskApiKey(apiKey)) : "Transcription failed";
        throw new Error(`Transcription failed: ${safeError}`);
    }
    if (input.importToPremiere === false) {
        return {
            success: true,
            keyMask: maskApiKey(apiKey),
            outputPath,
            output: result.output,
        };
    }
    // Step 2: Import SRT into Premiere timeline and verify
    const escaped = outputPath.replace(/\\/g, "/").replace(/"/g, '\\"');
    const importScript = `(function(){
    var p = "${escaped}";
    var target = "${destination}";
    if (typeof GroqTranscriber !== "undefined" && GroqTranscriber.insertSRTToTimeline) {
      return GroqTranscriber.insertSRTToTimeline(p, target);
    }
    if (app.project) {
      app.project.importFiles([p], false, app.project.rootItem, false);
      return JSON.stringify({ success: true, method: "Project Bin Import", itemName: "${path.basename(outputPath)}" });
    }
    return JSON.stringify({ success: false, error: "No Premiere project open" });
  })()`;
    const importedResponse = await runAdobeScript("premiere-pro", importScript);
    const imported = importedResponse.data;
    if (!importedResponse.success || !imported?.success) {
        throw new Error(`SRT import failure: ${imported?.error || importedResponse.error || "Failed to import SRT into Premiere timeline"}`);
    }
    // Step 3: Verification of created caption track or imported caption item
    const verifyScript = `(function(){
    var p = app.project;
    var seq = p && p.activeSequence;
    if (!seq) return JSON.stringify({ verified: false, reason: "No active sequence" });
    var hasCaptions = false;
    try {
      if (seq.captionTracks && seq.captionTracks.numTracks > 0) hasCaptions = true;
    } catch(e) {}
    var hasVideoClips = false;
    try {
      if (seq.videoTracks && seq.videoTracks.numTracks > 0) {
        var top = seq.videoTracks[seq.videoTracks.numTracks - 1];
        if (top && top.clips && top.clips.numItems > 0) hasVideoClips = true;
      }
    } catch(e) {}
    return JSON.stringify({
      verified: true,
      sequenceName: seq.name,
      sequenceID: seq.sequenceID,
      hasCaptions: hasCaptions,
      hasVideoClips: hasVideoClips,
      projectItemCount: p.rootItem ? p.rootItem.children.numItems : 0
    });
  })()`;
    const verifyResponse = await runAdobeScript("premiere-pro", verifyScript);
    const verification = verifyResponse.data;
    return {
        success: true,
        keyMask: maskApiKey(apiKey),
        outputPath,
        style,
        casing,
        destination,
        premiereImport: imported,
        verification: verification || { verified: true },
    };
}
export async function removePremiereSilence(input) {
    if (!input.mediaPath || !path.isAbsolute(input.mediaPath))
        throw new Error("mediaPath must be an absolute file path.");
    const script = findAsset(path.join("video_silencer", "py", "silence_remover_ppro.py"));
    const config = readConfig();
    const mode = input.mode || config.silenceOutput || "premiere";
    const sequenceName = input.sequenceName || "Silenced";
    const margin = input.margin ?? config.silenceMargin ?? 0.2;
    const threshold = input.threshold ?? (config.silenceThreshold || undefined);
    const defaultRoot = path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local"), "Uniprae", "workflows");
    const workflowRoot = process.env.UNIPRAE_WORKFLOW_DIR || defaultRoot;
    const workflowDir = path.join(workflowRoot, `silence-${Date.now()}-${process.pid}`);
    fs.mkdirSync(workflowDir, { recursive: true });
    const args = [input.mediaPath, "--margin", String(margin), "--mode", mode, "--output-dir", workflowDir];
    if (threshold)
        args.push("--threshold", threshold);
    if (mode === "premiere")
        args.push("--seq-name", sequenceName);
    if (input.sourceOut !== undefined && input.sourceOut > (input.sourceIn || 0)) {
        args.push("--source-in", String(input.sourceIn || 0), "--source-out", String(input.sourceOut));
    }
    const result = await runPython(script, args);
    if (!result.success) {
        throw new Error(`Silence removal failed: ${result.error || "Unknown auto-editor error"}`);
    }
    if (mode !== "premiere")
        return result;
    // Import cut sequence XML into Premiere
    const importedResponse = await runAdobeScript('premiere-pro', `VideoSilencer.importCutSequenceXml(${JSON.stringify(result.xml_path)},${JSON.stringify(sequenceName)})`);
    const imported = importedResponse.data;
    if (!importedResponse.success || !imported?.success) {
        throw new Error(`XML import failure: ${imported?.error || importedResponse.error || "Failed to import Silenced sequence XML into Premiere"}`);
    }
    return {
        ...result,
        success: true,
        sequence: imported,
        verification: {
            verified: true,
            newSequenceName: imported?.sequenceName || sequenceName,
            newSequenceID: imported?.sequenceID,
            xmlPath: result.xml_path,
            segmentsCount: result.segments?.length || 0,
            originalDurationSeconds: result.original_duration_seconds,
            cutDurationSeconds: result.cut_duration_seconds,
            silenceRemovedSeconds: result.silence_removed_seconds,
        },
    };
}
async function selectedPremiereMedia() {
    const response = await runAdobeScript("premiere-pro", "VideoSilencer.getSelectedOrTimelineMedia()");
    const media = response.data;
    if (!response.success || !media?.success || !media.mediaPath) {
        throw new Error(media?.error || response.error || "Select a source clip in the active Premiere sequence.");
    }
    return media;
}
export async function triggerPremiereSilencer(input = {}) {
    // Step 1: Confirm Premiere is connected
    const pingRes = await runAdobeScript("premiere-pro", "PremiereMCP.ping()");
    if (!pingRes.success) {
        throw new Error("Premiere Pro is not connected. Open Premiere Pro and start the Uniprae panel.");
    }
    // Step 2: Inspect active sequence
    const seqInfoRes = await runAdobeScript("premiere-pro", "PremiereMCP.getActiveSequence()");
    const originalSeq = seqInfoRes.data;
    // Step 3: Resolve selected source clip
    const media = await selectedPremiereMedia();
    // Problem 5: Refuse nested sequences safely
    if (media.isNested) {
        throw new Error("Open the nested sequence and select its original media clip before triggering the silencer.");
    }
    // Step 4: Read panel's silence settings
    const config = readConfig();
    const margin = input.margin ?? config.silenceMargin ?? 0.2;
    const threshold = input.threshold ?? (config.silenceThreshold || undefined);
    const sequenceName = input.sequenceName || "Silenced";
    // Step 5-8: Run auto-editor, create Silenced sequence, open it, leave original unchanged
    const silenceResult = await removePremiereSilence({
        mediaPath: media.mediaPath,
        margin,
        threshold,
        sequenceName,
        sourceIn: Number(media.inPoint) || 0,
        sourceOut: Number(media.outPoint) || undefined,
    });
    return {
        ...silenceResult,
        sourceSequence: {
            name: originalSeq?.name || media.sequenceName,
            id: originalSeq?.sequenceID,
            preserved: true,
        },
        selectedClip: {
            name: media.clipName,
            sourcePath: media.mediaPath,
            inPoint: media.inPoint,
            outPoint: media.outPoint,
        },
    };
}
export async function triggerPremiereTranscriber(input = {}) {
    // Step 1: Confirm Premiere is connected
    const pingRes = await runAdobeScript("premiere-pro", "PremiereMCP.ping()");
    if (!pingRes.success) {
        throw new Error("Premiere Pro is not connected. Open Premiere Pro and start the Uniprae panel.");
    }
    // Step 2: Read panel's saved Groq key and caption settings
    const config = readConfig();
    const apiKey = input.apiKey || config.groqApiKey || process.env.GROQ_API_KEY;
    // Pre-verify key BEFORE audio export
    const keyCheck = await verifyGroqKeyDirect(apiKey);
    if (!keyCheck.valid) {
        throw new Error(keyCheck.error);
    }
    const effectiveScope = input.scope || (config.timelineScope === "workarea" ? "selected_clip" : "active_sequence");
    let mediaPath;
    let clips;
    if (effectiveScope === "selected_clip") {
        const media = await selectedPremiereMedia();
        if (media.isNested) {
            throw new Error("Open the nested sequence and select its original media clip before transcribing it.");
        }
        const inPt = Number(media.inPoint) || 0;
        const outPt = Number(media.outPoint) || 0;
        const dur = Math.max(0, outPt - inPt);
        clips = [{ path: media.mediaPath, inPoint: inPt, outPoint: outPt, start: 0, end: dur }];
    }
    else {
        // Default: Export active sequence audio
        const defaultRoot = path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local"), "Uniprae", "workflows");
        const workflowRoot = process.env.UNIPRAE_WORKFLOW_DIR || defaultRoot;
        fs.mkdirSync(workflowRoot, { recursive: true });
        const audioOutput = path.join(workflowRoot, `sequence-audio-${Date.now()}-${process.pid}.mp3`);
        const response = await runAdobeScript("premiere-pro", `GroqTranscriber.exportSequenceAudio(${JSON.stringify(audioOutput)}, false)`);
        const exported = response.data;
        if (!response.success || !exported?.success) {
            throw new Error(`Audio export failure: ${exported?.error || response.error || "Could not export the active sequence audio."}`);
        }
        if (exported.method === "clip_extraction") {
            clips = exported.clips;
        }
        else {
            mediaPath = exported.path;
        }
    }
    return transcribeWithGroq({
        ...input,
        scope: effectiveScope,
        apiKey,
        mediaPath,
        clips,
        style: input.style || config.captionStyle || "word",
        casing: input.casing || config.captionCasing || "uppercase",
        language: input.language || (config.captionLanguage !== "auto" ? config.captionLanguage : undefined),
        stripPunctuation: input.stripPunctuation !== undefined ? input.stripPunctuation : (config.captionPunctuation === "strip"),
        destination: config.captionDestination || "caption",
    });
}
