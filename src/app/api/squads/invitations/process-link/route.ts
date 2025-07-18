import { NextResponse } from 'next/server';
import {
  connectToDatabase,
  SquadDocument,
  SquadInvitationDocument,
  UserDocument,
} from '@/lib/mongodb';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { v4 as uuidv4 } from 'uuid';
import { createNotification } from '@/lib/notificationUtils';

interface ProcessInviteRequestBody {
  squadId: string;
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions) as any;
  if (
    !session ||
    !session.user ||
    typeof (session.user as any).walletAddress !== 'string'
  ) {
    return NextResponse.json(
      { error: 'User not authenticated or wallet not available in session' },
      { status: 401 }
    );
  }
  const currentUserWalletAddress = (session.user as any).walletAddress;

  try {
    const body: ProcessInviteRequestBody = await request.json();
    const { squadId } = body;

    if (!squadId) {
      return NextResponse.json(
        { error: 'Squad ID is required.' },
        { status: 400 }
      );
    }

    const { db } = await connectToDatabase();
    const squadsCollection = db.collection<SquadDocument>('squads');
    const invitationsCollection = db.collection<SquadInvitationDocument>('squadInvitations');
    const usersCollection = db.collection<UserDocument>('users');

    // 1. Ensure user record exists and is not already in a squad
    let currentUserDoc = await usersCollection.findOne({ walletAddress: currentUserWalletAddress });
    // Auto-create minimal user profile if not found
    if (!currentUserDoc) {
      const newUser: UserDocument = {
        walletAddress: currentUserWalletAddress,
        xUserId: (session.user as any).id || (session.user as any).sub || currentUserWalletAddress,
        xUsername: (session.user as any).xUsername || '',
        xProfileImageUrl: (session.user as any).xProfileImageUrl || '',
        points: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any;
      const insertRes = await usersCollection.insertOne(newUser);
      currentUserDoc = { ...newUser, _id: insertRes.insertedId } as any;
      console.log(`[Process Invite Link] Auto-created minimal user profile for ${currentUserWalletAddress}`);
    }
    if (currentUserDoc && currentUserDoc.squadId) {
      return NextResponse.json(
        { error: 'You are already in a squad.' },
        { status: 400 }
      );
    }

    // 2. Validate squad exists
    const targetSquad = await squadsCollection.findOne({ squadId });
    if (!targetSquad) {
      return NextResponse.json(
        { error: 'Squad not found.' },
        { status: 404 }
      );
    }

    // 3. Ensure squad has capacity
    const maxMembers = parseInt(
      process.env.NEXT_PUBLIC_MAX_SQUAD_MEMBERS || '10',
      10
    );
    if (targetSquad.memberWalletAddresses.length >= maxMembers) {
      return NextResponse.json(
        { error: 'This squad is full.' },
        { status: 400 }
      );
    }

    // 4. Check for existing pending invite
    const existingInvite = await invitationsCollection.findOne({
      squadId,
      invitedUserWalletAddress: currentUserWalletAddress,
      status: 'pending',
    });
    if (existingInvite) {
      return NextResponse.json(
        { message: 'An invitation is already pending.', invitation: existingInvite },
        { status: 200 }
      );
    }

    // 5. Create new invitation
    const invitationId = uuidv4();
    const newInvitation: SquadInvitationDocument = {
      invitationId,
      squadId,
      squadName: targetSquad.name,
      inviterWalletAddress: targetSquad.leaderWalletAddress,
      inviteeWalletAddress: currentUserWalletAddress,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await invitationsCollection.insertOne(newInvitation);

    // 6. Create notification for user
    const notificationTitle = `Invite: Join ${targetSquad.name}`;
    // In this flow, the "inviter" is effectively the squad leader, as the user is joining via a general squad link.
    const notificationMessage = `You received an invitation to join the squad "${targetSquad.name}". Review and accept if you wish.`;
    const ctaUrl = `/squads/invitations`; // Or a more specific link to this invitation
    // Attempt to get leader's username, otherwise it will be undefined and createNotification handles it
    const leaderUserDoc = await usersCollection.findOne({ walletAddress: targetSquad.leaderWalletAddress });
    const leaderUsername = leaderUserDoc?.xUsername; 

    await createNotification(
      db,
      currentUserWalletAddress,  // recipientWalletAddress
      'squad_invite_received',   // type
      notificationTitle,         // title
      notificationMessage,       // message
      ctaUrl,                    // ctaUrl
      undefined,                 // relatedQuestId
      undefined,                 // relatedQuestTitle
      squadId,                   // relatedSquadId (from request body, same as targetSquad.squadId)
      targetSquad.name,          // relatedSquadName
      targetSquad.leaderWalletAddress, // relatedUserId (the squad leader who effectively invited via link)
      leaderUsername,            // relatedUserName (leader's username, if found)
      invitationId               // relatedInvitationId (the ID of the invitation document created)
    );

    return NextResponse.json(
      { message: 'Squad invitation received!', invitation: newInvitation },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error processing squad invite from link:', error);
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to process squad invitation' },
      { status: 500 }
    );
  }
} 