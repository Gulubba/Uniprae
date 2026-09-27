// Groq Transcriber Hostscript for Adobe Premiere Pro (Rebuilt 2025/2026 Engine)
// Zero Word Stacking & Production Subtitle Importer

if (typeof app !== "undefined" && app.enableQE) {
    try {
        app.enableQE();
        if (typeof qe !== "undefined" && qe.setDebugDatabaseEntry) {
            qe.setDebugDatabaseEntry("dvascripting.EnabledInternalDOM", "true");
        }
    } catch (e) {}
}

var GroqTranscriber = {
    getActiveSequenceInfo: function() {
        if (!app.project) {
            return JSON.stringify({ error: "No project is currently open in Premiere Pro." });
        }
        var seq = app.project.activeSequence;
        if (!seq && app.project.sequences && app.project.sequences.numSequences > 0) {
            seq = app.project.sequences[0];
            try { app.project.activeSequence = seq; } catch(e) {}
        }
        if (!seq && typeof qe !== "undefined" && qe.project) {
            try {
                var qeSeq = qe.project.getActiveSequence();
                if (qeSeq && qeSeq.name) {
                    for (var s = 0; s < app.project.sequences.numSequences; s++) {
                        if (app.project.sequences[s].name === qeSeq.name) {
                            seq = app.project.sequences[s];
                            break;
                        }
                    }
                }
            } catch(e) {}
        }

        if (!seq) {
            return JSON.stringify({ error: "No active sequence found. Please open or select a sequence in the timeline." });
        }

        var durationSec = 0;
        try {
            if (seq.end && typeof seq.end === "number") {
                durationSec = seq.end / 254016000000;
            } else if (seq.end && typeof seq.end.seconds === "number") {
                durationSec = seq.end.seconds;
            }
        } catch(e) {}

        return JSON.stringify({
            success: true,
            name: seq.name,
            sequenceID: seq.sequenceID,
            duration: durationSec.toFixed(2),
            timebase: seq.timebase
        });
    },

    exportSequenceAudio: function(outputPath, workAreaOnly) {
        if (!app.project) {
            return JSON.stringify({ error: "No project open." });
        }
        var seq = app.project.activeSequence;
        if (!seq) {
            return JSON.stringify({ error: "No active sequence found. Please click on a sequence first." });
        }

        var targetFile = new File(outputPath);
        if (targetFile.exists) {
            try { targetFile.remove(); } catch(e) {}
        }

        // Verified Premiere Pro 2025/2026 MediaIO presets
        var candidatePresets = [
            "C:/Program Files/Adobe/Adobe Premiere Pro 2025/MediaIO/systempresets/3F3F3F3F_4D503320/MP3 128kbps.epr",
            "C:/Program Files/Adobe/Adobe Premiere Pro 2025/MediaIO/systempresets/3F3F3F3F_57415645/Waveform Audio 48kHz 16-bit.epr",
            "C:/Program Files/Adobe/Adobe Media Encoder 2025/MediaIO/systempresets/3F3F3F3F_4D503320/MP3 128kbps.epr",
            "C:/Program Files/Adobe/Adobe Media Encoder 2025/MediaIO/systempresets/3F3F3F3F_57415645/Waveform Audio 48kHz 16-bit.epr"
        ];

        var exportError = "";
        var encodeFlag = 0; // ENCODE_ENTIRE
        if (workAreaOnly) {
            if (typeof app.encoder !== "undefined" && typeof app.encoder.ENCODE_IN_TO_OUT !== "undefined") {
                encodeFlag = app.encoder.ENCODE_IN_TO_OUT;
            } else {
                encodeFlag = 1;
            }
        } else {
            if (typeof app.encoder !== "undefined" && typeof app.encoder.ENCODE_ENTIRE !== "undefined") {
                encodeFlag = app.encoder.ENCODE_ENTIRE;
            }
        }

        // METHOD 1: Direct sequence audio export
        for (var i = 0; i < candidatePresets.length; i++) {
            var pFile = new File(candidatePresets[i]);
            if (pFile.exists) {
                try {
                    var actualOut = outputPath;
                    var isWav = (pFile.name.indexOf("Waveform") !== -1 || pFile.name.indexOf(".wav") !== -1);
                    if (isWav) {
                        actualOut = outputPath.replace(/\.[^\.]+$/, ".wav");
                    } else {
                        actualOut = outputPath.replace(/\.[^\.]+$/, ".mp3");
                    }

                    var res = seq.exportAsMediaDirect(actualOut, pFile.fsName, encodeFlag);

                    var check = new File(actualOut);
                    if (check.exists && check.length > 1024) {
                        return JSON.stringify({
                            success: true,
                            method: "direct_export",
                            path: actualOut,
                            size: check.length,
                            sequenceName: seq.name
                        });
                    } else {
                        exportError = String(res || "File size 0");
                    }
                } catch (err) {
                    exportError = err.toString();
                }
            }
        }

        // METHOD 2: Fallback - Scan timeline clips (with precise timeline offsets)
        var clips = [];

        // Scan audio tracks
        for (var a = 0; a < seq.audioTracks.numTracks; a++) {
            var aTrack = seq.audioTracks[a];
            for (var ac = 0; ac < aTrack.clips.numItems; ac++) {
                var aClip = aTrack.clips[ac];
                if (aClip.projectItem && typeof aClip.projectItem.getMediaPath === "function") {
                    try {
                        var aPath = aClip.projectItem.getMediaPath();
                        if (aPath) {
                            var inSec = (aClip.inPoint && typeof aClip.inPoint.seconds === "number") ? aClip.inPoint.seconds : 0;
                            var outSec = (aClip.outPoint && typeof aClip.outPoint.seconds === "number") ? aClip.outPoint.seconds : 0;
                            var startSec = (aClip.start && typeof aClip.start.seconds === "number") ? aClip.start.seconds : 0;
                            var endSec = (aClip.end && typeof aClip.end.seconds === "number") ? aClip.end.seconds : 0;

                            clips.push({
                                path: aPath,
                                inPoint: inSec,
                                outPoint: outSec,
                                start: startSec,
                                end: endSec
                            });
                        }
                    } catch(e) {}
                }
            }
        }

        // If audio tracks are empty, scan video tracks
        if (clips.length === 0) {
            for (var v = 0; v < seq.videoTracks.numTracks; v++) {
                var vTrack = seq.videoTracks[v];
                for (var vc = 0; vc < vTrack.clips.numItems; vc++) {
                    var vClip = vTrack.clips[vc];
                    if (vClip.projectItem && typeof vClip.projectItem.getMediaPath === "function") {
                        try {
                            var vPath = vClip.projectItem.getMediaPath();
                            if (vPath) {
                                var vIn = (vClip.inPoint && typeof vClip.inPoint.seconds === "number") ? vClip.inPoint.seconds : 0;
                                var vOut = (vClip.outPoint && typeof vClip.outPoint.seconds === "number") ? vClip.outPoint.seconds : 0;
                                var vStart = (vClip.start && typeof vClip.start.seconds === "number") ? vClip.start.seconds : 0;
                                var vEnd = (vClip.end && typeof vClip.end.seconds === "number") ? vClip.end.seconds : 0;

                                clips.push({
                                    path: vPath,
                                    inPoint: vIn,
                                    outPoint: vOut,
                                    start: vStart,
                                    end: vEnd
                                });
                            }
                        } catch(e) {}
                    }
                }
            }
        }

        if (clips.length > 0) {
            return JSON.stringify({
                success: true,
                method: "clip_extraction",
                clips: clips,
                sequenceName: seq.name
            });
        }

        return JSON.stringify({
            error: "Unable to export sequence audio (" + exportError + ") and no audio/video media clips found on sequence tracks."
        });
    },

    insertSRTToTimeline: function(srtPath, targetType) {
        if (!app.project) {
            return JSON.stringify({ error: "No project open." });
        }
        var seq = app.project.activeSequence;
        if (!seq) {
            return JSON.stringify({ error: "No active sequence found." });
        }

        var srtFile = new File(srtPath);
        if (!srtFile.exists) {
            return JSON.stringify({ error: "SRT subtitle file not found: " + srtPath });
        }

        var cleanSrt = srtPath.replace(/\\/g, "/");

        // Import SRT file into project
        var prevCount = app.project.rootItem.children.numItems;
        app.project.importFiles([cleanSrt], false, app.project.rootItem, false);

        // Find the imported project item
        var srtItem = null;
        for (var i = app.project.rootItem.children.numItems - 1; i >= 0; i--) {
            var item = app.project.rootItem.children[i];
            if (item && item.getMediaPath) {
                try {
                    if (item.getMediaPath().toLowerCase() === cleanSrt.toLowerCase()) {
                        srtItem = item;
                        break;
                    }
                } catch(e) {}
            }
        }

        if (!srtItem) {
            for (var k = app.project.rootItem.children.numItems - 1; k >= 0; k--) {
                var it = app.project.rootItem.children[k];
                if (it && it.name && (it.name.indexOf(".srt") !== -1 || it.name.indexOf(srtFile.name) !== -1)) {
                    srtItem = it;
                    break;
                }
            }
        }

        if (!srtItem && app.project.rootItem.children.numItems > prevCount) {
            srtItem = app.project.rootItem.children[app.project.rootItem.children.numItems - 1];
        }

        if (!srtItem) {
            return JSON.stringify({ error: "Subtitles were imported into project, but project item reference could not be resolved." });
        }

        var placed = false;
        var methodUsed = "";

        // METHOD 1: Native Sequence createCaptionTrack
        if (typeof seq.createCaptionTrack === "function") {
            try {
                // Try with numeric 0
                seq.createCaptionTrack(srtItem, 0);
                placed = true;
                methodUsed = "Caption Track (Native)";
            } catch (err1) {
                // Try with Time object
                try {
                    var tObj = (typeof Time !== "undefined") ? new Time() : null;
                    if (tObj) {
                        tObj.seconds = 0;
                        seq.createCaptionTrack(srtItem, tObj);
                        placed = true;
                        methodUsed = "Caption Track (Time Object)";
                    }
                } catch(err1b) {
                    methodUsed = "createCaptionTrack: " + err1.toString();
                }
            }
        }

        // METHOD 2: QE DOM createCaptionTrack
        if (!placed && typeof qe !== "undefined" && qe.project) {
            try {
                var qeSeq = qe.project.getActiveSequence();
                if (qeSeq && typeof qeSeq.createCaptionTrack === "function") {
                    qeSeq.createCaptionTrack(srtItem, 0);
                    placed = true;
                    methodUsed = "Caption Track (QE DOM)";
                }
            } catch (err2) {
                methodUsed += " | QE err: " + err2.toString();
            }
        }

        // METHOD 3: Video Track Insertion
        if (!placed && seq.videoTracks && seq.videoTracks.numTracks > 0) {
            try {
                var topTrack = seq.videoTracks[seq.videoTracks.numTracks - 1];
                topTrack.insertClip(srtItem, 0);
                placed = true;
                methodUsed = "Video Track " + seq.videoTracks.numTracks;
            } catch (err3) {
                methodUsed += " | VideoTrack err: " + err3.toString();
            }
        }

        // If targetType is "graphics", upgrade caption track to Essential Graphics
        if (placed && targetType === "graphics") {
            try {
                var cmdId = (typeof app.findMenuCommandId === "function") ? app.findMenuCommandId("Upgrade Caption to Graphic") : 0;
                if (!cmdId) cmdId = 12586;
                app.executeCommand(cmdId);
                methodUsed += " -> Upgraded to Essential Graphics";
            } catch (upgradeErr) {
                // Kept as caption track if upgrade command is not in current context
            }
        }

        return JSON.stringify({
            success: true,
            placed: placed,
            method: methodUsed,
            itemName: srtItem.name
        });
    }
};
