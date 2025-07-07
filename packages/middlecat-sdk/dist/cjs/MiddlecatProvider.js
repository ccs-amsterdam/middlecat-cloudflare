"use strict";
"use client";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.useMiddlecat = void 0;
exports.MiddlecatProvider = MiddlecatProvider;
var jsx_runtime_1 = require("react/jsx-runtime");
var useMiddlecatConnection_1 = __importDefault(require("./useMiddlecatConnection"));
var react_1 = require("react");
var util_1 = require("./util");
var MiddlecatContext = (0, react_1.createContext)({});
function MiddlecatProvider(_a) {
    var children = _a.children, autoConnect = _a.autoConnect, storeToken = _a.storeToken, bff = _a.bff, fixedResource = _a.fixedResource, cleanupParams = _a.cleanupParams;
    var middlecat = (0, useMiddlecatConnection_1.default)({
        onFinishOauth: cleanupParams || util_1.silentDeleteSearchParams,
        autoConnect: autoConnect,
        storeToken: storeToken,
        bff: bff,
        fixedResource: fixedResource,
    });
    return ((0, jsx_runtime_1.jsx)(MiddlecatContext.Provider, { value: middlecat, children: children }));
}
var useMiddlecat = function () { return (0, react_1.useContext)(MiddlecatContext); };
exports.useMiddlecat = useMiddlecat;
