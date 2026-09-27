export interface BezierEasingOptions {
    compName?: string;
    layerIdentifier: string | number;
    propertyPath: string[];
    keyframeIndex?: number;
    inSpeed?: number;
    inInfluence?: number;
    outSpeed?: number;
    outInfluence?: number;
    spatialIn?: number[];
    spatialOut?: number[];
    preset?: "smooth" | "sharp" | "overshoot" | "anticipation" | "easeIn" | "easeOut";
}
export declare function buildSetBezierEasingJsx(opts: BezierEasingOptions): string;
export interface CopyPasteKeyframesOptions {
    compName?: string;
    sourceLayerIdentifier: string | number;
    sourcePropertyPath: string[];
    targetLayerIdentifier: string | number;
    targetPropertyPath: string[];
    timeOffset?: number;
}
export declare function buildCopyPasteKeyframesJsx(opts: CopyPasteKeyframesOptions): string;
export interface LoopKeyframesOptions {
    compName?: string;
    layerIdentifier: string | number;
    propertyPath: string[];
    loopType: "cycle" | "pingpong" | "offset" | "continue";
    loopIn?: boolean;
    loopOut?: boolean;
}
export declare function buildLoopKeyframesJsx(opts: LoopKeyframesOptions): string;
export interface DeleteKeyframesOptions {
    compName?: string;
    layerIdentifier: string | number;
    propertyPath: string[];
    keyframeIndex?: number;
    timeRange?: [number, number];
}
export declare function buildDeleteKeyframesJsx(opts: DeleteKeyframesOptions): string;
export interface RovingKeyframesOptions {
    compName?: string;
    layerIdentifier: string | number;
    propertyPath: string[];
    enabled: boolean;
}
export declare function buildSetRovingKeyframesJsx(opts: RovingKeyframesOptions): string;
