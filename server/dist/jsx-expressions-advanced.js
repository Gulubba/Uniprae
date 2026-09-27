/**
 * Advanced Expressions JSX Templates
 * Covers: validate expression, toggle expression, expression library
 */
import { sanitizeForJsx, buildCompTarget, buildLayerRef } from "./jsx-helpers.js";
export function buildValidateExpressionJsx(opts) {
    const pathChain = opts.propertyPath.map(p => `property("${sanitizeForJsx(p)}")`).join(".");
    return `
(function() {
  try {
    ${buildCompTarget(opts.compName)}
    ${buildLayerRef(opts.layerIdentifier)}

    var prop = layer.${pathChain};
    if (!prop) return { success: false, error: "Property not found" };

    // Save current expression state
    var hadExpression = prop.expressionEnabled;
    var oldExpression = prop.expression;

    // Try applying the expression
    try {
      prop.expression = ${JSON.stringify(opts.expression)};
      // Check if AE flagged it as invalid
      if (prop.expressionError && prop.expressionError !== "") {
        var errMsg = prop.expressionError;
        // Restore original state
        prop.expression = oldExpression;
        prop.expressionEnabled = hadExpression;
        return { success: true, valid: false, error: errMsg };
      }
      // Restore original state
      prop.expression = oldExpression;
      prop.expressionEnabled = hadExpression;
      return { success: true, valid: true, expression: ${JSON.stringify(opts.expression)} };
    } catch(e) {
      // Restore original state
      try { prop.expression = oldExpression; prop.expressionEnabled = hadExpression; } catch(ex) {}
      return { success: true, valid: false, error: e.toString() };
    }
  } catch (err) {
    return { success: false, error: err.toString() };
  }
})();
  `.trim();
}
export function buildToggleExpressionJsx(opts) {
    const pathChain = opts.propertyPath.map(p => `property("${sanitizeForJsx(p)}")`).join(".");
    return `
(function() {
  try {
    app.beginUndoGroup("MCP Toggle Expression");
    ${buildCompTarget(opts.compName)}
    ${buildLayerRef(opts.layerIdentifier)}

    var prop = layer.${pathChain};
    if (!prop) return { success: false, error: "Property not found" };

    if (!prop.expression || prop.expression === "") {
      return { success: false, error: "Property has no expression to toggle" };
    }

    prop.expressionEnabled = ${opts.enabled};
    app.endUndoGroup();
    return {
      success: true,
      enabled: prop.expressionEnabled,
      expression: prop.expression,
      expressionError: prop.expressionError || null
    };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
})();
  `.trim();
}
const EXPRESSION_PRESETS = {
    wiggle: (p) => `wiggle(${p?.frequency || 3}, ${p?.amplitude || 25})`,
    inertialBounce: (p) => `
// Inertial Bounce
var n = 0;
if (numKeys > 0) {
  n = nearestKey(time).index;
  if (key(n).time > time) { n--; }
}
if (n == 0) { t = 0; } else { t = time - key(n).time; }
if (n > 0 && t < ${p?.duration || 2}) {
  var v = velocityAtTime(key(n).time - thisComp.frameDuration / 10);
  var amp = ${p?.amplitude || 0.06};
  var freq = ${p?.frequency || 3};
  var decay = ${p?.decay || 5};
  value + v * amp * Math.sin(freq * t * 2 * Math.PI) / Math.exp(decay * t);
} else { value; }`.trim(),
    elasticScale: (p) => `
// Elastic Scale
var freq = ${p?.frequency || 3};
var decay = ${p?.decay || 5};
var n = 0;
if (numKeys > 0) {
  n = nearestKey(time).index;
  if (key(n).time > time) n--;
}
if (n > 0) {
  var t = time - key(n).time;
  var startVal = key(n).value;
  var amp = velocityAtTime(key(n).time - 0.001);
  var w = freq * Math.PI * 2;
  value + amp * (Math.sin(t * w) / Math.exp(decay * t)) / w;
} else { value; }`.trim(),
    autoRotate: (p) => `
// Auto Orient Along Path
var d = ${p?.lookAhead || 0.05};
var p1 = position.valueAtTime(time);
var p2 = position.valueAtTime(time + d);
var delta = p2 - p1;
radiansToDegrees(Math.atan2(delta[1], delta[0]));`.trim(),
    timeRemap: (p) => `
// Smooth Time Remap with Speed Control
var speed = ${p?.speed || 1};
time * speed`.trim(),
    fadeInOut: (p) => `
// Fade In and Out
var fadeIn = ${p?.fadeIn || 0.5};
var fadeOut = ${p?.fadeOut || 0.5};
var fadeInEnd = inPoint + fadeIn;
var fadeOutStart = outPoint - fadeOut;
if (time < fadeInEnd) {
  linear(time, inPoint, fadeInEnd, 0, 100);
} else if (time > fadeOutStart) {
  linear(time, fadeOutStart, outPoint, 100, 0);
} else { 100; }`.trim(),
    parallax: (p) => `
// Parallax scrolling based on null controller
var speed = ${p?.speed || 1};
var ctrl = thisComp.layer("${p?.controllerName || "Controller"}");
value + (ctrl.transform.position - [thisComp.width/2, thisComp.height/2]) * speed * -0.1;`.trim(),
    typewriter: () => `
// Typewriter effect
var speed = 5;
var numChars = Math.floor(time * speed);
text.sourceText.substr(0, numChars)`.trim(),
    counter: (p) => `
// Number counter
var startVal = ${p?.start || 0};
var endVal = ${p?.end || 100};
var dur = ${p?.duration || 3};
var t = Math.min(time / dur, 1);
var eased = t * t * (3 - 2 * t); // smoothstep
Math.round(linear(eased, 0, 1, startVal, endVal))`.trim(),
    pendulum: (p) => `
// Pendulum swing
var freq = ${p?.frequency || 2};
var amp = ${p?.amplitude || 30};
var decay = ${p?.decay || 3};
amp * Math.sin(time * freq * Math.PI * 2) * Math.exp(-time * decay)`.trim(),
};
export function buildExpressionLibraryJsx(opts) {
    const pathChain = opts.propertyPath.map(p => `property("${sanitizeForJsx(p)}")`).join(".");
    const presetFn = EXPRESSION_PRESETS[opts.presetName];
    if (!presetFn) {
        // Return an error result
        const availablePresets = Object.keys(EXPRESSION_PRESETS).join(", ");
        return `(function() { return { success: false, error: "Unknown preset '${sanitizeForJsx(opts.presetName)}'. Available: ${availablePresets}" }; })();`;
    }
    const expression = presetFn(opts.params);
    return `
(function() {
  try {
    app.beginUndoGroup("MCP Expression Library");
    ${buildCompTarget(opts.compName)}
    ${buildLayerRef(opts.layerIdentifier)}

    var prop = layer.${pathChain};
    if (!prop) return { success: false, error: "Property not found" };

    prop.expression = ${JSON.stringify(expression)};

    if (prop.expressionError && prop.expressionError !== "") {
      return { success: false, error: "Expression error: " + prop.expressionError, expression: prop.expression };
    }

    app.endUndoGroup();
    return { success: true, preset: "${sanitizeForJsx(opts.presetName)}", expression: prop.expression };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
})();
  `.trim();
}
