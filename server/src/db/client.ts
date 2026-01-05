import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

/**
 * Custom error class for database errors with enhanced context
 */
export class DatabaseError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly query?: string,
    public readonly originalError?: Error,
    public readonly isRetryable: boolean = false
  ) {
    super(message);
    this.name = 'DatabaseError';
  }
}

/**
 * Parse PostgreSQL errors and return a user-friendly error
 */
function parseDatabaseError(error: unknown, queryText?: string): DatabaseError {
  if (error instanceof DatabaseError) {
    return error;
  }

  if (error instanceof pg.DatabaseError) {
    const pgError = error as pg.DatabaseError & { code?: string };
    const code = pgError.code ?? 'UNKNOWN';

    switch (code) {
      case '23505': // unique_violation
        return new DatabaseError(
          `Duplicate entry: ${pgError.detail ?? pgError.message}`,
          'DUPLICATE_ENTRY',
          queryText,
          error,
          false
        );
      case '23503': // foreign_key_violation
        return new DatabaseError(
          `Foreign key constraint failed: ${pgError.detail ?? pgError.message}`,
          'FOREIGN_KEY_VIOLATION',
          queryText,
          error,
          false
        );
      case '23502': // not_null_violation
        return new DatabaseError(
          `Required field is missing: ${pgError.column ?? pgError.message}`,
          'NOT_NULL_VIOLATION',
          queryText,
          error,
          false
        );
      case '42P01': // undefined_table
        return new DatabaseError(
          `Table does not exist: ${pgError.message}`,
          'TABLE_NOT_FOUND',
          queryText,
          error,
          false
        );
      case '42703': // undefined_column
        return new DatabaseError(
          `Column does not exist: ${pgError.message}`,
          'COLUMN_NOT_FOUND',
          queryText,
          error,
          false
        );
      case '28000': // invalid_authorization_specification
      case '28P01': // invalid_password
        return new DatabaseError(
          'Database authentication failed. Please check your credentials.',
          'AUTH_FAILED',
          queryText,
          error,
          false
        );
      case '57P01': // admin_shutdown
      case '57P02': // crash_shutdown
      case '57P03': // cannot_connect_now
        return new DatabaseError(
          'Database server is shutting down or unavailable.',
          'SERVER_SHUTDOWN',
          queryText,
          error,
          true
        );
      case '53300': // too_many_connections
        return new DatabaseError(
          'Too many database connections. Please try again later.',
          'TOO_MANY_CONNECTIONS',
          queryText,
          error,
          true
        );
      case '40001': // serialization_failure
      case '40P01': // deadlock_detected
        return new DatabaseError(
          'Transaction conflict detected. Please retry the operation.',
          'TRANSACTION_CONFLICT',
          queryText,
          error,
          true
        );
      default:
        return new DatabaseError(
          `Database error: ${pgError.message}`,
          code,
          queryText,
          error,
          code.startsWith('53') || code.startsWith('57') // Connection issues are retryable
        );
    }
  }

  if (error instanceof Error) {
    if (error.message.includes('ECONNREFUSED')) {
      return new DatabaseError(
        'Cannot connect to database. Please ensure the database server is running.',
        'CONNECTION_REFUSED',
        queryText,
        error,
        true
      );
    }
    if (error.message.includes('timeout')) {
      return new DatabaseError(
        'Database connection timed out. The server may be overloaded.',
        'CONNECTION_TIMEOUT',
        queryText,
        error,
        true
      );
    }
    if (error.message.includes('ENOTFOUND')) {
      return new DatabaseError(
        'Database host not found. Please check your connection string.',
        'HOST_NOT_FOUND',
        queryText,
        error,
        false
      );
    }
    return new DatabaseError(
      `Database error: ${error.message}`,
      'UNKNOWN',
      queryText,
      error,
      false
    );
  }

  return new DatabaseError(
    'An unknown database error occurred.',
    'UNKNOWN',
    queryText,
    undefined,
    false
  );
}

/**
 * Database connection pool
 */
export const pool = new Pool({
  connectionString: process.env['DATABASE_URL'],
  ssl: process.env['DATABASE_SSL'] === 'true' ? { rejectUnauthorized: false } : undefined,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Handle pool errors to prevent unhandled rejections
pool.on('error', (err) => {
  console.error('Unexpected database pool error:', err.message);
});

/**
 * Execute a query with automatic connection management
 * @throws {DatabaseError} If the query fails
 */
export async function query<T extends pg.QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<pg.QueryResult<T>> {
  const start = Date.now();

  try {
    const result = await pool.query<T>(text, params);
    const duration = Date.now() - start;

    if (process.env['NODE_ENV'] === 'development') {
      console.log('Executed query', { text: text.slice(0, 100), duration, rows: result.rowCount });
    }

    return result;
  } catch (error) {
    const duration = Date.now() - start;
    console.error('Query failed', { text: text.slice(0, 100), duration, error });
    throw parseDatabaseError(error, text);
  }
}

/**
 * Get a client from the pool for transactions
 * @throws {DatabaseError} If unable to acquire a connection
 */
export async function getClient(): Promise<pg.PoolClient> {
  try {
    const client = await pool.connect();
    return client;
  } catch (error) {
    throw parseDatabaseError(error);
  }
}

/**
 * Execute a function within a transaction
 * @throws {DatabaseError} If the transaction fails
 */
export async function withTransaction<T>(
  fn: (client: pg.PoolClient) => Promise<T>
): Promise<T> {
  let client: pg.PoolClient;

  try {
    client = await pool.connect();
  } catch (error) {
    throw parseDatabaseError(error);
  }

  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    // Attempt rollback, but don't let rollback errors mask the original error
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      console.error('Failed to rollback transaction:', rollbackError);
    }

    // Re-throw as DatabaseError if not already
    if (error instanceof DatabaseError) {
      throw error;
    }
    throw parseDatabaseError(error);
  } finally {
    client.release();
  }
}

/**
 * Check database connection
 * @returns Connection status with error details if failed
 */
export async function checkConnection(): Promise<{
  connected: boolean;
  error?: string;
  errorCode?: string;
}> {
  try {
    await pool.query('SELECT 1');
    return { connected: true };
  } catch (error) {
    const dbError = parseDatabaseError(error);
    console.error('Database connection check failed:', dbError.message);
    return {
      connected: false,
      error: dbError.message,
      errorCode: dbError.code,
    };
  }
}

/**
 * Close all connections (for graceful shutdown)
 */
export async function closePool(): Promise<void> {
  try {
    await pool.end();
  } catch (error) {
    console.error('Error closing database pool:', error);
    // Don't throw - we're shutting down anyway
  }
}
