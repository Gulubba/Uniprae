/**
 * ExtendScript (JSX) generator templates for Adobe After Effects automation.
 * Wraps operations in try/catch blocks and sets `_result` JSON object for response parsing.
 */
import os from "os";
/** Shared temp directory constant for JSX path references */
function getTmpDir() {
    return os.tmpdir().replace(/\\/g, "/");
}
/**
 * Sanitize a user-supplied string before interpolating into generated JSX.
 * Escapes backslashes, double-quotes, and newlines to prevent injection.
 */
function sanitizeForJsx(input) {
    return input
        .replace(/\\/g, "\\\\")
        .replace(/"/g, '\\"')
        .replace(/\n/g, "\\n")
        .replace(/\r/g, "\\r");
}
/**
 * Helper to convert hex color (#RRGGBB) to [R, G, B] normalized array [0..1]
 */
function hexToRgbNormalized(hex) {
    const cleanHex = hex.replace("#", "");
    const r = parseInt(cleanHex.substring(0, 2), 16) / 255;
    const g = parseInt(cleanHex.substring(2, 4), 16) / 255;
    const b = parseInt(cleanHex.substring(4, 6), 16) / 255;
    return `[${r.toFixed(4)}, ${g.toFixed(4)}, ${b.toFixed(4)}]`;
}
/**
 * Generate JSX to create or target a composition
 */
export function buildCreateCompJsx(opts) {
    const w = opts.width || 1920;
    const h = opts.height || 1080;
    const fps = opts.fps || 30;
    const dur = opts.duration || 10;
    const bgCode = opts.bgColor
        ? `
      var bgSolid = comp.layers.addSolid(${hexToRgbNormalized(opts.bgColor)}, "Background", ${w}, ${h}, 1.0, ${dur});
      bgSolid.moveToEnd();
    `
        : "";
    return `
(function() {
  try {
    app.beginUndoGroup("MCP Create Comp");
    var comp = app.project.items.addComp("${opts.name}", ${w}, ${h}, 1.0, ${dur}, ${fps});
    ${bgCode}
    comp.openInViewer();
    app.endUndoGroup();
    return { success: true, compId: comp.id, name: comp.name, width: comp.width, height: comp.height, fps: comp.frameRate, duration: comp.duration };
  } catch (err) {
    return { success: false, error: err.toString() + " (Line " + (err.line || "?") + ")" };
  }
})();
  `.trim();
}
/**
 * Generate JSX to add a formatted text layer
 */
export function buildAddTextLayerJsx(opts) {
    const textContent = JSON.stringify(opts.text);
    const layerName = opts.name ? `textLayer.name = "${opts.name}";` : "";
    const fontCode = opts.font ? `textDocument.font = "${opts.font}";` : "";
    const fontSizeCode = opts.fontSize ? `textDocument.fontSize = ${opts.fontSize};` : `textDocument.fontSize = 72;`;
    const colorCode = opts.color ? `textDocument.fillColor = ${hexToRgbNormalized(opts.color)};` : "";
    const trackingCode = opts.tracking ? `textDocument.tracking = ${opts.tracking};` : "";
    const alignCode = opts.alignment ? `textDocument.justification = ParagraphJustification.${opts.alignment.toUpperCase()}_JUSTIFY;` : "";
    const posCode = opts.position
        ? `var posProp = textLayer.property("ADBE Transform Group") ? textLayer.property("ADBE Transform Group").property("ADBE Position") : textLayer.property("Transform").property("Position"); if (posProp) posProp.setValue([${opts.position.join(", ")}]);`
        : `var posProp = textLayer.property("ADBE Transform Group") ? textLayer.property("ADBE Transform Group").property("ADBE Position") : textLayer.property("Transform").property("Position"); if (posProp) posProp.setValue([comp.width/2, comp.height/2]);`;
    const compTarget = opts.compName
        ? `var comp = null; for (var i = 1; i <= app.project.numItems; i++) { if (app.project.item(i) instanceof CompItem && app.project.item(i).name === "${opts.compName}") { comp = app.project.item(i); break; } } if (!comp) { comp = app.project.items.addComp("${opts.compName}", 1920, 1080, 1.0, 10, 30); }`
        : `var comp = app.project.activeItem; if (!comp || !(comp instanceof CompItem)) { for (var i = 1; i <= app.project.numItems; i++) { if (app.project.item(i) instanceof CompItem) { comp = app.project.item(i); break; } } } if (!comp) { comp = app.project.items.addComp("Welcome_Comp", 1920, 1080, 1.0, 10, 30); }`;
    return `
(function() {
  try {
    app.beginUndoGroup("MCP Add Text Layer");
    ${compTarget}
    var textLayer = comp.layers.addText(${textContent});
    ${layerName}
    var textProp = textLayer.property("ADBE Text Properties") ? textLayer.property("ADBE Text Properties").property("ADBE Text Document") : textLayer.property("Source Text");
    if (textProp) {
      var textDocument = textProp.value;
      ${fontCode}
      ${fontSizeCode}
      ${colorCode}
      ${trackingCode}
      ${alignCode}
      textProp.setValue(textDocument);
    }
    ${posCode}
    comp.openInViewer();
    comp.time = 0;
    app.endUndoGroup();
    return { success: true, layerIndex: textLayer.index, layerName: textLayer.name, compName: comp.name };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
})();
  `.trim();
}
/**
 * Generate JSX to add a solid layer
 */
export function buildAddSolidLayerJsx(opts) {
    const compTarget = opts.compName
        ? `var comp = null; for (var i = 1; i <= app.project.numItems; i++) { if (app.project.item(i) instanceof CompItem && app.project.item(i).name === "${opts.compName}") { comp = app.project.item(i); break; } } if (!comp) throw new Error("Composition '${opts.compName}' not found");`
        : `var comp = app.project.activeItem; if (!comp || !(comp instanceof CompItem)) throw new Error("No active composition found");`;
    const name = opts.name || "Solid Layer";
    const w = opts.width ? opts.width : "comp.width";
    const h = opts.height ? opts.height : "comp.height";
    const color = hexToRgbNormalized(opts.color);
    const posCode = opts.position ? `solidLayer.property("Transform").property("Position").setValue([${opts.position.join(", ")}]);` : "";
    const opacityCode = opts.opacity !== undefined ? `solidLayer.property("Transform").property("Opacity").setValue(${opts.opacity});` : "";
    return `
(function() {
  try {
    app.beginUndoGroup("MCP Add Solid Layer");
    ${compTarget}
    var solidLayer = comp.layers.addSolid(${color}, "${name}", ${w}, ${h}, 1.0, comp.duration);
    ${posCode}
    ${opacityCode}
    app.endUndoGroup();
    return { success: true, layerIndex: solidLayer.index, layerName: solidLayer.name };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
})();
  `.trim();
}
/**
 * Generate JSX to add a shape layer (rectangle, ellipse, etc.)
 */
export function buildAddShapeLayerJsx(opts) {
    const compTarget = opts.compName
        ? `var comp = null; for (var i = 1; i <= app.project.numItems; i++) { if (app.project.item(i) instanceof CompItem && app.project.item(i).name === "${opts.compName}") { comp = app.project.item(i); break; } } if (!comp) throw new Error("Composition '${opts.compName}' not found");`
        : `var comp = app.project.activeItem; if (!comp || !(comp instanceof CompItem)) throw new Error("No active composition found");`;
    const name = opts.name || "Shape Layer";
    const shapeType = opts.shapeType || "rect";
    const size = opts.size ? `[${opts.size.join(", ")}]` : `[300, 300]`;
    const posCode = opts.position ? `shapeLayer.property("Transform").property("Position").setValue([${opts.position.join(", ")}]);` : `shapeLayer.property("Transform").property("Position").setValue([comp.width/2, comp.height/2]);`;
    const fillColor = opts.fillColor ? hexToRgbNormalized(opts.fillColor) : null;
    const strokeColor = opts.strokeColor ? hexToRgbNormalized(opts.strokeColor) : null;
    const strokeWidth = opts.strokeWidth || 4;
    const cornerRadius = opts.cornerRadius || 0;
    return `
(function() {
  try {
    app.beginUndoGroup("MCP Add Shape Layer");
    ${compTarget}
    var shapeLayer = comp.layers.addShape();
    shapeLayer.name = "${name}";
    var contents = shapeLayer.property("Contents");
    var group = contents.addProperty("ADBE Vector Group");
    var groupContents = group.property("Contents");
    
    if ("${shapeType}" === "rect") {
      var rect = groupContents.addProperty("ADBE Vector Shape - Rect");
      rect.property("Size").setValue(${size});
      if (${cornerRadius} > 0) {
        rect.property("Roundness").setValue(${cornerRadius});
      }
    } else if ("${shapeType}" === "ellipse") {
      var ellipse = groupContents.addProperty("ADBE Vector Shape - Ellipse");
      ellipse.property("Size").setValue(${size});
    } else if ("${shapeType}" === "star") {
      var star = groupContents.addProperty("ADBE Vector Shape - Star");
      star.property("Type").setValue(1); // 1 = Star
      star.property("Points").setValue(5);
      star.property("Outer Radius").setValue(${size}[0] / 2);
      star.property("Inner Radius").setValue(${size}[0] / 4);
    }

    ${fillColor ? `
      var fill = groupContents.addProperty("ADBE Vector Graphic - Fill");
      fill.property("Color").setValue(${fillColor});
    ` : ""}

    ${strokeColor ? `
      var stroke = groupContents.addProperty("ADBE Vector Graphic - Stroke");
      stroke.property("Color").setValue(${strokeColor});
      stroke.property("Stroke Width").setValue(${strokeWidth});
    ` : ""}

    ${posCode}
    app.endUndoGroup();
    return { success: true, layerIndex: shapeLayer.index, layerName: shapeLayer.name };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
})();
  `.trim();
}
/**
 * Generate JSX to apply keyframes or static values to transform properties
 */
export function buildSetTransformJsx(opts) {
    const compTarget = opts.compName
        ? `var comp = null; for (var i = 1; i <= app.project.numItems; i++) { if (app.project.item(i) instanceof CompItem && app.project.item(i).name === "${opts.compName}") { comp = app.project.item(i); break; } } if (!comp) throw new Error("Composition '${opts.compName}' not found");`
        : `var comp = app.project.activeItem; if (!comp || !(comp instanceof CompItem)) throw new Error("No active composition found");`;
    const targetIdentifier = typeof opts.layerIdentifier === "number"
        ? `var layer = comp.layer(${opts.layerIdentifier});`
        : `var layer = comp.layer("${opts.layerIdentifier}");`;
    return `
(function() {
  try {
    app.beginUndoGroup("MCP Set Transform");
    ${compTarget}
    ${targetIdentifier}
    if (!layer) throw new Error("Target layer not found");
    var transform = layer.property("Transform");

    function applyProp(propName, value) {
      var prop = transform.property(propName);
      if (!prop) return;
      if (value instanceof Array && value.length > 0 && typeof value[0] === "object" && value[0].time !== undefined) {
        for (var k = 0; k < value.length; k++) {
          prop.setValueAtTime(value[k].time, value[k].value);
        }
      } else {
        prop.setValue(value);
      }
    }

    ${opts.position !== undefined ? `applyProp("Position", ${JSON.stringify(opts.position)});` : ""}
    ${opts.scale !== undefined ? `applyProp("Scale", ${JSON.stringify(opts.scale)});` : ""}
    ${opts.rotation !== undefined ? `applyProp("Rotation", ${JSON.stringify(opts.rotation)});` : ""}
    ${opts.opacity !== undefined ? `applyProp("Opacity", ${JSON.stringify(opts.opacity)});` : ""}
    ${opts.anchorPoint !== undefined ? `applyProp("Anchor Point", ${JSON.stringify(opts.anchorPoint)});` : ""}

    app.endUndoGroup();
    return { success: true, layerName: layer.name };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
})();
  `.trim();
}
/**
 * Generate JSX to add an effect to a layer
 */
export function buildAddEffectJsx(opts) {
    const compTarget = opts.compName
        ? `var comp = null; for (var i = 1; i <= app.project.numItems; i++) { if (app.project.item(i) instanceof CompItem && app.project.item(i).name === "${opts.compName}") { comp = app.project.item(i); break; } } if (!comp) throw new Error("Composition '${opts.compName}' not found");`
        : `var comp = app.project.activeItem; if (!comp || !(comp instanceof CompItem)) throw new Error("No active composition found");`;
    const targetIdentifier = typeof opts.layerIdentifier === "number"
        ? `var layer = comp.layer(${opts.layerIdentifier});`
        : `var layer = comp.layer("${opts.layerIdentifier}");`;
    return `
(function() {
  try {
    app.beginUndoGroup("MCP Add Effect");
    ${compTarget}
    ${targetIdentifier}
    if (!layer) throw new Error("Layer not found");
    var effectsGroup = layer.property("Effects");
    var effect = effectsGroup.addProperty("${opts.effectMatchName}");
    if ("${opts.effectName || ""}") {
      effect.name = "${opts.effectName}";
    }

    ${opts.properties ? Object.entries(opts.properties).map(([pName, pVal]) => `
      try {
        var p = effect.property("${pName}");
        if (p) p.setValue(${JSON.stringify(pVal)});
      } catch (e) {}
    `).join("\n") : ""}

    app.endUndoGroup();
    return { success: true, effectName: effect.name, layerName: layer.name };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
})();
  `.trim();
}
/**
 * Generate JSX to apply an expression to a layer property
 */
export function buildSetExpressionJsx(opts) {
    const compTarget = opts.compName
        ? `var comp = null; for (var i = 1; i <= app.project.numItems; i++) { if (app.project.item(i) instanceof CompItem && app.project.item(i).name === "${opts.compName}") { comp = app.project.item(i); break; } } if (!comp) throw new Error("Composition '${opts.compName}' not found");`
        : `var comp = app.project.activeItem; if (!comp || !(comp instanceof CompItem)) throw new Error("No active composition found");`;
    const targetIdentifier = typeof opts.layerIdentifier === "number"
        ? `var layer = comp.layer(${opts.layerIdentifier});`
        : `var layer = comp.layer("${opts.layerIdentifier}");`;
    const pathJs = opts.propertyPath.map(p => `.property("${p}")`).join("");
    return `
(function() {
  try {
    app.beginUndoGroup("MCP Set Expression");
    ${compTarget}
    ${targetIdentifier}
    if (!layer) throw new Error("Layer not found");
    var targetProp = layer${pathJs};
    if (!targetProp) throw new Error("Property path '${opts.propertyPath.join(" -> ")}' not found on layer");
    targetProp.expression = ${JSON.stringify(opts.expression)};
    app.endUndoGroup();
    return { success: true, propertyPath: "${opts.propertyPath.join(".")}", expression: targetProp.expression };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
})();
  `.trim();
}
/**
 * Generate JSX to run arbitrary raw ExtendScript code
 */
export function buildRunScriptJsx(code) {
    // If the submitted script already manages its own undo group (contains beginUndoGroup),
    // DO NOT wrap another undo group around it (prevents illegal nesting and mismatch warnings).
    const hasOwnUndo = /beginUndoGroup\s*\(/.test(code);
    if (hasOwnUndo) {
        return `
(function() {
  try {
    var _result = null;
    ${code}
    return _result || { success: true, message: "Script executed successfully" };
  } catch (err) {
    if (app.forceCleanUndoGroup) {
      try { app.forceCleanUndoGroup(); } catch (e) {}
    }
    return { success: false, error: err.toString() + " (Line " + (err.line || "?") + ")" };
  }
})();
    `.trim();
    }
    // Canonical Adobe After Effects pattern:
    // app.beginUndoGroup -> try { operations } finally { app.endUndoGroup() }
    return `
(function() {
  app.beginUndoGroup("MCP Action");
  try {
    var _result = null;
    ${code}
    return _result || { success: true, message: "Script executed successfully" };
  } catch (err) {
    return { success: false, error: err.toString() + " (Line " + (err.line || "?") + ")" };
  } finally {
    app.endUndoGroup();
  }
})();
  `.trim();
}
/**
 * Generate JSX to query active comp info
 */
export function buildGetActiveCompJsx() {
    return `
(function() {
  try {
    var comp = app.project.activeItem;
    if (!comp || !(comp instanceof CompItem)) {
      return { success: false, error: "No active composition found in After Effects" };
    }
    var layersInfo = [];
    for (var i = 1; i <= comp.numLayers; i++) {
      var l = comp.layer(i);
      layersInfo.push({ index: l.index, name: l.name, type: l.typeName, enabled: l.enabled });
    }
    return {
      success: true,
      comp: {
        id: comp.id,
        name: comp.name,
        width: comp.width,
        height: comp.height,
        duration: comp.duration,
        frameRate: comp.frameRate,
        numLayers: comp.numLayers,
        layers: layersInfo
      }
    };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
})();
  `.trim();
}
/**
 * Generate JSX to export a PNG preview frame of the active composition
 */
export function buildSaveFramePreviewJsx(opts) {
    const targetComp = opts.compName ? `
    var comp = null;
    for (var i = 1; i <= app.project.numItems; i++) {
      if (app.project.item(i) instanceof CompItem && app.project.item(i).name === "${opts.compName}") {
        comp = app.project.item(i); break;
      }
    }
  ` : `
    var comp = app.project.activeItem;
    if (!comp || !(comp instanceof CompItem)) {
      for (var i = 1; i <= app.project.numItems; i++) {
        if (app.project.item(i) instanceof CompItem) { comp = app.project.item(i); break; }
      }
    }
  `;
    const cleanPath = opts.outputPath.replace(/\\/g, "/");
    const renderTime = typeof opts.time === "number" ? opts.time : "comp ? comp.time : 0";
    return `
(function() {
  try {
    ${targetComp}
    if (!comp) {
      return { success: false, error: "No composition found for preview frame export" };
    }
    var f = new File("${cleanPath}");
    if (typeof comp.saveFrameToPng === "function") {
      comp.saveFrameToPng(${renderTime}, f);
      return { success: true, path: f.fsName, comp: comp.name, time: ${renderTime} };
    } else {
      return { success: false, error: "saveFrameToPng is not supported in this After Effects version" };
    }
  } catch (err) {
    return { success: false, error: err.toString() };
  }
})();
  `.trim();
}
/**
 * Generate JSX to set keyframe easing curves (Ease In, Ease Out, Ease In/Out)
 */
export function buildSetEasingJsx(opts) {
    const targetComp = opts.compName ? `
    var comp = null;
    for (var i = 1; i <= app.project.numItems; i++) {
      if (app.project.item(i) instanceof CompItem && app.project.item(i).name === "${opts.compName}") {
        comp = app.project.item(i); break;
      }
    }
  ` : `
    var comp = app.project.activeItem;
  `;
    const layerRef = typeof opts.layerIdentifier === "number"
        ? `comp.layer(${opts.layerIdentifier})`
        : `comp.layer("${opts.layerIdentifier}")`;
    const pathChain = opts.propertyPath.map(p => `property("${p}")`).join(".");
    const easeType = opts.easeType || "easeInOut";
    const infl = opts.influence || 66;
    return `
(function() {
  try {
    app.beginUndoGroup("MCP Set Keyframe Easing");
    ${targetComp}
    if (!comp) return { success: false, error: "Composition not found" };
    var layer = ${layerRef};
    if (!layer) return { success: false, error: "Layer not found" };

    var prop = layer.${pathChain};
    if (!prop || prop.numKeys === 0) {
      return { success: false, error: "Property has no keyframes to ease" };
    }

    var easeInObj = new KeyframeEase(0, ${infl});
    var easeOutObj = new KeyframeEase(0, ${infl});
    var linearObj = new KeyframeEase(0, 0.1);

    // Determine property dimensions for correct ease array length
    var dims = 1;
    try {
      var testVal = prop.valueAtTime(0, false);
      if (testVal instanceof Array) dims = testVal.length;
    } catch(e) {}

    function buildEaseArray(obj, d) {
      var arr = [];
      for (var i = 0; i < d; i++) arr.push(obj);
      return arr;
    }

    for (var k = 1; k <= prop.numKeys; k++) {
      if ("${easeType}" === "easeIn") {
        prop.setTemporalEaseAtKey(k, buildEaseArray(easeInObj, dims), buildEaseArray(linearObj, dims));
      } else if ("${easeType}" === "easeOut") {
        prop.setTemporalEaseAtKey(k, buildEaseArray(linearObj, dims), buildEaseArray(easeOutObj, dims));
      } else if ("${easeType}" === "easeInOut") {
        prop.setTemporalEaseAtKey(k, buildEaseArray(easeInObj, dims), buildEaseArray(easeOutObj, dims));
      }
    }

    app.endUndoGroup();
    return { success: true, message: "Keyframe easing applied to " + prop.name };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
})();
  `.trim();
}
/**
 * Generate JSX to import an external file (PNG, JPG, SVG, MP4, MP3) into AE project and comp
 */
export function buildImportAssetJsx(opts) {
    const cleanPath = opts.filePath.replace(/\\/g, "/");
    const posCode = opts.position ? `[${opts.position[0]}, ${opts.position[1]}]` : `[comp.width/2, comp.height/2]`;
    const scaleCode = opts.scale ? `layer.property("ADBE Transform Group").property("ADBE Scale").setValue([${opts.scale[0]}, ${opts.scale[1]}]);` : ``;
    return `
(function() {
  try {
    app.beginUndoGroup("MCP Import Asset");
    var f = new File("${cleanPath}");
    if (!f.exists) {
      return { success: false, error: "Asset file does not exist: " + f.fsName };
    }

    var io = new ImportOptions(f);
    var item = app.project.importFile(io);
    if ("${opts.name || ""}" !== "") item.name = "${opts.name || ""}";

    var comp = app.project.activeItem;
    if (!comp || !(comp instanceof CompItem)) {
      for (var i = 1; i <= app.project.numItems; i++) {
        if (app.project.item(i) instanceof CompItem) { comp = app.project.item(i); break; }
      }
    }

    var layer = null;
    if (comp) {
      layer = comp.layers.add(item);
      layer.property("ADBE Transform Group").property("ADBE Position").setValue(${posCode});
      ${scaleCode}
    }

    app.endUndoGroup();
    return { success: true, itemId: item.id, itemName: item.name, layerName: layer ? layer.name : null };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
})();
  `.trim();
}
/**
 * Generate JSX to group multiple layers into a nested pre-composition
 */
export function buildPrecomposeJsx(opts) {
    const compTarget = opts.compName
        ? `var comp = null; for (var i = 1; i <= app.project.numItems; i++) { if (app.project.item(i) instanceof CompItem && app.project.item(i).name === "${sanitizeForJsx(opts.compName)}") { comp = app.project.item(i); break; } } if (!comp) throw new Error("Composition '${sanitizeForJsx(opts.compName)}' not found");`
        : `var comp = app.project.activeItem; if (!comp || !(comp instanceof CompItem)) throw new Error("No active composition found");`;
    return `
(function() {
  try {
    app.beginUndoGroup("MCP Precompose");
    ${compTarget}

    var indices = [${opts.layerIndices.join(",")}];
    if (indices.length === 0) {
      return { success: false, error: "No layer indices provided" };
    }

    var precomp = comp.layers.precompose(indices, "${sanitizeForJsx(opts.precompName)}", true);
    app.endUndoGroup();
    return { success: true, precompId: precomp.id, precompName: precomp.name };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
})();
  `.trim();
}
/**
 * Generate JSX to swap or apply global color palette tokens across composition layers
 */
export function buildApplyColorPaletteJsx(opts) {
    return `
(function() {
  try {
    app.beginUndoGroup("MCP Apply Color Palette");
    var comp = app.project.activeItem;
    if (!comp || !(comp instanceof CompItem)) return { success: false, error: "No active comp" };

    var updatedCount = 0;
    for (var i = 1; i <= comp.numLayers; i++) {
      var l = comp.layer(i);
      if (l instanceof TextLayer && "${opts.colors.text || ""}" !== "") {
        var td = l.property("ADBE Text Properties").property("ADBE Text Document").value;
        td.fillColor = ${hexToRgbNormalized(opts.colors.text || "#FFFFFF")};
        l.property("ADBE Text Properties").property("ADBE Text Document").setValue(td);
        updatedCount++;
      } else if (l.name.indexOf("BG_") === 0 && "${opts.colors.background || ""}" !== "") {
        if (l.mainSource && typeof l.mainSource.color !== "undefined") {
          l.mainSource.color = ${hexToRgbNormalized(opts.colors.background || "#0A0A0F")};
          updatedCount++;
        }
      }
    }

    app.endUndoGroup();
    return { success: true, updatedLayers: updatedCount };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
})();
  `.trim();
}
/**
 * Generate JSX to inspect the active composition structure and details
 */
export function buildInspectCompJsx(compName) {
    return `
(function() {
  try {
    var comp = ${compName ? `(function(){ for(var i=1;i<=app.project.numItems;i++){ if(app.project.item(i) instanceof CompItem && app.project.item(i).name === "${compName}") return app.project.item(i); } return null; })()` : "app.project.activeItem"};
    if (!comp || !(comp instanceof CompItem)) {
      return { success: false, error: "No active composition found" };
    }

    var layersList = [];
    for (var i = 1; i <= comp.numLayers; i++) {
      var l = comp.layer(i);
      var typeStr = "Solid/Other";
      if (l instanceof TextLayer) typeStr = "Text";
      else if (l instanceof ShapeLayer) typeStr = "Shape";
      else if (l instanceof CameraLayer) typeStr = "Camera";
      else if (l instanceof LightLayer) typeStr = "Light";
      else if (l.nullLayer) typeStr = "Null";

      var effectsList = [];
      try {
        var fxParade = l.property("ADBE Effect Parade");
        if (fxParade) {
          for (var f = 1; f <= fxParade.numProperties; f++) {
            effectsList.push(fxParade.property(f).name);
          }
        }
      } catch(e) {}

      layersList.push({
        index: l.index,
        name: l.name,
        type: typeStr,
        threeDLayer: l.threeDLayer,
        enabled: l.enabled,
        locked: l.locked,
        inPoint: l.inPoint,
        outPoint: l.outPoint,
        effects: effectsList
      });
    }

    return {
      success: true,
      compName: comp.name,
      width: comp.width,
      height: comp.height,
      duration: comp.duration,
      frameRate: comp.frameRate,
      numLayers: comp.numLayers,
      layers: layersList
    };
  } catch(err) {
    return { success: false, error: err.toString() };
  }
})();
  `.trim();
}
export function buildApplyMotionPresetJsx(opts) {
    let expr = "";
    const freq = opts.frequency || 3;
    const amp = opts.amplitude || 15;
    const decay = opts.decay || 5;
    if (opts.presetType === "bounce") {
        expr = `
// Inertial Bounce Preset
n = 0;
if (numKeys > 0){
  n = nearestKey(time).index;
  if (key(n).time > time){ n--; }
}
if (n == 0){ t = 0; } else { t = time - key(n).time; }
if (n > 0 && t < 1){
  v = velocityAtTime(key(n).time - thisComp.frameDuration/10);
  amp = ${amp} / 100;
  freq = ${freq};
  decay = ${decay};
  value + v*amp*Math.sin(freq*t*2*Math.PI)/Math.exp(decay*t);
} else { value; }
    `.trim();
    }
    else if (opts.presetType === "wiggle") {
        expr = `wiggle(${freq}, ${amp});`;
    }
    else if (opts.presetType === "rubberband") {
        expr = `
// Rubberband Squish & Stretch
maxVal = ${amp};
freq = ${freq};
decay = ${decay};
t = time - inPoint;
s = Math.sin(t * freq * Math.PI * 2) * maxVal * Math.exp(-t * decay);
[value[0] + s, value[1] - s];
    `.trim();
    }
    else {
        expr = `
// Elastic Oscillation
t = time - inPoint;
Math.sin(t * ${freq} * Math.PI) * ${amp} * Math.exp(-t * ${decay});
    `.trim();
    }
    return `
(function() {
  try {
    app.beginUndoGroup("MCP Apply Motion Preset");
    var comp = ${opts.compName ? `(function(){ for(var i=1;i<=app.project.numItems;i++){ if(app.project.item(i) instanceof CompItem && app.project.item(i).name === "${opts.compName}") return app.project.item(i); } return null; })()` : "app.project.activeItem"};
    if (!comp || !(comp instanceof CompItem)) return { success: false, error: "No active comp" };

    var layer = ${typeof opts.layerIdentifier === "number" ? `comp.layer(${opts.layerIdentifier})` : `comp.layer("${opts.layerIdentifier}")`};
    if (!layer) return { success: false, error: "Layer not found" };

    var prop = null;
    if ("${opts.propertyName}" === "position") prop = layer.property("ADBE Transform Group").property("ADBE Position");
    else if ("${opts.propertyName}" === "scale") prop = layer.property("ADBE Transform Group").property("ADBE Scale");
    else if ("${opts.propertyName}" === "rotation") prop = layer.property("ADBE Transform Group").property("ADBE Rotation");
    else if ("${opts.propertyName}" === "opacity") prop = layer.property("ADBE Transform Group").property("ADBE Opacity");

    if (prop) {
      prop.expression = ${JSON.stringify(expr)};
      app.endUndoGroup();
      return { success: true, preset: "${opts.presetType}", property: "${opts.propertyName}" };
    } else {
      return { success: false, error: "Property not found" };
    }
  } catch (err) {
    return { success: false, error: err.toString() };
  }
})();
  `.trim();
}
/**
 * Generate JSX to create a 3D Camera Rig & 3-Point Studio Lights
 */
export function buildCreateCameraRigJsx(compName) {
    return `
(function() {
  try {
    app.beginUndoGroup("MCP Create 3D Camera Rig");
    var comp = ${compName ? `(function(){ for(var i=1;i<=app.project.numItems;i++){ if(app.project.item(i) instanceof CompItem && app.project.item(i).name === "${compName}") return app.project.item(i); } return null; })()` : "app.project.activeItem"};
    if (!comp || !(comp instanceof CompItem)) return { success: false, error: "No active comp" };

    // 1. Create Camera Null Controller
    var camCtrl = comp.layers.addNull();
    camCtrl.name = "Camera_Ctrl";
    camCtrl.threeDLayer = true;
    camCtrl.property("ADBE Transform Group").property("ADBE Position").setValue([comp.width/2, comp.height/2, 0]);

    // 2. Create 3D Camera
    var cam = comp.layers.addCamera("3D_Studio_Camera", [comp.width/2, comp.height/2]);
    cam.parent = camCtrl;
    cam.property("ADBE Transform Group").property("ADBE Position").setValue([0, 0, -1500]);

    // 3. Create Key Light (Bright Warm)
    var keyLight = comp.layers.addLight("Key_Light", [comp.width/2 - 400, comp.height/2 - 400]);
    keyLight.lightType = LightType.POINT;
    keyLight.property("ADBE Light Options Group").property("ADBE Light Intensity").setValue(100);
    keyLight.property("ADBE Transform Group").property("ADBE Position").setValue([comp.width/2 - 500, comp.height/2 - 500, -800]);

    // 4. Create Fill Light (Cool Soft)
    var fillLight = comp.layers.addLight("Fill_Light", [comp.width/2 + 500, comp.height/2 + 300]);
    fillLight.lightType = LightType.POINT;
    fillLight.property("ADBE Light Options Group").property("ADBE Light Intensity").setValue(50);
    fillLight.property("ADBE Transform Group").property("ADBE Position").setValue([comp.width/2 + 600, comp.height/2 + 400, -600]);

    // Move Camera and Rig to top
    camCtrl.moveToBeginning();
    cam.moveToBeginning();

    app.endUndoGroup();
    return { success: true, camera: cam.name, controller: camCtrl.name };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
})();
  `.trim();
}
/**
 * Generate JSX to capture a sequence of PNG frames across the timeline to inspect animation video motion
 */
export function buildExportVideoPreviewJsx(compName, frameCount = 3) {
    return `
(function() {
  try {
    var comp = ${compName ? `(function(){ for(var i=1;i<=app.project.numItems;i++){ if(app.project.item(i) instanceof CompItem && app.project.item(i).name === "${compName}") return app.project.item(i); } return null; })()` : "app.project.activeItem"};
    if (!comp || !(comp instanceof CompItem)) return { success: false, error: "No active comp" };

    var tmpDir = "${getTmpDir()}";
    var captured = [];
    var step = comp.duration / Math.max(${frameCount}, 1);
    for (var k = 0; k < ${frameCount}; k++) {
      var t = k * step;
      var f = new File(tmpDir + "/ae_frame_" + k + ".png");
      if (typeof comp.saveFrameToPng === "function") {
        comp.saveFrameToPng(t, f);
        captured.push(f.fsName);
      }
    }

    return { success: true, frames: captured, frameCount: captured.length };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
})();
  `.trim();
}
/**
 * Generate JSX for health repair
 */
export function buildHealthRepairJsx() {
    const tmpDir = getTmpDir();
    return `
(function() {
  try {
    var report = { success: true, time: new Date().toString() };

    // 1. Check watcher ready signal
    var readyFile = new File("${tmpDir}/ae-mcp-ready.txt");
    report.watcherReady = readyFile.exists;

    // 2. Check for stale command files
    var cmdDir = new Folder("${tmpDir}/ae-mcp-commands");
    var staleFiles = [];
    if (cmdDir.exists) {
      var files = cmdDir.getFiles("*.jsx");
      for (var i = 0; i < files.length; i++) {
        staleFiles.push(files[i].name);
      }
    }
    report.staleCommands = staleFiles;
    report.staleCount = staleFiles.length;

    // 3. Clean up stale command files older than 30 seconds
    var now = new Date().getTime();
    for (var j = 0; j < staleFiles.length; j++) {
      try {
        var sf = new File(cmdDir.fsName + "/" + staleFiles[j]);
        if (sf.exists && (now - sf.modified.getTime()) > 30000) {
          sf.remove();
          report.cleaned = (report.cleaned || 0) + 1;
        }
      } catch(e) {}
    }

    // 4. Check for orphan result files
    var resultDir = new Folder("${tmpDir}/ae-mcp-bridge");
    var orphanResults = 0;
    if (resultDir.exists) {
      var rFiles = resultDir.getFiles("*.json");
      orphanResults = rFiles.length;
      // Clean up old orphan results
      for (var r = 0; r < rFiles.length; r++) {
        try {
          if ((now - rFiles[r].modified.getTime()) > 60000) {
            rFiles[r].remove();
          }
        } catch(e) {}
      }
    }
    report.orphanResults = orphanResults;

    // 5. AE project state
    report.projectOpen = (app.project !== null);
    report.activeComp = (app.project && app.project.activeItem && app.project.activeItem instanceof CompItem) ? app.project.activeItem.name : null;
    report.numProjectItems = app.project ? app.project.numItems : 0;

    report.status = report.watcherReady ? "Healthy" : "Watcher Not Running";
    return report;
  } catch (err) {
    return { success: false, error: err.toString() };
  }
})();
  `.trim();
}
/**
 * Generate JSX to fetch live After Effects watcher execution logs
 */
export function buildGetLogsJsx() {
    const tmpDir = getTmpDir();
    return `
(function() {
  try {
    var lf = new File("${tmpDir}/ae-mcp-watcher.log");
    var logsText = "";
    if (lf.exists) {
      lf.open("r");
      logsText = lf.read();
      lf.close();
    }
    return { success: true, logPath: lf.fsName, logs: logsText };
  } catch(err) {
    return { success: false, error: err.toString() };
  }
})();
  `.trim();
}
/**
 * Generate JSX to fetch a live diagnostic report of After Effects project, comp, selection & memory state
 */
export function buildGetLiveReportJsx() {
    return `
(function() {
  try {
    var prj = app.project;
    var activeComp = prj ? prj.activeItem : null;
    var report = {
      success: true,
      timestamp: new Date().toString(),
      projectFile: (prj && prj.file) ? prj.file.fsName : "Unsaved Project",
      numItems: prj ? prj.numItems : 0,
      activeCompName: (activeComp && activeComp instanceof CompItem) ? activeComp.name : "None",
      activeCompWidth: (activeComp && activeComp instanceof CompItem) ? activeComp.width : 0,
      activeCompHeight: (activeComp && activeComp instanceof CompItem) ? activeComp.height : 0,
      activeCompDuration: (activeComp && activeComp instanceof CompItem) ? activeComp.duration : 0,
      activeCompTime: (activeComp && activeComp instanceof CompItem) ? activeComp.time : 0,
      numLayers: (activeComp && activeComp instanceof CompItem) ? activeComp.numLayers : 0,
      selectedLayersCount: (activeComp && activeComp instanceof CompItem && activeComp.selectedLayers) ? activeComp.selectedLayers.length : 0
    };

    // Capture current frame preview as part of report
    if (activeComp && activeComp instanceof CompItem && typeof activeComp.saveFrameToPng === "function") {
      var prevFile = new File("${getTmpDir()}/ae_live_report_frame.png");
      activeComp.saveFrameToPng(activeComp.time, prevFile);
      report.previewPath = prevFile.fsName;
    }

    return report;
  } catch(err) {
    return { success: false, error: err.toString() };
  }
})();
  `.trim();
}
/**
 * Generate JSX to delete/remove a layer from a composition
 */
export function buildDeleteLayerJsx(opts) {
    const compTarget = opts.compName
        ? `var comp = null; for (var i = 1; i <= app.project.numItems; i++) { if (app.project.item(i) instanceof CompItem && app.project.item(i).name === "${sanitizeForJsx(opts.compName)}") { comp = app.project.item(i); break; } } if (!comp) throw new Error("Composition not found");`
        : `var comp = app.project.activeItem; if (!comp || !(comp instanceof CompItem)) throw new Error("No active composition found");`;
    const layerRef = typeof opts.layerIdentifier === "number"
        ? `comp.layer(${opts.layerIdentifier})`
        : `comp.layer("${sanitizeForJsx(String(opts.layerIdentifier))}")`;
    return `
(function() {
  try {
    app.beginUndoGroup("MCP Delete Layer");
    ${compTarget}
    var layer = ${layerRef};
    if (!layer) throw new Error("Layer not found");
    var removedName = layer.name;
    var removedIndex = layer.index;
    layer.remove();
    app.endUndoGroup();
    return { success: true, removedLayer: removedName, removedIndex: removedIndex, remainingLayers: comp.numLayers };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
})();
  `.trim();
}
/**
 * Generate JSX to duplicate a layer (including keyframes and effects)
 */
export function buildDuplicateLayerJsx(opts) {
    const compTarget = opts.compName
        ? `var comp = null; for (var i = 1; i <= app.project.numItems; i++) { if (app.project.item(i) instanceof CompItem && app.project.item(i).name === "${sanitizeForJsx(opts.compName)}") { comp = app.project.item(i); break; } } if (!comp) throw new Error("Composition not found");`
        : `var comp = app.project.activeItem; if (!comp || !(comp instanceof CompItem)) throw new Error("No active composition found");`;
    const layerRef = typeof opts.layerIdentifier === "number"
        ? `comp.layer(${opts.layerIdentifier})`
        : `comp.layer("${sanitizeForJsx(String(opts.layerIdentifier))}")`;
    const renameCode = opts.newName
        ? `dupLayer.name = "${sanitizeForJsx(opts.newName)}";`
        : "";
    return `
(function() {
  try {
    app.beginUndoGroup("MCP Duplicate Layer");
    ${compTarget}
    var layer = ${layerRef};
    if (!layer) throw new Error("Layer not found");
    var dupLayer = layer.duplicate();
    ${renameCode}
    app.endUndoGroup();
    return { success: true, originalLayer: layer.name, duplicatedLayer: dupLayer.name, newIndex: dupLayer.index };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
})();
  `.trim();
}
/**
 * Generate JSX to set layer timing (in/out points and start time)
 */
export function buildSetLayerTimingJsx(opts) {
    const compTarget = opts.compName
        ? `var comp = null; for (var i = 1; i <= app.project.numItems; i++) { if (app.project.item(i) instanceof CompItem && app.project.item(i).name === "${sanitizeForJsx(opts.compName)}") { comp = app.project.item(i); break; } } if (!comp) throw new Error("Composition not found");`
        : `var comp = app.project.activeItem; if (!comp || !(comp instanceof CompItem)) throw new Error("No active composition found");`;
    const layerRef = typeof opts.layerIdentifier === "number"
        ? `comp.layer(${opts.layerIdentifier})`
        : `comp.layer("${sanitizeForJsx(String(opts.layerIdentifier))}")`;
    return `
(function() {
  try {
    app.beginUndoGroup("MCP Set Layer Timing");
    ${compTarget}
    var layer = ${layerRef};
    if (!layer) throw new Error("Layer not found");

    ${opts.startTime !== undefined ? `layer.startTime = ${opts.startTime};` : ""}
    ${opts.inPoint !== undefined ? `layer.inPoint = ${opts.inPoint};` : ""}
    ${opts.outPoint !== undefined ? `layer.outPoint = ${opts.outPoint};` : ""}

    app.endUndoGroup();
    return {
      success: true,
      layerName: layer.name,
      inPoint: layer.inPoint,
      outPoint: layer.outPoint,
      startTime: layer.startTime,
      duration: layer.outPoint - layer.inPoint
    };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
})();
  `.trim();
}
/**
 * Generate JSX to create a 3D Camera Layer in AE timeline
 */
export function buildAddCameraLayerJsx(opts) {
    const compTarget = opts.compName
        ? `var comp = null; for (var i = 1; i <= app.project.numItems; i++) { if (app.project.item(i) instanceof CompItem && app.project.item(i).name === "${sanitizeForJsx(opts.compName)}") { comp = app.project.item(i); break; } } if (!comp) throw new Error("Composition not found");`
        : `var comp = app.project.activeItem; if (!comp || !(comp instanceof CompItem)) throw new Error("No active composition found");`;
    const nameStr = opts.name ? sanitizeForJsx(opts.name) : "3D Camera";
    const centerPt = opts.centerPoint ? `[${opts.centerPoint[0]}, ${opts.centerPoint[1]}]` : `[comp.width/2, comp.height/2]`;
    return `
(function() {
  try {
    app.beginUndoGroup("MCP Add Camera Layer");
    ${compTarget}
    var cam = comp.layers.addCamera("${nameStr}", ${centerPt});

    ${opts.position ? `cam.property("ADBE Transform Group").property("ADBE Position").setValue([${opts.position.join(",")}]);` : ""}
    ${opts.pointOfInterest ? `cam.property("ADBE Transform Group").property("ADBE Point of Interest").setValue([${opts.pointOfInterest.join(",")}]);` : ""}
    ${opts.zoom !== undefined ? `cam.property("ADBE Camera Options Group").property("ADBE Camera Zoom").setValue(${opts.zoom});` : ""}
    ${opts.depthOfField !== undefined ? `cam.property("ADBE Camera Options Group").property("ADBE Camera Depth of Field").setValue(${opts.depthOfField ? 1 : 0});` : ""}
    ${opts.focusDistance !== undefined ? `cam.property("ADBE Camera Options Group").property("ADBE Camera Focus Distance").setValue(${opts.focusDistance});` : ""}
    ${opts.aperture !== undefined ? `cam.property("ADBE Camera Options Group").property("ADBE Camera Aperture").setValue(${opts.aperture});` : ""}
    ${opts.blurLevel !== undefined ? `cam.property("ADBE Camera Options Group").property("ADBE Camera Blur Level").setValue(${opts.blurLevel});` : ""}

    app.endUndoGroup();
    return { success: true, layerIndex: cam.index, layerName: cam.name };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
})();
  `.trim();
}
/**
 * Generate JSX to create a Light Layer (Parallel, Spot, Point, Ambient)
 */
export function buildAddLightLayerJsx(opts) {
    const compTarget = opts.compName
        ? `var comp = null; for (var i = 1; i <= app.project.numItems; i++) { if (app.project.item(i) instanceof CompItem && app.project.item(i).name === "${sanitizeForJsx(opts.compName)}") { comp = app.project.item(i); break; } } if (!comp) throw new Error("Composition not found");`
        : `var comp = app.project.activeItem; if (!comp || !(comp instanceof CompItem)) throw new Error("No active composition found");`;
    const nameStr = opts.name ? sanitizeForJsx(opts.name) : "Light Layer";
    const centerPt = `[comp.width/2, comp.height/2]`;
    let lightTypeEnum = "LightType.POINT";
    if (opts.lightType === "parallel")
        lightTypeEnum = "LightType.PARALLEL";
    else if (opts.lightType === "spot")
        lightTypeEnum = "LightType.SPOT";
    else if (opts.lightType === "ambient")
        lightTypeEnum = "LightType.AMBIENT";
    const hexColor = opts.color || "#FFFFFF";
    return `
(function() {
  try {
    app.beginUndoGroup("MCP Add Light Layer");
    ${compTarget}
    var light = comp.layers.addLight("${nameStr}", ${centerPt});
    light.lightType = ${lightTypeEnum};

    var hex = "${hexColor}".replace("#", "");
    var r = parseInt(hex.substring(0, 2), 16) / 255;
    var g = parseInt(hex.substring(2, 4), 16) / 255;
    var b = parseInt(hex.substring(4, 6), 16) / 255;
    light.property("ADBE Light Options Group").property("ADBE Light Color").setValue([r, g, b]);

    ${opts.intensity !== undefined ? `light.property("ADBE Light Options Group").property("ADBE Light Intensity").setValue(${opts.intensity});` : ""}
    ${opts.position ? `light.property("ADBE Transform Group").property("ADBE Position").setValue([${opts.position.join(",")}]);` : ""}
    ${opts.coneAngle !== undefined && opts.lightType === "spot" ? `light.property("ADBE Light Options Group").property("ADBE Light Cone Angle").setValue(${opts.coneAngle});` : ""}
    ${opts.coneFeather !== undefined && opts.lightType === "spot" ? `light.property("ADBE Light Options Group").property("ADBE Light Cone Feather").setValue(${opts.coneFeather});` : ""}
    ${opts.castsShadows !== undefined ? `light.property("ADBE Light Options Group").property("ADBE Light Casts Shadows").setValue(${opts.castsShadows ? 1 : 0});` : ""}
    ${opts.shadowDarkness !== undefined ? `light.property("ADBE Light Options Group").property("ADBE Light Shadow Darkness").setValue(${opts.shadowDarkness});` : ""}

    app.endUndoGroup();
    return { success: true, layerIndex: light.index, layerName: light.name };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
})();
  `.trim();
}
/**
 * Generate JSX to apply keyframe assistant curve profiles (Elastic, Bounce, Exponential, etc.)
 */
export function buildKeyframeAssistantJsx(opts) {
    const compTarget = opts.compName
        ? `var comp = null; for (var i = 1; i <= app.project.numItems; i++) { if (app.project.item(i) instanceof CompItem && app.project.item(i).name === "${sanitizeForJsx(opts.compName)}") { comp = app.project.item(i); break; } } if (!comp) throw new Error("Composition not found");`
        : `var comp = app.project.activeItem; if (!comp || !(comp instanceof CompItem)) throw new Error("No active composition found");`;
    const layerRef = typeof opts.layerIdentifier === "number"
        ? `comp.layer(${opts.layerIdentifier})`
        : `comp.layer("${sanitizeForJsx(String(opts.layerIdentifier))}")`;
    const pathChain = opts.propertyPath.map(p => `property("${sanitizeForJsx(p)}")`).join(".");
    const curveType = opts.curveType || "smoothEase";
    const infl = opts.influence !== undefined ? opts.influence : 75;
    return `
(function() {
  try {
    app.beginUndoGroup("MCP Keyframe Assistant");
    ${compTarget}
    var layer = ${layerRef};
    if (!layer) return { success: false, error: "Layer not found" };

    var prop = layer.${pathChain};
    if (!prop) return { success: false, error: "Property not found" };

    if (prop.numKeys === 0) {
      return { success: false, error: "Property has no keyframes" };
    }

    var dims = 1;
    try {
      var testVal = prop.valueAtTime(0, false);
      if (testVal instanceof Array) dims = testVal.length;
    } catch(e) {}

    function buildEaseArray(speed, influence, d) {
      var arr = [];
      var kEase = new KeyframeEase(speed, influence);
      for (var i = 0; i < d; i++) arr.push(kEase);
      return arr;
    }

    if ("${curveType}" === "exponential" || "${curveType}" === "cubicBezier" || "${curveType}" === "smoothEase") {
      var inEase = buildEaseArray(0, ${infl}, dims);
      var outEase = buildEaseArray(0, ${infl}, dims);
      for (var k = 1; k <= prop.numKeys; k++) {
        prop.setTemporalEaseAtKey(k, inEase, outEase);
      }
    } else if ("${curveType}" === "elastic" || "${curveType}" === "bounce" || "${curveType}" === "back") {
      var expr = "";
      if ("${curveType}" === "elastic") {
        expr = "amp = ${opts.amplitude || 0.05}; freq = ${opts.frequency || 4.0}; decay = 5.0; n = 0; if (numKeys > 0){ n = nearestKey(time).index; if (key(n).time > time){ n--; } } if (n == 0){ t = 0; }else{ t = time - key(n).time; } if (n > 0 && t < 1){ v = velocityAtTime(key(n).time - 0.001); value + v*amp*Math.sin(freq*t*2*Math.PI)/Math.exp(decay*t); }else{ value; }";
      } else if ("${curveType}" === "bounce") {
        expr = "n = 0; if (numKeys > 0){ n = nearestKey(time).index; if (key(n).time > time){ n--; } } if (n == 0){ t = 0; }else{ t = time - key(n).time; } if (n > 0 && t < 1){ v = velocityAtTime(key(n).time - 0.001); value + v * Math.abs(Math.sin(6 * t)) / Math.exp(4 * t); }else{ value; }";
      } else if ("${curveType}" === "back") {
        expr = "s = 1.70158; n = 0; if (numKeys > 0){ n = nearestKey(time).index; if (key(n).time > time){ n--; } } if (n == 0){ t = 0; }else{ t = time - key(n).time; } if (n > 0 && t < 0.5){ v = velocityAtTime(key(n).time - 0.001); value + v * t * t * ((s + 1) * t - s); }else{ value; }";
      }
      prop.expression = expr;
      prop.expressionEnabled = true;
    }

    app.endUndoGroup();
    return { success: true, message: "Applied " + "${curveType}" + " curve to " + prop.name, numKeys: prop.numKeys };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
})();
  `.trim();
}
