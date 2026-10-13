import { buildPlugin } from "@piiq/workspace-plugin-sdk/build";

await buildPlugin({
  root: import.meta.dirname,
  entry: "src/index.tsx",
  assets: ["assets"],
});
