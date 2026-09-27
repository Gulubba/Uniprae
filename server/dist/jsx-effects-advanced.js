/**
 * Advanced Effects Engine & Layer Styles JSX Templates
 * Covers: remove/disable effects, layer styles, effect property set, available effects inventory
 */
import { sanitizeForJsx, buildCompTarget, buildLayerRef, hexToRgbNormalized } from "./jsx-helpers.js";
export function buildRemoveEffectJsx(opts) {
    return `
(function() {
  try {
    app.beginUndoGroup("MCP Remove Effect");
    ${buildCompTarget(opts.compName)}
    ${buildLayerRef(opts.layerIdentifier)}
    var fx = layer.property("ADBE Effect Parade");
    if (!fx || fx.numProperties === 0) return { success: false, error: "Layer has no effects" };

    var effect = null;
    ${opts.effectIndex !== undefined
        ? `effect = fx.property(${opts.effectIndex});`
        : opts.effectName
            ? `for (var i = 1; i <= fx.numProperties; i++) { if (fx.property(i).name === "${sanitizeForJsx(opts.effectName)}") { effect = fx.property(i); break; } }`
            : `return { success: false, error: "Provide effectName or effectIndex" };`}
    if (!effect) return { success: false, error: "Effect not found" };
    var removedName = effect.name;
    effect.remove();
    app.endUndoGroup();
    return { success: true, removedEffect: removedName, remainingEffects: fx.numProperties };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
})();
  `.trim();
}
export function buildToggleEffectJsx(opts) {
    return `
(function() {
  try {
    app.beginUndoGroup("MCP Toggle Effect");
    ${buildCompTarget(opts.compName)}
    ${buildLayerRef(opts.layerIdentifier)}
    var fx = layer.property("ADBE Effect Parade");
    if (!fx || fx.numProperties === 0) return { success: false, error: "Layer has no effects" };

    var effect = null;
    ${opts.effectIndex !== undefined
        ? `effect = fx.property(${opts.effectIndex});`
        : opts.effectName
            ? `for (var i = 1; i <= fx.numProperties; i++) { if (fx.property(i).name === "${sanitizeForJsx(opts.effectName)}") { effect = fx.property(i); break; } }`
            : `return { success: false, error: "Provide effectName or effectIndex" };`}
    if (!effect) return { success: false, error: "Effect not found" };
    effect.enabled = ${opts.enabled};
    app.endUndoGroup();
    return { success: true, effectName: effect.name, enabled: effect.enabled };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
})();
  `.trim();
}
export function buildSetEffectPropertyJsx(opts) {
    return `
(function() {
  try {
    app.beginUndoGroup("MCP Set Effect Property");
    ${buildCompTarget(opts.compName)}
    ${buildLayerRef(opts.layerIdentifier)}
    var fx = layer.property("ADBE Effect Parade");
    if (!fx || fx.numProperties === 0) return { success: false, error: "Layer has no effects" };

    var effect = null;
    ${opts.effectIndex !== undefined
        ? `effect = fx.property(${opts.effectIndex});`
        : opts.effectName
            ? `for (var i = 1; i <= fx.numProperties; i++) { if (fx.property(i).name === "${sanitizeForJsx(opts.effectName)}") { effect = fx.property(i); break; } }`
            : `return { success: false, error: "Provide effectName or effectIndex" };`}
    if (!effect) return { success: false, error: "Effect not found" };

    var prop = effect.property("${sanitizeForJsx(opts.propertyName)}");
    if (!prop) return { success: false, error: "Property '${sanitizeForJsx(opts.propertyName)}' not found on effect" };

    ${opts.time !== undefined
        ? `prop.setValueAtTime(${opts.time}, ${JSON.stringify(opts.value)});`
        : `prop.setValue(${JSON.stringify(opts.value)});`}

    app.endUndoGroup();
    return { success: true, effectName: effect.name, property: "${sanitizeForJsx(opts.propertyName)}" };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
})();
  `.trim();
}
// ═══════════════════════════════════════════════════════════════
// Get Available Effects Inventory
// ═══════════════════════════════════════════════════════════════
export function buildGetAvailableEffectsJsx() {
    return `
(function() {
  try {
    // Create a temporary solid to probe available effects
    var comp = app.project.activeItem;
    if (!comp || !(comp instanceof CompItem)) {
      // Create a temp comp to probe
      comp = app.project.items.addComp("__tmp_probe__", 100, 100, 1, 1, 30);
    }
    var probe = comp.layers.addSolid([0,0,0], "__probe__", 100, 100, 1, 1);
    var effectsGroup = probe.property("ADBE Effect Parade");

    var categories = {};
    // Get all effect match names via the app.effects array
    var effectsList = [];
    try {
      if (app.effects) {
        for (var i = 0; i < app.effects.length; i++) {
          effectsList.push({
            name: app.effects[i].displayName,
            matchName: app.effects[i].matchName,
            category: app.effects[i].category
          });
          var cat = app.effects[i].category || "Uncategorized";
          if (!categories[cat]) categories[cat] = [];
          categories[cat].push(app.effects[i].displayName);
        }
      }
    } catch(e) {
      // Fallback: just report common effects
      effectsList.push({ name: "Could not enumerate effects", error: e.toString() });
    }

    // Clean up probe
    probe.remove();
    if (comp.name === "__tmp_probe__") comp.remove();

    return { success: true, effects: effectsList, categories: categories, totalCount: effectsList.length };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
})();
  `.trim();
}
export function buildSetLayerStylesJsx(opts) {
    const styleSetters = [];
    if (opts.dropShadow) {
        const ds = opts.dropShadow;
        styleSetters.push(`
    try {
      var dsGroup = styles.property("ADBE Drop Shadow");
      if (dsGroup) {
        dsGroup.property("ADBE Drop Shadow-0001").setValue(${ds.enabled !== false ? 1 : 0}); // enabled
        ${ds.color ? `dsGroup.property("ADBE Drop Shadow-0002").setValue(${hexToRgbNormalized(ds.color)});` : ""}
        ${ds.opacity !== undefined ? `dsGroup.property("ADBE Drop Shadow-0003").setValue(${ds.opacity});` : ""}
        ${ds.angle !== undefined ? `dsGroup.property("ADBE Drop Shadow-0005").setValue(${ds.angle});` : ""}
        ${ds.distance !== undefined ? `dsGroup.property("ADBE Drop Shadow-0006").setValue(${ds.distance});` : ""}
        ${ds.spread !== undefined ? `dsGroup.property("ADBE Drop Shadow-0007").setValue(${ds.spread});` : ""}
        ${ds.size !== undefined ? `dsGroup.property("ADBE Drop Shadow-0008").setValue(${ds.size});` : ""}
      }
    } catch(e) { errors.push("dropShadow: " + e.toString()); }
    `);
    }
    if (opts.innerShadow) {
        const is = opts.innerShadow;
        styleSetters.push(`
    try {
      var isGroup = styles.property("ADBE Inner Shadow");
      if (isGroup) {
        isGroup.property("ADBE Inner Shadow-0001").setValue(${is.enabled !== false ? 1 : 0});
        ${is.color ? `isGroup.property("ADBE Inner Shadow-0002").setValue(${hexToRgbNormalized(is.color)});` : ""}
        ${is.opacity !== undefined ? `isGroup.property("ADBE Inner Shadow-0003").setValue(${is.opacity});` : ""}
        ${is.angle !== undefined ? `isGroup.property("ADBE Inner Shadow-0005").setValue(${is.angle});` : ""}
        ${is.distance !== undefined ? `isGroup.property("ADBE Inner Shadow-0006").setValue(${is.distance});` : ""}
        ${is.size !== undefined ? `isGroup.property("ADBE Inner Shadow-0008").setValue(${is.size});` : ""}
      }
    } catch(e) { errors.push("innerShadow: " + e.toString()); }
    `);
    }
    if (opts.outerGlow) {
        const og = opts.outerGlow;
        styleSetters.push(`
    try {
      var ogGroup = styles.property("ADBE Outer Glow");
      if (ogGroup) {
        ogGroup.property("ADBE Outer Glow-0001").setValue(${og.enabled !== false ? 1 : 0});
        ${og.color ? `ogGroup.property("ADBE Outer Glow-0002").setValue(${hexToRgbNormalized(og.color)});` : ""}
        ${og.opacity !== undefined ? `ogGroup.property("ADBE Outer Glow-0003").setValue(${og.opacity});` : ""}
        ${og.spread !== undefined ? `ogGroup.property("ADBE Outer Glow-0006").setValue(${og.spread});` : ""}
        ${og.size !== undefined ? `ogGroup.property("ADBE Outer Glow-0008").setValue(${og.size});` : ""}
      }
    } catch(e) { errors.push("outerGlow: " + e.toString()); }
    `);
    }
    if (opts.innerGlow) {
        const ig = opts.innerGlow;
        styleSetters.push(`
    try {
      var igGroup = styles.property("ADBE Inner Glow");
      if (igGroup) {
        igGroup.property("ADBE Inner Glow-0001").setValue(${ig.enabled !== false ? 1 : 0});
        ${ig.color ? `igGroup.property("ADBE Inner Glow-0002").setValue(${hexToRgbNormalized(ig.color)});` : ""}
        ${ig.opacity !== undefined ? `igGroup.property("ADBE Inner Glow-0003").setValue(${ig.opacity});` : ""}
        ${ig.size !== undefined ? `igGroup.property("ADBE Inner Glow-0008").setValue(${ig.size});` : ""}
      }
    } catch(e) { errors.push("innerGlow: " + e.toString()); }
    `);
    }
    if (opts.bevelEmboss) {
        const be = opts.bevelEmboss;
        styleSetters.push(`
    try {
      var beGroup = styles.property("ADBE Bevel Emboss");
      if (beGroup) {
        beGroup.property("ADBE Bevel Emboss-0001").setValue(${be.enabled !== false ? 1 : 0});
        ${be.style !== undefined ? `beGroup.property("ADBE Bevel Emboss-0002").setValue(${be.style});` : ""}
        ${be.depth !== undefined ? `beGroup.property("ADBE Bevel Emboss-0003").setValue(${be.depth});` : ""}
        ${be.size !== undefined ? `beGroup.property("ADBE Bevel Emboss-0005").setValue(${be.size});` : ""}
        ${be.soften !== undefined ? `beGroup.property("ADBE Bevel Emboss-0006").setValue(${be.soften});` : ""}
        ${be.angle !== undefined ? `beGroup.property("ADBE Bevel Emboss-0007").setValue(${be.angle});` : ""}
        ${be.altitude !== undefined ? `beGroup.property("ADBE Bevel Emboss-0008").setValue(${be.altitude});` : ""}
      }
    } catch(e) { errors.push("bevelEmboss: " + e.toString()); }
    `);
    }
    if (opts.colorOverlay) {
        const co = opts.colorOverlay;
        styleSetters.push(`
    try {
      var coGroup = styles.property("ADBE Color Overlay");
      if (coGroup) {
        coGroup.property("ADBE Color Overlay-0001").setValue(${co.enabled !== false ? 1 : 0});
        ${co.color ? `coGroup.property("ADBE Color Overlay-0002").setValue(${hexToRgbNormalized(co.color)});` : ""}
        ${co.opacity !== undefined ? `coGroup.property("ADBE Color Overlay-0003").setValue(${co.opacity});` : ""}
      }
    } catch(e) { errors.push("colorOverlay: " + e.toString()); }
    `);
    }
    if (opts.stroke) {
        const st = opts.stroke;
        styleSetters.push(`
    try {
      var stGroup = styles.property("ADBE Stroke");
      if (stGroup) {
        stGroup.property("ADBE Stroke-0001").setValue(${st.enabled !== false ? 1 : 0});
        ${st.color ? `stGroup.property("ADBE Stroke-0002").setValue(${hexToRgbNormalized(st.color)});` : ""}
        ${st.size !== undefined ? `stGroup.property("ADBE Stroke-0004").setValue(${st.size});` : ""}
        ${st.position !== undefined ? `stGroup.property("ADBE Stroke-0005").setValue(${st.position});` : ""}
        ${st.opacity !== undefined ? `stGroup.property("ADBE Stroke-0003").setValue(${st.opacity});` : ""}
      }
    } catch(e) { errors.push("stroke: " + e.toString()); }
    `);
    }
    return `
(function() {
  try {
    app.beginUndoGroup("MCP Set Layer Styles");
    ${buildCompTarget(opts.compName)}
    ${buildLayerRef(opts.layerIdentifier)}

    // Layer Styles must be enabled first
    var styles = layer.property("ADBE Layer Styles");
    if (!styles) {
      return { success: false, error: "Layer Styles not available on this layer type. Precompose shape layers first." };
    }

    var errors = [];

    ${styleSetters.join("\n")}

    app.endUndoGroup();
    if (errors.length > 0) {
      return { success: true, layerName: layer.name, warnings: errors };
    }
    return { success: true, layerName: layer.name, stylesApplied: true };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
})();
  `.trim();
}
