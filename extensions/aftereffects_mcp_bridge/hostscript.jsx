// ═══════════════════════════════════════════════════════════════════
// Adobe After Effects MCP Bridge - Host ExtendScript Engine
// ═══════════════════════════════════════════════════════════════════

// 1. JSON Polyfill for ExtendScript (ECMAScript 3 engine)
if (typeof JSON === "undefined") { JSON = {}; }
if (typeof JSON.stringify !== "function") {
    JSON.stringify = function(obj) {
        if (obj === null) return "null";
        if (typeof obj === "undefined") return undefined;
        if (typeof obj === "number" || typeof obj === "boolean") return String(obj);
        if (typeof obj === "string") return '"' + obj.replace(/\\/g,"\\\\").replace(/"/g,'\\"').replace(/\n/g,'\\n').replace(/\r/g,'\\r') + '"';
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

// 2. Bulletproof Undo Protection Guard (Anti-Mismatch & Normal Single Undo)
(function() {
    if (!$.global.__ae_mcp_undo_guard && typeof app !== "undefined" && app.beginUndoGroup) {
        $.global.__ae_mcp_undo_guard = true;
        var _realBegin = app.beginUndoGroup;
        var _realEnd = app.endUndoGroup;
        var _undoDepth = 0;

        app.beginUndoGroup = function(name) {
            try {
                if (_undoDepth === 0) {
                    _realBegin.call(app, name || "MCP Action");
                }
                _undoDepth++;
            } catch(e) {}
        };

        app.endUndoGroup = function() {
            try {
                if (_undoDepth > 0) {
                    _undoDepth--;
                    if (_undoDepth === 0) {
                        _realEnd.call(app);
                    }
                }
            } catch(e) {}
        };

        app.forceCleanUndoGroup = function() {
            while (_undoDepth > 0) {
                _undoDepth--;
                try { _realEnd.call(app); } catch(e) {}
            }
        };
    }
})();

var AeMCP = {
    ping: function() {
        try {
            var proj = app.project;
            var active = proj ? proj.activeItem : null;
            var activeInfo = null;

            if (active && active instanceof CompItem) {
                activeInfo = {
                    id: active.id,
                    name: active.name,
                    width: active.width,
                    height: active.height,
                    frameRate: active.frameRate,
                    duration: active.duration,
                    time: active.time,
                    numLayers: active.numLayers
                };
            }

            return JSON.stringify({
                status: "online",
                appName: app.name || "Adobe After Effects",
                appVersion: app.version || "Unknown",
                hasProject: (proj !== null && typeof proj !== "undefined"),
                projectName: (proj && proj.file) ? proj.file.name : (proj ? "Untitled Project" : null),
                activeComp: activeInfo
            });
        } catch(e) {
            return JSON.stringify({
                status: "online",
                appName: "Adobe After Effects",
                error: e.toString()
            });
        }
    },

    execute: function(codeStr) {
        try {
            var res = eval(codeStr);
            if (typeof res === "undefined" || res === null) {
                return JSON.stringify({ success: true, data: "OK" });
            }
            if (typeof res === "object") {
                return JSON.stringify(res);
            }
            return JSON.stringify({ success: true, data: res });
        } catch(err) {
            if (app.forceCleanUndoGroup) {
                try { app.forceCleanUndoGroup(); } catch(e) {}
            }
            var lineInfo = err.line ? " (Line " + err.line + ")" : "";
            return JSON.stringify({
                success: false,
                error: err.toString() + lineInfo
            });
        }
    },

    capturePreview: function(outPath) {
        try {
            var proj = app.project;
            if (!proj || !proj.activeItem || !(proj.activeItem instanceof CompItem)) {
                return JSON.stringify({ success: false, error: "No active composition found to capture frame preview." });
            }
            var comp = proj.activeItem;
            var f = new File(outPath);
            comp.saveFrameToPng(comp.time, f);
            return JSON.stringify({
                success: true,
                path: f.fsName,
                width: comp.width,
                height: comp.height,
                time: comp.time
            });
        } catch(e) {
            return JSON.stringify({ success: false, error: "Preview capture failed: " + e.toString() });
        }
    }
};
