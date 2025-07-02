// @ts-ignore - TypeScript module resolution
import { connectToDatabase } from '../lib/mongodb.js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';
// Load environment variables
dotenv.config({ path: resolve(process.cwd(), '.env.local') });
async function checkSuspiciousActivity() {
    console.log('=== Checking for Suspicious Database Activity ===\n');
    const { db, client } = await connectToDatabase();
    try {
        const now = new Date();
        const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
        // 1. Check recent user creations
        const usersCollection = db.collection('users');
        const recentUserCount = await usersCollection.countDocuments({
            createdAt: { $gte: oneDayAgo }
        });
        const lastHourUsers = await usersCollection.countDocuments({
            createdAt: { $gte: oneHourAgo }
        });
        console.log('User Creation Activity:');
        console.log(`- Last 24 hours: ${recentUserCount} users`);
        console.log(`- Last hour: ${lastHourUsers} users`);
        if (lastHourUsers > 100) {
            console.log('⚠️  WARNING: Unusually high user creation rate!');
        }
        // 2. Check referral activity
        const actionsCollection = db.collection('actions');
        const recentReferrals = await actionsCollection.countDocuments({
            actionType: 'referral_bonus',
            timestamp: { $gte: oneDayAgo }
        });
        const lastHourReferrals = await actionsCollection.countDocuments({
            actionType: 'referral_bonus',
            timestamp: { $gte: oneHourAgo }
        });
        console.log('\nReferral Activity:');
        console.log(`- Last 24 hours: ${recentReferrals} referrals`);
        console.log(`- Last hour: ${lastHourReferrals} referrals`);
        if (lastHourReferrals > 50) {
            console.log('⚠️  WARNING: Unusually high referral rate!');
        }
        // 3. Check for duplicate wallet patterns (bot behavior)
        const suspiciousPatterns = await usersCollection.aggregate([
            {
                $match: { createdAt: { $gte: oneDayAgo } }
            },
            {
                $group: {
                    _id: {
                        $substr: ['$walletAddress', 0, 10] // Group by wallet prefix
                    },
                    count: { $sum: 1 },
                    wallets: { $push: '$walletAddress' }
                }
            },
            {
                $match: { count: { $gt: 5 } } // More than 5 similar prefixes
            },
            {
                $sort: { count: -1 }
            }
        ]).toArray();
        if (suspiciousPatterns.length > 0) {
            console.log('\n⚠️  WARNING: Suspicious wallet patterns detected:');
            suspiciousPatterns.forEach((pattern) => {
                console.log(`  - Prefix "${pattern._id}...": ${pattern.count} wallets`);
                console.log(`    Sample: ${pattern.wallets.slice(0, 3).join(', ')}`);
            });
        }
        // 4. Check for users with no activity except referrals
        const botsCount = await usersCollection.countDocuments({
            createdAt: { $gte: oneDayAgo },
            points: { $gt: 0 },
            completedActions: { $size: 0 } // Only have points but no actions
        });
        if (botsCount > 0) {
            console.log(`\n⚠️  WARNING: ${botsCount} users with points but no completed actions (possible bots)`);
        }
        // 5. Check collections that shouldn't be growing rapidly
        const collections = ['notifications', 'squadInvitations', 'communityquests'];
        console.log('\nCollection Growth Check:');
        for (const collName of collections) {
            const coll = db.collection(collName);
            const total = await coll.countDocuments();
            const recent = await coll.countDocuments({
                createdAt: { $gte: oneDayAgo }
            });
            const growthRate = total > 0 ? (recent / total * 100).toFixed(1) : 0;
            console.log(`- ${collName}: ${total} total, ${recent} new (${growthRate}% growth)`);
            if (Number(growthRate) > 50) {
                console.log(`  ⚠️  WARNING: Rapid growth detected!`);
            }
        }
        // 6. Generate recommendations
        console.log('\n=== Recommendations ===\n');
        if (recentUserCount > 1000 || lastHourUsers > 100) {
            console.log('1. IMMEDIATE: Add authentication to /api/check-airdrop and /api/referrals/*');
            console.log('2. IMMEDIATE: Implement rate limiting on all public endpoints');
            console.log('3. Review MongoDB Atlas logs for source IPs of requests');
        }
        if (suspiciousPatterns.length > 0) {
            console.log('4. Investigate wallet patterns - likely bot attack');
            console.log('5. Consider blocking wallet creation from suspicious patterns');
        }
        console.log('\nTo clean up suspicious data:');
        console.log('- Backup your database first');
        console.log('- Remove users created in suspicious time windows');
        console.log('- Reset referral counts for affected users');
        console.log('- Contact MongoDB support for billing adjustment');
    }
    catch (error) {
        console.error('Error checking suspicious activity:', error);
    }
    finally {
        await client.close();
    }
}
// Run the check
checkSuspiciousActivity().catch(console.error);
