# MongoDB Billing Optimization Plan

## Executive Summary

Your MongoDB bill spiked to €450 due to:
1. **Quest lifecycle checks running every minute** (1,440 queries/day per collection)
2. **Missing database indexes** causing full collection scans
3. **Oversized connection pools** (50 connections in production)
4. **Inefficient query patterns** in leaderboards and aggregations

Expected savings: **80-90% reduction** in MongoDB usage and costs.

## Root Cause Analysis

### 1. High-Frequency Cron Jobs
- `scheduler.js` runs every minute checking quest status
- Quest lifecycle cron runs every 5 minutes on Vercel
- Agent policy sync runs hourly
- Each run performs multiple unindexed queries

### 2. Missing Indexes
Critical collections without proper indexes:
- `communityquests`: No indexes on status/date fields
- `proposals`: No indexes for status filtering
- `users`: No index on points for leaderboards
- `notifications`: No indexes for user queries

### 3. Connection Pool Issues
- Production uses `maxPoolSize: 50`
- Development uses `maxPoolSize: 10`
- Both Mongoose and MongoDB native driver create separate pools
- No connection reuse in cron jobs

### 4. Inefficient Queries
- Leaderboard aggregations scan entire user collection
- No query result caching
- Missing pagination on some endpoints
- No query timeouts

## Action Plan

### Phase 1: Immediate Actions (Do Today)

#### 1.1 Add Critical Indexes
```bash
# Run the index creation script
npm run build:scripts
node dist-scripts/scripts/addCriticalIndexes.js
```

This adds 20+ missing indexes including:
- Quest status and timestamp indexes
- User points leaderboard indexes
- Proposal processing indexes
- Notification query indexes

#### 1.2 Reduce Cron Frequency
Update `vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/cron/quest-lifecycle",
      "schedule": "*/15 * * * *"  // Changed from */5 to */15
    }
  ]
}
```

Update `package.json` to use optimized scheduler:
```json
{
  "scripts": {
    "dev:scheduler": "nodemon src/scheduler-optimized.js",
  }
}
```

#### 1.3 Monitor Current Usage
```bash
# Run monitoring script
npm run build:scripts
node dist-scripts/scripts/monitorMongoUsage.js
```

### Phase 2: Connection Optimization (This Week)

#### 2.1 Replace MongoDB Connection Module
1. Back up current `src/lib/mongodb.ts`
2. Replace with `src/lib/mongodb-optimized.ts`
3. Update imports across the codebase

#### 2.2 Update Environment Variables
Add to `.env.local` and production:
```env
MONGODB_DEBUG=true  # Enable connection monitoring
```

#### 2.3 Consolidate Database Connections
- Remove duplicate Mongoose connections
- Use single connection pool across all services
- Implement connection reuse in cron jobs

### Phase 3: Query Optimization (Next 2 Weeks)

#### 3.1 Implement Caching
Add Redis caching for:
- Leaderboard queries (5-minute TTL)
- User rankings (5-minute TTL)
- Squad points calculations

#### 3.2 Add Query Limits
- Add `.limit(100)` to all leaderboard queries
- Implement proper pagination
- Add query timeouts (45 seconds max)

#### 3.3 Optimize Aggregation Pipelines
- Add `$match` stages early to filter data
- Use indexes in `$sort` stages
- Limit results before complex calculations

### Phase 4: Monitoring & Maintenance

#### 4.1 Set Up Alerts
- MongoDB Atlas alerts for high connection counts
- Query performance monitoring
- Bill threshold alerts

#### 4.2 Regular Maintenance
- Weekly index analysis
- Monthly query optimization review
- Quarterly connection pool tuning

## Expected Results

### Immediate Impact (After Phase 1)
- **60-70% reduction** in database operations
- Quest checks: 96 queries/day (down from 1,440)
- Indexed queries run 100-1000x faster

### Full Implementation Impact
- **80-90% reduction** in MongoDB costs
- Sub-second query response times
- Stable connection pool usage
- Predictable billing

## Monitoring Commands

```bash
# Check index usage
npm run build:scripts && node dist-scripts/scripts/monitorMongoUsage.js

# Monitor connections in real-time
MONGODB_DEBUG=true npm run dev

# Analyze slow queries (in MongoDB Atlas)
# Go to Performance Advisor → Slow Queries
```

## Rollback Plan

If issues occur:
1. Revert `vercel.json` cron schedules
2. Switch back to original `mongodb.ts`
3. Remove new indexes if causing issues: `db.collection.dropIndex("index_name")`

## Support

For MongoDB optimization support:
- MongoDB Atlas Performance Advisor
- MongoDB University free courses
- MongoDB official documentation

## Checklist

- [ ] Run `addCriticalIndexes.ts` script
- [ ] Update `vercel.json` cron frequency
- [ ] Switch to `scheduler-optimized.js`
- [ ] Run monitoring script
- [ ] Deploy changes to production
- [ ] Monitor MongoDB Atlas metrics for 24 hours
- [ ] Implement connection optimization
- [ ] Add query caching
- [ ] Set up billing alerts 