#!/usr/bin/env ts-node

import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config({ path: '.env.local' });

const execAsync = promisify(exec);

interface MigrationConfig {
  oldUri: string;
  newUri: string;
  oldDbName: string;
  newDbName: string;
  backupPath: string;
}

class MongoMigrator {
  private config: MigrationConfig;

  constructor(config: MigrationConfig) {
    this.config = config;
  }

  async checkConnections(): Promise<void> {
    console.log('🔍 Checking connections...');
    
    const oldClient = new MongoClient(this.config.oldUri);
    const newClient = new MongoClient(this.config.newUri);
    
    try {
      await oldClient.connect();
      console.log('✅ Connected to old cluster');
      
      await newClient.connect();
      console.log('✅ Connected to new cluster (defairewards)');
      
      const oldDb = oldClient.db(this.config.oldDbName);
      const collections = await oldDb.listCollections().toArray();
      console.log(`📊 Found ${collections.length} collections in old database`);
      
    } catch (error) {
      console.error('❌ Connection error:', error);
      throw error;
    } finally {
      await oldClient.close();
      await newClient.close();
    }
  }

  async exportData(): Promise<void> {
    console.log('\n📤 Exporting data from old cluster...');
    
    // Create backup directory
    if (!fs.existsSync(this.config.backupPath)) {
      fs.mkdirSync(this.config.backupPath, { recursive: true });
    }
    
    const command = `mongodump --uri="${this.config.oldUri}/${this.config.oldDbName}" --out="${this.config.backupPath}"`;
    
    try {
      const { stdout, stderr } = await execAsync(command);
      if (stderr && !stderr.includes('done dumping')) {
        console.error('⚠️  Export warnings:', stderr);
      }
      console.log('✅ Data exported successfully');
    } catch (error) {
      console.error('❌ Export failed:', error);
      throw error;
    }
  }

  async importData(): Promise<void> {
    console.log('\n📥 Importing data to new cluster (defairewards)...');
    
    const command = `mongorestore --uri="${this.config.newUri}" --nsFrom="${this.config.oldDbName}.*" --nsTo="${this.config.newDbName}.*" "${this.config.backupPath}"`;
    
    try {
      const { stdout, stderr } = await execAsync(command);
      if (stderr && !stderr.includes('done')) {
        console.error('⚠️  Import warnings:', stderr);
      }
      console.log('✅ Data imported successfully to defai database');
    } catch (error) {
      console.error('❌ Import failed:', error);
      throw error;
    }
  }

  async verifyMigration(): Promise<void> {
    console.log('\n🔍 Verifying migration...');
    
    const oldClient = new MongoClient(this.config.oldUri);
    const newClient = new MongoClient(this.config.newUri);
    
    try {
      await oldClient.connect();
      await newClient.connect();
      
      const oldDb = oldClient.db(this.config.oldDbName);
      const newDb = newClient.db(this.config.newDbName);
      
      const oldCollections = await oldDb.listCollections().toArray();
      const newCollections = await newDb.listCollections().toArray();
      
      console.log(`\n📊 Migration Summary:`);
      console.log(`Old database: ${oldCollections.length} collections`);
      console.log(`New database: ${newCollections.length} collections`);
      
      let allMatch = true;
      
      for (const coll of oldCollections) {
        const oldCount = await oldDb.collection(coll.name).countDocuments();
        const newCount = await newDb.collection(coll.name).countDocuments();
        
        const match = oldCount === newCount;
        allMatch = allMatch && match;
        
        console.log(`${match ? '✅' : '❌'} ${coll.name}: ${oldCount} → ${newCount} documents`);
      }
      
      if (allMatch) {
        console.log('\n✅ All collections migrated successfully!');
      } else {
        console.log('\n⚠️  Some collections have mismatched document counts');
      }
      
    } finally {
      await oldClient.close();
      await newClient.close();
    }
  }

  async createIndexes(): Promise<void> {
    console.log('\n🔧 Creating indexes on new database...');
    
    const client = new MongoClient(this.config.newUri);
    
    try {
      await client.connect();
      const db = client.db(this.config.newDbName);
      
      // Users indexes
      const users = db.collection('users');
      await users.createIndex({ walletAddress: 1 }, { unique: true, sparse: true });
      await users.createIndex({ xUserId: 1 }, { unique: true, sparse: true });
      await users.createIndex({ referralCode: 1 }, { unique: true, sparse: true });
      await users.createIndex({ createdAt: -1 });
      await users.createIndex({ points: -1 });
      console.log('✅ Users indexes created');
      
      // Proposals indexes
      const proposals = db.collection('proposals');
      await proposals.createIndex({ squadId: 1, status: 1 });
      await proposals.createIndex({ epochEnd: 1 });
      console.log('✅ Proposals indexes created');
      
      // Add more indexes as needed...
      
    } catch (error) {
      console.error('⚠️  Index creation error:', error);
    } finally {
      await client.close();
    }
  }
}

// Main migration function
async function main() {
  console.log('🚀 MongoDB Migration Tool');
  console.log('========================');
  
  // Check for required environment variables
  const OLD_MONGODB_URI = process.env.OLD_MONGODB_URI || process.env.MONGODB_URI;
  const NEW_MONGODB_URI = process.env.NEW_MONGODB_URI;
  const OLD_DB_NAME = process.env.OLD_DB_NAME || process.env.MONGODB_DB_NAME || 'test';
  
  if (!OLD_MONGODB_URI || !NEW_MONGODB_URI) {
    console.error('❌ Missing required environment variables:');
    console.error('   OLD_MONGODB_URI or MONGODB_URI');
    console.error('   NEW_MONGODB_URI');
    console.error('\nSet these in .env.local or as environment variables');
    process.exit(1);
  }
  
  const config: MigrationConfig = {
    oldUri: OLD_MONGODB_URI,
    newUri: NEW_MONGODB_URI,
    oldDbName: OLD_DB_NAME,
    newDbName: 'defai', // Target database name
    backupPath: path.join(process.cwd(), 'mongodb-backup', new Date().toISOString().split('T')[0])
  };
  
  console.log('\n📋 Migration Configuration:');
  console.log(`   From: ${OLD_DB_NAME} database`);
  console.log(`   To: defai database (in defairewards cluster)`);
  console.log(`   Backup: ${config.backupPath}`);
  
  const migrator = new MongoMigrator(config);
  
  try {
    // Step 1: Check connections
    await migrator.checkConnections();
    
    // Step 2: Export data
    await migrator.exportData();
    
    // Step 3: Import data
    await migrator.importData();
    
    // Step 4: Verify migration
    await migrator.verifyMigration();
    
    // Step 5: Create indexes
    await migrator.createIndexes();
    
    console.log('\n🎉 Migration completed successfully!');
    console.log('\n📝 Next steps:');
    console.log('1. Update MONGODB_URI in Vercel to point to new cluster');
    console.log('2. Update MONGODB_DB_NAME to "defai" in Vercel');
    console.log('3. Test application thoroughly');
    console.log('4. Keep old cluster running for 24-48 hours');
    console.log('5. After confirming everything works, delete old cluster');
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

export { MongoMigrator, MigrationConfig }; 