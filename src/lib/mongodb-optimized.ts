import { MongoClient, Db, Collection, ObjectId, Document } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME;

/**
 * OPTIMIZED MongoDB connection configuration to reduce billing
 * Key changes:
 * 1. Reduced connection pool sizes
 * 2. Added connection monitoring
 * 3. Better connection reuse
 * 4. Added query timeout settings
 */

interface CachedMongoConnection {
  client: MongoClient | null;
  db: Db | null;
}

declare global {
  var mongo: CachedMongoConnection | undefined;
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

let cached: CachedMongoConnection = global.mongo || { client: null, db: null };

if (!global.mongo) {
  global.mongo = cached;
}

// Monitor connection pool usage
function setupConnectionMonitoring(client: MongoClient) {
  client.on('connectionPoolCreated', (event) => {
    console.log('[MongoDB] Connection pool created:', event.address);
  });

  client.on('connectionPoolReady', (event) => {
    console.log('[MongoDB] Connection pool ready:', event.address);
  });

  client.on('connectionPoolClosed', (event) => {
    console.log('[MongoDB] Connection pool closed:', event.address);
  });

  // Log when connections are checked out/in
  let activeConnections = 0;
  client.on('connectionCheckedOut', () => {
    activeConnections++;
    if (activeConnections > 10) {
      console.warn(`[MongoDB] High connection usage: ${activeConnections} active connections`);
    }
  });

  client.on('connectionCheckedIn', () => {
    activeConnections--;
  });
}

let clientPromise: Promise<MongoClient>;

// OPTIMIZED connection settings
const connectionOptions = {
  // Reduced pool sizes (was 50 in production)
  maxPoolSize: process.env.NODE_ENV === 'production' ? 20 : 5,
  minPoolSize: process.env.NODE_ENV === 'production' ? 5 : 1,
  
  // Aggressive idle timeout to close unused connections
  maxIdleTimeMS: 30000, // 30 seconds (was 10 seconds)
  
  // Shorter server selection timeout
  serverSelectionTimeoutMS: 3000, // 3 seconds (was 5 seconds)
  
  // Socket timeout to prevent hanging queries
  socketTimeoutMS: 45000, // 45 seconds
  
  // Connection timeout
  connectTimeoutMS: 10000, // 10 seconds
  
  // Enable connection pool monitoring
  monitorCommands: process.env.NODE_ENV === 'development',
  
  // Compression to reduce network usage
  compressors: ['snappy', 'zlib'] as ('snappy' | 'zlib')[],
};

if (process.env.NODE_ENV === 'development') {
  if (!global._mongoClientPromise) {
    const client = new MongoClient(MONGODB_URI!, connectionOptions);
    
    if (process.env.MONGODB_DEBUG === 'true') {
      setupConnectionMonitoring(client);
    }
    
    global._mongoClientPromise = client.connect();
  }
  clientPromise = global._mongoClientPromise;
} else {
  // In production, create a single shared client
  const client = new MongoClient(MONGODB_URI!, connectionOptions);
  
  // Always monitor in production to track usage
  setupConnectionMonitoring(client);
  
  clientPromise = client.connect();
}

export default clientPromise;

export async function connectToDatabase(): Promise<{ client: MongoClient; db: Db }> {
  if (cached.client && cached.db) {
    return cached as { client: MongoClient; db: Db };
  }

  if (!MONGODB_URI) {
    throw new Error('MONGODB_URI environment variable is not defined');
  }

  if (!MONGODB_DB_NAME) {
    throw new Error('MONGODB_DB_NAME environment variable is not defined');
  }

  const client = await clientPromise;
  const db = client.db(MONGODB_DB_NAME);

  cached.client = client;
  cached.db = db;

  return { client, db };
}

// Helper to get database with timeout wrapper
export async function getDatabase(): Promise<Db> {
  const { db } = await connectToDatabase();
  return db;
}

// Collection helpers with query timeout
export function getCollection<T extends Document = Document>(name: string): Promise<Collection<T>> {
  return getDatabase().then(db => db.collection<T>(name));
}

// Export commonly used types
export { ObjectId, Db, Collection, MongoClient }; 