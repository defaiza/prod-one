// @ts-ignore - TypeScript module resolution
import { connectToDatabase } from '../lib/mongodb.js';
import { readFileSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: resolve(process.cwd(), '.env.local') });

interface CollectionStats {
  name: string;
  count: number;
  indexes: any[];
  totalIndexSize: number;
}

async function analyzeMongoUsage() {
  console.log('=== MongoDB Usage Analysis ===\n');
  
  const { db, client } = await connectToDatabase();
  
  try {
    // 1. Get database statistics
    const dbStats = await db.stats();
    console.log('Database Statistics:');
    console.log(`- Data Size: ${(dbStats.dataSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`- Storage Size: ${(dbStats.storageSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`- Index Size: ${(dbStats.indexSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`- Total Collections: ${dbStats.collections}`);
    console.log(`- Total Indexes: ${dbStats.indexes}\n`);

    // 2. Analyze each collection
    const collections = await db.listCollections().toArray();
    const collectionStats: CollectionStats[] = [];

    console.log('Collection Analysis:');
    console.log('-------------------');

    for (const coll of collections) {
      const collection = db.collection(coll.name);
      const count = await collection.countDocuments();
      const indexes = await collection.indexes();
      
      // Calculate total index size for this collection
      let totalIndexSize = 0;

      collectionStats.push({
        name: coll.name,
        count,
        indexes,
        totalIndexSize
      });

      console.log(`\n${coll.name}:`);
      console.log(`  Documents: ${count.toLocaleString()}`);
      console.log(`  Indexes: ${indexes.length}`);
      
      if (indexes.length > 0) {
        console.log('  Index Details:');
        indexes.forEach((idx: any) => {
          const keys = Object.keys(idx.key).map(k => `${k}:${idx.key[k]}`).join(', ');
          console.log(`    - ${idx.name}: {${keys}}`);
        });
      }
    }

    // 3. Identify potential issues
    console.log('\n\n=== Potential Issues ===\n');
    
    // Collections without indexes (excluding system collections)
    const collectionsWithoutIndexes = collectionStats.filter(
      c => c.indexes.length <= 1 && !c.name.startsWith('system.')
    );
    
    if (collectionsWithoutIndexes.length > 0) {
      console.log('⚠️  Collections with no custom indexes:');
      collectionsWithoutIndexes.forEach(c => {
        console.log(`   - ${c.name} (${c.count} documents)`);
      });
      console.log('');
    }

    // Large collections that might need optimization
    const largeCollections = collectionStats.filter(c => c.count > 10000);
    if (largeCollections.length > 0) {
      console.log('📊 Large collections (>10k documents):');
      largeCollections.forEach(c => {
        console.log(`   - ${c.name}: ${c.count.toLocaleString()} documents`);
      });
      console.log('');
    }

    // 4. Connection pool status (if available)
    console.log('=== Connection Pool Status ===\n');
    // @ts-ignore - topology might not be in types
    const topology = client.topology;
    if (topology && topology.s && topology.s.servers) {
      const servers = topology.s.servers;
      servers.forEach((server: any, address: string) => {
        const pool = server.s.pool;
        if (pool) {
          console.log(`Server: ${address}`);
          console.log(`  - Total Connections: ${pool.totalConnectionCount || 'N/A'}`);
          console.log(`  - Available Connections: ${pool.availableConnectionCount || 'N/A'}`);
          console.log(`  - Pending Connections: ${pool.pendingConnectionCount || 'N/A'}`);
        }
      });
    } else {
      console.log('Connection pool information not available');
    }

    // 5. Generate recommendations
    console.log('\n\n=== Recommendations ===\n');
    
    console.log('Based on the analysis, here are the recommended actions:');
    console.log('');
    
    console.log('1. IMMEDIATE ACTIONS:');
    console.log('   - Run the addCriticalIndexes.ts script to add missing indexes');
    console.log('   - Switch from scheduler.js to scheduler-optimized.js');
    console.log('   - Update vercel.json to change quest-lifecycle cron from */5 to */15');
    console.log('');
    
    console.log('2. CONNECTION OPTIMIZATION:');
    console.log('   - Replace mongodb.ts with mongodb-optimized.ts');
    console.log('   - Set MONGODB_DEBUG=true in production to monitor connections');
    console.log('');
    
    console.log('3. QUERY OPTIMIZATION:');
    if (largeCollections.length > 0) {
      console.log('   - Add pagination to queries on these collections:');
      largeCollections.forEach(c => {
        console.log(`     * ${c.name}`);
      });
    }
    console.log('   - Implement query result caching for leaderboards');
    console.log('   - Add .limit() to aggregation pipelines');
    console.log('');

    // Save report
    const report = {
      timestamp: new Date().toISOString(),
      dbStats,
      collections: collectionStats,
      recommendations: {
        immediate: [
          'Add missing indexes',
          'Reduce cron frequency', 
          'Optimize connection pools'
        ],
        medium_term: [
          'Implement caching',
          'Add query timeouts',
          'Monitor slow queries'
        ]
      }
    };

    const reportPath = join(process.cwd(), 'mongodb-usage-report.json');
    writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n📄 Full report saved to: ${reportPath}`);

  } catch (error) {
    console.error('Error during analysis:', error);
  } finally {
    await client.close();
  }
}

// Run the analysis
analyzeMongoUsage().catch(console.error); 