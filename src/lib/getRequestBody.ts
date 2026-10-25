// get body for either formdata or json
export default async function getRequestBody(req: Request): Promise<Record<string, unknown>> {
  const contentType = req.headers.get("content-type");

  if (contentType?.includes("application/json")) {
    const body = await req.json();
    return body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  }

  if (contentType?.includes("application/x-www-form-urlencoded") || contentType?.includes("multipart/form-data")) {
    const formData = await req.formData();
    return Object.fromEntries(formData.entries());
  }

  throw new Error(`Unsupported Content-Type: ${contentType}`);
}
