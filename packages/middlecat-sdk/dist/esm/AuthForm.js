var __makeTemplateObject = (this && this.__makeTemplateObject) || function (cooked, raw) {
    if (Object.defineProperty) { Object.defineProperty(cooked, "raw", { value: raw }); } else { cooked.raw = raw; }
    return cooked;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useCallback, useEffect, useState } from "react";
import styled from "styled-components";
import { useMiddlecat } from "./MiddlecatProvider";
var AuthContainer = styled.div(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n  --primary: ", ";\n  --secondary: ", ";\n\n  color: var(--secondary);\n  display: flex;\n  text-align: center;\n  flex-direction: column;\n  position: relative;\n  font-size: ", ";\n\n  .InnerContainer {\n    box-sizing: border-box;\n    font-size: 1.2em;\n    margin: auto;\n    width: 100%;\n    max-width: 400px;\n    text-align: center;\n  }\n\n  .User {\n    display: flex;\n    justify-content: center;\n    align-items: center;\n    font-weight: 800;\n  }\n\n  .Image {\n    height: 45px;\n    width: 45px;\n    border-radius: 50%;\n    margin-right: 1rem;\n    border: 1px solid var(--secondary);\n  }\n  button {\n    width: 100%;\n    color: black;\n    background: white;\n    border: 2px solid var(--primary);\n    font-size: inherit;\n    max-width: 400px;\n    padding: 0.6rem 1.5rem;\n    border-radius: 10px;\n    cursor: pointer;\n    transition: background 0.3s;\n\n    &:hover:enabled {\n      color: white;\n      background: var(--primary);\n    }\n  }\n\n  input {\n    margin: 1rem 0rem;\n    width: 100%;\n    border-radius: 5px;\n    height: 40px;\n    padding: 10px 10px 10px 10px;\n    font-size: inherit;\n    background: white;\n  }\n  .SignOut {\n    display: flex;\n    flex-direction: column;\n    gap: 0.5rem;\n    margin-top: 1rem;\n  }\n\n  .Loader {\n    margin: auto;\n    border: 10px solid #f3f3f3;\n    border-top: 10px solid var(--secondary);\n    border-radius: 50%;\n    width: 80px;\n    height: 80px;\n    animation: spin 1s linear infinite, delayedFadeIn 1s linear;\n  }\n\n  .ResourceLabel {\n    line-height: 3rem;\n  }\n\n  p {\n    margin-top: 0.5rem;\n    margin-bottom: 0.5rem;\n    height: 3rem;\n  }\n\n  .Divider {\n    display: flex;\n    position: relative;\n    margin: 1rem 10px;\n    z-index: 2;\n  }\n\n  .Divider div {\n    margin: auto;\n    background: white;\n    z-index: 2;\n    padding: 0rem 1rem;\n    font-size: 0.9em;\n  }\n\n  .Divider::after {\n    content: \"\";\n    position: absolute;\n    bottom: 1rem;\n    left: 0;\n    width: 100%;\n    z-index: 1;\n    border-bottom: 2px solid;\n  }\n"], ["\n  --primary: ", ";\n  --secondary: ", ";\n\n  color: var(--secondary);\n  display: flex;\n  text-align: center;\n  flex-direction: column;\n  position: relative;\n  font-size: ", ";\n\n  .InnerContainer {\n    box-sizing: border-box;\n    font-size: 1.2em;\n    margin: auto;\n    width: 100%;\n    max-width: 400px;\n    text-align: center;\n  }\n\n  .User {\n    display: flex;\n    justify-content: center;\n    align-items: center;\n    font-weight: 800;\n  }\n\n  .Image {\n    height: 45px;\n    width: 45px;\n    border-radius: 50%;\n    margin-right: 1rem;\n    border: 1px solid var(--secondary);\n  }\n  button {\n    width: 100%;\n    color: black;\n    background: white;\n    border: 2px solid var(--primary);\n    font-size: inherit;\n    max-width: 400px;\n    padding: 0.6rem 1.5rem;\n    border-radius: 10px;\n    cursor: pointer;\n    transition: background 0.3s;\n\n    &:hover:enabled {\n      color: white;\n      background: var(--primary);\n    }\n  }\n\n  input {\n    margin: 1rem 0rem;\n    width: 100%;\n    border-radius: 5px;\n    height: 40px;\n    padding: 10px 10px 10px 10px;\n    font-size: inherit;\n    background: white;\n  }\n  .SignOut {\n    display: flex;\n    flex-direction: column;\n    gap: 0.5rem;\n    margin-top: 1rem;\n  }\n\n  .Loader {\n    margin: auto;\n    border: 10px solid #f3f3f3;\n    border-top: 10px solid var(--secondary);\n    border-radius: 50%;\n    width: 80px;\n    height: 80px;\n    animation: spin 1s linear infinite, delayedFadeIn 1s linear;\n  }\n\n  .ResourceLabel {\n    line-height: 3rem;\n  }\n\n  p {\n    margin-top: 0.5rem;\n    margin-bottom: 0.5rem;\n    height: 3rem;\n  }\n\n  .Divider {\n    display: flex;\n    position: relative;\n    margin: 1rem 10px;\n    z-index: 2;\n  }\n\n  .Divider div {\n    margin: auto;\n    background: white;\n    z-index: 2;\n    padding: 0rem 1rem;\n    font-size: 0.9em;\n  }\n\n  .Divider::after {\n    content: \"\";\n    position: absolute;\n    bottom: 1rem;\n    left: 0;\n    width: 100%;\n    z-index: 1;\n    border-bottom: 2px solid;\n  }\n"])), function (p) { return p.primary || "#38c7b9"; }, function (p) { return p.secondary || "#1d7269"; }, function (p) { return p.fontSize || "1.4em"; });
export default function AuthForm(_a) {
    var primary = _a.primary, secondary = _a.secondary, fontSize = _a.fontSize, resourceExample = _a.resourceExample, resourceSuggestion = _a.resourceSuggestion, resourceFixed = _a.resourceFixed, resourceRequired = _a.resourceRequired, signInTitle = _a.signInTitle, signOutTitle = _a.signOutTitle, signInButtonLabel = _a.signInButtonLabel, signOutButtonLabel = _a.signOutButtonLabel;
    var _b = useMiddlecat(), user = _b.user, loading = _b.loading, error = _b.error, fixedResource = _b.fixedResource, signIn = _b.signIn, signInGuest = _b.signInGuest, signOut = _b.signOut;
    function ConditionalRender() {
        if (loading)
            return _jsx("div", { className: "Loader" });
        if (!user)
            return (_jsx(SignInForm, { signIn: signIn, signInGuest: signInGuest, resourceExample: resourceExample, resourceSuggestion: resourceSuggestion, resourceFixed: fixedResource || resourceFixed, resourceRequired: resourceRequired, signInTitle: signInTitle, signInButtonLabel: signInButtonLabel }));
        return (_jsx(SignOutForm, { user: user, resourceFixed: fixedResource || resourceFixed, signIn: signIn, signOut: signOut, signOutTitle: signOutTitle, signOutButtonLabel: signOutButtonLabel }));
    }
    return (_jsxs(AuthContainer, { fontSize: fontSize, primary: primary, secondary: secondary, children: [_jsx("div", { className: "InnerContainer", children: _jsx(ConditionalRender, {}) }), user ? null : _jsx("p", { children: error })] }));
}
// interface ResourceConfig {
//   resource: string;
//   middlecat_url: string;
//   allow_guests: boolean;
// }
function SignInForm(_a) {
    var _this = this;
    var signIn = _a.signIn, signInGuest = _a.signInGuest, resourceExample = _a.resourceExample, resourceSuggestion = _a.resourceSuggestion, resourceFixed = _a.resourceFixed, resourceRequired = _a.resourceRequired, signInTitle = _a.signInTitle, signInButtonLabel = _a.signInButtonLabel;
    var _b = useState(resourceFixed ||
        sessionStorage.getItem("AuthformResource") ||
        resourceSuggestion ||
        ""), resourceValue = _b[0], setResourceValue = _b[1];
    //   const [config, setConfig] = useState<ResourceConfig>();
    var _c = useState(""), error = _c[0], setError = _c[1];
    var _d = useState(false), loadingConfig = _d[0], setLoadingConfig = _d[1];
    var onSubmit = useCallback(function (e) { return __awaiter(_this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            e.preventDefault();
            setLoadingConfig(true);
            signInGuest(resourceValue).finally(function () { return setLoadingConfig(false); });
            // DEPRECATED: NO LONGER AUTO LOGIN. jUST ALWAYS CONNECT AS GUEST FIRST
            // let res;
            // try {
            //   res = await axios.get(`${prepareURL(resourceValue)}/config`, {
            //     timeout: 5000,
            //   });
            // } catch (e) {
            //   console.error(e);
            // }
            // if (!res || res.status !== 200) {
            //   setError("Could not connect to server");
            //   setLoadingConfig(false);
            //   return;
            // }
            // const auth = res.data.authorization || "allow_guests";
            // const middlecat_url = res.data.middlecat_url || "";
            // const allow_guests = auth === "allow_guests";
            // if (auth === "no_auth") {
            //   signInGuest(resourceValue, true, middlecat_url);
            // } else if (!allow_guests && !middlecat_url) {
            //   setError("Server has invalid authentication configuration");
            // } else if (!allow_guests && middlecat_url) {
            //   signIn(resourceValue, middlecat_url);
            // } else if (allow_guests) {
            //   signInGuest(resourceValue, false, middlecat_url);
            // }
            setLoadingConfig(false);
            return [2 /*return*/];
        });
    }); }, [resourceValue, signIn, signInGuest]);
    function invalidUrl(url) {
        if (resourceFixed)
            return false;
        return !/^https?:\/\//.test(url);
    }
    useEffect(function () {
        if (resourceFixed && resourceRequired) {
            onSubmit({ preventDefault: function () { } });
        }
    }, [resourceFixed, resourceRequired, onSubmit]);
    if (loadingConfig)
        return _jsx("div", { className: "Loader" });
    if (resourceFixed && resourceRequired && !error)
        return _jsx("div", { className: "Loader" });
    return (_jsxs("form", { onSubmit: onSubmit, children: [_jsx("h2", { className: "Title", children: signInTitle }), resourceFixed ? null : (_jsx("input", { type: "url", id: "url", name: "url", placeholder: resourceExample || "https://amcat-server.example", value: resourceValue, onChange: function (e) {
                    if (error)
                        setError("");
                    sessionStorage.setItem("AuthformResource", e.target.value);
                    setResourceValue(e.target.value);
                } })), _jsx("button", { disabled: invalidUrl(resourceValue), type: "submit", children: signInButtonLabel || "Connect to server" }), error && _jsx("p", { children: error })] }));
}
function SignOutForm(_a) {
    var user = _a.user, resourceFixed = _a.resourceFixed, signIn = _a.signIn, signOut = _a.signOut, signOutTitle = _a.signOutTitle, signOutButtonLabel = _a.signOutButtonLabel;
    if (!user.authenticated) {
        return (_jsxs(_Fragment, { children: [_jsx("h2", { className: "Title", children: signOutTitle }), _jsx("div", { className: "NoAuthLabel" }), _jsxs("div", { className: "SignOut", children: [_jsx("button", { onClick: function () { return signIn(user.resource, user.middlecat); }, children: "Sign-in" }), resourceFixed ? null : (_jsx("button", { onClick: function () { return signOut(false); }, children: "Change server" }))] })] }));
    }
    return (_jsxs(_Fragment, { children: [_jsx("h2", { className: "Title", children: signOutTitle }), _jsxs("div", { className: "User", children: [(user === null || user === void 0 ? void 0 : user.image) ? (_jsx("img", { className: "Image", src: user.image, "referrer-policy": "no-referrer", alt: "" })) : null, _jsxs("div", { children: [(user === null || user === void 0 ? void 0 : user.name) || (user === null || user === void 0 ? void 0 : user.email), (user === null || user === void 0 ? void 0 : user.name) && (user === null || user === void 0 ? void 0 : user.email) ? (_jsxs(_Fragment, { children: [_jsx("br", {}), _jsx("span", { style: { fontSize: "0.8em" }, children: user === null || user === void 0 ? void 0 : user.email })] })) : null] })] }), _jsxs("div", { className: "SignOut", children: [_jsx("button", { onClick: function () { return signOut(false); }, children: signOutButtonLabel || "Sign-out Server" }), _jsx("button", { onClick: function () { return signOut(true); }, children: "Sign-out MiddleCat" })] })] }));
}
var templateObject_1;
