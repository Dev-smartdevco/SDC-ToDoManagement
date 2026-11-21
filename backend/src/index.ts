import { app } from "./app.js";
import { assertEnv, env } from "./lib/env.js";
import { startNotificationWorkers } from "./services/notificationEngine.js";

assertEnv();
startNotificationWorkers();

app.listen(env.port, () => {
  console.log(`MY OS API running on http://localhost:${env.port}`);
});
