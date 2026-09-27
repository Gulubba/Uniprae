export interface OpenProjectOptions {
    path: string;
}
export declare function buildOpenProjectJsx(opts: OpenProjectOptions): string;
export interface SaveProjectOptions {
    path?: string;
}
export declare function buildSaveProjectJsx(opts?: SaveProjectOptions): string;
export interface CloseProjectOptions {
    save?: boolean;
}
export declare function buildCloseProjectJsx(opts?: CloseProjectOptions): string;
export declare function buildGetProjectInfoJsx(): string;
export interface CollectFilesOptions {
    outputFolder: string;
}
export declare function buildCollectFilesJsx(opts: CollectFilesOptions): string;
export declare function buildIncrementSaveJsx(): string;
