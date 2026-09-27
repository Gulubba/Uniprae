/**
 * Animation & Keyframe System JSX Templates
 * Covers: bezier easing, keyframe copy/paste, loop, delete, roving
 */
import { sanitizeForJsx, buildCompTarget, buildLayerRef } from "./jsx-helpers.js";
export function buildSetBezierEasingJsx(opts) {
    const pathChain = opts.propertyPath.map(p => `property("${sanitizeForJsx(p)}")`).join(".");
    // Preset mappings
    let inSpeed = opts.inSpeed ?? 0;
    let inInfluence = opts.inInfluence ?? 33;
    let outSpeed = opts.outSpeed ?? 0;
    let outInfluence = opts.outInfluence ?? 33;
    if (opts.preset) {
        switch (opts.preset) {
            case "smooth":
                inSpeed = 0;
                inInfluence = 66;
                outSpeed = 0;
                outInfluence = 66;
                break;
            case "sharp":
                inSpeed = 0;
                inInfluence = 10;
                outSpeed = 0;
                outInfluence = 10;
                break;
            case "overshoot":
                inSpeed = 0;
                inInfluence = 80;
                outSpeed = 0;
                outInfluence = 20;
                break;
            case "anticipation":
                inSpeed = 0;
                inInfluence = 20;
                outSpeed = 0;
                outInfluence = 80;
                break;
            case "easeIn":
                inSpeed = 0;
                inInfluence = 75;
                outSpeed = 0;
                outInfluence = 0.1;
                break;
            case "easeOut":
                inSpeed = 0;
                inInfluence = 0.1;
                outSpeed = 0;
                outInfluence = 75;
                break;
        }
    }
    const spatialInCode = opts.spatialIn
        ? `prop.setSpatialTangentsAtKey(k, ${JSON.stringify(opts.spatialIn)}, prop.keySpatialTangent(k, "out"));`
        : "";
    const spatialOutCode = opts.spatialOut
        ? `prop.setSpatialTangentsAtKey(k, prop.keySpatialTangent(k, "in"), ${JSON.stringify(opts.spatialOut)});`
        : "";
    return `
(function() {
  try {
    app.beginUndoGroup("MCP Set Bezier Easing");
    ${buildCompTarget(opts.compName)}
    ${buildLayerRef(opts.layerIdentifier)}

    var prop = layer.${pathChain};
    if (!prop) return { success: false, error: "Property path not found" };
    if (prop.numKeys === 0) return { success: false, error: "Property has no keyframes" };

    // Determine property dimensions
    var dims = 1;
    try {
      var testVal = prop.valueAtTime(0, false);
      if (testVal instanceof Array) dims = testVal.length;
    } catch(e) {}

    var easeIn = new KeyframeEase(${inSpeed}, ${inInfluence});
    var easeOut = new KeyframeEase(${outSpeed}, ${outInfluence});

    function buildEaseArr(easeObj, d) {
      var arr = [];
      for (var i = 0; i < d; i++) arr.push(easeObj);
      return arr;
    }

    var startK = ${opts.keyframeIndex && opts.keyframeIndex > 0 ? opts.keyframeIndex : 1};
    var endK = ${opts.keyframeIndex && opts.keyframeIndex > 0 ? opts.keyframeIndex : "prop.numKeys"};

    var modifiedCount = 0;
    for (var k = startK; k <= endK; k++) {
      prop.setTemporalEaseAtKey(k, buildEaseArr(easeIn, dims), buildEaseArr(easeOut, dims));
      ${spatialInCode}
      ${spatialOutCode}
      modifiedCount++;
    }

    app.endUndoGroup();
    return { success: true, modifiedKeyframes: modifiedCount, inInfluence: ${inInfluence}, outInfluence: ${outInfluence} };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
})();
  `.trim();
}
export function buildCopyPasteKeyframesJsx(opts) {
    const srcPathChain = opts.sourcePropertyPath.map(p => `property("${sanitizeForJsx(p)}")`).join(".");
    const tgtPathChain = opts.targetPropertyPath.map(p => `property("${sanitizeForJsx(p)}")`).join(".");
    const srcLayerRef = typeof opts.sourceLayerIdentifier === "number"
        ? `comp.layer(${opts.sourceLayerIdentifier})`
        : `comp.layer("${sanitizeForJsx(String(opts.sourceLayerIdentifier))}")`;
    const tgtLayerRef = typeof opts.targetLayerIdentifier === "number"
        ? `comp.layer(${opts.targetLayerIdentifier})`
        : `comp.layer("${sanitizeForJsx(String(opts.targetLayerIdentifier))}")`;
    return `
(function() {
  try {
    app.beginUndoGroup("MCP Copy Paste Keyframes");
    ${buildCompTarget(opts.compName)}

    var srcLayer = ${srcLayerRef};
    var tgtLayer = ${tgtLayerRef};
    if (!srcLayer) return { success: false, error: "Source layer not found" };
    if (!tgtLayer) return { success: false, error: "Target layer not found" };

    var srcProp = srcLayer.${srcPathChain};
    var tgtProp = tgtLayer.${tgtPathChain};
    if (!srcProp) return { success: false, error: "Source property not found" };
    if (!tgtProp) return { success: false, error: "Target property not found" };
    if (srcProp.numKeys === 0) return { success: false, error: "Source property has no keyframes" };

    var offset = ${opts.timeOffset || 0};
    var copied = 0;

    for (var k = 1; k <= srcProp.numKeys; k++) {
      var t = srcProp.keyTime(k) + offset;
      var v = srcProp.keyValue(k);
      tgtProp.setValueAtTime(t, v);
      copied++;

      // Copy easing
      try {
        var eIn = srcProp.keyInTemporalEase(k);
        var eOut = srcProp.keyOutTemporalEase(k);
        var newKeyIdx = tgtProp.nearestKeyIndex(t);
        tgtProp.setTemporalEaseAtKey(newKeyIdx, eIn, eOut);
      } catch(e) {}
    }

    app.endUndoGroup();
    return { success: true, copiedKeyframes: copied, timeOffset: offset };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
})();
  `.trim();
}
export function buildLoopKeyframesJsx(opts) {
    const pathChain = opts.propertyPath.map(p => `property("${sanitizeForJsx(p)}")`).join(".");
    const loopMap = {
        cycle: "cycle",
        pingpong: "pingpong",
        offset: "offset",
        continue: "continue",
    };
    const loopFn = loopMap[opts.loopType] || "cycle";
    const exprParts = [];
    if (opts.loopIn)
        exprParts.push(`loopIn("${loopFn}")`);
    if (opts.loopOut !== false)
        exprParts.push(`loopOut("${loopFn}")`);
    // For combined in+out, we need a more complex expression
    let expr;
    if (opts.loopIn && opts.loopOut !== false) {
        expr = `loopIn("${loopFn}") + loopOut("${loopFn}") - value`;
    }
    else if (opts.loopIn) {
        expr = `loopIn("${loopFn}")`;
    }
    else {
        expr = `loopOut("${loopFn}")`;
    }
    return `
(function() {
  try {
    app.beginUndoGroup("MCP Loop Keyframes");
    ${buildCompTarget(opts.compName)}
    ${buildLayerRef(opts.layerIdentifier)}

    var prop = layer.${pathChain};
    if (!prop) return { success: false, error: "Property not found" };
    if (prop.numKeys === 0) return { success: false, error: "Property has no keyframes to loop" };

    prop.expression = ${JSON.stringify(expr)};
    app.endUndoGroup();
    return { success: true, expression: prop.expression, loopType: "${loopFn}" };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
})();
  `.trim();
}
export function buildDeleteKeyframesJsx(opts) {
    const pathChain = opts.propertyPath.map(p => `property("${sanitizeForJsx(p)}")`).join(".");
    return `
(function() {
  try {
    app.beginUndoGroup("MCP Delete Keyframes");
    ${buildCompTarget(opts.compName)}
    ${buildLayerRef(opts.layerIdentifier)}

    var prop = layer.${pathChain};
    if (!prop) return { success: false, error: "Property not found" };
    if (prop.numKeys === 0) return { success: false, error: "Property has no keyframes" };

    var deleted = 0;
    ${opts.keyframeIndex && opts.keyframeIndex > 0
        ? `prop.removeKey(${opts.keyframeIndex}); deleted = 1;`
        : opts.timeRange
            ? `
    for (var k = prop.numKeys; k >= 1; k--) {
      var t = prop.keyTime(k);
      if (t >= ${opts.timeRange[0]} && t <= ${opts.timeRange[1]}) {
        prop.removeKey(k);
        deleted++;
      }
    }
    `
            : `
    while (prop.numKeys > 0) {
      prop.removeKey(1);
      deleted++;
    }
    `}

    app.endUndoGroup();
    return { success: true, deletedKeyframes: deleted, remainingKeyframes: prop.numKeys };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
})();
  `.trim();
}
export function buildSetRovingKeyframesJsx(opts) {
    const pathChain = opts.propertyPath.map(p => `property("${sanitizeForJsx(p)}")`).join(".");
    return `
(function() {
  try {
    app.beginUndoGroup("MCP Set Roving Keyframes");
    ${buildCompTarget(opts.compName)}
    ${buildLayerRef(opts.layerIdentifier)}

    var prop = layer.${pathChain};
    if (!prop) return { success: false, error: "Property not found" };
    if (prop.numKeys < 3) return { success: false, error: "Need at least 3 keyframes for roving (first and last cannot rove)" };

    // Set roving for all keyframes except first and last
    var modified = 0;
    for (var k = 2; k < prop.numKeys; k++) {
      if (${opts.enabled}) {
        prop.setRovingAtKey(k, true);
      } else {
        prop.setRovingAtKey(k, false);
      }
      modified++;
    }

    app.endUndoGroup();
    return { success: true, modifiedKeyframes: modified, roving: ${opts.enabled} };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
})();
  `.trim();
}
