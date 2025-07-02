# Quick Fix Guide - MongoDB Billing Issue

## 🚨 Immediate Actions (15 minutes)

### Step 1: Add Missing Indexes (5 min)
```bash
npm run mongodb:add-indexes
```
This will add 20+ critical indexes and show you current collection sizes.

### Step 2: Update Cron Frequency (2 min)
Edit `vercel.json`, change line 21:
```json
"schedule": "*/15 * * * *"  // was "*/5 * * * *"
```

### Step 3: Switch to Optimized Scheduler (3 min)
For local development:
```bash
# Stop current scheduler (Ctrl+C)
# Start optimized version:
npm run dev:scheduler-optimized
```

For production deployment, update your process manager or Docker config to use `scheduler-optimized.js` instead of `scheduler.js`.

### Step 4: Monitor Impact (5 min)
```bash
npm run mongodb:monitor
```
This shows your current database usage and recommendations.

## 📊 Expected Results

Within 1 hour:
- Database operations reduced by ~70%
- Query performance improved 10-100x
- Connection count stabilized

Within 24 hours:
- MongoDB billing should show significant reduction
- No more connection spikes

## 🔄 Next Steps

1. **Deploy to Production**
   - Commit these changes
   - Deploy to your hosting platform
   - Monitor MongoDB Atlas metrics

2. **Phase 2 (This Week)**
   - Replace mongodb.ts with mongodb-optimized.ts
   - Add Redis caching for leaderboards
   - Implement query pagination

## ⚠️ If Something Goes Wrong

1. **Indexes causing issues**: 
   ```javascript
   // Connect to MongoDB and run:
   db.collection_name.dropIndex("index_name")
   ```

2. **Cron jobs not running**:
   - Revert vercel.json to original schedule
   - Check logs for errors

3. **Performance degraded**:
   - Switch back to original scheduler.js
   - Contact MongoDB support with your usage patterns

## 📞 Need Help?

- Check `MONGODB_OPTIMIZATION_PLAN.md` for detailed explanations
- MongoDB Atlas Performance Advisor shows query patterns
- MongoDB support can help optimize based on your workload

Remember: The biggest impact comes from the indexes and reduced cron frequency. Everything else is optimization on top of that. 