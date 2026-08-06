import { createDatabaseClient } from '../db/client.js';
import { purgeExpiredData } from '../modules/storage/retentionService.js';

const client = createDatabaseClient();

try {
  const result = await purgeExpiredData(client.db);
  process.stdout.write(`${JSON.stringify(result)}\n`);
} finally {
  await client.close();
}
