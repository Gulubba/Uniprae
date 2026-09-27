export interface SplitLayerOptions {
    compName?: string;
    layerIdentifier: string | number;
    splitTime?: number;
}
export declare function buildSplitLayerJsx(opts: SplitLayerOptions): string;
export interface SetLayerFlagsOptions {
    compName?: string;
    layerIdentifier: string | number;
    locked?: boolean;
    shy?: boolean;
    enabled?: boolean;
    guideLayer?: boolean;
    solo?: boolean;
    collapseTransformation?: boolean;
    adjustmentLayer?: boolean;
    threeDLayer?: boolean;
    motionBlur?: boolean;
}
export declare function buildSetLayerFlagsJsx(opts: SetLayerFlagsOptions): string;
export interface ParentLayerOptions {
    compName?: string;
    childLayerIdentifier: string | number;
    parentLayerIdentifier: string | number | null;
}
export declare function buildParentLayerJsx(opts: ParentLayerOptions): string;
export interface SetBlendModeOptions {
    compName?: string;
    layerIdentifier: string | number;
    blendMode: string;
}
export declare function buildSetBlendModeJsx(opts: SetBlendModeOptions): string;
export interface SetTrackMatteOptions {
    compName?: string;
    layerIdentifier: string | number;
    matteType: "alpha" | "alphaInverted" | "luma" | "lumaInverted" | "none";
    matteLayerIdentifier?: string | number;
}
export declare function buildSetTrackMatteJsx(opts: SetTrackMatteOptions): string;
export interface ReorderLayerOptions {
    compName?: string;
    layerIdentifier: string | number;
    newIndex: number;
}
export declare function buildReorderLayerJsx(opts: ReorderLayerOptions): string;
export interface AddAdjustmentLayerOptions {
    compName?: string;
    name?: string;
    color?: string;
}
export declare function buildAddAdjustmentLayerJsx(opts: AddAdjustmentLayerOptions): string;
export interface TimeReverseLayerOptions {
    compName?: string;
    layerIdentifier: string | number;
}
export declare function buildTimeReverseLayerJsx(opts: TimeReverseLayerOptions): string;
