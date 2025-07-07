"use strict";
var __makeTemplateObject = (this && this.__makeTemplateObject) || function (cooked, raw) {
    if (Object.defineProperty) { Object.defineProperty(cooked, "raw", { value: raw }); } else { cooked.raw = raw; }
    return cooked;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var jsx_runtime_1 = require("react/jsx-runtime");
var styled_components_1 = __importDefault(require("styled-components"));
var AuthForm_1 = __importDefault(require("./AuthForm"));
var react_1 = require("react");
function LoginModal(_a) {
    var middlecat = _a.middlecat, fixedResource = _a.fixedResource, resourceRequired = _a.resourceRequired, title = _a.title, primary = _a.primary, secondary = _a.secondary, fontSize = _a.fontSize;
    var ref = (0, react_1.useRef)(null);
    if (!(middlecat === null || middlecat === void 0 ? void 0 : middlecat.loading) && (middlecat === null || middlecat === void 0 ? void 0 : middlecat.user))
        return null;
    return ((0, jsx_runtime_1.jsx)(LoginModalDiv, { fontSize: fontSize, primary: primary, children: middlecat.loading ? ("Loading...") : ((0, jsx_runtime_1.jsx)("div", { ref: ref, className: "AuthForm", children: (0, jsx_runtime_1.jsx)(AuthForm_1.default, { resourceFixed: fixedResource, resourceRequired: resourceRequired, signInTitle: title, primary: primary, secondary: secondary, fontSize: "1em" }) })) }));
}
var LoginModalDiv = styled_components_1.default.div(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n  top: 0;\n  left: 0;\n  width: 100vw;\n  height: 100vh;\n  position: fixed;\n  display: flex;\n  justify-content: center;\n  backdrop-filter: blur(5px);\n  background-color: #fff8;\n  z-index: 1000;\n\n  .AuthForm {\n    margin: auto 1rem;\n    margin-top: min(10em, 10vh);\n    padding: 2rem;\n    width: 40rem;\n    max-width: 90vw;\n    background-color: #fff3;\n    border-radius: 10px;\n    font-size: ", ";\n    border: 1px solid ", ";\n\n    h2 {\n      text-align: center;\n      font-size: 1.8em;\n    }\n  }\n"], ["\n  top: 0;\n  left: 0;\n  width: 100vw;\n  height: 100vh;\n  position: fixed;\n  display: flex;\n  justify-content: center;\n  backdrop-filter: blur(5px);\n  background-color: #fff8;\n  z-index: 1000;\n\n  .AuthForm {\n    margin: auto 1rem;\n    margin-top: min(10em, 10vh);\n    padding: 2rem;\n    width: 40rem;\n    max-width: 90vw;\n    background-color: #fff3;\n    border-radius: 10px;\n    font-size: ", ";\n    border: 1px solid ", ";\n\n    h2 {\n      text-align: center;\n      font-size: 1.8em;\n    }\n  }\n"])), function (p) { return p.fontSize || "1.4em"; }, function (p) { return p.primary || "var(--primary)"; });
exports.default = LoginModal;
var templateObject_1;
