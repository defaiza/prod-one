import { NextResponse } from 'next/server';
import { connectToDatabase, UserDocument, SquadDocument } from '@/lib/mongodb';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { Db } from 'mongodb';
import { createNotification } from '@/lib/notificationUtils';

export async function POST(request: Request) {
  const session = await getServerSession(authOptions) as any;
  if (!session || !session.user || typeof session.user.walletAddress !== 'string') {
    return NextResponse.json({ error: 'User not authenticated or wallet not available in session' }, { status: 401 });
  }
  const userWalletAddress = session.user.walletAddress;
  const userXUsername = session.user.xUsername || userWalletAddress;

  try {
    const { db } = await connectToDatabase();
    const squadsCollection = db.collection<SquadDocument>('squads');
    const usersCollection = db.collection<UserDocument>('users');

    const user = await usersCollection.findOne({ walletAddress: userWalletAddress });
    if (!user || !user.squadId) { 
        if(!user) return NextResponse.json({ error: 'Authenticated user not found in database.' }, { status: 404 });
        return NextResponse.json({ error: 'You are not currently in a squad.' }, { status: 400 });
    }

    const pointsToDeduct = user.points || 0;
    const squadIdUserWasIn = user.squadId;
    const currentSquad = await squadsCollection.findOne({ squadId: squadIdUserWasIn });
    if (!currentSquad) {
      await usersCollection.updateOne({ walletAddress: userWalletAddress }, { $unset: { squadId: "" }, $set: { updatedAt: new Date() } });
      return NextResponse.json({ error: 'Squad data inconsistent, your squad link has been cleared.' }, { status: 404 });
    }

    await squadsCollection.updateOne(
      { squadId: squadIdUserWasIn }, 
      { 
        $pull: { memberWalletAddresses: userWalletAddress }, 
        $set: { updatedAt: new Date() } 
      }
    );
    await usersCollection.updateOne({ walletAddress: userWalletAddress }, { $unset: { squadId: "" }, $set: { updatedAt: new Date() } });
    
    const remainingMembers = currentSquad.memberWalletAddresses.filter(wa => wa !== userWalletAddress);

    if (currentSquad.leaderWalletAddress === userWalletAddress) {
      if (remainingMembers.length === 0) {
        await squadsCollection.deleteOne({ squadId: squadIdUserWasIn });
        // No direct recipients for disband if last member leaves, but could log system event or notify admins.
        return NextResponse.json({ message: 'Successfully left and disbanded squad as the sole member.' });
      } else {
        const newLeaderWalletAddress = remainingMembers[0];
        await squadsCollection.updateOne({ squadId: squadIdUserWasIn }, { $set: { leaderWalletAddress: newLeaderWalletAddress, updatedAt: new Date() } });
        
        const newLeaderUserDoc = await usersCollection.findOne({walletAddress: newLeaderWalletAddress});
        const newLeaderXUsername = newLeaderUserDoc?.xUsername || newLeaderWalletAddress;

        const notificationTitle = `New Leader for ${currentSquad.name}`;
        const notificationMessage = `@${userXUsername} left your squad, "${currentSquad.name}". @${newLeaderXUsername} is now the new leader.`;
        const squadPageCtaUrl = currentSquad.squadId ? `/squads/${currentSquad.squadId}` : '/squads';

        for (const memberAddr of remainingMembers) {
          await createNotification(
            db, 
            memberAddr,                       // recipientWalletAddress
            'squad_leader_changed',           // type
            notificationTitle,                // title
            notificationMessage,              // message
            squadPageCtaUrl,                  // ctaUrl
            undefined,                        // relatedQuestId
            undefined,                        // relatedQuestTitle
            squadIdUserWasIn,                 // relatedSquadId
            currentSquad.name,                // relatedSquadName
            newLeaderWalletAddress,           // relatedUserId (the NEW leader)
            newLeaderXUsername                // relatedUserName (NEW leader's name)
            // userWalletAddress (old leader) & userXUsername (old leader name) are part of the message
            );
        }
      }
    } else { 
      if (remainingMembers.length > 0) {
        const notificationTitle = `@${userXUsername} Left Squad`;
        const notificationMessage = `@${userXUsername} has left your squad, "${currentSquad.name}".`;
        const squadPageCtaUrl = currentSquad.squadId ? `/squads/${currentSquad.squadId}` : '/squads';

        for (const memberAddr of remainingMembers) { // This includes the leader
          await createNotification(
            db, 
            memberAddr,                   // recipientWalletAddress
            'squad_member_left',        // type
            notificationTitle,            // title
            notificationMessage,          // message
            squadPageCtaUrl,              // ctaUrl
            undefined,                    // relatedQuestId
            undefined,                    // relatedQuestTitle
            squadIdUserWasIn,             // relatedSquadId
            currentSquad.name,            // relatedSquadName
            userWalletAddress,            // relatedUserId (the user who left)
            userXUsername                 // relatedUserName (name of the user who left)
            // No relatedInvitationId needed
            );
        }
      }
    }

    return NextResponse.json({ message: 'Successfully left squad.' });

  } catch (error) {
    console.error("Error leaving squad:", error);
    return NextResponse.json({ error: 'Failed to leave squad' }, { status: 500 });
  }
} 