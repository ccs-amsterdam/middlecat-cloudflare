export declare function createVerifier(): string;
export declare function createCodeChallenge(verrifier: string): Promise<string>;
export default function pkce(): Promise<{
    codeVerifier: string;
    codeChallenge: string;
}>;
