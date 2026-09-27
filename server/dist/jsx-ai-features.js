/**
 * AI-Native Features JSX Templates
 * Covers: describe comp (semantic), find layer (fuzzy search), template engine, batch compose
 */
import { sanitizeForJsx, buildCompTarget } from "./jsx-helpers.js";
// ═══════════════════════════════════════════════════════════════
// Describe Comp (Semantic Description for LLM Context)
// ═══════════════════════════════════════════════════════════════
export function buildDescribeCompJsx(compName) {
    return `
(function() {
  try {
    ${buildCompTarget(compName)}

    var desc = [];
    desc.push("Composition: " + comp.name);
    desc.push("Resolution: " + comp.width + "x" + comp.height + " @ " + comp.frameRate + "fps");
    desc.push("Duration: " + comp.duration.toFixed(2) + " seconds");
    desc.push("Total Layers: " + comp.numLayers);
    desc.push("");

    var layerDescs = [];
    for (var i = 1; i <= comp.numLayers; i++) {
      var l = comp.layer(i);
      var type = "Unknown";
      if (l instanceof TextLayer) type = "Text";
      else if (l instanceof ShapeLayer) type = "Shape";
      else if (l instanceof CameraLayer) type = "Camera";
      else if (l instanceof LightLayer) type = "Light";
      else if (l.nullLayer) type = "Null";
      else if (l.adjustmentLayer) type = "Adjustment";
      else if (l.source && l.source instanceof CompItem) type = "Precomp";
      else type = "AV/Solid";

      var layerDesc = "#" + l.index + " [" + type + "] '" + l.name + "'";

      // Add key details
      var details = [];
      if (!l.enabled) details.push("hidden");
      if (l.threeDLayer) details.push("3D");
      if (l.motionBlur) details.push("motion-blur");
      if (l.parent) details.push("parented-to:'" + l.parent.name + "'");
      if (l.locked) details.push("locked");
      if (l.adjustmentLayer) details.push("adjustment");

      // Timing
      details.push("in:" + l.inPoint.toFixed(2) + "s out:" + l.outPoint.toFixed(2) + "s");

      // Transform summary
      try {
        var pos = l.property("ADBE Transform Group").property("ADBE Position").value;
        details.push("pos:[" + Math.round(pos[0]) + "," + Math.round(pos[1]) + "]");
        var opac = l.property("ADBE Transform Group").property("ADBE Opacity").value;
        if (opac < 100) details.push("opacity:" + Math.round(opac) + "%");
      } catch(e) {}

      // Effects
      try {
        var fx = l.property("ADBE Effect Parade");
        if (fx && fx.numProperties > 0) {
          var fxNames = [];
          for (var f = 1; f <= fx.numProperties; f++) {
            fxNames.push(fx.property(f).name);
          }
          details.push("effects:[" + fxNames.join(", ") + "]");
        }
      } catch(e) {}

      // Text content
      if (l instanceof TextLayer) {
        try {
          var textDoc = l.property("ADBE Text Properties").property("ADBE Text Document").value;
          var textContent = textDoc.text;
          if (textContent.length > 50) textContent = textContent.substring(0, 50) + "...";
          details.push("text:'" + textContent + "'");
        } catch(e) {}
      }

      // Blend mode
      try {
        if (l.blendingMode !== BlendingMode.NORMAL) {
          details.push("blend:" + l.blendingMode.toString());
        }
      } catch(e) {}

      if (details.length > 0) layerDesc += " {" + details.join(", ") + "}";
      layerDescs.push(layerDesc);
    }

    desc.push("--- Layer Stack (top to bottom) ---");
    for (var d = 0; d < layerDescs.length; d++) {
      desc.push(layerDescs[d]);
    }

    return { success: true, description: desc.join("\\n"), compName: comp.name };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
})();
  `.trim();
}
export function buildFindLayerJsx(opts) {
    return `
(function() {
  try {
    ${buildCompTarget(opts.compName)}

    var query = "${sanitizeForJsx(opts.query)}".toLowerCase();
    var results = [];

    for (var i = 1; i <= comp.numLayers; i++) {
      var l = comp.layer(i);
      var score = 0;
      var matchReasons = [];

      var lName = l.name.toLowerCase();
      var lType = "";
      if (l instanceof TextLayer) lType = "text";
      else if (l instanceof ShapeLayer) lType = "shape";
      else if (l instanceof CameraLayer) lType = "camera";
      else if (l instanceof LightLayer) lType = "light";
      else if (l.nullLayer) lType = "null";
      else if (l.adjustmentLayer) lType = "adjustment";
      else if (l.source && l.source instanceof CompItem) lType = "precomp";
      else lType = "solid";

      // Exact name match
      if (lName === query) { score += 100; matchReasons.push("exact name match"); }
      // Name contains query
      else if (lName.indexOf(query) >= 0) { score += 60; matchReasons.push("name contains query"); }
      // Query contains layer name
      else if (query.indexOf(lName) >= 0) { score += 40; matchReasons.push("query contains name"); }

      // Type match
      if (query.indexOf(lType) >= 0) { score += 30; matchReasons.push("type match: " + lType); }

      // Color keywords for text/solid layers
      var colorWords = ["red", "blue", "green", "white", "black", "yellow", "cyan", "magenta", "orange", "purple", "pink"];
      for (var c = 0; c < colorWords.length; c++) {
        if (query.indexOf(colorWords[c]) >= 0) {
          // Check if layer name contains this color
          if (lName.indexOf(colorWords[c]) >= 0) { score += 25; matchReasons.push("color in name: " + colorWords[c]); }
          // Check actual text color
          if (l instanceof TextLayer) {
            try {
              var td = l.property("ADBE Text Properties").property("ADBE Text Document").value;
              var fc = td.fillColor;
              // Rough color matching
              if (colorWords[c] === "red" && fc[0] > 0.7 && fc[1] < 0.3 && fc[2] < 0.3) { score += 20; matchReasons.push("text fill is red"); }
              if (colorWords[c] === "blue" && fc[2] > 0.7 && fc[0] < 0.3) { score += 20; matchReasons.push("text fill is blue"); }
              if (colorWords[c] === "green" && fc[1] > 0.7 && fc[0] < 0.3 && fc[2] < 0.3) { score += 20; matchReasons.push("text fill is green"); }
              if (colorWords[c] === "white" && fc[0] > 0.9 && fc[1] > 0.9 && fc[2] > 0.9) { score += 20; matchReasons.push("text fill is white"); }
            } catch(e) {}
          }
        }
      }

      // Text content match
      if (l instanceof TextLayer) {
        try {
          var textContent = l.property("ADBE Text Properties").property("ADBE Text Document").value.text.toLowerCase();
          if (textContent.indexOf(query) >= 0) { score += 50; matchReasons.push("text content match"); }
        } catch(e) {}
      }

      // Background keyword
      if (query.indexOf("background") >= 0 || query.indexOf("bg") >= 0) {
        if (lName.indexOf("bg") >= 0 || lName.indexOf("background") >= 0) { score += 40; matchReasons.push("background keyword"); }
        if (l.index === comp.numLayers) { score += 15; matchReasons.push("bottom layer"); }
      }

      // Keywords: "top", "bottom", "first", "last"
      if (query.indexOf("top") >= 0 && l.index === 1) { score += 20; matchReasons.push("top layer"); }
      if (query.indexOf("bottom") >= 0 && l.index === comp.numLayers) { score += 20; matchReasons.push("bottom layer"); }

      if (score > 0) {
        results.push({
          index: l.index,
          name: l.name,
          type: lType,
          score: score,
          matchReasons: matchReasons
        });
      }
    }

    // Sort by score descending
    results.sort(function(a, b) { return b.score - a.score; });

    return { success: true, query: "${sanitizeForJsx(opts.query)}", results: results, totalMatches: results.length };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
})();
  `.trim();
}
export function buildCreateTemplateJsx(opts) {
    const cleanPath = opts.outputPath.replace(/\\/g, "/");
    return `
(function() {
  try {
    ${buildCompTarget(opts.compName)}

    // Serialize comp structure to JSON template
    var template = {
      name: "${sanitizeForJsx(opts.templateName)}",
      created: new Date().toString(),
      comp: {
        name: comp.name,
        width: comp.width,
        height: comp.height,
        fps: comp.frameRate,
        duration: comp.duration
      },
      layers: []
    };

    for (var i = 1; i <= comp.numLayers; i++) {
      var l = comp.layer(i);
      var layerData = {
        index: l.index,
        name: l.name,
        type: l instanceof TextLayer ? "text" : l instanceof ShapeLayer ? "shape" : l instanceof CameraLayer ? "camera" : l instanceof LightLayer ? "light" : l.nullLayer ? "null" : "solid",
        enabled: l.enabled,
        threeDLayer: l.threeDLayer,
        parent: l.parent ? l.parent.name : null,
        inPoint: l.inPoint,
        outPoint: l.outPoint,
        transform: {}
      };

      // Capture transform values
      try {
        var tf = l.property("ADBE Transform Group");
        layerData.transform.position = tf.property("ADBE Position").value;
        layerData.transform.scale = tf.property("ADBE Scale").value;
        layerData.transform.rotation = tf.property("ADBE Rotation").value;
        layerData.transform.opacity = tf.property("ADBE Opacity").value;
      } catch(e) {}

      // Capture text content
      if (l instanceof TextLayer) {
        try {
          var td = l.property("ADBE Text Properties").property("ADBE Text Document").value;
          layerData.textContent = td.text;
          layerData.fontSize = td.fontSize;
          layerData.font = td.font;
          layerData.fillColor = [td.fillColor[0], td.fillColor[1], td.fillColor[2]];
        } catch(e) {}
      }

      // Capture effects list
      layerData.effects = [];
      try {
        var fx = l.property("ADBE Effect Parade");
        if (fx) {
          for (var f = 1; f <= fx.numProperties; f++) {
            layerData.effects.push({ name: fx.property(f).name, matchName: fx.property(f).matchName });
          }
        }
      } catch(e) {}

      template.layers.push(layerData);
    }

    // Write template to JSON file
    var outFile = new File("${cleanPath}");
    outFile.open("w");
    outFile.write(JSON.stringify(template));
    outFile.close();

    return { success: true, templateName: template.name, outputPath: outFile.fsName, layerCount: template.layers.length };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
})();
  `.trim();
}
export function buildLoadTemplateJsx(opts) {
    const cleanPath = opts.templatePath.replace(/\\/g, "/");
    return `
(function() {
  try {
    app.beginUndoGroup("MCP Load Template");
    var f = new File("${cleanPath}");
    if (!f.exists) return { success: false, error: "Template file not found" };

    f.open("r");
    var templateJson = f.read();
    f.close();

    var template = eval("(" + templateJson + ")");
    if (!template || !template.comp) return { success: false, error: "Invalid template format" };

    // Create new composition from template
    var compName = ${opts.newCompName ? `"${sanitizeForJsx(opts.newCompName)}"` : "template.comp.name + '_from_template'"};
    var comp = app.project.items.addComp(compName, template.comp.width, template.comp.height, 1.0, template.comp.duration, template.comp.fps);

    var substitutions = ${JSON.stringify(opts.substitutions || {})};

    // Recreate layers (bottom to top)
    for (var i = template.layers.length - 1; i >= 0; i--) {
      var ld = template.layers[i];
      var newLayer;

      if (ld.type === "text") {
        var textContent = substitutions[ld.name] || ld.textContent || ld.name;
        newLayer = comp.layers.addText(textContent);
        newLayer.name = ld.name;

        // Apply text formatting
        try {
          var textProp = newLayer.property("ADBE Text Properties").property("ADBE Text Document");
          var td = textProp.value;
          if (ld.fontSize) td.fontSize = ld.fontSize;
          if (ld.font) td.font = ld.font;
          if (ld.fillColor) td.fillColor = ld.fillColor;
          textProp.setValue(td);
        } catch(e) {}
      } else if (ld.type === "null") {
        newLayer = comp.layers.addNull();
        newLayer.name = ld.name;
      } else if (ld.type === "shape") {
        newLayer = comp.layers.addShape();
        newLayer.name = ld.name;
      } else {
        // Default to solid
        newLayer = comp.layers.addSolid([0.5, 0.5, 0.5], ld.name, comp.width, comp.height, 1.0, comp.duration);
      }

      // Apply transform
      if (ld.transform) {
        try {
          var tf = newLayer.property("ADBE Transform Group");
          if (ld.transform.position) tf.property("ADBE Position").setValue(ld.transform.position);
          if (ld.transform.scale) tf.property("ADBE Scale").setValue(ld.transform.scale);
          if (ld.transform.rotation !== undefined) tf.property("ADBE Rotation").setValue(ld.transform.rotation);
          if (ld.transform.opacity !== undefined) tf.property("ADBE Opacity").setValue(ld.transform.opacity);
        } catch(e) {}
      }

      // Apply flags
      if (ld.threeDLayer) newLayer.threeDLayer = true;
      newLayer.enabled = ld.enabled !== false;
      if (ld.inPoint !== undefined) newLayer.inPoint = ld.inPoint;
      if (ld.outPoint !== undefined) newLayer.outPoint = ld.outPoint;
    }

    // Apply parenting (second pass)
    for (var j = 0; j < template.layers.length; j++) {
      var ld2 = template.layers[j];
      if (ld2.parent) {
        try {
          var childLayer = comp.layer(ld2.name);
          var parentLayer = comp.layer(ld2.parent);
          if (childLayer && parentLayer) childLayer.parent = parentLayer;
        } catch(e) {}
      }
    }

    comp.openInViewer();
    app.endUndoGroup();
    return { success: true, compName: comp.name, layersCreated: comp.numLayers };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
})();
  `.trim();
}
export function buildBatchComposeJsx(opts) {
    return `
(function() {
  try {
    app.beginUndoGroup("MCP Batch Compose");
    ${buildCompTarget(opts.compName)}

    var dataArray = ${JSON.stringify(opts.dataArray)};
    var prefix = "${sanitizeForJsx(opts.outputPrefix || "Batch")}";
    var createdComps = [];

    for (var d = 0; d < dataArray.length; d++) {
      var data = dataArray[d];
      var dupComp = comp.duplicate();
      dupComp.name = prefix + "_" + (d + 1);

      // Apply substitutions
      for (var layerName in data) {
        if (data.hasOwnProperty(layerName)) {
          try {
            var targetLayer = dupComp.layer(layerName);
            if (targetLayer && targetLayer instanceof TextLayer) {
              var textProp = targetLayer.property("ADBE Text Properties").property("ADBE Text Document");
              var td = textProp.value;
              td.text = data[layerName];
              textProp.setValue(td);
            }
          } catch(e) {}
        }
      }

      createdComps.push({ name: dupComp.name, id: dupComp.id });
    }

    app.endUndoGroup();
    return { success: true, createdComps: createdComps, count: createdComps.length };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
})();
  `.trim();
}
