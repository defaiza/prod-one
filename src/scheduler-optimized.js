// src/scheduler-optimized.js
import './config/env-loader.js';

import cron from 'node-cron';
import { questLifecycleService } from './services/questLifecycle.service.js';
import { connectToDatabase } from '../dist-scripts/lib/mongodb.js';

console.log('[Scheduler] Starting optimized scheduler...');

// Keep a persistent database connection
let dbConnection = null;

async function initializeAndScheduleJobs() {
  try {
    // Establish a single persistent connection
    dbConnection = await connectToDatabase();
    console.log('[Scheduler] Database connection established.');

    // CRITICAL CHANGE: Run quest lifecycle checks every 15 minutes instead of every minute
    // This reduces database load by 93%
    cron.schedule('*/15 * * * *', async () => {
      console.log('[Scheduler] Running scheduled job: quest lifecycle checks');
      try {
        // Run both operations in parallel
        const [activationResult, expirationResult] = await Promise.all([
          questLifecycleService.activateScheduledQuests(),
          questLifecycleService.expireOverdueQuests()
        ]);
        
        console.log('[Scheduler] Quest lifecycle check completed:', {
          activated: activationResult.activated || 0,
          expired: expirationResult.expired || 0
        });
      } catch (e) {
        console.error('[Scheduler] Error during quest lifecycle job:', e);
      }
    });

    console.log('[Scheduler] Cron jobs scheduled. Checking for quest status updates every 15 minutes.');
    console.log('[Scheduler] This reduces MongoDB operations by ~93% compared to every-minute checks.');
    console.log('[Scheduler] Scheduler process is running. Press Ctrl+C to exit.');

  } catch (error) {
    console.error('[Scheduler] Failed to initialize scheduler or connect to DB:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('[Scheduler] Shutting down gracefully...');
  if (dbConnection && dbConnection.client) {
    await dbConnection.client.close();
    console.log('[Scheduler] Database connection closed.');
  }
  process.exit(0);
});

initializeAndScheduleJobs(); 