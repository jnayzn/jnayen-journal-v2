import "dotenv/config";
import { createApp } from "./app";
import { logger } from "./lib/logger";

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? "0.0.0.0";

const app = createApp();
app.listen(port, host, () => {
  logger.info({ host, port }, "api-server listening");
});
