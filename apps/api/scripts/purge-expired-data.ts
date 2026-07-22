import { createDatabaseClient } from '../src/db/client.js';
import { purgeExpiredSyncedData } from '../src/modules/dataSync/dataSyncService.js';

const client = createDatabaseClient();

try {
  await purgeExpiredSyncedData(client.db);
} finally {
  await client.close();
}
