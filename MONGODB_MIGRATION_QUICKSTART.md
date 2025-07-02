# MongoDB Migration Quick Start Guide

## 🚀 Fastest Method: Atlas Live Migration

1. **In MongoDB Atlas:**
   - Go to old cluster → "..." menu → "Migrate Your Cluster"
   - Select "Live Migrate"
   - Choose destination: `defairewards`
   - Map database: `old_name` → `defai`
   - Start migration

2. **Update Vercel:**
   ```
   MONGODB_URI=mongodb+srv://user:pass@defairewards.mongodb.net
   MONGODB_DB_NAME=defai
   ```

3. **Redeploy & Test**

## 💻 Command Line Method

### Prerequisites:
```bash
# Install MongoDB tools (macOS)
brew tap mongodb/brew
brew install mongodb-database-tools
```

### Quick Migration:
```bash
# 1. Set up environment variables in .env.local
OLD_MONGODB_URI="mongodb+srv://old-connection-string"
NEW_MONGODB_URI="mongodb+srv://new-connection-string-to-defairewards"

# 2. Run the migration script
npx ts-node scripts/migrate-mongodb.ts

# Or manually:
# Export
mongodump --uri="$OLD_MONGODB_URI/old_db_name" --out=./backup

# Import with rename
mongorestore --uri="$NEW_MONGODB_URI" \
  --nsFrom="old_db_name.*" \
  --nsTo="defai.*" \
  ./backup
```

## 🔧 Post-Migration Checklist

- [ ] Update connection string in Vercel
- [ ] Update database name to `defai`
- [ ] Test all critical features
- [ ] Monitor for 24 hours
- [ ] Delete old cluster (after verification)
- [ ] Remove old connection strings everywhere

## ⚠️ Important Notes

1. **Keep old cluster running** during migration
2. **Test thoroughly** before deleting old data
3. **Update all environment variables** in:
   - Vercel Dashboard
   - Local `.env.local`
   - CI/CD pipelines
   - Team documentation

## 🆘 Rollback Plan

If issues occur:
1. Switch back to old connection string in Vercel
2. Investigate issues
3. Re-run migration after fixes

## 📞 Support

- MongoDB Atlas Support (for Live Migration issues)
- Check Atlas Activity Feed for migration status
- Monitor application logs in Vercel 