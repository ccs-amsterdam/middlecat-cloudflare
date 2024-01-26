/** @type {import('next').NextConfig} */
const nextConfig = {};

module.exports = nextConfig;

if (process.env.NODE_ENV === "development") {
  // we import the utility from the next-dev submodule
  const { setupDevBindings } = require("@cloudflare/next-on-pages/next-dev");

  // we call the utility with the bindings we want to have access to
  setupDevBindings({
    bindings: {
      DB1: {
        type: "d1",
        id: "DB1",
        databaseName: "middlecat_db",
        databaseId: "middlecat_db",
      },
    },
  });
}
