export declare function verifyGroqKeyDirect(apiKey?: string): Promise<{
    valid: boolean;
    errorType?: string;
    error?: string;
}>;
export declare function transcribeWithGroq(input: {
    scope?: string;
    mediaPath?: string;
    clips?: Array<{
        path: string;
        inPoint?: number;
        outPoint?: number;
        start?: number;
        end?: number;
    }>;
    outputPath?: string;
    model?: string;
    language?: string;
    style?: string;
    casing?: string;
    stripPunctuation?: boolean;
    destination?: string;
    apiKey?: string;
    importToPremiere?: boolean;
}): Promise<any>;
export declare function removePremiereSilence(input: {
    mediaPath: string;
    margin?: number;
    threshold?: string;
    mode?: "premiere" | "render";
    sequenceName?: string;
    sourceIn?: number;
    sourceOut?: number;
}): Promise<any>;
export declare function triggerPremiereSilencer(input?: {
    margin?: number;
    threshold?: string;
    sequenceName?: string;
}): Promise<any>;
export declare function triggerPremiereTranscriber(input?: {
    scope?: "active_sequence" | "selected_clip";
    outputPath?: string;
    model?: string;
    language?: string;
    style?: string;
    casing?: string;
    stripPunctuation?: boolean;
    apiKey?: string;
    importToPremiere?: boolean;
}): Promise<any>;
