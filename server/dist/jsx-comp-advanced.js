/**
 * Advanced Composition Management JSX Templates
 * Covers: duplicate, delete, settings, work area, comp tree, analysis
 */
import { sanitizeForJsx, buildCompTarget } from "./jsx-helpers.js";
export function buildDuplicateCompJsx(opts) {
    return `
(function() {
  try {
    app.beginUndoGroup("MCP Duplicate Comp");
    var sourceComp = null;
    for (var i = 1; i <= app.project.numItems; i++) {
      if (app.project.item(i) instanceof CompItem && app.project.item(i).name === "${sanitizeForJsx(opts.sourceName)}") {
        sourceComp = app.project.item(i); break;
      }
    }
    if (!sourceComp) return { success: false, error: "Source composition '${sanitizeForJsx(opts.sourceName)}' not found" };

    var newComp = sourceComp.duplicate();
    ${opts.newName ? `newComp.name = "${sanitizeForJsx(opts.newName)}";` : ""}
    newComp.openInViewer();
    app.endUndoGroup();
    return { success: true, newCompId: newComp.id, newCompName: newComp.name, numLayers: newComp.numLayers };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
})();
  `.trim();
}
export function buildDeleteCompJsx(opts) {
    return `
(function() {
  try {
    app.beginUndoGroup("MCP Delete Comp");
    var comp = null;
    for (var i = 1; i <= app.project.numItems; i++) {
      if (app.project.item(i) instanceof CompItem && app.project.item(i).name === "${sanitizeForJsx(opts.compName)}") {
        comp = app.project.item(i); break;
      }
    }
    if (!comp) return { success: false, error: "Composition '${sanitizeForJsx(opts.compName)}' not found" };
    var name = comp.name;
    comp.remove();
    app.endUndoGroup();
    return { success: true, deletedComp: name };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
})();
  `.trim();
}
export function buildGetCompSettingsJsx(opts) {
    return `
(function() {
  try {
    ${buildCompTarget(opts?.compName)}
    return {
      success: true,
      name: comp.name,
      width: comp.width,
      height: comp.height,
      pixelAspect: comp.pixelAspect,
      frameRate: comp.frameRate,
      duration: comp.duration,
      workAreaStart: comp.workAreaStart,
      workAreaDuration: comp.workAreaDuration,
      numLayers: comp.numLayers,
      bgColor: comp.bgColor,
      motionBlur: comp.motionBlur,
      shutterAngle: comp.shutterAngle,
      shutterPhase: comp.shutterPhase,
      resolutionFactor: comp.resolutionFactor,
      renderer: comp.renderer,
      preserveNestedResolution: comp.preserveNestedResolution
    };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
})();
  `.trim();
}
export function buildSetWorkAreaJsx(opts) {
    return `
(function() {
  try {
    app.beginUndoGroup("MCP Set Work Area");
    ${buildCompTarget(opts.compName)}
    comp.workAreaStart = ${opts.startTime};
    comp.workAreaDuration = ${opts.endTime} - ${opts.startTime};
    app.endUndoGroup();
    return {
      success: true,
      compName: comp.name,
      workAreaStart: comp.workAreaStart,
      workAreaDuration: comp.workAreaDuration
    };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
})();
  `.trim();
}
export function buildGetCompTreeJsx(compName) {
    return `
(function() {
  try {
    ${buildCompTarget(compName)}

    function getCompTree(c, depth) {
      if (depth > 10) return { name: c.name, error: "Max depth exceeded" };
      var layers = [];
      for (var i = 1; i <= c.numLayers; i++) {
        var l = c.layer(i);
        var info = {
          index: l.index,
          name: l.name,
          type: l instanceof TextLayer ? "Text" : l instanceof ShapeLayer ? "Shape" : l instanceof CameraLayer ? "Camera" : l instanceof LightLayer ? "Light" : l.nullLayer ? "Null" : "AV/Solid",
          enabled: l.enabled,
          parent: l.parent ? l.parent.name : null
        };
        // If this layer is a precomp, recurse
        if (l.source && l.source instanceof CompItem) {
          info.type = "Precomp";
          info.children = getCompTree(l.source, depth + 1);
        }
        layers.push(info);
      }
      return { name: c.name, width: c.width, height: c.height, duration: c.duration, layers: layers };
    }

    return { success: true, tree: getCompTree(comp, 0) };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
})();
  `.trim();
}
export function buildAnalyzeCompJsx(compName) {
    return `
(function() {
  try {
    ${buildCompTarget(compName)}

    var analysis = {
      compName: comp.name,
      width: comp.width,
      height: comp.height,
      duration: comp.duration,
      frameRate: comp.frameRate,
      totalLayers: comp.numLayers,
      layersByType: { text: 0, shape: 0, solid: 0, camera: 0, light: 0, "null": 0, adjustment: 0, footage: 0, precomp: 0 },
      totalKeyframes: 0,
      totalExpressions: 0,
      effectInventory: {},
      missingFootage: [],
      threeDLayerCount: 0,
      motionBlurEnabled: comp.motionBlur,
      estimatedComplexity: "low"
    };

    function countKeyframesAndExpressions(propGroup, depth) {
      if (depth > 20) return;
      try {
        for (var p = 1; p <= propGroup.numProperties; p++) {
          var prop = propGroup.property(p);
          if (prop.propertyType === PropertyType.PROPERTY) {
            if (prop.numKeys > 0) analysis.totalKeyframes += prop.numKeys;
            if (prop.expressionEnabled) analysis.totalExpressions++;
          } else if (prop.propertyType === PropertyType.INDEXED_GROUP || prop.propertyType === PropertyType.NAMED_GROUP) {
            countKeyframesAndExpressions(prop, depth + 1);
          }
        }
      } catch(e) {}
    }

    for (var i = 1; i <= comp.numLayers; i++) {
      var l = comp.layer(i);

      // Classify layer type
      if (l instanceof TextLayer) analysis.layersByType.text++;
      else if (l instanceof ShapeLayer) analysis.layersByType.shape++;
      else if (l instanceof CameraLayer) analysis.layersByType.camera++;
      else if (l instanceof LightLayer) analysis.layersByType.light++;
      else if (l.nullLayer) analysis.layersByType["null"]++;
      else if (l.adjustmentLayer) analysis.layersByType.adjustment++;
      else if (l.source && l.source instanceof CompItem) analysis.layersByType.precomp++;
      else if (l.source && l.source instanceof FootageItem) analysis.layersByType.footage++;
      else analysis.layersByType.solid++;

      if (l.threeDLayer) analysis.threeDLayerCount++;

      // Count effects
      try {
        var fx = l.property("ADBE Effect Parade");
        if (fx) {
          for (var f = 1; f <= fx.numProperties; f++) {
            var eName = fx.property(f).matchName;
            if (analysis.effectInventory[eName]) analysis.effectInventory[eName]++;
            else analysis.effectInventory[eName] = 1;
          }
        }
      } catch(e) {}

      // Count keyframes and expressions
      countKeyframesAndExpressions(l, 0);

      // Check missing footage
      try {
        if (l.source && l.source instanceof FootageItem && l.source.mainSource instanceof PlaceholderSource) {
          analysis.missingFootage.push(l.name);
        }
      } catch(e) {}
    }

    // Estimate complexity
    var score = analysis.totalLayers + analysis.totalKeyframes * 0.1 + analysis.totalExpressions * 2 + analysis.threeDLayerCount * 3;
    var effectCount = 0;
    for (var k in analysis.effectInventory) { if (analysis.effectInventory.hasOwnProperty(k)) effectCount += analysis.effectInventory[k]; }
    score += effectCount * 1.5;
    if (score < 20) analysis.estimatedComplexity = "low";
    else if (score < 80) analysis.estimatedComplexity = "medium";
    else if (score < 200) analysis.estimatedComplexity = "high";
    else analysis.estimatedComplexity = "extreme";

    analysis.success = true;
    return analysis;
  } catch (err) {
    return { success: false, error: err.toString() };
  }
})();
  `.trim();
}
