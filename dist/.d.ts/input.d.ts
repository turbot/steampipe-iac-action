export declare class ActionInput {
    version: string;
    plugins: Array<string>;
    modRepository: string;
    connectionData: string;
    private run;
    where: string | null;
    output: string;
    export: Array<string>;
    summaryFile: string;
    constructor();
    GetRun(): Array<string>;
}
