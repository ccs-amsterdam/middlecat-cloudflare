// get body for either formdata or json
export default async function getRequestBody<T>(req: Request): Promise<Record<string, any>> {
  const contentType = req.headers.get("content-type");
  if (contentType === "application/x-www-form-urlencoded") {
    const formdata = await req.formData();
    return Object.fromEntries(formdata.entries());
  }
  return await req.json();
}
