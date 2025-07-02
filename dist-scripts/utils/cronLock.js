import { connectToDatabase } from '../lib/mongodb';
export class CronJobLock {
    static async acquireLock(jobName, lockDurationMs = this.DEFAULT_LOCK_DURATION) {
        try {
            const { db } = await connectToDatabase();
            const locks = db.collection(this.LOCK_COLLECTION);
            const now = new Date();
            const expiresAt = new Date(now.getTime() + lockDurationMs);
            const instanceId = `${process.env.VERCEL_REGION || 'local'}-${process.pid}`;
            // Try to acquire lock atomically
            const result = await locks.findOneAndUpdate({
                _id: jobName,
                $or: [
                    { expiresAt: { $lt: now } }, // Lock expired
                    { expiresAt: { $exists: false } } // No lock exists
                ]
            }, {
                $set: {
                    _id: jobName,
                    lockedAt: now,
                    lockedBy: instanceId,
                    expiresAt: expiresAt
                }
            }, {
                upsert: true,
                returnDocument: 'after'
            });
            const acquired = result !== null && result.lockedBy === instanceId;
            if (acquired) {
                console.log(`[CronLock] Lock acquired for ${jobName} by ${instanceId}`);
            }
            else {
                console.log(`[CronLock] Failed to acquire lock for ${jobName} - already locked`);
            }
            return acquired;
        }
        catch (error) {
            console.error(`[CronLock] Error acquiring lock for ${jobName}:`, error);
            return false;
        }
    }
    static async releaseLock(jobName) {
        try {
            const { db } = await connectToDatabase();
            const locks = db.collection(this.LOCK_COLLECTION);
            await locks.deleteOne({ _id: jobName });
            console.log(`[CronLock] Lock released for ${jobName}`);
        }
        catch (error) {
            console.error(`[CronLock] Error releasing lock for ${jobName}:`, error);
        }
    }
    static async withLock(jobName, fn, lockDurationMs) {
        const lockAcquired = await this.acquireLock(jobName, lockDurationMs);
        if (!lockAcquired) {
            console.log(`[CronLock] Skipping ${jobName} - another instance is running`);
            return null;
        }
        try {
            return await fn();
        }
        finally {
            await this.releaseLock(jobName);
        }
    }
}
CronJobLock.LOCK_COLLECTION = 'cron_locks';
CronJobLock.DEFAULT_LOCK_DURATION = 5 * 60 * 1000; // 5 minutes
