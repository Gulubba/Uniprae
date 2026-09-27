/**
 * Advanced Render Pipeline & Motion Blur JSX Templates
 * Covers: motion blur, render settings, render status, cancel render, color management
 */
import { sanitizeForJsx, buildCompTarget, buildLayerRef } from "./jsx-helpers.js";
export function buildSetMotionBlurJsx(opts) {
    return `
(function() {
  try {
    app.beginUndoGroup("MCP Set Motion Blur");
    ${buildCompTarget(opts.compName)}

    // Comp-level master motion blur switch
    comp.motionBlur = ${opts.enabled};

    ${opts.shutterAngle !== undefined ? `comp.shutterAngle = ${opts.shutterAngle};` : ""}
    ${opts.shutterPhase !== undefined ? `comp.shutterPhase = ${opts.shutterPhase};` : ""}

    ${opts.layerIdentifier !== undefined ? `
    // Per-layer motion blur
    ${buildLayerRef(opts.layerIdentifier)}
    layer.motionBlur = ${opts.enabled};
    ` : `
    // Apply to all eligible layers if no specific layer given
    for (var i = 1; i <= comp.numLayers; i++) {
      try { comp.layer(i).motionBlur = ${opts.enabled}; } catch(e) {}
    }
    `}

    // Advanced render settings for motion blur quality
    ${opts.samplesPerFrame !== undefined || opts.adaptiveSampleLimit !== undefined ? `
    // These settings are applied via render queue items at render time
    // Store as comp comment for render queue reference
    var mblurSettings = "MB_SAMPLES:" + ${opts.samplesPerFrame || 16} + "|MB_ADAPTIVE:" + ${opts.adaptiveSampleLimit || 128};
    try { comp.comment = comp.comment ? comp.comment + "|" + mblurSettings : mblurSettings; } catch(e) {}
    ` : ""}

    app.endUndoGroup();
    return {
      success: true,
      compName: comp.name,
      motionBlur: comp.motionBlur,
      shutterAngle: comp.shutterAngle,
      shutterPhase: comp.shutterPhase
    };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
})();
  `.trim();
}
export function buildSetRenderSettingsJsx(opts) {
    const outputPath = opts.outputPath ? opts.outputPath.replace(/\\/g, "/") : null;
    // Map codec to output module template names (AE built-in templates)
    const codecTemplateMap = {
        h264: "H.264 - Match Render Settings - 15 Mbps",
        prores422: "Apple ProRes 422",
        prores4444: "Apple ProRes 4444",
        pngSequence: "PNG Sequence with Alpha",
        exr: "OpenEXR Sequence",
        tiff: "TIFF Sequence with Alpha",
    };
    return `
(function() {
  try {
    app.beginUndoGroup("MCP Set Render Settings");
    ${buildCompTarget(opts.compName)}

    // Set comp-level color depth
    ${opts.colorDepth ? `
    var depthMap = { "8bpc": 8, "16bpc": 16, "32bpc": 32 };
    if (depthMap["${opts.colorDepth}"]) {
      app.project.bitsPerChannel = depthMap["${opts.colorDepth}"];
    }
    ` : ""}

    // Add comp to render queue
    var rqItem = app.project.renderQueue.items.add(comp);

    // Render settings
    ${opts.quality ? `
    var qualityMap = { "best": RQItemStatus.NEEDS_OUTPUT, "draft": RQItemStatus.NEEDS_OUTPUT, "wireframe": RQItemStatus.NEEDS_OUTPUT };
    try {
      rqItem.applyTemplate("${opts.quality === "best" ? "Best Settings" : opts.quality === "draft" ? "Draft Settings" : "Best Settings"}");
    } catch(e) {}
    ` : `
    try { rqItem.applyTemplate("Best Settings"); } catch(e) {}
    `}

    // Resolution
    ${opts.resolution ? `
    var resMap = { "full": [1,1], "half": [2,2], "third": [3,3], "quarter": [4,4] };
    var resFactor = ${opts.resolutionFactor ? JSON.stringify(opts.resolutionFactor) : `resMap["${opts.resolution}"] || [1,1]`};
    comp.resolutionFactor = resFactor;
    ` : ""}

    // Motion Blur Override in render settings
    ${opts.motionBlurOverride ? `
    try {
      var rs = rqItem.getSettings(GetSettingsFormat.SPEC);
      // Motion blur is typically controlled via "Use Comp's Settings" in render settings
      // We enable it at comp level for "on"
      if ("${opts.motionBlurOverride}" === "on") { comp.motionBlur = true; }
      else if ("${opts.motionBlurOverride}" === "off") { comp.motionBlur = false; }
    } catch(e) {}
    ` : ""}

    // Frame blending
    ${opts.frameBlending ? `
    try {
      if ("${opts.frameBlending}" === "on") {
        comp.frameBlending = true;
      } else if ("${opts.frameBlending}" === "off") {
        comp.frameBlending = false;
      }
    } catch(e) {}
    ` : ""}

    // Output Module Configuration
    var om = rqItem.outputModule(1);

    // Apply codec template
    ${opts.codec ? `
    try {
      var templateName = "${codecTemplateMap[opts.codec] || "Lossless"}";
      om.applyTemplate(templateName);
    } catch(e) {
      // If specific template not found, try common alternatives
      try {
        var fallbackTemplates = {
          "h264": ["H.264", "H264", "MPEG-4"],
          "prores422": ["Apple ProRes 422", "ProRes 422"],
          "prores4444": ["Apple ProRes 4444", "ProRes 4444"],
          "pngSequence": ["PNG Sequence", "PNG Sequence with Alpha"],
          "exr": ["OpenEXR", "OpenEXR Sequence"],
          "tiff": ["TIFF Sequence", "TIFF Sequence with Alpha"]
        };
        var alts = fallbackTemplates["${opts.codec}"];
        if (alts) {
          for (var t = 0; t < alts.length; t++) {
            try { om.applyTemplate(alts[t]); break; } catch(ex) {}
          }
        }
      } catch(e2) {}
    }
    ` : ""}

    // Output path
    ${outputPath ? `
    var outFile = new File("${outputPath}");
    om.file = outFile;
    ` : ""}

    var result = {
      success: true,
      compName: comp.name,
      renderQueueItem: rqItem.comp.name,
      outputPath: om.file ? om.file.fsName : null,
      status: "queued"
    };

    // Start render if requested
    ${opts.startRender ? `
    app.endUndoGroup();
    app.project.renderQueue.render();
    result.status = "rendering";
    return result;
    ` : `
    app.endUndoGroup();
    return result;
    `}
  } catch (err) {
    return { success: false, error: err.toString() };
  }
})();
  `.trim();
}
// ═══════════════════════════════════════════════════════════════
// Render Status
// ═══════════════════════════════════════════════════════════════
export function buildGetRenderStatusJsx() {
    return `
(function() {
  try {
    var rq = app.project.renderQueue;
    var items = [];
    for (var i = 1; i <= rq.numItems; i++) {
      var item = rq.item(i);
      var statusMap = {};
      statusMap[RQItemStatus.QUEUED] = "queued";
      statusMap[RQItemStatus.RENDERING] = "rendering";
      statusMap[RQItemStatus.DONE] = "done";
      statusMap[RQItemStatus.ERR_STOPPED] = "error_stopped";
      statusMap[RQItemStatus.USER_STOPPED] = "user_stopped";
      statusMap[RQItemStatus.NEEDS_OUTPUT] = "needs_output";
      statusMap[RQItemStatus.UNQUEUED] = "unqueued";

      items.push({
        index: i,
        compName: item.comp.name,
        status: statusMap[item.status] || "unknown",
        outputPath: item.outputModule(1).file ? item.outputModule(1).file.fsName : null,
        timeSpanStart: item.timeSpanStart,
        timeSpanDuration: item.timeSpanDuration,
        logType: item.logType || null
      });
    }

    return {
      success: true,
      rendering: rq.rendering,
      numItems: rq.numItems,
      items: items
    };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
})();
  `.trim();
}
// ═══════════════════════════════════════════════════════════════
// Cancel / Stop Render
// ═══════════════════════════════════════════════════════════════
export function buildCancelRenderJsx() {
    return `
(function() {
  try {
    var rq = app.project.renderQueue;
    if (rq.rendering) {
      rq.stopRendering();
      return { success: true, message: "Rendering stopped" };
    }
    return { success: true, message: "No active render to cancel" };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
})();
  `.trim();
}
// ═══════════════════════════════════════════════════════════════
// Start Render
// ═══════════════════════════════════════════════════════════════
export function buildStartRenderJsx() {
    return `
(function() {
  try {
    var rq = app.project.renderQueue;
    if (rq.numItems === 0) return { success: false, error: "Render queue is empty" };

    var queuedCount = 0;
    for (var i = 1; i <= rq.numItems; i++) {
      if (rq.item(i).status === RQItemStatus.QUEUED) queuedCount++;
    }
    if (queuedCount === 0) return { success: false, error: "No items queued for rendering" };

    rq.render();
    return { success: true, message: "Render started", queuedItems: queuedCount };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
})();
  `.trim();
}
export function buildSetColorSettingsJsx(opts) {
    return `
(function() {
  try {
    app.beginUndoGroup("MCP Set Color Settings");
    var proj = app.project;

    ${opts.bitsPerChannel !== undefined ? `proj.bitsPerChannel = ${opts.bitsPerChannel};` : ""}
    ${opts.linearize !== undefined ? `proj.linearBlending = ${opts.linearize};` : ""}
    ${opts.workingSpace ? `
    try {
      proj.workingSpace = "${sanitizeForJsx(opts.workingSpace)}";
    } catch(e) {
      // Working space name might differ by OS/locale
    }
    ` : ""}

    app.endUndoGroup();
    return {
      success: true,
      bitsPerChannel: proj.bitsPerChannel,
      linearBlending: proj.linearBlending,
      workingSpace: proj.workingSpace || "Not set"
    };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
})();
  `.trim();
}
export function buildApplyLutJsx(opts) {
    const cleanPath = opts.lutPath.replace(/\\/g, "/");
    return `
(function() {
  try {
    app.beginUndoGroup("MCP Apply LUT");
    ${buildCompTarget(opts.compName)}
    ${buildLayerRef(opts.layerIdentifier)}

    var lutFile = new File("${cleanPath}");
    if (!lutFile.exists) return { success: false, error: "LUT file not found: " + lutFile.fsName };

    // Apply "Apply Color LUT" effect
    var fx = layer.property("ADBE Effect Parade");
    var lutEffect = fx.addProperty("ADBE Apply Color LUT2");
    if (lutEffect) {
      // Set the LUT file path
      try {
        lutEffect.property("ADBE Apply Color LUT2-0002").setValue("${cleanPath}");
      } catch(e) {
        // Some AE versions use different property index
        try {
          lutEffect.property(2).setValue("${cleanPath}");
        } catch(e2) {}
      }
    }

    app.endUndoGroup();
    return { success: true, layerName: layer.name, lutFile: lutFile.name };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
})();
  `.trim();
}
