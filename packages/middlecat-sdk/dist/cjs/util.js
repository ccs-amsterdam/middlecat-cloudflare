"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.silentDeleteSearchParams = silentDeleteSearchParams;
exports.prepareURL = prepareURL;
function silentDeleteSearchParams() {
    // remove url parameters without refresh
    var searchParams = new URLSearchParams(window.location.search);
    searchParams.delete("code");
    searchParams.delete("state");
    var paramstring = searchParams.toString();
    var url = window.location.pathname;
    if (paramstring)
        url += "?" + paramstring;
    window.history.replaceState(null, "", url);
}
function prepareURL(url) {
    if (url && typeof window !== "undefined" && !/^https?:\/\//.test(url)) {
        url = "".concat(window.location.origin, "/").concat(url);
    }
    return url.replace(/\/$/, "");
}
