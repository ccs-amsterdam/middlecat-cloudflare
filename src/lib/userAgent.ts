import UAParser from "ua-parser-js";

/** Short description of the device a session was created on, e.g. "Apple, Safari, iOS" */
export function getCreatedOn(req: Request): string {
  const ua = new UAParser(req.headers.get("user-agent") || "").getResult();
  const createdOnDetails: string[] = [];
  if (ua.device.vendor) createdOnDetails.push(ua.device.vendor);
  if (ua.browser.name) createdOnDetails.push(ua.browser.name);
  if (ua.os.name) createdOnDetails.push(ua.os.name);
  return createdOnDetails.join(", ");
}
