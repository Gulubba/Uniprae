/** Shared temp directory constant for JSX path references */
export declare function getTmpDir(): string;
/**
 * Sanitize a user-supplied string before interpolating into generated JSX.
 * Escapes backslashes, double-quotes, and newlines to prevent injection.
 */
export declare function sanitizeForJsx(input: string): string;
/**
 * Convert hex color (#RRGGBB) to [R, G, B] normalized array string [0..1]
 */
export declare function hexToRgbNormalized(hex: string): string;
/**
 * Generate JSX code to target a specific composition by name or use active comp.
 */
export declare function buildCompTarget(compName?: string): string;
/**
 * Generate JSX code to target a specific layer by name or index.
 */
export declare function buildLayerRef(layerIdentifier: string | number): string;
