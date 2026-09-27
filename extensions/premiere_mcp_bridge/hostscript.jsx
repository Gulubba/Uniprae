// ═══════════════════════════════════════════════════════════════════
// Premiere Pro MCP Hostscript - Real-time ExtendScript Bridge
// ═══════════════════════════════════════════════════════════════════

if (typeof app !== "undefined" && app.enableQE) {
    try {
        app.enableQE();
        if (typeof qe !== "undefined" && qe.setDebugDatabaseEntry) {
            qe.setDebugDatabaseEntry("dvascripting.EnabledInternalDOM", "true");
        }
    } catch(e) {}
}

// Polyfill JSON if needed
if (typeof JSON === "undefined") { JSON = {}; }
if (typeof JSON.stringify !== "function") {
    JSON.stringify = function(obj) {
        if (obj === null) return "null";
        if (typeof obj === "undefined") return undefined;
        if (typeof obj === "number" || typeof obj === "boolean") return String(obj);
        if (typeof obj === "string") return '"' + obj.replace(/\\/g,"\\\\").replace(/"/g,'\\"') + '"';
        if (obj instanceof Array) {
            var a = [];
            for (var i = 0; i < obj.length; i++) a.push(JSON.stringify(obj[i]));
            return "[" + a.join(",") + "]";
        }
        if (typeof obj === "object") {
            var p = [];
            for (var k in obj) {
                if (obj.hasOwnProperty(k)) p.push('"' + k + '":' + JSON.stringify(obj[k]));
            }
            return "{" + p.join(",") + "}";
        }
        return String(obj);
    };
}
if (typeof JSON.parse !== "function") {
    JSON.parse = function(str) { return eval('(' + str + ')'); };
}

var PremiereMCP = {
    // Health & status check
    ping: function() {
        return JSON.stringify({
            status: "online",
            appName: app.name || "Adobe Premiere Pro",
            appVersion: app.version || "Unknown",
            hasProject: (app.project !== null && typeof app.project !== "undefined"),
            projectName: (app.project && app.project.name) ? app.project.name : null,
            projectPath: (app.project && app.project.path) ? app.project.path : null
        });
    },

    // Get project information
    getProjectInfo: function() {
        if (!app.project) {
            return JSON.stringify({ error: "No project open in Premiere Pro." });
        }

        var seqs = [];
        for (var i = 0; i < app.project.sequences.length; i++) {
            var s = app.project.sequences[i];
            seqs.push({
                index: i,
                name: s.name,
                sequenceID: s.sequenceID
            });
        }

        var activeSeq = app.project.activeSequence;

        return JSON.stringify({
            success: true,
            projectName: app.project.name,
            projectPath: app.project.path,
            numSequences: app.project.sequences.length,
            sequences: seqs,
            activeSequence: activeSeq ? {
                name: activeSeq.name,
                sequenceID: activeSeq.sequenceID
            } : null
        });
    },

    // Get active sequence details
    getActiveSequence: function() {
        if (!app.project) return JSON.stringify({ error: "No project open." });
        var seq = app.project.activeSequence;
        if (!seq) return JSON.stringify({ error: "No active sequence found." });

        var vidTracks = seq.videoTracks ? seq.videoTracks.numTracks : 0;
        var audTracks = seq.audioTracks ? seq.audioTracks.numTracks : 0;

        return JSON.stringify({
            success: true,
            name: seq.name,
            sequenceID: seq.sequenceID,
            timecode: seq.getPlayerPosition ? seq.getPlayerPosition().getFormatted(seq.getSettings().videoFrameRate, app.project.activeSequence.getSettings().videoDisplayFormat) : null,
            durationTicks: seq.end,
            videoTracks: vidTracks,
            audioTracks: audTracks
        });
    },

    // Get clips on active sequence
    getClips: function() {
        if (!app.project) return JSON.stringify({ error: "No project open." });
        var seq = app.project.activeSequence;
        if (!seq) return JSON.stringify({ error: "No active sequence." });

        var clips = [];
        var numTracks = seq.videoTracks.numTracks;
        for (var t = 0; t < numTracks; t++) {
            var track = seq.videoTracks[t];
            for (var c = 0; c < track.clips.numItems; c++) {
                var clip = track.clips[c];
                clips.push({
                    trackType: "video",
                    trackIndex: t,
                    clipIndex: c,
                    name: clip.name,
                    startTicks: clip.start ? clip.start.ticks : 0,
                    endTicks: clip.end ? clip.end.ticks : 0,
                    durationTicks: clip.duration ? clip.duration.ticks : 0
                });
            }
        }

        return JSON.stringify({
            success: true,
            sequenceName: seq.name,
            clipCount: clips.length,
            clips: clips
        });
    },

    // Save project
    saveProject: function() {
        if (!app.project) return JSON.stringify({ error: "No project open to save." });
        try {
            app.project.save();
            return JSON.stringify({ success: true, message: "Project saved: " + app.project.name });
        } catch(e) {
            return JSON.stringify({ error: e.toString() });
        }
    },

    // Save project as
    saveProjectAs: function(newPath) {
        if (!app.project) return JSON.stringify({ error: "No project open." });
        try {
            var res = app.project.saveAs(newPath);
            return JSON.stringify({ success: res, path: newPath });
        } catch(e) {
            return JSON.stringify({ error: e.toString() });
        }
    },

    // Open project
    openProject: function(filePath) {
        try {
            var f = new File(filePath);
            if (!f.exists) return JSON.stringify({ error: "File not found: " + filePath });
            var res = app.openDocument(filePath);
            return JSON.stringify({ success: res, path: filePath });
        } catch(e) {
            return JSON.stringify({ error: e.toString() });
        }
    },

    // Close project
    closeProject: function(saveFirst) {
        if (!app.project) return JSON.stringify({ error: "No project open." });
        try {
            var name = app.project.name;
            if (saveFirst) app.project.save();
            app.project.closeDocument();
            return JSON.stringify({ success: true, message: "Closed project: " + name });
        } catch(e) {
            return JSON.stringify({ error: e.toString() });
        }
    },

    // Arbitrary ExtendScript evaluator
    evalScript: function(code) {
        var _result = { success: true, data: null };
        try {
            var returned = eval(code);
            _result.data = (typeof _result.data !== "undefined" && _result.data !== null) ? _result.data : returned;
        } catch(e) {
            _result.success = false;
            _result.error = e.toString() + (e.line ? (" (Line " + e.line + ")") : "");
        }
        return JSON.stringify(_result);
    }
};

// Load the two workflow engines into the same CEP scripting context so the
// unified Uniprae panel can run transcription and silence removal directly.
#include "jsx/groq-hostscript.jsx"
#include "jsx/video-silencer-hostscript.jsx"
