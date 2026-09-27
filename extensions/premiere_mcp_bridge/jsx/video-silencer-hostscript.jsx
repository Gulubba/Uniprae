// Adobe Premiere Pro ExtendScript Host for Video Silencer

if (typeof app !== "undefined" && app.enableQE) {
    try {
        app.enableQE();
        if (typeof qe !== "undefined" && qe.setDebugDatabaseEntry) {
            qe.setDebugDatabaseEntry("dvascripting.EnabledInternalDOM", "true");
        }
    } catch (e) {}
}

var VideoSilencer = {
    /**
     * Find sequence object by ID, exact name, or stripped name
     */
    findSequenceByNameOrId: function(name, id) {
        if (!app.project || !app.project.sequences) return null;
        
        // 1. By ID
        if (id) {
            for (var i = 0; i < app.project.sequences.numSequences; i++) {
                var sId = app.project.sequences[i];
                if (sId && sId.sequenceID === id) return sId;
            }
        }

        // 2. By exact name
        if (name) {
            for (var j = 0; j < app.project.sequences.numSequences; j++) {
                var sName = app.project.sequences[j];
                if (sName && sName.name === name) return sName;
            }

            // 3. By cleaned name (removing track suffixes like " [V]", " [A]", " [V1]", " [A1]", or " (Nested)")
            var clean = name.replace(/\s*\[[VA\d]+\]\s*$/i, "")
                            .replace(/\s*\(nested\)\s*$/i, "")
                            .replace(/\s*\(silenced cuts\)\s*$/i, "")
                            .replace(/^\s+|\s+$/g, "");
            for (var k = 0; k < app.project.sequences.numSequences; k++) {
                var sClean = app.project.sequences[k];
                if (sClean && sClean.name === clean) return sClean;
            }
        }

        return null;
    },

    /**
     * Extract atomic media file path from a project item
     */
    getDirectMediaPath: function(projectItem) {
        if (!projectItem) return null;

        try {
            if (typeof projectItem.getMediaPath === "function") {
                var path = projectItem.getMediaPath();
                if (path && path.length > 0) return path;
            }
        } catch (e) {}

        try {
            if (projectItem.mediaPath && projectItem.mediaPath.length > 0) {
                return projectItem.mediaPath;
            }
        } catch (e) {}

        return null;
    },

    /**
     * Recursively resolve the atomic media file from a clip (unwrapping nested sequences if needed)
     */
    resolveMediaFromClip: function(clip, depth) {
        if (!clip) return null;
        if (typeof depth === "undefined") depth = 0;
        if (depth > 6) return null; // Prevent infinite loop

        var pItem = clip.projectItem;

        // 1. Check if clip has direct atomic media
        var directPath = this.getDirectMediaPath(pItem);
        if (directPath) {
            return {
                clipName: clip.name,
                sourceName: (pItem && pItem.name) ? pItem.name : clip.name,
                mediaPath: directPath,
                inPoint: (clip.inPoint && typeof clip.inPoint.seconds === "number") ? clip.inPoint.seconds : 0,
                outPoint: (clip.outPoint && typeof clip.outPoint.seconds === "number") ? clip.outPoint.seconds : 0,
                isNested: false
            };
        }

        // 2. If direct media is empty, it may be a Nested Sequence!
        var targetSeq = null;
        if (pItem) {
            targetSeq = this.findSequenceByNameOrId(pItem.name, pItem.sequenceID);
        }
        if (!targetSeq) {
            targetSeq = this.findSequenceByNameOrId(clip.name, null);
        }

        if (targetSeq) {
            // Scan audio tracks of the nested sequence
            for (var a = 0; a < targetSeq.audioTracks.numTracks; a++) {
                var aTrk = targetSeq.audioTracks[a];
                for (var ac = 0; ac < aTrk.clips.numItems; ac++) {
                    var aRes = this.resolveMediaFromClip(aTrk.clips[ac], depth + 1);
                    if (aRes) {
                        return {
                            clipName: clip.name,
                            sourceName: aRes.sourceName,
                            mediaPath: aRes.mediaPath,
                            inPoint: (clip.inPoint && typeof clip.inPoint.seconds === "number") ? clip.inPoint.seconds : aRes.inPoint,
                            outPoint: (clip.outPoint && typeof clip.outPoint.seconds === "number") ? clip.outPoint.seconds : aRes.outPoint,
                            isNested: true,
                            nestedSequenceName: targetSeq.name
                        };
                    }
                }
            }

            // Scan video tracks of the nested sequence
            for (var v = 0; v < targetSeq.videoTracks.numTracks; v++) {
                var vTrk = targetSeq.videoTracks[v];
                for (var vc = 0; vc < vTrk.clips.numItems; vc++) {
                    var vRes = this.resolveMediaFromClip(vTrk.clips[vc], depth + 1);
                    if (vRes) {
                        return {
                            clipName: clip.name,
                            sourceName: vRes.sourceName,
                            mediaPath: vRes.mediaPath,
                            inPoint: (clip.inPoint && typeof clip.inPoint.seconds === "number") ? clip.inPoint.seconds : vRes.inPoint,
                            outPoint: (clip.outPoint && typeof clip.outPoint.seconds === "number") ? clip.outPoint.seconds : vRes.outPoint,
                            isNested: true,
                            nestedSequenceName: targetSeq.name
                        };
                    }
                }
            }
        }

        return null;
    },

    /**
     * Get active sequence basic info
     */
    getActiveSequenceInfo: function() {
        if (!app.project) {
            return JSON.stringify({ error: "No project is currently open in Premiere Pro." });
        }
        var seq = app.project.activeSequence;
        if (!seq) {
            return JSON.stringify({ error: "No active sequence found. Please open a sequence in the timeline." });
        }
        return JSON.stringify({
            success: true,
            name: seq.name,
            sequenceID: seq.sequenceID
        });
    },

    /**
     * Retrieve the source media path from selected clip(s) or active timeline,
     * automatically unwrapping nested sequences or exporting audio if necessary.
     */
    getSelectedOrTimelineMedia: function() {
        if (!app.project) {
            return JSON.stringify({ error: "No project open in Premiere Pro." });
        }
        var seq = app.project.activeSequence;
        if (!seq) {
            return JSON.stringify({ error: "No active sequence found. Please click or open a sequence on your timeline." });
        }

        // 1. Try getSelection() first (user highlighted specific clip(s))
        try {
            var selection = (typeof seq.getSelection === "function") ? seq.getSelection() : null;
            if (selection && selection.length > 0) {
                for (var s = 0; s < selection.length; s++) {
                    var selClip = selection[s];
                    var selRes = this.resolveMediaFromClip(selClip, 0);
                    if (selRes && selRes.mediaPath) {
                        return JSON.stringify({
                            success: true,
                            isSelection: true,
                            clipName: selRes.clipName,
                            sourceName: selRes.sourceName,
                            mediaPath: selRes.mediaPath,
                            inPoint: selRes.inPoint,
                            outPoint: selRes.outPoint,
                            isNested: selRes.isNested || false,
                            nestedSequenceName: selRes.nestedSequenceName || "",
                            sequenceName: seq.name
                        });
                    }
                }
            }
        } catch (selErr) {}

        // 2. Scan audio tracks of the active sequence
        for (var a = 0; a < seq.audioTracks.numTracks; a++) {
            var aTrack = seq.audioTracks[a];
            for (var ac = 0; ac < aTrack.clips.numItems; ac++) {
                var aClip = aTrack.clips[ac];
                var aRes = this.resolveMediaFromClip(aClip, 0);
                if (aRes && aRes.mediaPath) {
                    return JSON.stringify({
                        success: true,
                        isSelection: false,
                        clipName: aRes.clipName,
                        sourceName: aRes.sourceName,
                        mediaPath: aRes.mediaPath,
                        inPoint: aRes.inPoint,
                        outPoint: aRes.outPoint,
                        isNested: aRes.isNested || false,
                        nestedSequenceName: aRes.nestedSequenceName || "",
                        sequenceName: seq.name
                    });
                }
            }
        }

        // 3. Scan video tracks of the active sequence
        for (var v = 0; v < seq.videoTracks.numTracks; v++) {
            var vTrack = seq.videoTracks[v];
            for (var vc = 0; vc < vTrack.clips.numItems; vc++) {
                var vClip = vTrack.clips[vc];
                var vRes = this.resolveMediaFromClip(vClip, 0);
                if (vRes && vRes.mediaPath) {
                    return JSON.stringify({
                        success: true,
                        isSelection: false,
                        clipName: vRes.clipName,
                        sourceName: vRes.sourceName,
                        mediaPath: vRes.mediaPath,
                        inPoint: vRes.inPoint,
                        outPoint: vRes.outPoint,
                        isNested: vRes.isNested || false,
                        nestedSequenceName: vRes.nestedSequenceName || "",
                        sequenceName: seq.name
                    });
                }
            }
        }

        // 4. Check if any project item has a media path (e.g. from the project bin)
        for (var p = 0; p < app.project.rootItem.children.numItems; p++) {
            var pChild = app.project.rootItem.children[p];
            var pPath = this.getDirectMediaPath(pChild);
            if (pPath) {
                return JSON.stringify({
                    success: true,
                    isSelection: false,
                    clipName: pChild.name,
                    sourceName: pChild.name,
                    mediaPath: pPath,
                    inPoint: 0,
                    outPoint: 0,
                    isNested: false,
                    sequenceName: seq.name
                });
            }
        }

        return JSON.stringify({
            error: "Could not find source media on the timeline or nested sequences. Please ensure your clip or nested sequence contains a video/audio file."
        });
    },

    /**
     * Fallback export of timeline audio directly (handles complex multi-clip or nested sequences)
     */
    exportTimelineAudio: function(outputPath) {
        if (!app.project) return JSON.stringify({ error: "No project open." });
        var seq = app.project.activeSequence;
        if (!seq) return JSON.stringify({ error: "No active sequence found." });

        var targetFile = new File(outputPath);
        if (targetFile.exists) {
            try { targetFile.remove(); } catch(e) {}
        }

        var candidatePresets = [
            "C:/Program Files/Adobe/Adobe Premiere Pro 2025/MediaIO/systempresets/3F3F3F3F_57415645/Waveform Audio 48kHz 16-bit.epr",
            "C:/Program Files/Adobe/Adobe Premiere Pro 2025/MediaIO/systempresets/3F3F3F3F_4D503320/MP3 128kbps.epr",
            "C:/Program Files/Adobe/Adobe Media Encoder 2025/MediaIO/systempresets/3F3F3F3F_57415645/Waveform Audio 48kHz 16-bit.epr",
            "C:/Program Files/Adobe/Adobe Media Encoder 2025/MediaIO/systempresets/3F3F3F3F_4D503320/MP3 128kbps.epr"
        ];

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

                    var encodeFlag = 0;
                    if (typeof app.encoder !== "undefined" && typeof app.encoder.ENCODE_ENTIRE !== "undefined") {
                        encodeFlag = app.encoder.ENCODE_ENTIRE;
                    }

                    var res = seq.exportAsMediaDirect(actualOut, pFile.fsName, encodeFlag);
                    var check = new File(actualOut);
                    if (check.exists && check.length > 0) {
                        return JSON.stringify({
                            success: true,
                            mediaPath: actualOut,
                            clipName: seq.name + " (Audio Mix)",
                            sequenceName: seq.name
                        });
                    }
                } catch(e) {}
            }
        }

        return JSON.stringify({ error: "Could not export timeline audio." });
    },

    /**
     * Import generated FCPXML / Premiere XML and open the newly clipped sequence
     */
    importCutSequenceXml: function(xmlPath, sequenceName) {
        if (!app.project) {
            return JSON.stringify({ error: "No project open." });
        }

        var cleanPath = xmlPath.replace(/\\/g, "/");
        var targetFile = new File(cleanPath);
        if (!targetFile.exists) {
            return JSON.stringify({ error: "Generated XML file does not exist: " + cleanPath });
        }

        // Map existing sequences to identify the newly added one
        var seqMapBefore = {};
        for (var i = 0; i < app.project.sequences.numSequences; i++) {
            seqMapBefore[app.project.sequences[i].sequenceID] = true;
        }

        // Import XML into root bin
        try {
            app.project.importFiles([cleanPath], true, app.project.rootItem, false);
        } catch (impErr) {
            return JSON.stringify({ error: "Failed to import XML into Premiere Pro: " + impErr.toString() });
        }

        // Find newly imported sequence
        var newSeq = null;
        for (var j = 0; j < app.project.sequences.numSequences; j++) {
            var currentSeq = app.project.sequences[j];
            if (!seqMapBefore[currentSeq.sequenceID]) {
                newSeq = currentSeq;
                break;
            }
        }

        if (newSeq) {
            var desiredName = sequenceName || "Silenced";
            try { newSeq.name = desiredName; } catch (renameErr) {}
            try { if (newSeq.projectItem) newSeq.projectItem.name = desiredName; } catch (renameItemErr) {}
            try {
                app.project.activeSequence = newSeq;
            } catch (e) {}
            try {
                if (typeof app.project.openSequence === "function") {
                    app.project.openSequence(newSeq.sequenceID);
                }
            } catch (e) {}

            return JSON.stringify({
                success: true,
                sequenceName: newSeq.name || desiredName,
                sequenceID: newSeq.sequenceID,
                message: "Sequence '" + newSeq.name + "' created and opened in timeline."
            });
        }

        // Fallback: Check project items for newly created sequence item
        for (var c = 0; c < app.project.rootItem.children.numItems; c++) {
            var child = app.project.rootItem.children[c];
            if (child && typeof child.isSequence === "function" && child.isSequence()) {
                return JSON.stringify({
                    success: true,
                    sequenceName: child.name,
                    message: "Imported into project bin as: " + child.name
                });
            }
        }

        return JSON.stringify({
            success: true,
            message: "XML imported into project bin successfully."
        });
    },

    /**
     * Import rendered media file directly into project
     */
    importRenderedMedia: function(mediaPath) {
        if (!app.project) {
            return JSON.stringify({ error: "No project open." });
        }
        var cleanPath = mediaPath.replace(/\\/g, "/");
        var targetFile = new File(cleanPath);
        if (!targetFile.exists) {
            return JSON.stringify({ error: "Media file not found: " + cleanPath });
        }
        try {
            app.project.importFiles([cleanPath], true, app.project.rootItem, false);
            return JSON.stringify({ success: true, message: "Imported rendered media: " + targetFile.name });
        } catch (e) {
            return JSON.stringify({ error: "Error importing media: " + e.toString() });
        }
    }
};
#include "timeline-cuts.jsx"
