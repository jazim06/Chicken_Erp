// vite-health-plugin.js
// Vite plugin that tracks compilation state and health metrics
// Adapted from webpack-health-plugin.js for Vite

import os from 'os';

const SERVER_START_TIME = Date.now();

/**
 * Vite Health Check Plugin
 * Tracks build state and provides health endpoints
 */
export function createHealthCheckPlugin() {
  const status = {
    state: 'idle',           // idle, compiling, success, failed
    errors: [],
    warnings: [],
    lastCompileTime: null,
    lastSuccessTime: null,
    compileDuration: 0,
    totalCompiles: 0,
    firstCompileTime: null,
  };

  const getStatus = () => ({
    ...status,
    isHealthy: status.state === 'success',
    errorCount: status.errors.length,
    warningCount: status.warnings.length,
    hasCompiled: status.totalCompiles > 0,
  });

  const getSimpleStatus = () => ({
    state: status.state,
    isHealthy: status.state === 'success',
    errorCount: status.errors.length,
    warningCount: status.warnings.length,
  });

  return {
    name: 'vite-health-check',
    
    // Hook: Build started
    buildStart() {
      const now = Date.now();
      status.state = 'compiling';
      status.lastCompileTime = now;
      
      if (!status.firstCompileTime) {
        status.firstCompileTime = now;
      }
    },

    // Hook: Build completed successfully
    buildEnd(error) {
      status.totalCompiles++;
      status.compileDuration = Date.now() - status.lastCompileTime;

      if (error) {
        status.state = 'failed';
        status.errors = [{
          message: error.message,
          stack: error.stack,
        }];
      } else {
        status.state = 'success';
        status.lastSuccessTime = Date.now();
        status.errors = [];
        status.warnings = [];
      }
    },

    // Hook: Handle hot updates (when files change during dev)
    handleHotUpdate({ file, timestamp }) {
      status.state = 'compiling';
      const now = Date.now();
      status.lastCompileTime = now;
      
      if (!status.firstCompileTime) {
        status.firstCompileTime = now;
      }
    },

    // Hook: Configure dev server
    configureServer(server) {
      console.log('[Health Check] Setting up health endpoints...');

      // Middleware for health endpoints
      server.middlewares.use((req, res, next) => {
        const url = req.url;

        // GET /health - Detailed health status
        if (url === '/health') {
          const webpackStatus = getStatus();
          const uptime = Date.now() - SERVER_START_TIME;
          const memUsage = process.memoryUsage();

          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({
            status: webpackStatus.isHealthy ? 'healthy' : 'unhealthy',
            timestamp: new Date().toISOString(),
            uptime: {
              seconds: Math.floor(uptime / 1000),
              formatted: formatDuration(uptime),
            },
            vite: {
              state: webpackStatus.state,
              isHealthy: webpackStatus.isHealthy,
              hasCompiled: webpackStatus.hasCompiled,
              errors: webpackStatus.errorCount,
              warnings: webpackStatus.warningCount,
              lastCompileTime: webpackStatus.lastCompileTime
                ? new Date(webpackStatus.lastCompileTime).toISOString()
                : null,
              lastSuccessTime: webpackStatus.lastSuccessTime
                ? new Date(webpackStatus.lastSuccessTime).toISOString()
                : null,
              compileDuration: webpackStatus.compileDuration
                ? `${webpackStatus.compileDuration}ms`
                : null,
              totalCompiles: webpackStatus.totalCompiles,
              firstCompileTime: webpackStatus.firstCompileTime
                ? new Date(webpackStatus.firstCompileTime).toISOString()
                : null,
            },
            server: {
              nodeVersion: process.version,
              platform: os.platform(),
              arch: os.arch(),
              cpus: os.cpus().length,
              memory: {
                heapUsed: formatBytes(memUsage.heapUsed),
                heapTotal: formatBytes(memUsage.heapTotal),
                rss: formatBytes(memUsage.rss),
                external: formatBytes(memUsage.external),
              },
              systemMemory: {
                total: formatBytes(os.totalmem()),
                free: formatBytes(os.freemem()),
                used: formatBytes(os.totalmem() - os.freemem()),
              },
            },
            environment: process.env.NODE_ENV || 'development',
          }, null, 2));
          return;
        }

        // GET /health/simple - Simple text response
        if (url === '/health/simple') {
          const webpackStatus = getSimpleStatus();

          if (webpackStatus.state === 'success') {
            res.statusCode = 200;
            res.end('OK');
          } else if (webpackStatus.state === 'compiling') {
            res.statusCode = 200;
            res.end('COMPILING');
          } else if (webpackStatus.state === 'idle') {
            res.statusCode = 200;
            res.end('IDLE');
          } else {
            res.statusCode = 503;
            res.end('ERROR');
          }
          return;
        }

        // GET /health/ready - Readiness check
        if (url === '/health/ready') {
          const webpackStatus = getSimpleStatus();
          res.setHeader('Content-Type', 'application/json');

          if (webpackStatus.state === 'success') {
            res.statusCode = 200;
            res.end(JSON.stringify({
              ready: true,
              state: webpackStatus.state,
            }));
          } else {
            res.statusCode = 503;
            res.end(JSON.stringify({
              ready: false,
              state: webpackStatus.state,
              reason: webpackStatus.state === 'compiling'
                ? 'Compilation in progress'
                : 'Compilation failed',
            }));
          }
          return;
        }

        // GET /health/live - Liveness check
        if (url === '/health/live') {
          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 200;
          res.end(JSON.stringify({
            alive: true,
            timestamp: new Date().toISOString(),
          }));
          return;
        }

        // GET /health/errors - Get current errors
        if (url === '/health/errors') {
          const webpackStatus = getStatus();
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({
            errorCount: webpackStatus.errorCount,
            warningCount: webpackStatus.warningCount,
            errors: webpackStatus.errors,
            warnings: webpackStatus.warnings,
            state: webpackStatus.state,
          }));
          return;
        }

        // GET /health/stats - Compilation statistics
        if (url === '/health/stats') {
          const webpackStatus = getStatus();
          const uptime = Date.now() - SERVER_START_TIME;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({
            totalCompiles: webpackStatus.totalCompiles,
            averageCompileTime: webpackStatus.totalCompiles > 0
              ? `${Math.round(uptime / webpackStatus.totalCompiles)}ms`
              : null,
            lastCompileDuration: webpackStatus.compileDuration
              ? `${webpackStatus.compileDuration}ms`
              : null,
            firstCompileTime: webpackStatus.firstCompileTime
              ? new Date(webpackStatus.firstCompileTime).toISOString()
              : null,
            serverUptime: formatDuration(uptime),
          }));
          return;
        }

        next();
      });

      console.log('[Health Check] ✓ Health endpoints ready:');
      console.log('  • GET /health         - Detailed status');
      console.log('  • GET /health/simple  - Simple OK/ERROR');
      console.log('  • GET /health/ready   - Readiness check');
      console.log('  • GET /health/live    - Liveness check');
      console.log('  • GET /health/errors  - Error details');
      console.log('  • GET /health/stats   - Statistics');
    }
  };
}

// Helper Functions

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

function formatDuration(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}
