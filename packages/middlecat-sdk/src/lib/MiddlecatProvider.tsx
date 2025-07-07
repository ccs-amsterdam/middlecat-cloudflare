"use client";

import useMiddlecatConnection from "./useMiddlecatConnection";
import { ReactNode, createContext, useContext } from "react";
import { Middlecat } from "./types";
import LoginModal from "./LoginModal";
import { silentDeleteSearchParams } from "./util";

const MiddlecatContext = createContext<Partial<Middlecat>>({});

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

export function MiddlecatProvider({
  children,
  autoConnect,
  storeToken,
  bff,
  fixedResource,
  cleanupParams,
}: Props) {
  const middlecat = useMiddlecatConnection({
    onFinishOauth: cleanupParams || silentDeleteSearchParams,
    autoConnect,
    storeToken,
    bff,
    fixedResource,
  });

  return (
    <MiddlecatContext.Provider value={middlecat}>
      {children}
    </MiddlecatContext.Provider>
  );
}

export const useMiddlecat = () => useContext(MiddlecatContext) as Middlecat;
