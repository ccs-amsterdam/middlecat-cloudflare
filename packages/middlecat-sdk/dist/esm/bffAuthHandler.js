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
/**
 * If useMiddlecat is used on a client that has a samesite backend, the backend
 * can be used to secure the refresh token. This handler should then be
 * put at an endpoint (like api/bffAuth), and in useMiddlecat the settings
 * bff should be set to this endpoint (e.g., bff = '/api/bffAuth')
 *
 * To secure the refresh_token, this handler intercepts the
 * authorization_code, refresh_token and kill_session grant flows. The refresh
 * token is then not returned directly to the client application, but split into
 * an 'id' and 'secret' component. The refresh_id is returned
 *
 * We didn't properly type the req, res and cookies due to issues with including this as dependencies,
 * but it should work with normal node http handlers and Next handlers.
 *
 * @param req      Node (or Next) request
 * @param res      Node (or Next) response
 * @param cookies  Cookies objects created with new Cookies(req, res) (using the 'cookies' package)
 * @param maxAge   Max age in milliseconds that the cookie stays valid (regardless of expiration date of refresh token)
 * @param secure   secure flag in cookie. By default false (note that cookies are always httpOnly and samesite=strict)
 * @returns
 */
export default function bffAuthHandler(req_1, res_1, cookies_1) {
    return __awaiter(this, arguments, void 0, function (req, res, cookies, maxAge, // 30 days
    secure) {
        var name64, refreshCookie, tokens_res, tokens, refresh_token, _a, refresh_id, refresh_secret, e_1;
        if (maxAge === void 0) { maxAge = 60 * 60 * 24 * 30 * 1000; }
        if (secure === void 0) { secure = false; }
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 3, , 4]);
                    name64 = Buffer.from(req.body.resource + "." + req.body.middlecat_url).toString("base64");
                    refreshCookie = "refresh_" + name64;
                    // if bff auth is used, request will not contain the full refresh_token.
                    // Middlecat refresh tokens are composed of a unique (cuid) 'id', and
                    // a cryptographic random 'secret'. The id is stored in localstorage, and the
                    // secret is stored in a httponly samesite cookie. Both parts are needed to
                    // get an access token (refresh_token grant) or kill a session.
                    if (req.body.grant_type === "refresh_token" || req.body.grant_type === "kill_session")
                        req.body.refresh_token = req.body.refresh_id + "." + cookies.get(refreshCookie) || "";
                    return [4 /*yield*/, fetch(req.body.middlecat_url, {
                            method: "POST",
                            headers: {
                                Accept: "application/json",
                                "Content-Type": "application/json",
                            },
                            body: JSON.stringify(req.body),
                        })];
                case 1:
                    tokens_res = _b.sent();
                    return [4 /*yield*/, tokens_res.json()];
                case 2:
                    tokens = _b.sent();
                    refresh_token = tokens.refresh_token || ".";
                    _a = refresh_token.split("."), refresh_id = _a[0], refresh_secret = _a[1];
                    cookies.set(refreshCookie, refresh_secret, {
                        secure: secure,
                        httpOnly: true,
                        sameSite: "strict",
                        maxAge: maxAge,
                    });
                    // remove refresh_token from response, so that it is not returned to the client
                    tokens.refresh_token = null;
                    // return only the 'id' part of the refresh token
                    tokens.refresh_id = refresh_id;
                    return [2 /*return*/, res.status(200).json(tokens)];
                case 3:
                    e_1 = _b.sent();
                    console.log(e_1);
                    return [2 /*return*/, res.status(500).json({ error: e_1.message })];
                case 4: return [2 /*return*/];
            }
        });
    });
}
