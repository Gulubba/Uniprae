export interface CompOptions {
    name: string;
    width?: number;
    height?: number;
    fps?: number;
    duration?: number;
    bgColor?: string;
}
export interface TextLayerOptions {
    compName?: string;
    text: string;
    fontSize?: number;
    font?: string;
    color?: string;
    position?: [number, number] | [number, number, number];
    alignment?: "left" | "center" | "right";
    tracking?: number;
    name?: string;
}
export interface SolidLayerOptions {
    compName?: string;
    name?: string;
    color: string;
    width?: number;
    height?: number;
    position?: [number, number] | [number, number, number];
    opacity?: number;
}
export interface ShapeLayerOptions {
    compName?: string;
    name?: string;
    shapeType?: "rect" | "ellipse" | "star";
    fillColor?: string;
    strokeColor?: string;
    strokeWidth?: number;
    size?: [number, number];
    position?: [number, number] | [number, number, number];
    cornerRadius?: number;
}
export interface TransformOptions {
    compName?: string;
    layerIdentifier: string | number;
    position?: [number, number] | [number, number, number] | Array<{
        time: number;
        value: [number, number] | [number, number, number];
    }>;
    scale?: [number, number] | [number, number, number] | Array<{
        time: number;
        value: [number, number] | [number, number, number];
    }>;
    rotation?: number | Array<{
        time: number;
        value: number;
    }>;
    opacity?: number | Array<{
        time: number;
        value: number;
    }>;
    anchorPoint?: [number, number] | [number, number, number];
}
export interface EffectOptions {
    compName?: string;
    layerIdentifier: string | number;
    effectMatchName: string;
    effectName?: string;
    properties?: Record<string, any>;
}
export interface ExpressionOptions {
    compName?: string;
    layerIdentifier: string | number;
    propertyPath: string[];
    expression: string;
}
export interface RenderOptions {
    compName?: string;
    outputPath?: string;
    format?: "PNG" | "H264" | "ProRes";
    timeInSeconds?: number;
}
/**
 * Generate JSX to create or target a composition
 */
export declare function buildCreateCompJsx(opts: CompOptions): string;
/**
 * Generate JSX to add a formatted text layer
 */
export declare function buildAddTextLayerJsx(opts: TextLayerOptions): string;
/**
 * Generate JSX to add a solid layer
 */
export declare function buildAddSolidLayerJsx(opts: SolidLayerOptions): string;
/**
 * Generate JSX to add a shape layer (rectangle, ellipse, etc.)
 */
export declare function buildAddShapeLayerJsx(opts: ShapeLayerOptions): string;
/**
 * Generate JSX to apply keyframes or static values to transform properties
 */
export declare function buildSetTransformJsx(opts: TransformOptions): string;
/**
 * Generate JSX to add an effect to a layer
 */
export declare function buildAddEffectJsx(opts: EffectOptions): string;
/**
 * Generate JSX to apply an expression to a layer property
 */
export declare function buildSetExpressionJsx(opts: ExpressionOptions): string;
/**
 * Generate JSX to run arbitrary raw ExtendScript code
 */
export declare function buildRunScriptJsx(code: string): string;
/**
 * Generate JSX to query active comp info
 */
export declare function buildGetActiveCompJsx(): string;
/**
 * Generate JSX to export a PNG preview frame of the active composition
 */
export declare function buildSaveFramePreviewJsx(opts: {
    compName?: string;
    outputPath: string;
    time?: number;
}): string;
export interface EasingOptions {
    compName?: string;
    layerIdentifier: string | number;
    propertyPath: string[];
    easeType?: "easeIn" | "easeOut" | "easeInOut" | "linear";
    influence?: number;
}
/**
 * Generate JSX to set keyframe easing curves (Ease In, Ease Out, Ease In/Out)
 */
export declare function buildSetEasingJsx(opts: EasingOptions): string;
export interface ImportAssetOptions {
    filePath: string;
    compName?: string;
    name?: string;
    position?: [number, number];
    scale?: [number, number];
}
/**
 * Generate JSX to import an external file (PNG, JPG, SVG, MP4, MP3) into AE project and comp
 */
export declare function buildImportAssetJsx(opts: ImportAssetOptions): string;
export interface PrecomposeOptions {
    compName?: string;
    layerIndices: number[];
    precompName: string;
}
/**
 * Generate JSX to group multiple layers into a nested pre-composition
 */
