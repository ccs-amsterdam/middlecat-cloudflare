export function silentDeleteSearchParams() {
  // remove url parameters without refresh
  const searchParams = new URLSearchParams(window.location.search);
  searchParams.delete("code");
  searchParams.delete("state");
  let paramstring = searchParams.toString();
  let url = window.location.pathname;
  if (paramstring) url += "?" + paramstring;
  window.history.replaceState(null, "", url);
}

export function prepareURL(url: string) {
  if (url && typeof window !== "undefined" && !/^https?:\/\//.test(url)) {
    url = `${window.location.origin}/${url}`;
  }
  return url.replace(/\/$/, "");
}
