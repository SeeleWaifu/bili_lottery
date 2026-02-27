export function toError(err: any): Error {
    return err instanceof Error ? err : new Error(String(err));
}
