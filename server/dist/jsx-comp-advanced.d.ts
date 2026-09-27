export interface DuplicateCompOptions {
    sourceName: string;
    newName?: string;
}
export declare function buildDuplicateCompJsx(opts: DuplicateCompOptions): string;
export interface DeleteCompOptions {
    compName: string;
}
export declare function buildDeleteCompJsx(opts: DeleteCompOptions): string;
export interface GetCompSettingsOptions {
    compName?: string;
}
export declare function buildGetCompSettingsJsx(opts?: GetCompSettingsOptions): string;
export interface SetWorkAreaOptions {
    compName?: string;
    startTime: number;
    endTime: number;
}
export declare function buildSetWorkAreaJsx(opts: SetWorkAreaOptions): string;
export declare function buildGetCompTreeJsx(compName?: string): string;
export declare function buildAnalyzeCompJsx(compName?: string): string;
