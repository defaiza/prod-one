# MongoDB Cluster Migration Guide

## Overview
Migrating data from exposed cluster to new secure cluster: **defairewards** with database **defai**

## Prerequisites
- MongoDB Database Tools installed (`mongodump` and `mongorestore`)
- Access to both old and new MongoDB clusters
- Sufficient disk space for backup files

## Method 1: Using MongoDB Atlas UI (Recommended)

### Step 1: Create New Cluster
1. Log into MongoDB Atlas
2. Create new cluster named `defairewards`
3. Configure security settings:
   - Enable IP Whitelist (add your IPs)
   - Create new database user with strong password
   - Enable encryption at rest

### Step 2: Use Atlas Live Migration
1. In Atlas, go to your old cluster
2. Click "..." menu → "Migrate Your Cluster"
3. Select "Live Migrate"
4. Choose destination: `defairewards` cluster
5. Map database names: `old_db_name` → `defai`
6. Start migration (keeps apps running during migration)

## Method 2: Using Command Line Tools

### Step 1: Install MongoDB Database Tools
```bash
# macOS
brew tap mongodb/brew
brew install mongodb-database-tools

# Or download from: https://www.mongodb.com/try/download/database-tools
```

### Step 2: Export Data from Old Cluster
```bash
# Set connection strings
OLD_URI="mongodb+srv://username:password@old-cluster.mongodb.net"
NEW_URI="mongodb+srv://username:password@defairewards.mongodb.net"

# Create backup directory
mkdir -p ~/mongodb-migration-backup
cd ~/mongodb-migration-backup

# Export all data from old cluster
mongodump --uri="$OLD_URI" --out=./backup

# Or export specific database
mongodump --uri="$OLD_URI/old_database_name" --out=./backup
```

### Step 3: Import Data to New Cluster
```bash
# Import to new cluster with database rename
mongorestore --uri="$NEW_URI" \
  --nsFrom="old_database_name.*" \
  --nsTo="defai.*" \
  ./backup

# Or if database names are the same
mongorestore --uri="$NEW_URI/defai" \
  --drop \
  ./backup/old_database_name
```

## Method 3: Using MongoDB Compass (GUI)

1. Connect to old cluster in Compass
2. Select database → Export Collection
3. Export each collection as JSON
4. Connect to new cluster
5. Create `defai` database
6. Import each collection

## Step 4: Update Application Configuration

### Update Environment Variables
```bash
# Old (REMOVE THESE)
MONGODB_URI="mongodb+srv://old-user:old-pass@old-cluster.mongodb.net"
MONGODB_DB_NAME="old_database_name"

# New (ADD THESE)
MONGODB_URI="mongodb+srv://new-user:new-pass@defairewards.mongodb.net"
MONGODB_DB_NAME="defai"
```

### Update in Vercel/Deployment Platform
1. Go to Vercel Dashboard → Settings → Environment Variables
2. Update `MONGODB_URI` with new connection string
3. Update `MONGODB_DB_NAME` to `defai`
4. Redeploy application

## Step 5: Verify Migration

### Run Verification Script
Create `verify-migration.js`:
```javascript
const { MongoClient } = require('mongodb');

async function verifyMigration() {
  const oldUri = process.env.OLD_MONGODB_URI;
  const newUri = process.env.NEW_MONGODB_URI;
  
  const oldClient = new MongoClient(oldUri);
  const newClient = new MongoClient(newUri);
  
  try {
    await oldClient.connect();
    await newClient.connect();
    
    const oldDb = oldClient.db('old_database_name');
    const newDb = newClient.db('defai');
    
    // Get collection names
    const oldCollections = await oldDb.listCollections().toArray();
    const newCollections = await newDb.listCollections().toArray();
    
    console.log('Old collections:', oldCollections.length);
    console.log('New collections:', newCollections.length);
    
    // Verify document counts
    for (const coll of oldCollections) {
      const oldCount = await oldDb.collection(coll.name).countDocuments();
      const newCount = await newDb.collection(coll.name).countDocuments();
      
      console.log(`${coll.name}: Old=${oldCount}, New=${newCount}`);
      
      if (oldCount !== newCount) {
        console.error(`⚠️  Mismatch in ${coll.name}!`);
      }
    }
    
  } finally {
    await oldClient.close();
    await newClient.close();
  }
}

verifyMigration().catch(console.error);
```

Run with:
```bash
OLD_MONGODB_URI="old_connection_string" \
NEW_MONGODB_URI="new_connection_string" \
node verify-migration.js
```

## Step 6: Update Indexes

After migration, recreate indexes:
```bash
# Connect to new cluster
mongosh "$NEW_URI/defai"

# In MongoDB shell, recreate indexes
db.users.createIndex({ walletAddress: 1 }, { unique: true, sparse: true });
db.users.createIndex({ xUserId: 1 }, { unique: true, sparse: true });
db.users.createIndex({ referralCode: 1 }, { unique: true, sparse: true });
db.users.createIndex({ createdAt: -1 });
db.users.createIndex({ points: -1 });

# Add other indexes as needed
db.proposals.createIndex({ squadId: 1, status: 1 });
db.proposals.createIndex({ epochEnd: 1 });
db.actions.createIndex({ userId: 1, timestamp: -1 });
# ... etc
```

## Step 7: Test Application

1. Update local `.env.local` with new connection
2. Run application locally
3. Test critical functions:
   - User login
   - Points operations
   - Squad operations
   - Proposals

## Step 8: Deploy and Monitor

1. Deploy with new connection string
2. Monitor logs for connection errors
3. Check MongoDB Atlas metrics
4. Ensure all features work correctly

## Step 9: Cleanup

After confirming everything works:

1. **Keep backup for 30 days**
2. **Download final backup of old cluster**
3. **Delete old cluster** (after thorough testing)
4. **Remove old connection strings from:**
   - Password managers
   - Documentation
   - Team communications

## Security Checklist

- [ ] New cluster has different credentials
- [ ] IP Whitelist configured
- [ ] Network peering/PrivateLink enabled (if applicable)
- [ ] Encryption at rest enabled
- [ ] Audit logs enabled
- [ ] Backup schedule configured
- [ ] Monitoring alerts set up
- [ ] Old cluster access revoked
- [ ] Team notified of new credentials

## Troubleshooting

### Connection Issues
```bash
# Test connection
mongosh "$NEW_URI/defai" --eval "db.stats()"
```

### Permission Issues
- Ensure new user has `readWrite` role on `defai` database
- Check IP whitelist includes your application servers

### Data Integrity Issues
- Compare document counts
- Spot-check critical documents
- Run application test suite

## Emergency Rollback

If issues arise:
1. Keep old cluster running during transition
2. Have connection string ready to switch back
3. Document any data changes during migration period 