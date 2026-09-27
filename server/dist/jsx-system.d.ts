export declare function buildGetSystemInfoJsx(): string;
export declare function buildMemoryCleanupJsx(): string;
export declare function buildGetPluginInventoryJsx(): string;
export interface UndoOptions {
    action: "undo" | "redo";
    steps?: number;
}
export declare function buildUndoJsx(opts: UndoOptions): string;
export declare function buildCheckRenderFeasibilityJsx(compName?: string): string;
export declare function buildProjectDiffJsx(): string;
export interface AddMaskOptions {
    compName?: string;
    layerIdentifier: string | number;
    vertices: number[][];
    mode?: "add" | "subtract" | "intersect" | "difference" | "none";
    feather?: number;
    expansion?: number;
    opacity?: number;
    inverted?: boolean;
    name?: string;
}
export declare function buildAddMaskJsx(opts: AddMaskOptions): string;
export interface AnimateMaskOptions {
    compName?: string;
    layerIdentifier: string | number;
    maskIndex: number;
    keyframes: Array<{
        time: number;
        vertices: number[][];
    }>;
}
export declare function buildAnimateMaskJsx(opts: AnimateMaskOptions): string;
export interface TextUpdateOptions {
    compName?: string;
    layerIdentifier: string | number;
    newText: string;
    preserveFormatting?: boolean;
}
export declare function buildTextUpdateJsx(opts: TextUpdateOptions): string;
export interface TextToShapesOptions {
    compName?: string;
    layerIdentifier: string | number;
}
export declare function buildTextToShapesJsx(opts: TextToShapesOptions): string;
