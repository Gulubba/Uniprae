export declare const premiereEditorTools: {
    name: string;
    description: string;
    inputSchema: any;
}[];
export declare function buildPremiereEditorScript(name: string, args: unknown): string;
export declare function callPremiereEditor(name: string, args: unknown): Promise<import("./adobe-universal.js").AdobeBridgeResult>;
