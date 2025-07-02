import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase, UserDocument, ActionDocument } from '@/lib/mongodb';
import { randomBytes } from 'crypto';
import { Db } from 'mongodb';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { publicRateLimit } from '@/middleware/rateLimiter';

const POINTS_INITIAL_CONNECTION = 100; // For new users created here

// Placeholder for your database connection and logic
// import { connectToDatabase, User } from '@/lib/mongodb'; // Example

// In production, ensure this is robustly unique by checking against the database.
async function generateUniqueReferralCode(db: Db, length = 8): Promise<string> {
  const usersCollection = db.collection<UserDocument>('users');
  let referralCode = '';
  let isUnique = false;
  let attempts = 0;
  const maxAttempts = 10; // Prevent infinite loop in a highly unlikely scenario

  while (!isUnique && attempts < maxAttempts) {
    referralCode = randomBytes(Math.ceil(length / 2)).toString('hex').slice(0, length);
    const existingUser = await usersCollection.findOne({ referralCode });
    if (!existingUser) {
      isUnique = true;
    }
    attempts++;
  }

  if (!isUnique) {
    // Fallback or error if a unique code can't be generated after maxAttempts (very unlikely with sufficient length)
    // For now, append a short random string or timestamp
    console.warn(`Could not generate a unique referral code after ${maxAttempts} attempts. Appending random chars.`);
    return referralCode + randomBytes(2).toString('hex'); 
  }
  return referralCode;
}

export async function GET(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResponse = await publicRateLimit(request);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const { searchParams } = new URL(request.url);
  const walletAddress = searchParams.get('address');

  if (!walletAddress) {
    return NextResponse.json({ error: 'Wallet address is required' }, { status: 400 });
  }

  // Get session for authentication check
  const session = await getServerSession(authOptions) as any;

  try {
    const { db } = await connectToDatabase();
    const usersCollection = db.collection<UserDocument>('users');
    const actionsCollection = db.collection<ActionDocument>('actions');

    let user = await usersCollection.findOne({ walletAddress });

    if (user && user.referralCode) {
      // Anyone can check if a referral code exists for a wallet
      return NextResponse.json({ referralCode: user.referralCode });
    } else if (user && !user.referralCode) {
      // Only authenticated user can generate code for their own wallet
      if (!session?.user?.walletAddress || session.user.walletAddress !== walletAddress) {
        return NextResponse.json({ error: 'Authentication required to generate referral code' }, { status: 401 });
      }

      const newReferralCode = await generateUniqueReferralCode(db);
      await usersCollection.updateOne(
        { walletAddress },
        { $set: { referralCode: newReferralCode, updatedAt: new Date() } }
      );
      
      console.log(`[Referral Get-Code] Generated code for existing user ${walletAddress}`);
      return NextResponse.json({ referralCode: newReferralCode });
    } else {
      // Creating new user requires authentication
      if (!session?.user) {
        return NextResponse.json({ 
          error: 'Authentication required to create new user', 
          message: 'Please sign in first'
        }, { status: 401 });
      }

      // Only allow creating user for own wallet
      if (session.user.walletAddress !== walletAddress) {
        console.warn(`[Referral Get-Code] User ${session.user.walletAddress} attempting to create user for different wallet ${walletAddress}`);
        return NextResponse.json({ error: 'You can only create a referral code for your own wallet' }, { status: 403 });
      }

      const newReferralCode = await generateUniqueReferralCode(db);
      const initialPoints = POINTS_INITIAL_CONNECTION;
      
      const newUserDoc: UserDocument = {
        walletAddress,
        xUserId: session.user.xId || walletAddress,
        points: initialPoints,
        referralCode: newReferralCode,
        completedActions: ['initial_connection'],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      await usersCollection.insertOne(newUserDoc);

      await actionsCollection.insertOne({
        walletAddress,
        actionType: 'initial_connection',
        pointsAwarded: initialPoints,
        timestamp: new Date(),
      });

      console.log(`[Referral Get-Code] Created new user ${walletAddress} with initial points`);
      return NextResponse.json({ referralCode: newReferralCode });
    }
  } catch (error) {
    console.error("Error fetching/generating referral code:", error);
    return NextResponse.json({ error: 'Failed to get referral code' }, { status: 500 });
  }
} 