import express from 'express';
import cors from 'cors';
import * as trpcExpress from '@trpc/server/adapters/express';
import { appRouter } from './routers';
import { createContext } from './trpc';
import { checkConnection, closePool } from './db/client';
import dotenv from 'dotenv';
import type { Server } from 'http';

dotenv.config();

const app = express();
const PORT = process.env['PORT'] ?? 3000;

let server: Server | null = null;

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint with database status
app.get('/health', async (_req, res) => {
  try {
    const dbStatus = await checkConnection();
    res.json({
      status: dbStatus.connected ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      database: dbStatus,
    });
  } catch (error) {
    res.status(503).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// tRPC endpoint
app.use(
  '/api/trpc',
  trpcExpress.createExpressMiddleware({
    router: appRouter,
    createContext,
  })
);

// Global error handler for Express
app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    console.error('Unhandled server error:', err);
    res.status(500).json({
      error: 'Internal server error',
      message: process.env['NODE_ENV'] === 'development' ? err.message : undefined,
    });
  }
);

/**
 * Graceful shutdown handler
 */
async function gracefulShutdown(signal: string): Promise<void> {
  console.log(`\nReceived ${signal}. Starting graceful shutdown...`);

  // Stop accepting new connections
  if (server) {
    server.close((err) => {
      if (err) {
        console.error('Error closing HTTP server:', err);
      } else {
        console.log('HTTP server closed.');
      }
    });
  }

  // Close database connections
  try {
    await closePool();
    console.log('Database connections closed.');
  } catch (error) {
    console.error('Error closing database connections:', error);
  }

  // Exit process
  process.exit(0);
}

// Register shutdown handlers
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
  gracefulShutdown('uncaughtException').catch(() => process.exit(1));
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled rejection at:', promise, 'reason:', reason);
});

/**
 * Start the server
 */
async function startServer(): Promise<void> {
  try {
    // Check database connection before starting
    const dbStatus = await checkConnection();
    if (!dbStatus.connected) {
      console.warn(
        `Warning: Database connection failed: ${dbStatus.error}. Server will start but some features may not work.`
      );
    } else {
      console.log('Database connection verified.');
    }

    // Start HTTP server
    server = app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
      console.log(`tRPC endpoint: http://localhost:${PORT}/api/trpc`);
      console.log(`Health check: http://localhost:${PORT}/health`);
    });

    // Handle server errors
    server.on('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`Error: Port ${PORT} is already in use.`);
        console.error('Please either:');
        console.error(`  1. Stop the process using port ${PORT}`);
        console.error('  2. Set a different PORT in your environment');
        process.exit(1);
      } else if (error.code === 'EACCES') {
        console.error(`Error: Permission denied to bind to port ${PORT}.`);
        console.error('Try using a port number above 1024.');
        process.exit(1);
      } else {
        console.error('Server error:', error);
        process.exit(1);
      }
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
startServer();

export type { AppRouter } from './routers';
