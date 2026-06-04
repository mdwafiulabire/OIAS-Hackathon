import { env } from './env.js';
import { buildApp } from './app.js';

async function main() {
  const app = await buildApp();

  try {
    await app.listen({ port: env.PORT, host: env.HOST });
    app.log.info(`Server running at ${env.API_URL}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();
