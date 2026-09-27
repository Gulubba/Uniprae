/**
 * AE Bridge using file-based IPC.
 *
 * Drops .jsx command files into a watched folder. A companion watcher
 * running inside After Effects (either headless in Scripts/Startup or
 * ScriptUI panel in Scripts/ScriptUI Panels) polls this folder and executes
 * any .jsx files it finds.
 */
export declare class AEBridge {
    private commandDir;
    private resultDir;
    private readyFilePath;
    private readonly instanceId;
    constructor();
    /**
     * Fast check if Adobe After Effects process is running.
     */
    isAfterEffectsRunning(): boolean;
    /**
     * Check if the AE watcher is actively running and updating heartbeat.
     */
    isWatcherRunning(): boolean;
    /** Read-only diagnostics that remain available even when AE cannot execute JSX. */
    getConnectionStatus(): Record<string, unknown>;
    /**
     * Attempt execution via the After Effects CEP Extension HTTP server (port 3006).
     */
    private executeViaCepHttp;
    /**
     * Clean up leftover files from previous commands.
     */
    private cleanStaleFiles;
    /**
     * Execute ExtendScript code inside Adobe After Effects.
     */
    executeJsx(jsxCode: string, autoPreview?: boolean): Promise<any>;
}
