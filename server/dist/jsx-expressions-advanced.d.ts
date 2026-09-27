export interface ValidateExpressionOptions {
    compName?: string;
    layerIdentifier: string | number;
    propertyPath: string[];
    expression: string;
}
export declare function buildValidateExpressionJsx(opts: ValidateExpressionOptions): string;
export interface ToggleExpressionOptions {
    compName?: string;
    layerIdentifier: string | number;
    propertyPath: string[];
    enabled: boolean;
}
export declare function buildToggleExpressionJsx(opts: ToggleExpressionOptions): string;
export interface ExpressionLibraryOptions {
    compName?: string;
    layerIdentifier: string | number;
    propertyPath: string[];
    presetName: string;
    params?: Record<string, number>;
}
export declare function buildExpressionLibraryJsx(opts: ExpressionLibraryOptions): string;
