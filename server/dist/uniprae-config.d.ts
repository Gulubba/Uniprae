export interface UnipraeSettings {
    groqApiKey: string;
    captionStyle: "word" | "word_2" | "tiktok" | "phrase" | "sentence";
    captionCasing: "uppercase" | "gencaption" | "lowercase" | "titlecase";
    captionLanguage: string;
    captionPunctuation: "strip" | "keep";
    captionDestination: "caption" | "graphics";
    timelineScope: "entire" | "workarea" | "active_sequence" | "selected_clip";
    silenceMargin: number;
    silenceThreshold: string;
    silenceOutput: "premiere" | "render";
    silenceSource: "timeline" | "file";
}
export declare const DEFAULT_SETTINGS: UnipraeSettings;
export declare function getConfigDir(): string;
export declare function getConfigPath(): string;
export declare function getFallbackConfigPath(): string;
export declare function maskApiKey(key?: string): string;
export declare function sanitizeConfig(raw: any): UnipraeSettings;
export declare function readConfig(): UnipraeSettings;
export declare function writeConfig(updates: Partial<UnipraeSettings> | Record<string, any>): UnipraeSettings;
