import { z } from "zod";

const resourceConfigSchema = z.object({
  middlecat_url: z.string(),
});

export default async function getResourceConfig(url: string) {
  const resource = url.replace(/\/$/, ""); // standardize
  const config_res = await fetch(resource + "/config");
  const config = resourceConfigSchema.parse(await config_res.json());
  return config;
}
