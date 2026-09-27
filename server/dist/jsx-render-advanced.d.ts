export interface MotionBlurOptions {
    compName?: string;
    layerIdentifier?: string | number;
    enabled: boolean;
    shutterAngle?: number;
    shutterPhase?: number;
    samplesPerFrame?: number;
    adaptiveSampleLimit?: number;
}
export declare function buildSetMotionBlurJsx(opts: MotionBlurOptions): string;
export interface RenderSettingsOptions {
    compName?: string;
    quality?: "best" | "draft" | "wireframe";
    resolution?: "full" | "half" | "third" | "quarter" | "custom";
    resolutionFactor?: [number, number];
    motionBlurOverride?: "on" | "off" | "compSettings";
    fieldRender?: "off" | "upperFirst" | "lowerFirst";
    frameBlending?: "on" | "off" | "compSettings";
    codec?: "h264" | "prores422" | "prores4444" | "pngSequence" | "exr" | "tiff";
    colorDepth?: "8bpc" | "16bpc" | "32bpc";
    outputPath?: string;
    startRender?: boolean;
}
export declare function buildSetRenderSettingsJsx(opts: RenderSettingsOptions): string;
export declare function buildGetRenderStatusJsx(): string;
export declare function buildCancelRenderJsx(): string;
export declare function buildStartRenderJsx(): string;
export interface ColorSettingsOptions {
    workingSpace?: string;
    linearize?: boolean;
    bitsPerChannel?: 8 | 16 | 32;
}
export declare function buildSetColorSettingsJsx(opts: ColorSettingsOptions): string;
export interface ApplyLutOptions {
    compName?: string;
    layerIdentifier: string | number;
    lutPath: string;
}
export declare function buildApplyLutJsx(opts: ApplyLutOptions): string;
