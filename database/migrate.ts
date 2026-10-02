import { getDb, ensureSchema } from '../src/db/index.js';

async function migrate() {
  console.log('Running database migrations...');
  const db = await getDb();
  await ensureSchema(db);
  console.log('Database migrations completed successfully!');
  process.exit(0);
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
