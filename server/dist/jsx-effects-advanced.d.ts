export interface RemoveEffectOptions {
    compName?: string;
    layerIdentifier: string | number;
    effectName?: string;
    effectIndex?: number;
}
export declare function buildRemoveEffectJsx(opts: RemoveEffectOptions): string;
export interface ToggleEffectOptions {
    compName?: string;
    layerIdentifier: string | number;
    effectName?: string;
    effectIndex?: number;
    enabled: boolean;
}
export declare function buildToggleEffectJsx(opts: ToggleEffectOptions): string;
export interface SetEffectPropertyOptions {
    compName?: string;
    layerIdentifier: string | number;
    effectName?: string;
    effectIndex?: number;
    propertyName: string;
    value: any;
    time?: number;
}
export declare function buildSetEffectPropertyJsx(opts: SetEffectPropertyOptions): string;
export declare function buildGetAvailableEffectsJsx(): string;
export interface LayerStyleOptions {
    compName?: string;
    layerIdentifier: string | number;
    dropShadow?: {
        enabled?: boolean;
        color?: string;
        opacity?: number;
        angle?: number;
        distance?: number;
        size?: number;
        spread?: number;
    };
    innerShadow?: {
        enabled?: boolean;
        color?: string;
        opacity?: number;
        angle?: number;
        distance?: number;
        size?: number;
    };
    outerGlow?: {
        enabled?: boolean;
        color?: string;
        opacity?: number;
        size?: number;
        spread?: number;
    };
    innerGlow?: {
        enabled?: boolean;
        color?: string;
        opacity?: number;
        size?: number;
    };
    bevelEmboss?: {
        enabled?: boolean;
        style?: number;
        depth?: number;
        size?: number;
        soften?: number;
        angle?: number;
        altitude?: number;
    };
    colorOverlay?: {
        enabled?: boolean;
        color?: string;
        opacity?: number;
    };
    stroke?: {
        enabled?: boolean;
        color?: string;
        size?: number;
        position?: number;
        opacity?: number;
    };
}
export declare function buildSetLayerStylesJsx(opts: LayerStyleOptions): string;
