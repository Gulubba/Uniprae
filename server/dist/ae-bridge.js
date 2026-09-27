import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { execSync } from "node:child_process";
/**
 * AE Bridge using file-based IPC.
 *
 * Drops .jsx command files into a watched folder. A companion watcher
 * running inside After Effects (either headless in Scripts/Startup or
 * ScriptUI panel in Scripts/ScriptUI Panels) polls this folder and executes
 * any .jsx files it finds.
 */
export class AEBridge {
    commandDir;
    resultDir;
    readyFilePath;
    instanceId = `${process.pid}_${Math.random().toString(36).slice(2, 8)}`;
    constructor() {
        const tempDir = os.tmpdir();
        this.commandDir = path.join(tempDir, "ae-mcp-commands");
        this.resultDir = path.join(tempDir, "ae-mcp-bridge");
        this.readyFilePath = path.join(tempDir, "ae-mcp-ready.txt");
        if (!fs.existsSync(this.commandDir)) {
            fs.mkdirSync(this.commandDir, { recursive: true });
        }
        if (!fs.existsSync(this.resultDir)) {
            fs.mkdirSync(this.resultDir, { recursive: true });
        }
    }
    /**
     * Fast check if Adobe After Effects process is running.
     */
    isAfterEffectsRunning() {
        try {
            if (process.platform === "win32") {
                const out = execSync('tasklist /FI "IMAGENAME eq AfterFX.exe" /NH', {
                    encoding: "utf-8",
                    timeout: 2000,
                    windowsHide: true,
                });
                return out.toLowerCase().includes("afterfx.exe");
            }
            else if (process.platform === "darwin") {
                const out = execSync('pgrep -x "After Effects"', {
                    encoding: "utf-8",
                    timeout: 2000,
                });
                return out.trim().length > 0;
            }
        }
        catch (e) { }
        // Default to true if tasklist cannot be queried to avoid false negatives
        return true;
    }
    /**
     * Check if the AE watcher is actively running and updating heartbeat.
     */
    isWatcherRunning() {
        if (!fs.existsSync(this.readyFilePath)) {
            return false;
        }
        try {
            const stats = fs.statSync(this.readyFilePath);
            const content = fs.readFileSync(this.readyFilePath, "utf-8");
            const match = content.match(/READY:(\d+)/);
            const processor = content.match(/PROCESSOR:(STARTUP|PANEL|CEP_EXTENSION)/);
            if (match && processor) {
                const ts = parseInt(match[1], 10);
                if (!isNaN(ts) && Date.now() - ts < 10000) {
                    return true;
                }
            }
            return false;
        }
        catch (e) {
            return false;
        }
    }
    /** Read-only diagnostics that remain available even when AE cannot execute JSX. */
    getConnectionStatus() {
        let heartbeatAgeMs = null;
        let generation = null;
        let processorType = "none";
        try {
            const stats = fs.statSync(this.readyFilePath);
            heartbeatAgeMs = Math.max(0, Date.now() - stats.mtimeMs);
            const content = fs.readFileSync(this.readyFilePath, "utf-8");
            const match = content.match(/GENERATION:(\d+)/);
            if (match)
                generation = Number(match[1]);
            const procMatch = content.match(/PROCESSOR:(STARTUP|PANEL|CEP_EXTENSION)/);
            if (procMatch)
                processorType = procMatch[1].toLowerCase();
        }
        catch { }
        const countFiles = (dir, suffix) => {
            try {
                return fs.readdirSync(dir).filter((name) => name.endsWith(suffix)).length;
            }
            catch {
                return 0;
            }
        };
        const afterEffectsRunning = this.isAfterEffectsRunning();
        const watcherRunning = this.isWatcherRunning();
        return {
            success: true,
            status: !afterEffectsRunning ? "after_effects_not_running" : watcherRunning ? "connected" : "watcher_offline",
            mode: processorType === "cep_extension" ? "cep_extension" : "file_watcher",
            cepBridgeUrl: "http://127.0.0.1:3006",
            afterEffectsRunning,
            watcherRunning,
            heartbeatAgeMs,
            watcherGeneration: generation,
            pendingCommands: countFiles(this.commandDir, ".jsx"),
            pendingResults: countFiles(this.resultDir, ".json"),
            recovery: watcherRunning ? null : "Open Window > Extensions > After Effects MCP Bridge (or Window > ae-watcher.jsx). Re-run install.ps1 to repair installation.",
        };
    }
    /**
     * Attempt execution via the After Effects CEP Extension HTTP server (port 3006).
     */
    async executeViaCepHttp(jsxCode, autoPreview) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 120000);
        try {
            const res = await fetch("http://127.0.0.1:3006/execute", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    code: `(function(){try{var value=eval(${JSON.stringify(jsxCode)});return typeof value==='string'?value:JSON.stringify(typeof value==='undefined'?{success:true}:value);}catch(e){return JSON.stringify({success:false,error:e.toString()});}})()`,
                    autoPreview,
                }),
                signal: controller.signal,
            });
            if (res.ok) {
                const json = await res.json();
                return json;
            }
            return { success: false, error: `Adobe bridge returned HTTP ${res.status}. Inspect the composition before retrying.`, executionUncertain: true };
        }
        catch (e) {
            // Only connection refusal proves the request was never accepted.
            if (e?.cause?.code !== 'ECONNREFUSED') {
                return { success: false, error: 'Adobe request interrupted. Inspect the composition before retrying; the edit may have completed.', executionUncertain: true };
            }
        }
        finally {
            clearTimeout(timeoutId);
        }
        return null;
    }
    /**
     * Clean up leftover files from previous commands.
     */
    cleanStaleFiles() {
        try {
            const now = Date.now();
            const files = fs.readdirSync(this.resultDir);
            for (const f of files) {
                const fp = path.join(this.resultDir, f);
                try {
                    const st = fs.statSync(fp);
                    if (now - st.mtimeMs > 60000) {
                        fs.unlinkSync(fp);
                    }
                }
                catch (e) { }
            }
        }
        catch (e) { }
    }
    /**
     * Execute ExtendScript code inside Adobe After Effects.
     */
    async executeJsx(jsxCode, autoPreview = false) {
        // 1. Upfront check: Is After Effects process actually running?
        if (!this.isAfterEffectsRunning()) {
            return {
                success: false,
                error: "Adobe After Effects is not running. Please launch Adobe After Effects first.",
            };
        }
        // 2. High-speed primary channel: Try CEP Extension HTTP Server (port 3006)
        const cepResult = await this.executeViaCepHttp(jsxCode, autoPreview);
        if (cepResult !== null) {
            return cepResult;
        }
        // 3. Fallback secondary channel: File-based IPC
        this.cleanStaleFiles();
        const id = `${Date.now()}_${this.instanceId}_${Math.random().toString(36).substring(2, 8)}`;
        const resultFilePath = path.join(this.resultDir, `result_${id}.json`).replace(/\\/g, "/");
        const previewFilePath = path.join(this.resultDir, `preview_${id}.png`).replace(/\\/g, "/");
        const commandFilePath = path.join(this.commandDir, `cmd_${id}.jsx`);
        // Wrap user JSX with JSON polyfill, safety try/catch, and direct file output
        const wrappedJsx = `
(function() {
  if (typeof JSON === "undefined") {
    JSON = {};
  }
  if (typeof JSON.stringify !== "function") {
    JSON.stringify = function(obj) {
      if (obj === null) return "null";
      if (typeof obj === "undefined") return "undefined";
      if (typeof obj === "number" || typeof obj === "boolean") return String(obj);
      if (typeof obj === "string") {
        return '"' + obj.replace(/\\\\/g, '\\\\\\\\').replace(/"/g, '\\\\"').replace(/\\n/g, '\\\\n').replace(/\\r/g, '\\\\r') + '"';
      }
      if (obj instanceof Array) {
        var arr = [];
        for (var i = 0; i < obj.length; i++) arr.push(JSON.stringify(obj[i]));
        return "[" + arr.join(",") + "]";
      }
      if (typeof obj === "object") {
        var pairs = [];
        for (var k in obj) {
          if (obj.hasOwnProperty(k)) pairs.push('"' + k + '":' + JSON.stringify(obj[k]));
        }
        return "{" + pairs.join(",") + "}";
      }
      return String(obj);
    };
  }

  if (typeof $.global.__ae_mcp_realBegin !== "undefined" && typeof app !== "undefined") {
    try { app.beginUndoGroup = $.global.__ae_mcp_realBegin; } catch(e) {}
    delete $.global.__ae_mcp_realBegin;
  }
  if (typeof $.global.__ae_mcp_realEnd !== "undefined" && typeof app !== "undefined") {
    try { app.endUndoGroup = $.global.__ae_mcp_realEnd; } catch(e) {}
    delete $.global.__ae_mcp_realEnd;
  }
  delete $.global.__ae_mcp_undo_guard;

  if (typeof app !== "undefined") {
    app.safeEndUndoGroup = function() {
      try { app.endUndoGroup(); } catch(e) {}
    };
  }

  var _result = { success: true, data: "OK" };
  try {
    var _userRes = eval(${JSON.stringify(jsxCode)});
    if (typeof _userRes !== "undefined" && _userRes !== null) {
      _result = _userRes;
    }
  } catch(e) {
    if (app.safeEndUndoGroup) {
      try { app.safeEndUndoGroup(); } catch(err) {}
    }
    _result = { success: false, error: e.toString() + " (Line " + (e.line || "?") + ")" };
  }

  // 1. Write JSON result file FIRST to guarantee instant IPC response
  try {
    var f = new File("${resultFilePath}");
    f.open("w");
    f.write(JSON.stringify(_result));
    f.close();
  } catch(e) {}

  // 2. Optionally export PNG preview snapshot in isolated safety block
  if (${autoPreview ? "true" : "false"}) {
    try {
      var comp = app.project.activeItem;
      if (comp && comp instanceof CompItem && typeof comp.saveFrameToPng === "function") {
        var pf = new File("${previewFilePath}");
        comp.saveFrameToPng(comp.time, pf);
      }
    } catch(e) {}
  }
})();
    `;
        // Publish atomically so AE never observes a half-written JSX file.
        const pendingFilePath = `${commandFilePath}.pending`;
        fs.writeFileSync(pendingFilePath, wrappedJsx, "utf-8");
        fs.renameSync(pendingFilePath, commandFilePath);
        // Poll for result JSON file (timeout 15 seconds)
        const deadline = Date.now() + 15000;
        while (Date.now() < deadline) {
            if (fs.existsSync(resultFilePath)) {
                await new Promise((r) => setTimeout(r, 80));
                try {
                    const rawResult = fs.readFileSync(resultFilePath, "utf-8");
                    try {
                        fs.unlinkSync(resultFilePath);
                    }
                    catch (e) { }
                    try {
                        return JSON.parse(rawResult);
                    }
                    catch (e) {
                        return { success: true, rawOutput: rawResult };
                    }
                }
                catch (e) {
                    // File still being written, retry next loop
                }
            }
            await new Promise((r) => setTimeout(r, 120));
        }
        // Timeout — clean up command file if still present
        try {
            fs.unlinkSync(commandFilePath);
        }
        catch (e) { }
        if (!this.isWatcherRunning()) {
            return {
                success: false,
                error: "After Effects Watcher is not running. Please ensure After Effects is open (the startup watcher starts automatically within 3 seconds of AE launch, or run Window -> ae-watcher.jsx).",
            };
        }
        return {
            success: false,
            error: "Timeout waiting for After Effects to execute the command. After Effects may be processing a heavy operation or awaiting modal user input.",
        };
    }
}
