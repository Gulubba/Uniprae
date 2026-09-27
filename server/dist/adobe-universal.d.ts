export type AdobeHost = "after-effects" | "premiere-pro" | "auto";
export interface AdobeBridgeResult {
    success: boolean;
    host?: Exclude<AdobeHost, "auto">;
    endpoint?: string;
    data?: unknown;
    error?: string;
}
export declare function getAdobeStatus(): Promise<Record<string, unknown>>;
export declare function runAdobeScript(host: AdobeHost, code: string): Promise<AdobeBridgeResult>;
export declare function runPremiereFunction(functionName: string, args?: unknown[]): Promise<AdobeBridgeResult>;
export declare function triggerAdobeFunction(host: AdobeHost, functionName: string, args?: unknown[]): Promise<AdobeBridgeResult>;
