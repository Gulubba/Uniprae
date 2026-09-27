/**
 * Advanced Layer Operations JSX Templates
 * Covers: split, lock/shy/guide/solo, parent, 3D, blend modes, track mattes, reorder, adjustment layers
 */
import { sanitizeForJsx, buildCompTarget, buildLayerRef, hexToRgbNormalized } from "./jsx-helpers.js";
export function buildSplitLayerJsx(opts) {
    return `
(function() {
  try {
    app.beginUndoGroup("MCP Split Layer");
    ${buildCompTarget(opts.compName)}
    ${buildLayerRef(opts.layerIdentifier)}
    ${opts.splitTime !== undefined ? `comp.time = ${opts.splitTime};` : ""}
    var splitTime = ${opts.splitTime !== undefined ? opts.splitTime : "comp.time"};
    if (splitTime <= layer.inPoint || splitTime >= layer.outPoint) {
      return { success: false, error: "Split time must be between layer in and out points" };
    }
    var newLayer = layer.duplicate();
    newLayer.inPoint = splitTime;
    layer.outPoint = splitTime;
    newLayer.name = layer.name + " (split)";
    app.endUndoGroup();
    return { success: true, originalLayer: layer.name, newLayer: newLayer.name, splitTime: splitTime };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
})();
  `.trim();
}
export function buildSetLayerFlagsJsx(opts) {
    const flagSetters = [];
    if (opts.locked !== undefined)
        flagSetters.push(`layer.locked = ${opts.locked};`);
    if (opts.shy !== undefined)
        flagSetters.push(`layer.shy = ${opts.shy};`);
    if (opts.enabled !== undefined)
        flagSetters.push(`layer.enabled = ${opts.enabled};`);
    if (opts.guideLayer !== undefined)
        flagSetters.push(`layer.guideLayer = ${opts.guideLayer};`);
    if (opts.solo !== undefined)
        flagSetters.push(`layer.solo = ${opts.solo};`);
    if (opts.collapseTransformation !== undefined)
        flagSetters.push(`layer.collapseTransformation = ${opts.collapseTransformation};`);
    if (opts.adjustmentLayer !== undefined)
        flagSetters.push(`layer.adjustmentLayer = ${opts.adjustmentLayer};`);
    if (opts.threeDLayer !== undefined)
        flagSetters.push(`layer.threeDLayer = ${opts.threeDLayer};`);
    if (opts.motionBlur !== undefined)
        flagSetters.push(`layer.motionBlur = ${opts.motionBlur};`);
    return `
(function() {
  try {
    app.beginUndoGroup("MCP Set Layer Flags");
    ${buildCompTarget(opts.compName)}
    ${buildLayerRef(opts.layerIdentifier)}
    // Unlock first if we need to modify other properties
    var wasLocked = layer.locked;
    if (wasLocked) layer.locked = false;

    ${flagSetters.join("\n    ")}

    app.endUndoGroup();
    return {
      success: true,
      layerName: layer.name,
      locked: layer.locked,
      shy: layer.shy,
      enabled: layer.enabled,
      guideLayer: layer.guideLayer,
      solo: layer.solo,
      threeDLayer: layer.threeDLayer,
      adjustmentLayer: layer.adjustmentLayer,
      motionBlur: layer.motionBlur
    };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
})();
  `.trim();
}
export function buildParentLayerJsx(opts) {
    const parentRef = opts.parentLayerIdentifier === null
        ? `null`
        : typeof opts.parentLayerIdentifier === "number"
            ? `comp.layer(${opts.parentLayerIdentifier})`
            : `comp.layer("${sanitizeForJsx(String(opts.parentLayerIdentifier))}")`;
    return `
(function() {
  try {
    app.beginUndoGroup("MCP Parent Layer");
    ${buildCompTarget(opts.compName)}
    ${buildLayerRef(opts.childLayerIdentifier)}
    var childLayer = layer;
    var parentLayer = ${parentRef};
    ${opts.parentLayerIdentifier !== null ? `if (!parentLayer) return { success: false, error: "Parent layer not found" };` : ""}
    childLayer.parent = parentLayer;
    app.endUndoGroup();
    return {
      success: true,
      childLayer: childLayer.name,
      parentLayer: parentLayer ? parentLayer.name : null
    };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
})();
  `.trim();
}
const BLEND_MODE_MAP = {
    normal: "NORMAL",
    add: "ADD",
    multiply: "MULTIPLY",
    screen: "SCREEN",
    overlay: "OVERLAY",
    softLight: "SOFT_LIGHT",
    soft_light: "SOFT_LIGHT",
    hardLight: "HARD_LIGHT",
    hard_light: "HARD_LIGHT",
    colorDodge: "COLOR_DODGE",
    color_dodge: "COLOR_DODGE",
    colorBurn: "COLOR_BURN",
    color_burn: "COLOR_BURN",
    linearDodge: "LINEAR_DODGE",
    linear_dodge: "LINEAR_DODGE",
    linearBurn: "LINEAR_BURN",
    linear_burn: "LINEAR_BURN",
    darken: "DARKEN",
    lighten: "LIGHTEN",
    difference: "DIFFERENCE",
    exclusion: "EXCLUSION",
    hue: "HUE",
    saturation: "SATURATION",
    color: "COLOR",
    luminosity: "LUMINOSITY",
    dissolve: "DISSOLVE",
    dancingDissolve: "DANCING_DISSOLVE",
    dancing_dissolve: "DANCING_DISSOLVE",
    classicColorBurn: "CLASSIC_COLOR_BURN",
    classicColorDodge: "CLASSIC_COLOR_DODGE",
    classicDifference: "CLASSIC_DIFFERENCE",
    stencilAlpha: "STENCIL_ALPHA",
    stencil_alpha: "STENCIL_ALPHA",
    stencilLuma: "STENCIL_LUMA",
    stencil_luma: "STENCIL_LUMA",
    silhouetteAlpha: "SILHOUETTE_ALPHA",
    silhouette_alpha: "SILHOUETTE_ALPHA",
    silhouetteLuma: "SILHOUETTE_LUMA",
    silhouette_luma: "SILHOUETTE_LUMA",
    luminoscentPremul: "LUMINESCENT_PREMUL",
    vividLight: "VIVID_LIGHT",
    vivid_light: "VIVID_LIGHT",
    linearLight: "LINEAR_LIGHT",
    linear_light: "LINEAR_LIGHT",
    pinLight: "PIN_LIGHT",
    pin_light: "PIN_LIGHT",
    hardMix: "HARD_MIX",
    hard_mix: "HARD_MIX",
    lighterColor: "LIGHTER_COLOR",
    lighter_color: "LIGHTER_COLOR",
    darkerColor: "DARKER_COLOR",
    darker_color: "DARKER_COLOR",
    subtract: "SUBTRACT",
    divide: "DIVIDE",
};
export function buildSetBlendModeJsx(opts) {
    const modeConst = BLEND_MODE_MAP[opts.blendMode] || opts.blendMode.toUpperCase();
    return `
(function() {
  try {
    app.beginUndoGroup("MCP Set Blend Mode");
    ${buildCompTarget(opts.compName)}
    ${buildLayerRef(opts.layerIdentifier)}
    layer.blendingMode = BlendingMode.${modeConst};
    app.endUndoGroup();
    return { success: true, layerName: layer.name, blendMode: "${modeConst}" };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
})();
  `.trim();
}
export function buildSetTrackMatteJsx(opts) {
    const matteTypeMap = {
        alpha: "ALPHA",
        alphaInverted: "ALPHA_INVERTED",
        luma: "LUMA",
        lumaInverted: "LUMA_INVERTED",
        none: "NO_TRACK_MATTE",
    };
    const matteConst = matteTypeMap[opts.matteType] || "ALPHA";
    // If a specific matte layer is given, move it directly above the target layer
    const matteReorder = opts.matteLayerIdentifier !== undefined ? `
    var matteLayer = ${typeof opts.matteLayerIdentifier === "number"
        ? `comp.layer(${opts.matteLayerIdentifier})`
        : `comp.layer("${sanitizeForJsx(String(opts.matteLayerIdentifier))}")`};
    if (!matteLayer) return { success: false, error: "Matte layer not found" };
    // Track matte must be the layer directly above — reorder if needed
    if (matteLayer.index !== layer.index - 1) {
      matteLayer.moveBefore(layer);
    }
  ` : "";
    return `
(function() {
  try {
    app.beginUndoGroup("MCP Set Track Matte");
    ${buildCompTarget(opts.compName)}
    ${buildLayerRef(opts.layerIdentifier)}
    ${matteReorder}
    layer.trackMatteType = TrackMatteType.${matteConst};
    app.endUndoGroup();
    return { success: true, layerName: layer.name, trackMatteType: "${matteConst}" };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
})();
  `.trim();
}
export function buildReorderLayerJsx(opts) {
    return `
(function() {
  try {
    app.beginUndoGroup("MCP Reorder Layer");
    ${buildCompTarget(opts.compName)}
    ${buildLayerRef(opts.layerIdentifier)}
    var targetIndex = ${opts.newIndex};
    if (targetIndex < 1 || targetIndex > comp.numLayers) {
      return { success: false, error: "Target index " + targetIndex + " out of range (1-" + comp.numLayers + ")" };
    }
    if (targetIndex < layer.index) {
      layer.moveBefore(comp.layer(targetIndex));
    } else if (targetIndex > layer.index) {
      layer.moveAfter(comp.layer(targetIndex));
    }
    app.endUndoGroup();
    return { success: true, layerName: layer.name, newIndex: layer.index };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
})();
  `.trim();
}
export function buildAddAdjustmentLayerJsx(opts) {
    const name = opts.name || "Adjustment Layer";
    const color = opts.color ? hexToRgbNormalized(opts.color) : "[1, 1, 1]";
    return `
(function() {
  try {
    app.beginUndoGroup("MCP Add Adjustment Layer");
    ${buildCompTarget(opts.compName)}
    var adjLayer = comp.layers.addSolid(${color}, "${sanitizeForJsx(name)}", comp.width, comp.height, 1.0, comp.duration);
    adjLayer.adjustmentLayer = true;
    adjLayer.moveToBeginning();
    app.endUndoGroup();
    return { success: true, layerIndex: adjLayer.index, layerName: adjLayer.name };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
})();
  `.trim();
}
export function buildTimeReverseLayerJsx(opts) {
    return `
(function() {
  try {
    app.beginUndoGroup("MCP Time Reverse Layer");
    ${buildCompTarget(opts.compName)}
    ${buildLayerRef(opts.layerIdentifier)}
    layer.timeRemapEnabled = true;
    var timeRemap = layer.property("ADBE Time Remapping");
    if (timeRemap && timeRemap.numKeys >= 2) {
      var startVal = timeRemap.keyValue(1);
      var endVal = timeRemap.keyValue(timeRemap.numKeys);
      timeRemap.setValueAtTime(timeRemap.keyTime(1), endVal);
      timeRemap.setValueAtTime(timeRemap.keyTime(timeRemap.numKeys), startVal);
    }
    app.endUndoGroup();
    return { success: true, layerName: layer.name, reversed: true };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
})();
  `.trim();
}
