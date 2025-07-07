"use strict";
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
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = useMiddlecatConnection;
var react_1 = require("react");
var util_1 = require("./util");
var middlecatOauth_1 = require("./middlecatOauth");
var createMiddlecatUser_1 = require("./createMiddlecatUser");
var middlecatOauth_2 = require("./middlecatOauth");
var createGuestUser_1 = require("./createGuestUser");
var axios_1 = __importDefault(require("axios"));
function useMiddlecatConnection(_a) {
    var _this = this;
    var onFinishOauth = _a.onFinishOauth, _b = _a.autoConnect, autoConnect = _b === void 0 ? true : _b, // If user did not log out, automatically reconnect on next visit
    _c = _a.storeToken, // If user did not log out, automatically reconnect on next visit
    storeToken = _c === void 0 ? false : _c, // Stores refresh token in localstorage to persist across sessions, at the cost of making them more vulnerable to XSS
    _d = _a.bff, // Stores refresh token in localstorage to persist across sessions, at the cost of making them more vulnerable to XSS
    bff = _d === void 0 ? undefined : _d, // use backend-for-frontend to intercept refresh token for better security. Requires setting up a bff endpoint,
    _e = _a.fixedResource, // use backend-for-frontend to intercept refresh token for better security. Requires setting up a bff endpoint,
    fixedResource = _e === void 0 ? undefined : _e;
    var runOnce = (0, react_1.useRef)(true);
    var _f = (0, react_1.useState)(), user = _f[0], setUser = _f[1];
    var _g = (0, react_1.useState)(true), loading = _g[0], setLoading = _g[1];
    var _h = (0, react_1.useState)(""), error = _h[0], setError = _h[1];
    var signIn = (0, react_1.useCallback)(function (resource, middlecat_url) { return __awaiter(_this, void 0, void 0, function () {
        var r;
        return __generator(this, function (_a) {
            // OAuth action 1. Redirects to middlecat, which will redirect back with code and state
            // parameters. This triggers the authorizationCode flow.
            setError("");
            if (!resource && !fixedResource) {
                setError("No resource specified");
                return [2 /*return*/];
            }
            r = (0, util_1.prepareURL)(resource || fixedResource || "");
            if (!r)
                return [2 /*return*/];
            setLoading(true);
            return [2 /*return*/, (0, middlecatOauth_1.authorize)(r, middlecat_url)
                    .then(function (middlecat_redirect) {
                    localStorage.setItem("resource", r);
                    localStorage.setItem("awaiting_oauth_redirect", "true");
                    window.location.href = middlecat_redirect;
                })
                    .catch(function (e) {
                    setError(e.message.includes("timeout")
                        ? "Timeout exceeded"
                        : "Could not connect to server");
                    setTimeout(function () { return setError(""); }, 3000);
                    console.error(e);
                    setLoading(false);
                })];
        });
    }); }, [fixedResource]);
    var signInGuest = (0, react_1.useCallback)(function (resource, middlecat_url) { return __awaiter(_this, void 0, void 0, function () {
        var r;
        return __generator(this, function (_a) {
            setError("");
            if (!resource && !fixedResource) {
                setError("No resource specified");
                return [2 /*return*/];
            }
            r = (0, util_1.prepareURL)(resource || fixedResource || "");
            localStorage.setItem("resource", r);
            if (middlecat_url) {
                setUser((0, createGuestUser_1.createGuestUser)(r, setUser, middlecat_url));
                return [2 /*return*/];
            }
            setLoading(true);
            return [2 /*return*/, axios_1.default
                    .get("".concat(r, "/config"), { timeout: 5000 })
                    .then(function (res) {
                    setUser((0, createGuestUser_1.createGuestUser)(r, setUser, res.data.middlecat_url));
                })
                    .catch(function (e) {
                    console.error(e);
                    setError("Could not connect to server");
                })
                    .finally(function () { return setLoading(false); })];
        });
    }); }, [fixedResource]);
    var signOut = (0, react_1.useCallback)(function () {
        var args_1 = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args_1[_i] = arguments[_i];
        }
        return __awaiter(_this, __spreadArray([], args_1, true), void 0, function (signOutMiddlecat) {
            var resource;
            if (signOutMiddlecat === void 0) { signOutMiddlecat = false; }
            return __generator(this, function (_a) {
                setLoading(true);
                resource = localStorage.getItem("resource");
                localStorage.removeItem(resource + "_refresh");
                localStorage.removeItem("resource");
                if (!user)
                    return [2 /*return*/];
                user
                    .killSession(signOutMiddlecat)
                    .catch(function (e) { return console.error(e); })
                    .finally(function () {
                    setLoading(false);
                    if (fixedResource) {
                        setUser((0, createGuestUser_1.createGuestUser)(fixedResource, setUser, user.middlecat));
                    }
                    else {
                        setUser(undefined);
                    }
                });
                return [2 /*return*/];
            });
        });
    }, [user, fixedResource]);
    (0, react_1.useEffect)(function () {
        // This runs once on mount, and can do two things:
        // - resume an OAuth flow
        // - resume an existing connection to a resource
        if (!runOnce.current)
            return;
        runOnce.current = false;
        var resource = (0, util_1.prepareURL)(fixedResource || localStorage.getItem("resource") || "");
        if (!resource) {
            setLoading(false);
            return;
        }
        var searchParams = new URLSearchParams(window.location.search);
        var code = searchParams.get("code");
        var state = searchParams.get("state");
        var inFlow = localStorage.getItem("awaiting_oauth_redirect") === "true";
        localStorage.setItem("awaiting_oauth_redirect", "false");
        // If in oauth flow and code and state parameters are given, complete the oauth flow.
        // (the inFlow shouldn't be needed since we remove the URL parameters, but this somehow
        //  doesn't work when useMiddlecat is imported in nextJS. so this is just to be sure)
        if (inFlow && code && state) {
            //silentDeleteSearchParams(["code", "state"]);
            connectWithAuthGrant(resource, code, state, storeToken, bff, setUser, setLoading).then(onFinishOauth);
            return;
        }
        if (!autoConnect) {
            setLoading(false);
            return;
        }
        resumeConnection(resource, storeToken, bff, setUser)
            .catch(function (e) {
            console.error(e);
            setError("could not connect to ".concat(resource));
        })
            .finally(function () { return setLoading(false); });
    }, [autoConnect, storeToken, signIn, bff, fixedResource, onFinishOauth]);
    return {
        user: user,
        loading: loading,
        error: error,
        fixedResource: fixedResource,
        signIn: signIn,
        signInGuest: signInGuest,
        signOut: signOut,
    };
}
function connectWithAuthGrant(resource, code, state, storeToken, bff, setUser, setLoading) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, middlecatOauth_1.authorizationCode)(resource, code, state, bff)
                        .then(function (_a) {
                        var access_token = _a.access_token, refresh_token = _a.refresh_token;
                        var user = (0, createMiddlecatUser_1.createMiddlecatUser)(access_token, refresh_token, storeToken, bff, resource, setUser);
                        localStorage.setItem("resource", resource);
                        setUser(user);
                    })
                        .catch(function (e) {
                        console.error(e);
                    })
                        .finally(function () {
                        setLoading(false);
                    })];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function resumeConnection(resource, storeToken, bff, setUser) {
    return __awaiter(this, void 0, void 0, function () {
        var middlecat, res, e_1, local_refresh_token, _a, access_token, refresh_token, user, e_2;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    middlecat = localStorage.getItem(resource + "_middlecat") || "";
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, axios_1.default.get("".concat((0, util_1.prepareURL)(resource), "/config"), {
                            timeout: 5000,
                        })];
                case 2:
                    res = _b.sent();
                    return [3 /*break*/, 4];
                case 3:
                    e_1 = _b.sent();
                    console.error(e_1);
                    return [3 /*break*/, 4];
                case 4:
                    if (!res || res.status !== 200) {
                        throw new Error("Could not get config from resource");
                    }
                    if (res.data.authorization === "no_auth") {
                        setUser((0, createGuestUser_1.createGuestUser)(resource, setUser));
                        return [2 /*return*/, null];
                    }
                    local_refresh_token = storeToken && !bff ? localStorage.getItem(resource + "_refresh") : "";
                    _b.label = 5;
                case 5:
                    _b.trys.push([5, 7, , 8]);
                    return [4 /*yield*/, (0, middlecatOauth_2.refreshToken)(middlecat, local_refresh_token || "", resource, bff)];
                case 6:
                    _a = _b.sent(), access_token = _a.access_token, refresh_token = _a.refresh_token;
                    if (access_token) {
                        user = (0, createMiddlecatUser_1.createMiddlecatUser)(access_token, refresh_token, storeToken, bff, resource || "", setUser);
                        setUser(user);
                        return [2 /*return*/, null];
                    }
                    return [3 /*break*/, 8];
                case 7:
                    e_2 = _b.sent();
                    console.error(e_2);
                    localStorage.removeItem(resource + "_refresh");
                    return [3 /*break*/, 8];
                case 8:
                    setUser((0, createGuestUser_1.createGuestUser)(resource, setUser));
                    return [2 /*return*/];
            }
        });
    });
}
