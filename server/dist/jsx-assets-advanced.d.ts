export interface ImportAssetAdvancedOptions {
    filePath: string;
    importAs?: "footage" | "comp" | "comp_cropped";
    compName?: string;
    name?: string;
    position?: [number, number];
    scale?: [number, number];
    fitToComp?: boolean;
}
export declare function buildImportAssetAdvancedJsx(opts: ImportAssetAdvancedOptions): string;
export interface ImportFolderOptions {
    folderPath: string;
    extensions?: string[];
    asSequence?: boolean;
}
export declare function buildImportFolderJsx(opts: ImportFolderOptions): string;
export interface ReplaceFootageOptions {
    compName?: string;
    layerIdentifier: string | number;
    newFilePath: string;
}
export declare function buildReplaceFootageJsx(opts: ReplaceFootageOptions): string;
export interface InterpretFootageOptions {
    compName?: string;
    layerIdentifier: string | number;
    frameRate?: number;
    alphaMode?: "ignore" | "straight" | "premultiplied";
    loop?: number;
    fieldSeparation?: "off" | "upperFirst" | "lowerFirst";
}
export declare function buildInterpretFootageJsx(opts: InterpretFootageOptions): string;
export interface SetFootageProxyOptions {
    compName?: string;
    layerIdentifier: string | number;
    proxyPath?: string;
}
export declare function buildSetFootageProxyJsx(opts: SetFootageProxyOptions): string;
