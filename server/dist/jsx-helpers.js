/**
 * Shared utility functions for JSX template generation.
 * Used by all jsx-* template modules.
 */
import os from "os";
/** Shared temp directory constant for JSX path references */
export function getTmpDir() {
    return os.tmpdir().replace(/\\/g, "/");
}
/**
 * Sanitize a user-supplied string before interpolating into generated JSX.
 * Escapes backslashes, double-quotes, and newlines to prevent injection.
 */
export function sanitizeForJsx(input) {
    return input
        .replace(/\\/g, "\\\\")
        .replace(/"/g, '\\"')
        .replace(/\n/g, "\\n")
        .replace(/\r/g, "\\r");
}
/**
 * Convert hex color (#RRGGBB) to [R, G, B] normalized array string [0..1]
 */
export function hexToRgbNormalized(hex) {
    const cleanHex = hex.replace("#", "");
    const r = parseInt(cleanHex.substring(0, 2), 16) / 255;
    const g = parseInt(cleanHex.substring(2, 4), 16) / 255;
    const b = parseInt(cleanHex.substring(4, 6), 16) / 255;
    return `[${r.toFixed(4)}, ${g.toFixed(4)}, ${b.toFixed(4)}]`;
}
/**
 * Generate JSX code to target a specific composition by name or use active comp.
 */
export function buildCompTarget(compName) {
    if (compName) {
        return `var comp = null; for (var i = 1; i <= app.project.numItems; i++) { if (app.project.item(i) instanceof CompItem && app.project.item(i).name === "${sanitizeForJsx(compName)}") { comp = app.project.item(i); break; } } if (!comp) throw new Error("Composition '${sanitizeForJsx(compName)}' not found");`;
    }
    return `var comp = app.project.activeItem; if (!comp || !(comp instanceof CompItem)) throw new Error("No active composition found");`;
}
/**
 * Generate JSX code to target a specific layer by name or index.
 */
export function buildLayerRef(layerIdentifier) {
    if (typeof layerIdentifier === "number") {
        return `var layer = comp.layer(${layerIdentifier}); if (!layer) throw new Error("Layer at index ${layerIdentifier} not found");`;
    }
    return `var layer = comp.layer("${sanitizeForJsx(String(layerIdentifier))}"); if (!layer) throw new Error("Layer '${sanitizeForJsx(String(layerIdentifier))}' not found");`;
}
