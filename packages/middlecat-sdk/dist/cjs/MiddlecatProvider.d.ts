import { ReactNode } from "react";
import { Middlecat } from "./types";
interface Props {
    children: ReactNode;
    autoConnect?: boolean;
    storeToken?: boolean;
    bff?: string | undefined;
    fixedResource?: string | undefined;
    loginModalProps?: {
        title: string;
        primary?: string;
        secondary?: string;
        fontSize?: string;
    };
    cleanupParams?: () => void;
}
export declare function MiddlecatProvider({ children, autoConnect, storeToken, bff, fixedResource, cleanupParams, }: Props): import("react/jsx-runtime").JSX.Element;
export declare const useMiddlecat: () => Middlecat;
export {};
