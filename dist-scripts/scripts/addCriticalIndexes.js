// @ts-ignore - TypeScript module resolution
import { connectToDatabase } from '../lib/mongodb.js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';
// Load environment variables
dotenv.config({ path: resolve(process.cwd(), '.env.local') });
async function main() {
    const { db, client } = await connectToDatabase();
    console.log('Creating critical indexes to reduce MongoDB load...');
    try {
        // Quest-related indexes (for the every-minute cron job)
        await db.collection('communityquests').createIndexes([
            { key: { status: 1, start_ts: 1 }, name: 'quest_activation' },
            { key: { status: 1, end_ts: 1 }, name: 'quest_expiration' },
            { key: { goal_type: 1, status: 1 }, name: 'quest_type_status' },
            { key: { scope: 1, status: 1 }, name: 'quest_scope_status' }
        ]);
        // Quest contribution indexes
        await db.collection('questcontributions').createIndexes([
            { key: { quest_id: 1, user_id: 1 }, name: 'quest_user_contribution' },
            { key: { quest_id: 1, metric_value: 1 }, name: 'quest_metrics' }
        ]);
        // Proposal indexes (for cron jobs)
        await db.collection('proposals').createIndexes([
            { key: { status: 1, epochEnd: 1 }, name: 'proposal_processing' },
            { key: { squadId: 1, status: 1 }, name: 'squad_proposals' },
            { key: { status: 1, createdAt: -1 }, name: 'proposal_listing' }
        ]);
        // User indexes for leaderboards and points queries
        await db.collection('users').createIndexes([
            { key: { points: -1 }, name: 'user_points_desc' },
            { key: { points: 1, _id: 1 }, name: 'user_points_ranking' },
            { key: { squadId: 1, points: -1 }, name: 'squad_member_points' },
            { key: { agentStatus: 1 }, name: 'agent_status' },
            { key: { createdAt: -1 }, name: 'user_creation' }
        ]);
        // Squad indexes
        await db.collection('squads').createIndexes([
            { key: { totalSquadPoints: -1 }, name: 'squad_points_leaderboard' },
            { key: { tier: 1, totalSquadPoints: -1 }, name: 'squad_tier_points' }
        ]);
        // Notification indexes
        await db.collection('notifications').createIndexes([
            { key: { recipientUserId: 1, createdAt: -1 }, name: 'user_notifications' },
            { key: { recipientUserId: 1, isRead: 1, createdAt: -1 }, name: 'unread_notifications' },
            { key: { createdAt: 1 }, name: 'notification_cleanup', expireAfterSeconds: 2592000 } // 30 days TTL
        ]);
        // Admin audit log indexes
        await db.collection('adminAuditLogs').createIndexes([
            { key: { timestamp: -1 }, name: 'audit_time' },
            { key: { adminUserId: 1, timestamp: -1 }, name: 'admin_audit' },
            { key: { timestamp: 1 }, name: 'audit_cleanup', expireAfterSeconds: 7776000 } // 90 days TTL
        ]);
        // Cron lock indexes
        await db.collection('cron_locks').createIndexes([
            { key: { expiresAt: 1 }, name: 'lock_expiration' }
        ]);
        console.log('All critical indexes created successfully!');
        // Analyze index usage
        const collections = ['users', 'communityquests', 'proposals', 'squads', 'notifications'];
        console.log('\nAnalyzing current collection sizes:');
        for (const collName of collections) {
            const count = await db.collection(collName).countDocuments();
            console.log(`${collName}: ${count} documents`);
        }
    }
    catch (error) {
        console.error('Error creating indexes:', error);
        throw error;
    }
    finally {
        await client.close();
    }
}
main().catch(err => {
    console.error('Failed to create indexes', err);
    process.exit(1);
});
