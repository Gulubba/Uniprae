export declare function buildDescribeCompJsx(compName?: string): string;
export interface FindLayerOptions {
    compName?: string;
    query: string;
}
export declare function buildFindLayerJsx(opts: FindLayerOptions): string;
export interface CreateTemplateOptions {
    compName?: string;
    templateName: string;
    outputPath: string;
}
export declare function buildCreateTemplateJsx(opts: CreateTemplateOptions): string;
export interface LoadTemplateOptions {
    templatePath: string;
    substitutions?: Record<string, string>;
    newCompName?: string;
}
export declare function buildLoadTemplateJsx(opts: LoadTemplateOptions): string;
export interface BatchComposeOptions {
    compName?: string;
    dataArray: Array<Record<string, string>>;
    outputPrefix?: string;
}
export declare function buildBatchComposeJsx(opts: BatchComposeOptions): string;
