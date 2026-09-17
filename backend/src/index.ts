import { createApp } from "./app.js";
import { assertEnv, env } from "./lib/env.js";

assertEnv();
const app = createApp();

app.listen(env.port, () => {
  console.log(`MY OS API running on http://localhost:${env.port}`);
});
