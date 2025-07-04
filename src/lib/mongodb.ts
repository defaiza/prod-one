import { MongoClient, Db, Collection, ObjectId } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME;

/**
 * Global is used here to maintain a cached connection across hot reloads
 * in development. This prevents connections growing exponentially
 * during API Route usage.
 */
interface CachedMongoConnection {
  client: MongoClient | null;
  db: Db | null;
}

// Extend the NodeJS Global type with our cached connection interface
declare global {
  var mongo: CachedMongoConnection | undefined;
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

let cached: CachedMongoConnection = global.mongo || { client: null, db: null };

if (!global.mongo) {
  global.mongo = cached;
}

let clientPromise: Promise<MongoClient>;

if (process.env.NODE_ENV === 'development') {
  // In development mode, use a global variable so that the value
  // is preserved across module reloads caused by HMR (Hot Module Replacement).
  if (!global._mongoClientPromise) {
    const client = new MongoClient(MONGODB_URI!, {
      maxPoolSize: 10,
      minPoolSize: 2,
      maxIdleTimeMS: 10000,
      serverSelectionTimeoutMS: 5000,
    });
    global._mongoClientPromise = client.connect();
  }
  clientPromise = global._mongoClientPromise;
} else {
  // In production mode, it's best to not use a global variable.
  const client = new MongoClient(MONGODB_URI!, {
    maxPoolSize: 50,
    minPoolSize: 10,
    maxIdleTimeMS: 10000,
    serverSelectionTimeoutMS: 5000,
  });
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

  const client = new MongoClient(MONGODB_URI, {
    maxPoolSize: 50,
    minPoolSize: 10,
    maxIdleTimeMS: 10000,
    serverSelectionTimeoutMS: 5000,
  });
  await client.connect();
  const db = client.db(MONGODB_DB_NAME);

  cached.client = client;
  cached.db = db;

  return cached as { client: MongoClient; db: Db };
}

export interface UserDocument {
  _id?: ObjectId; // Prefer ObjectId, but main had 'any'
  auth0Id?: string; 
  walletAddress?: string;
  walletChain?: string; // Added for wallet-login consistency
  walletLinkedAt?: Date; // Added for wallet-login consistency
  xUserId?: string; 
  xUsername?: string;
  xProfileImageUrl?: string;
  email?: string;
  points?: number;
  referralCode?: string; // This user's own referral code
  referredBy?: string; // Wallet address or ID of the user who referred THIS user
  referredByCode?: string; // The actual referral code that this user used to sign up
  referralsMadeCount?: number;
  activeReferralBoosts?: ReferralBoost[];
  completedActions?: string[];
  highestAirdropTierLabel?: string;
  squadId?: string; 
  earnedBadgeIds?: string[];
  role?: 'user' | 'admin';
  createdAt?: Date;
  updatedAt?: Date;
  current_tier_name?: string;
  tier_updated_at?: Date;
  initialAirdropAmount?: number;
  totalEstimatedAirdrop?: number;
  airBasedDefai?: number;

  // Agent-related fields
  agentId?: string;
  agentStatus?: 'PENDING' | 'DEPLOYING' | 'RUNNING' | 'FAILED' | 'ARCHIVED';
  agentDeployedAt?: Date;
  agentUrl?: string;
  agentType?: string; // Added as it was used in deploy route

  // Crossmint-specific fields for Hybrid Auth & Yield/Agent section
  crossmintUserId?: string;       // Crossmint user ID (from JWT `sub` claim)
  crossmintWalletAddress?: string; // Primary wallet address from Crossmint
  crossmintWalletChain?: string;   // Chain of the Crossmint wallet

  // Agent risk tolerance (already used by /api/agents/risk)
  agentRiskTolerance?: number; // 1-5

  // Fields for X Account Linking (OAuth 2.0 based, not for app authentication)
  linkedXId?: string;                 // X User ID (numerical string)
  linkedXUsername?: string;           // X @handle
  linkedXProfileImageUrl?: string;    // URL of X profile image
  linkedXAccessToken?: string;        // Encrypted X Access Token
  linkedXRefreshToken?: string;       // Encrypted X Refresh Token
  linkedXScopes?: string[];           // Scopes granted by the user
  linkedXConnectedAt?: Date;          // Timestamp of when X account was linked
  followsDefAIRewards?: boolean;      // Tracks if the user follows the target X account
}

export interface ReferralBoost {
  boostId: string;
  type?: 'percentage_bonus_referrer';
  boostType?: string; // alias used by some routes
  value?: number;
  remainingUses?: number;
  description?: string;
  activatedAt?: Date;
  expiresAt?: Date;
}

export interface ActionDocument {
  _id?: ObjectId;
  walletAddress: string; // Can be the user's primary wallet or X ID if no wallet yet
  actionType: string; // e.g., 'initial_connection', 'shared_on_x', 'referral_bonus'
  pointsAwarded: number;
  timestamp: Date;
  notes?: string; // Optional notes, like which referral code was used, or admin adjustment reason
  metadata?: Record<string, any>; // For any other relevant data, e.g. { sharedUrl: '...', platform: 'X' }
  // Deprecated fields, kept for potential backward compatibility if old records exist
}

export interface SquadDocument {
  _id?: ObjectId; 
  squadId: string;
  name: string;
  description?: string; 
  leaderWalletAddress: string;
  memberWalletAddresses: string[];
  totalSquadPoints: number; // Kept from squad-goals for quest engine
  tier?: number; 
  maxMembers?: number;
  avatarImageUrl?: string; // From squad-goals (could be profile)
  bannerImageUrl?: string; // From squad-goals
  profileImageUrl?: string; // From HEAD (distinct from avatar?)
  tags?: string[]; // From HEAD
  createdAt: Date;
  updatedAt: Date;
  lastActivityAt?: Date; // From HEAD
  settings?: { // From squad-goals, incorporating HEAD's fields
    isPublic?: boolean; // isPrivate from HEAD would be !isPublic
    requiresApproval?: boolean;
  };
}

export interface SquadInvitationDocument {
  _id?: ObjectId;
  invitationId: string;
  squadId: string;
  squadName: string;
  invitedByUserWalletAddress?: string;
  invitedUserWalletAddress?: string;
  inviterWalletAddress?: string;   // alias used by new invitation routes
  inviteeWalletAddress?: string;   // alias used by new invitation routes
  status: 'pending' | 'accepted' | 'declined' | 'revoked' | 'expired';
  message?: string;
  createdAt: Date;
  updatedAt: Date;
  expiresAt?: Date;
}

export type NotificationType = 
  | 'generic'
  | 'welcome'
  | 'airdrop_claim_available'
  | 'referral_success' 
  | 'referred_by_success' 
  | 'quest_completed_community'
  | 'quest_failed_community'
  | 'quest_newly_active'
  | 'quest_reward_received'   
  | 'squad_invite_received'
  | 'squad_invite_accepted'
  | 'squad_invite_declined'
  | 'squad_invite_revoked'
  | 'squad_member_joined'    
  | 'squad_member_left'      
  | 'squad_kicked'           
  | 'squad_leader_changed'   
  | 'squad_disbanded'        
  | 'squad_join_request_received' 
  | 'squad_join_request_approved' 
  | 'squad_join_request_rejected' 
  | 'squad_join_request_cancelled'
  | 'squad_reward_received'  
  | 'proposal_created'
  | 'proposal_passed'
  | 'proposal_failed'
  | 'proposal_executed'
  | 'proposal_broadcasted'
  | 'new_squad_quest'
  | 'milestone_unlocked'     
  | 'badge_earned'           
  | 'rank_up'                
  | 'system_message';

export interface NotificationDocument {
  _id?: ObjectId;
  recipientWalletAddress: string;
  type: NotificationType;
  title: string;
  message: string;
  ctaUrl?: string;
  isRead: boolean;
  isArchived?: boolean; 
  createdAt: Date;      
  updatedAt: Date;      
  notificationId: string;
  relatedQuestId?: string;
  relatedQuestTitle?: string;
  relatedSquadId?: string;
  relatedSquadName?: string;
  relatedUserId?: string;
  relatedUserName?: string;
  relatedInvitationId?: string;
  rewardAmount?: number;
  rewardCurrency?: string;
  badgeId?: string;
}

export interface ISquadJoinRequest {
  _id?: ObjectId;
  requestId: string; // UUID
  squadId: string; // Aligns with SquadDocument.squadId
  squadName: string; // Denormalized for easier display
  requestingUserWalletAddress: string;
  requestingUserXUsername?: string; // Denormalized
  requestingUserXProfileImageUrl?: string; // Denormalized
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  message?: string; // Optional message from the requester
  createdAt: Date;
  updatedAt: Date;
}

// Interface for the new Meetup Check-in feature
export interface MeetupCheckInDocument {
  _id?: ObjectId;
  questId: ObjectId; // Reference to the CommunityQuest _id
  squadId: string;   // squadId from SquadDocument
  userId: string;    // User's dbId (ObjectId as string) or walletAddress if dbId not readily available client-side
  walletAddress: string; // User's wallet address who performed the check-in
  latitude: number;
  longitude: number;
  accuracy: number;  // Accuracy of the geolocation in meters
  clientTimestamp: Date; // Timestamp from the user's device
  serverTimestamp: Date; // Timestamp when the server processed this check-in
  signedMessage: string; // The full message string that was signed
  signature: string;     // The signature from the user's wallet
  status: 'pending_match' | 'matched' | 'processed_success' | 'expired_no_match' | 'error';
  matchGroupId?: string; // Optional: A common ID for a group of matched check-ins
  processingError?: string; // Optional: If status is 'error'
}
