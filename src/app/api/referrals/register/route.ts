import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase, UserDocument, ActionDocument, ReferralBoost, SquadDocument } from '@/lib/mongodb';
import { rabbitmqService } from '@/services/rabbitmq.service';
import { rabbitmqConfig } from '@/config/rabbitmq.config';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { strictRateLimit } from '@/middleware/rateLimiter';

interface RequestBody {
  newWalletAddress: string;
  referralCode: string;
}

const POINTS_REFERRAL_BONUS_FOR_REFERRER = 20;

export async function POST(request: NextRequest) {
  // Apply strict rate limiting
  const rateLimitResponse = await strictRateLimit(request);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  // Require authentication
  const session = await getServerSession(authOptions) as any;
  if (!session?.user?.walletAddress) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  try {
    const body: RequestBody = await request.json();
    const { newWalletAddress, referralCode } = body;

    if (!newWalletAddress || !referralCode) {
      return NextResponse.json({ error: 'New wallet address and referral code are required' }, { status: 400 });
    }

    // Ensure the authenticated user is registering their own wallet
    if (session.user.walletAddress !== newWalletAddress) {
      console.warn(`[Referral Register] User ${session.user.walletAddress} attempting to register different wallet ${newWalletAddress}`);
      return NextResponse.json({ error: 'You can only register your own wallet address' }, { status: 403 });
    }

    const { db } = await connectToDatabase();
    const usersCollection = db.collection<UserDocument>('users');
    const actionsCollection = db.collection<ActionDocument>('actions');
    const squadsCollection = db.collection<SquadDocument>('squads');

    // Find the referrer by their referral code
    const referrer = await usersCollection.findOne({ referralCode });

    if (!referrer) {
      return NextResponse.json({ error: 'Invalid referral code' }, { status: 404 });
    }

    if (referrer.walletAddress === newWalletAddress) {
      return NextResponse.json({ error: 'Cannot refer yourself' }, { status: 400 });
    }

    // Check if the new user already exists and if they have already been referred
    let newUser = await usersCollection.findOne({ walletAddress: newWalletAddress });

    // This route assumes the new user might already exist from a previous interaction (e.g., check-airdrop, get-code)
    // We only award referral bonus if the new user hasn't been marked as referredBy yet.
    if (newUser && newUser.referredBy) {
      return NextResponse.json({ message: 'User has already been referred or processed a referral' }, { status: 409 });
    }

    // If referrer has not yet connected a wallet, we still proceed – we will credit by userId instead.
    if (!referrer.walletAddress) {
      console.warn(`[Referral Register] Referrer ${referrer._id.toString()} has no walletAddress – awarding by userId.`);
    }
    
    // Award points to referrer
    let pointsToAwardReferrer = POINTS_REFERRAL_BONUS_FOR_REFERRER;
    let bonusFromBoost = 0;
    let appliedBoostDescription: string | undefined = undefined;

    let updatedReferrerBoosts = referrer.activeReferralBoosts || [];

    if (updatedReferrerBoosts && updatedReferrerBoosts.length > 0) {
      const activeBoostIndex = updatedReferrerBoosts.findIndex(
        (boost: ReferralBoost) => boost.type === 'percentage_bonus_referrer' && (boost.remainingUses ?? 0) > 0
      );

      if (activeBoostIndex !== -1) {
        const boost = updatedReferrerBoosts[activeBoostIndex];
        bonusFromBoost = Math.floor(POINTS_REFERRAL_BONUS_FOR_REFERRER * (boost.value ?? 0));
        pointsToAwardReferrer += bonusFromBoost;
        appliedBoostDescription = boost.description;

        updatedReferrerBoosts[activeBoostIndex].remainingUses = (updatedReferrerBoosts[activeBoostIndex].remainingUses ?? 1) - 1;
        if (updatedReferrerBoosts[activeBoostIndex].remainingUses <= 0) {
          // Remove boost if uses are exhausted
          updatedReferrerBoosts.splice(activeBoostIndex, 1);
        }
      }
    }

    // Use PointsService to award points
    const pointsService = await (await import('@/services/points.service')).getPointsService();
    if (referrer.walletAddress) {
      await pointsService.addPoints(referrer.walletAddress, pointsToAwardReferrer, {
        reason: 'referral:register',
        actionType: 'referral_bonus',
      });
    } else {
      await pointsService.addPointsByUserId(referrer._id.toString(), pointsToAwardReferrer, {
        reason: 'referral:register_no_wallet',
        actionType: 'referral_bonus',
      });
    }

    // Always update referralsMadeCount + activeReferralBoosts directly
    await usersCollection.updateOne(
      { _id: referrer._id },
      {
        $inc: { referralsMadeCount: 1 },
        $set: {
          updatedAt: new Date(),
          activeReferralBoosts: updatedReferrerBoosts,
        },
      },
    );

    // Update referrer's squad points if they are in a squad
    if (referrer.squadId) {
      const squadUpdate = await squadsCollection.updateOne(
        { squadId: referrer.squadId },
        { 
          $inc: { totalSquadPoints: pointsToAwardReferrer }, 
          $set: { updatedAt: new Date() } 
        }
      );
      console.log(`[Referral Register] Referrer ${referrer.walletAddress || referrer._id.toString()} squad ${referrer.squadId} points updated by ${pointsToAwardReferrer}. Matched: ${squadUpdate.matchedCount}, Modified: ${squadUpdate.modifiedCount}`);
      if (squadUpdate.modifiedCount > 0 && pointsToAwardReferrer > 0) {
        try {
          await rabbitmqService.publishToExchange(
            rabbitmqConfig.eventsExchange,
            rabbitmqConfig.routingKeys.squadPointsUpdated,
            {
              squadId: referrer.squadId,
              pointsChange: pointsToAwardReferrer,
              reason: 'referrer_bonus_registration',
              timestamp: new Date().toISOString(),
              responsibleUserId: referrer.walletAddress || referrer._id.toString() // The referrer whose action led to points
            }
          );
          console.log(`[Referral Register] Published squad.points.updated for referrer's squad ${referrer.squadId}`);
        } catch (publishError) {
          console.error(`[Referral Register] Failed to publish squad.points.updated for referrer's squad ${referrer.squadId}:`, publishError);
        }
      }
    }

    // Log the standard referral action
    const referrerIdentifier = referrer.walletAddress || referrer._id.toString();

    await actionsCollection.insertOne({
      walletAddress: referrerIdentifier,
      actionType: 'referral_bonus',
      pointsAwarded: POINTS_REFERRAL_BONUS_FOR_REFERRER, // Log standard points
      timestamp: new Date(),
      notes: `Referred ${newWalletAddress}`
    });

    // If bonus points were awarded from a boost, log that separately
    if (bonusFromBoost > 0) {
      await actionsCollection.insertOne({
        walletAddress: referrerIdentifier,
        actionType: 'referral_powerup_bonus',
        pointsAwarded: bonusFromBoost,
        timestamp: new Date(),
        notes: `Bonus from power-up: ${appliedBoostDescription || 'Referral Boost'} for referring ${newWalletAddress}`
      });
    }

    // Create or update the new user, linking them to the referrer
    let referredUserWalletAddress = newWalletAddress; // To ensure we have the correct wallet address for the event

    if (!newUser) {
      // New user being registered via referral link *after* referrer already exists.
      // They should have gotten initial points via check-airdrop or get-code if that was their first touchpoint.
      // If this is their absolute first touchpoint, they won't get initial_connection points here unless we add that logic.
      // For simplicity, this route focuses on the referral aspect.
      await usersCollection.insertOne({
        walletAddress: newWalletAddress,
        xUserId: newWalletAddress, // Assuming newWalletAddress can serve as xUserId
        points: 0, // Or POINTS_FOR_BEING_REFERRED if you implement that
        referredBy: referrer.walletAddress, // Link to the referrer's wallet address
        createdAt: new Date(),
        updatedAt: new Date(),
        completedActions: [] // Initialize if they are brand new through this path
      });
    } else { // User exists but was not referred by anyone yet
      await usersCollection.updateOne(
        { walletAddress: newWalletAddress },
        { 
          $set: { referredBy: referrer.walletAddress, updatedAt: new Date() }, // Link to the referrer's wallet address
          // $inc: { points: POINTS_FOR_BEING_REFERRED } // Optionally award points for being referred
        }
      );
      // Ensure newUser object has the walletAddress if it was fetched
      referredUserWalletAddress = newUser.walletAddress || newWalletAddress;
    }

    // Publish user.referred.success event
    try {
      const eventPayload = {
        userId: referredUserWalletAddress, // The user who was referred
        referredByUserId: referrerIdentifier, // The user who made the referral
        timestamp: new Date().toISOString(),
        // questRelevantValue: 1 // Each successful referral counts as 1
      };
      await rabbitmqService.publishToExchange(
        rabbitmqConfig.eventsExchange,
        rabbitmqConfig.routingKeys.userReferredSuccess,
        eventPayload
      );
      console.log('[Referral Register] Successfully published user.referred.success event:', eventPayload);
    } catch (publishError) {
      console.error('[Referral Register] Failed to publish user.referred.success event:', publishError);
      // Decide if this failure should affect the API response.
      // For now, we log and continue, as the core referral logic succeeded.
    }

    return NextResponse.json({ 
      message: `Referral successful! Referrer (${referrerIdentifier}) earned ${pointsToAwardReferrer} points (includes ${bonusFromBoost} bonus).` 
    });

  } catch (error) {
    console.error("Error processing referral:", error);
    return NextResponse.json({ error: 'Failed to process referral' }, { status: 500 });
  }
} 