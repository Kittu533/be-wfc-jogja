import "dotenv/config";

import { createApp } from "./app";
import { env } from "./config/env";
import { ensurePlaceStorage } from "./repositories/place.repository";

async function bootstrap() {
  await ensurePlaceStorage();

  const app = createApp();

  app.listen(env.port, () => {
    console.log(`be-wfc-jogja API listening on http://localhost:${env.port}`);
  });
}

bootstrap().catch((error) => {
  console.error(error);
  process.exit(1);
});
