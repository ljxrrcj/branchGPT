import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool, closePool } from './client.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATABASE_DIR = path.resolve(__dirname, '../../../database');

async function runMigration(): Promise<void> {
  console.log('Starting database migration...');

  const client = await pool.connect();

  try {
    // Run schema.sql
    console.log('Running schema.sql...');
    const schemaPath = path.join(DATABASE_DIR, 'schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf-8');
    await client.query(schemaSql);
    console.log('Schema created successfully');

    // Run indexes.sql
    console.log('Running indexes.sql...');
    const indexesPath = path.join(DATABASE_DIR, 'indexes.sql');
    const indexesSql = fs.readFileSync(indexesPath, 'utf-8');
    await client.query(indexesSql);
    console.log('Indexes created successfully');

    // Run functions.sql
    console.log('Running functions.sql...');
    const functionsPath = path.join(DATABASE_DIR, 'functions.sql');
    const functionsSql = fs.readFileSync(functionsPath, 'utf-8');
    await client.query(functionsSql);
    console.log('Functions created successfully');

    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    client.release();
    await closePool();
  }
}

runMigration().catch(console.error);
