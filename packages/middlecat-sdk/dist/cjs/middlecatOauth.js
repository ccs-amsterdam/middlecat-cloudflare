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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authorize = authorize;
exports.authorizationCode = authorizationCode;
exports.refreshToken = refreshToken;
exports.killMiddlecatSession = killMiddlecatSession;
var axios_1 = __importDefault(require("axios"));
var util_1 = require("./util");
var pkce_1 = __importDefault(require("./pkce"));
function authorize(resource, middlecat_url) {
    return __awaiter(this, void 0, void 0, function () {
        var redirectURL, redirect_uri, state, _a, codeVerifier, codeChallenge, clientURL, clientId, res, e_1;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    redirectURL = new URL(window.location.href);
                    redirectURL.searchParams.delete("state");
                    redirectURL.searchParams.delete("redirect_uri");
                    redirectURL.searchParams.delete("code");
                    redirect_uri = redirectURL.origin + redirectURL.pathname + redirectURL.search;
                    state = (Math.random() + 1).toString(36).substring(2);
                    return [4 /*yield*/, (0, pkce_1.default)()];
                case 1:
                    _a = _b.sent(), codeVerifier = _a.codeVerifier, codeChallenge = _a.codeChallenge;
                    clientURL = new URL(redirect_uri);
                    clientId = clientURL.host;
                    if (!!middlecat_url) return [3 /*break*/, 6];
                    res = void 0;
                    _b.label = 2;
                case 2:
                    _b.trys.push([2, 4, , 5]);
                    return [4 /*yield*/, axios_1.default.get("".concat((0, util_1.prepareURL)(resource), "/config"), {
                            timeout: 5000,
                        })];
                case 3:
                    res = _b.sent();
                    return [3 /*break*/, 5];
                case 4:
                    e_1 = _b.sent();
                    console.error(e_1);
                    return [3 /*break*/, 5];
                case 5:
                    if (!res || res.status !== 200 || !res.data.middlecat_url)
                        throw new Error("Could not get MiddleCat URL from resource");
                    middlecat_url = res.data.middlecat_url;
                    _b.label = 6;
                case 6:
                    // need to remember code_verifier and state, and this needs to work across
                    // sessions because auth with magic links continues in new window.
                    localStorage.setItem(resource + "_code_verifier", codeVerifier);
                    localStorage.setItem(resource + "_state", state);
                    localStorage.setItem(resource + "_middlecat", middlecat_url || "");
                    return [2 /*return*/, "".concat(middlecat_url, "/authorize?client_id=").concat(clientId, "&state=").concat(state, "&redirect_uri=").concat(encodeURIComponent(redirect_uri), "&resource=").concat(resource, "&code_challenge=").concat(codeChallenge)];
            }
        });
    });
}
function authorizationCode(resource, code, state, bff) {
    return __awaiter(this, void 0, void 0, function () {
        var sendState, middlecat, code_verifier, body, url, res;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    sendState = localStorage.getItem(resource + "_state");
                    middlecat = localStorage.getItem(resource + "_middlecat");
                    code_verifier = localStorage.getItem(resource + "_code_verifier");
                    if (!middlecat || sendState !== state) {
                        // if state doesn't match, something fishy is going on. We won't send the actual code_verifier, but instead
                        // send an obvious wrong code_verifier, which will cause middlecat to kill the session
                        code_verifier = "DoYouReallyWantToHurtMe?";
                    }
                    body = {
                        grant_type: "authorization_code",
                        code: code,
                        code_verifier: code_verifier,
                    };
                    url = "".concat(middlecat, "/api/token");
                    if (bff) {
                        body.middlecat_url = url;
                        body.resource = resource;
                        url = bff;
                    }
                    return [4 /*yield*/, axios_1.default.post(url, body)];
                case 1:
                    res = _a.sent();
                    if (bff) {
                        localStorage.setItem(resource + "_refresh_id", res.data.refresh_id);
                    }
                    // cleanup. Not strictly needed because they have now lost
                    // their power, but still feels nice
                    localStorage.removeItem(resource + "_code_verifier");
                    localStorage.removeItem(resource + "_state");
                    return [2 /*return*/, res.data];
            }
        });
    });
}
function refreshToken(middlecat, refresh_token, resource, bff) {
    return __awaiter(this, void 0, void 0, function () {
        var body, url, res;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    body = {
                        grant_type: "refresh_token",
                        refresh_token: refresh_token,
                    };
                    url = "".concat(middlecat, "/api/token");
                    if (bff) {
                        body.refresh_id = localStorage.getItem(resource + "_refresh_id");
                        body.middlecat_url = url;
                        body.resource = resource;
                        url = bff;
                    }
                    if (!body.refresh_token && !body.refresh_id)
                        return [2 /*return*/, { access_token: "", refresh_token: "" }];
                    return [4 /*yield*/, axios_1.default.post(url, body)];
                case 1:
                    res = _a.sent();
                    if (bff) {
                        localStorage.setItem(resource + "_refresh_id", res.data.refresh_id);
                    }
                    return [2 /*return*/, res.data];
            }
        });
    });
}
/**
 * Not really part of the oauth flow, but included it in the /token
 * endpoint as a grant_type because it has many similarities. If one has
 * the refresh token, they are allowed to kill a session, meaning that
 * all refresh tokens for this session stop working.
 */
function killMiddlecatSession(middlecat, refresh_token, signOutMiddlecat, resource, bff, setUser) {
    return __awaiter(this, void 0, void 0, function () {
        var body, url;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    body = {
                        grant_type: "kill_session",
                        sign_out: signOutMiddlecat,
                        refresh_token: refresh_token,
                    };
                    url = "".concat(middlecat, "/api/token");
                    if (bff) {
                        body.refresh_id = localStorage.getItem(resource + "_refresh_id");
                        body.middlecat_url = url;
                        body.resource = resource;
                        url = bff;
                    }
                    return [4 /*yield*/, axios_1.default.post(url, body)];
                case 1:
                    _a.sent();
                    setUser(undefined);
                    return [2 /*return*/];
            }
        });
    });
}
