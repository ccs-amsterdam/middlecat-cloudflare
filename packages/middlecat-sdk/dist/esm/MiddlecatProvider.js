"use client";
import { jsx as _jsx } from "react/jsx-runtime";
import useMiddlecatConnection from "./useMiddlecatConnection";
import { createContext, useContext } from "react";
import { silentDeleteSearchParams } from "./util";
var MiddlecatContext = createContext({});
export function MiddlecatProvider(_a) {
    var children = _a.children, autoConnect = _a.autoConnect, storeToken = _a.storeToken, bff = _a.bff, fixedResource = _a.fixedResource, cleanupParams = _a.cleanupParams;
    var middlecat = useMiddlecatConnection({
        onFinishOauth: cleanupParams || silentDeleteSearchParams,
        autoConnect: autoConnect,
        storeToken: storeToken,
        bff: bff,
        fixedResource: fixedResource,
    });
    return (_jsx(MiddlecatContext.Provider, { value: middlecat, children: children }));
}
export var useMiddlecat = function () { return useContext(MiddlecatContext); };