export declare function buildPrecomposeJsx(opts: PrecomposeOptions): string;
export interface ColorPaletteOptions {
    compName?: string;
    colors: {
        primary?: string;
        secondary?: string;
        background?: string;
        text?: string;
    };
}
/**
 * Generate JSX to swap or apply global color palette tokens across composition layers
 */
export declare function buildApplyColorPaletteJsx(opts: ColorPaletteOptions): string;
/**
 * Generate JSX to inspect the active composition structure and details
 */
export declare function buildInspectCompJsx(compName?: string): string;
/**
 * Generate JSX to apply a preset motion expression to a layer property
 */
export interface MotionPresetOptions {
    compName?: string;
    layerIdentifier: string | number;
    propertyName: "position" | "scale" | "rotation" | "opacity";
    presetType: "bounce" | "elastic" | "wiggle" | "rubberband";
    frequency?: number;
    amplitude?: number;
    decay?: number;
}
export declare function buildApplyMotionPresetJsx(opts: MotionPresetOptions): string;
/**
 * Generate JSX to create a 3D Camera Rig & 3-Point Studio Lights
 */
export declare function buildCreateCameraRigJsx(compName?: string): string;
/**
 * Generate JSX to capture a sequence of PNG frames across the timeline to inspect animation video motion
 */
export declare function buildExportVideoPreviewJsx(compName?: string, frameCount?: number): string;
/**
 * Generate JSX for health repair
 */
export declare function buildHealthRepairJsx(): string;
/**
 * Generate JSX to fetch live After Effects watcher execution logs
 */
export declare function buildGetLogsJsx(): string;
/**
 * Generate JSX to fetch a live diagnostic report of After Effects project, comp, selection & memory state
 */
export declare function buildGetLiveReportJsx(): string;
export interface DeleteLayerOptions {
    compName?: string;
    layerIdentifier: string | number;
}
/**
 * Generate JSX to delete/remove a layer from a composition
 */
export declare function buildDeleteLayerJsx(opts: DeleteLayerOptions): string;
export interface DuplicateLayerOptions {
    compName?: string;
    layerIdentifier: string | number;
    newName?: string;
}
/**
 * Generate JSX to duplicate a layer (including keyframes and effects)
 */
export declare function buildDuplicateLayerJsx(opts: DuplicateLayerOptions): string;
export interface LayerTimingOptions {
    compName?: string;
    layerIdentifier: string | number;
    inPoint?: number;
    outPoint?: number;
    startTime?: number;
}
/**
 * Generate JSX to set layer timing (in/out points and start time)
 */
export declare function buildSetLayerTimingJsx(opts: LayerTimingOptions): string;
export interface AddCameraLayerOptions {
    compName?: string;
    name?: string;
    centerPoint?: [number, number];
    position?: [number, number, number];
    pointOfInterest?: [number, number, number];
    zoom?: number;
    depthOfField?: boolean;
    focusDistance?: number;
    aperture?: number;
    blurLevel?: number;
}
/**
 * Generate JSX to create a 3D Camera Layer in AE timeline
 */
export declare function buildAddCameraLayerJsx(opts: AddCameraLayerOptions): string;
export interface AddLightLayerOptions {
    compName?: string;
    name?: string;
    lightType?: "parallel" | "spot" | "point" | "ambient";
    color?: string;
    intensity?: number;
    position?: [number, number, number];
    coneAngle?: number;
    coneFeather?: number;
    castsShadows?: boolean;
    shadowDarkness?: number;
}
/**
 * Generate JSX to create a Light Layer (Parallel, Spot, Point, Ambient)
 */
export declare function buildAddLightLayerJsx(opts: AddLightLayerOptions): string;
export interface KeyframeAssistantOptions {
    compName?: string;
    layerIdentifier: string | number;
    propertyPath: string[];
    curveType: "exponential" | "elastic" | "bounce" | "back" | "cubicBezier" | "smoothEase";
    influence?: number;
    amplitude?: number;
    frequency?: number;
}
/**
 * Generate JSX to apply keyframe assistant curve profiles (Elastic, Bounce, Exponential, etc.)
 */
export declare function buildKeyframeAssistantJsx(opts: KeyframeAssistantOptions): string;
