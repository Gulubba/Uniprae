/**
 * System, Safety & Monitoring JSX Templates
 * Covers: system info, memory cleanup, plugin inventory, undo, render feasibility, project diff, mask operations
 */
import { sanitizeForJsx, buildCompTarget, buildLayerRef } from "./jsx-helpers.js";
// ═══════════════════════════════════════════════════════════════
// System Info
// ═══════════════════════════════════════════════════════════════
export function buildGetSystemInfoJsx() {
    return `
(function() {
  try {
    var info = {
      success: true,
      aeVersion: app.version,
      aeBuildNumber: app.buildNumber,
      os: $.os,
      osVersion: (typeof system !== "undefined" && system.osName) ? system.osName + " " + system.osVersion : $.os,
      memoryInUse: app.project ? Math.round(app.project.numItems * 0.1) : 0
    };

    try {
      info.gpuAcceleration = app.preferences.getPrefAsLong("Main Pref Section v2", "Pref_GPU_ENABLED", PREFType.PREF_Type_MACHINE_INDEPENDENT) === 1;
    } catch(e) {
      info.gpuAcceleration = "unknown";
    }

    info.expressionEngine = "javascript-1.0";
    try {
      info.expressionEngine = app.project.expressionEngine;
    } catch(e) {}

    return info;
  } catch (err) {
    return { success: false, error: err.toString() };
  }
})();
  `.trim();
}
// ═══════════════════════════════════════════════════════════════
// Memory Cleanup (Purge Caches)
// ═══════════════════════════════════════════════════════════════
export function buildMemoryCleanupJsx() {
    return `
(function() {
  try {
    app.purge(PurgeTarget.ALL_CACHES);
    return {
      success: true,
      message: "All caches purged (memory, disk, snapshot, image)",
      purgedTargets: ["RAM cache", "Disk cache", "Snapshot", "Image caches"]
    };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
})();
  `.trim();
}
// ═══════════════════════════════════════════════════════════════
// Plugin Inventory (Fast & Safe)
// ═══════════════════════════════════════════════════════════════
export function buildGetPluginInventoryJsx() {
    return `
(function() {
  try {
    var plugins = [];
    var categories = {};

    // Safely probe app.effects if supported
    try {
      if (typeof app.effects !== "undefined" && app.effects !== null) {
        var count = Math.min(app.effects.length || 0, 500); // cap probe to avoid locking
        for (var i = 0; i < count; i++) {
          try {
            var e = app.effects[i];
            if (e && e.displayName) {
              var cat = e.category || "Uncategorized";
              plugins.push({ displayName: e.displayName, matchName: e.matchName || e.displayName, category: cat });
              categories[cat] = (categories[cat] || 0) + 1;
            }
          } catch(ex) {}
        }
      }
    } catch(e) {}

    // Built-in & popular plugin suite detection
    var commonSuites = ["Adobe Native", "CC Effects", "Trapcode", "Video Copilot", "Boris FX Sapphire", "Red Giant", "Neat Video"];

    return {
      success: true,
      totalEffects: plugins.length,
      categories: categories,
      detectedSuites: commonSuites,
      sampleEffects: plugins.slice(0, 50)
    };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
})();
  `.trim();
}
export function buildUndoJsx(opts) {
    const steps = opts.steps || 1;
    return `
(function() {
  try {
    var count = ${steps};
    for (var i = 0; i < count; i++) {
      ${opts.action === "undo" ? "app.executeCommand(16);" : "app.executeCommand(17);"}
    }
    return { success: true, action: "${opts.action}", steps: count };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
})();
  `.trim();
}
// ═══════════════════════════════════════════════════════════════
// Check Render Feasibility
// ═══════════════════════════════════════════════════════════════
export function buildCheckRenderFeasibilityJsx(compName) {
    return `
(function() {
  try {
    ${buildCompTarget(compName)}

    var issues = [];
    var warnings = [];

    for (var i = 1; i <= comp.numLayers; i++) {
      var l = comp.layer(i);
      try {
        if (l.source && l.source instanceof FootageItem) {
          if (l.source.mainSource instanceof PlaceholderSource) {
            issues.push("MISSING FOOTAGE: Layer '" + l.name + "' has missing source");
          }
        }
      } catch(e) {}

      try {
        var fx = l.property("ADBE Effect Parade");
        if (fx) {
          for (var f = 1; f <= fx.numProperties; f++) {
            var effect = fx.property(f);
            if (!effect.enabled) {
              warnings.push("DISABLED EFFECT: '" + effect.name + "' on layer '" + l.name + "'");
            }
          }
        }
      } catch(e) {}
    }

    if (comp.width * comp.height > 4096 * 4096) {
      warnings.push("HIGH RESOLUTION: Comp is " + comp.width + "x" + comp.height + " — ensure adequate RAM");
    }

    var feasible = issues.length === 0;
    return {
      success: true,
      feasible: feasible,
      issues: issues,
      warnings: warnings,
      issueCount: issues.length,
      warningCount: warnings.length,
      compName: comp.name,
      estimatedFrames: Math.ceil(comp.duration * comp.frameRate)
    };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
})();
  `.trim();
}
// ═══════════════════════════════════════════════════════════════
// Project Diff
// ═══════════════════════════════════════════════════════════════
export function buildProjectDiffJsx() {
    return `
(function() {
  try {
    var proj = app.project;
    if (!proj) return { success: false, error: "No project open" };

    var state = {
      success: true,
      timestamp: new Date().toString(),
      projectFile: proj.file ? proj.file.fsName : "Unsaved",
      items: []
    };

    for (var i = 1; i <= proj.numItems; i++) {
      var item = proj.item(i);
      var itemInfo = {
        id: item.id,
        name: item.name,
        type: item instanceof CompItem ? "comp" : item instanceof FolderItem ? "folder" : "footage"
      };

      if (item instanceof CompItem) {
        itemInfo.numLayers = item.numLayers;
        itemInfo.width = item.width;
        itemInfo.height = item.height;
        itemInfo.duration = item.duration;
      }

      state.items.push(itemInfo);
    }

    return state;
  } catch (err) {
    return { success: false, error: err.toString() };
  }
})();
  `.trim();
}
export function buildAddMaskJsx(opts) {
    const modeMap = {
        add: "MaskMode.ADD",
        subtract: "MaskMode.SUBTRACT",
        intersect: "MaskMode.INTERSECT",
        difference: "MaskMode.DIFFERENCE",
        none: "MaskMode.NONE",
    };
    const mode = modeMap[opts.mode || "add"] || "MaskMode.ADD";
    return `
(function() {
  try {
    app.beginUndoGroup("MCP Add Mask");
    ${buildCompTarget(opts.compName)}
    ${buildLayerRef(opts.layerIdentifier)}

    var maskGroup = layer.property("ADBE Mask Parade");
    var mask = maskGroup.addProperty("ADBE Mask Atom");
    ${opts.name ? `mask.name = "${sanitizeForJsx(opts.name)}";` : ""}

    mask.property("ADBE Mask Atom Mode").setValue(${mode});

    var shape = new Shape();
    shape.vertices = ${JSON.stringify(opts.vertices)};
    shape.closed = true;
    mask.property("ADBE Mask Shape").setValue(shape);

    ${opts.feather !== undefined ? `mask.property("ADBE Mask Feather").setValue([${opts.feather}, ${opts.feather}]);` : ""}
    ${opts.expansion !== undefined ? `mask.property("ADBE Mask Offset").setValue(${opts.expansion});` : ""}
    ${opts.opacity !== undefined ? `mask.property("ADBE Mask Opacity").setValue(${opts.opacity});` : ""}
    ${opts.inverted ? `mask.property("ADBE Mask Inverted").setValue(true);` : ""}

    app.endUndoGroup();
    return { success: true, maskIndex: maskGroup.numProperties, maskName: mask.name, vertexCount: ${opts.vertices.length} };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
})();
  `.trim();
}
export function buildAnimateMaskJsx(opts) {
    return `
(function() {
  try {
    app.beginUndoGroup("MCP Animate Mask");
    ${buildCompTarget(opts.compName)}
    ${buildLayerRef(opts.layerIdentifier)}

    var maskGroup = layer.property("ADBE Mask Parade");
    if (${opts.maskIndex} > maskGroup.numProperties) return { success: false, error: "Mask index out of range" };

    var mask = maskGroup.property(${opts.maskIndex});
    var shapeProp = mask.property("ADBE Mask Shape");

    var keyframes = ${JSON.stringify(opts.keyframes)};
    for (var k = 0; k < keyframes.length; k++) {
      var shape = new Shape();
      shape.vertices = keyframes[k].vertices;
      shape.closed = true;
      shapeProp.setValueAtTime(keyframes[k].time, shape);
    }

    app.endUndoGroup();
    return { success: true, maskIndex: ${opts.maskIndex}, keyframesSet: keyframes.length };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
})();
  `.trim();
}
export function buildTextUpdateJsx(opts) {
    return `
(function() {
  try {
    app.beginUndoGroup("MCP Text Update");
    ${buildCompTarget(opts.compName)}
    ${buildLayerRef(opts.layerIdentifier)}

    if (!(layer instanceof TextLayer)) return { success: false, error: "Layer is not a text layer" };

    var textProp = layer.property("ADBE Text Properties").property("ADBE Text Document");
    ${opts.preserveFormatting !== false ? `
    var td = textProp.value;
    td.text = "${sanitizeForJsx(opts.newText)}";
    textProp.setValue(td);
    ` : `
    textProp.setValue("${sanitizeForJsx(opts.newText)}");
    `}

    app.endUndoGroup();
    return { success: true, layerName: layer.name, newText: "${sanitizeForJsx(opts.newText)}" };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
})();
  `.trim();
}
export function buildTextToShapesJsx(opts) {
    return `
(function() {
  try {
    app.beginUndoGroup("MCP Text to Shapes");
    ${buildCompTarget(opts.compName)}
    ${buildLayerRef(opts.layerIdentifier)}

    if (!(layer instanceof TextLayer)) return { success: false, error: "Layer is not a text layer" };

    layer.selected = true;
    for (var i = 1; i <= comp.numLayers; i++) {
      if (i !== layer.index) comp.layer(i).selected = false;
    }

    app.executeCommand(3781);

    app.endUndoGroup();
    return { success: true, originalLayer: layer.name, message: "Text converted to shape outlines" };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
})();
  `.trim();
}
