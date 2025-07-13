import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { connectToDatabase, UserDocument } from '@/lib/mongodb';
import { decrypt } from '@/lib/encryption';
import { ObjectId } from 'mongodb';

const X_CLIENT_ID = process.env.X_CLIENT_ID;

// Ensure we always return valid JSON responses
function jsonResponse(data: any, status: number = 200) {
  return NextResponse.json(data, { 
    status,
    headers: {
      'Content-Type': 'application/json',
    }
  });
}

export async function POST(req: NextRequest) {
  console.log('[X Disconnect] POST endpoint called');
  
  try {
    // Get session
    let session;
    try {
      session = await getServerSession(authOptions);
    } catch (sessionError) {
      console.error('[X Disconnect] Session error:', sessionError);
      return jsonResponse({ error: 'Session error occurred' }, 500);
    }
    
    if (!session || !session.user || !session.user.dbId) {
      console.log('[X Disconnect] No valid session found');
      return jsonResponse({ error: 'User not authenticated' }, 401);
    }

    console.log(`[X Disconnect] Processing for user: ${session.user.dbId}`);

    // Connect to database
    let db, usersCollection;
    try {
      const connection = await connectToDatabase();
      db = connection.db;
      usersCollection = db.collection<UserDocument>('users');
    } catch (dbError) {
      console.error('[X Disconnect] Database connection error:', dbError);
      return jsonResponse({ error: 'Database connection failed' }, 500);
    }

    const userId = new ObjectId(session.user.dbId);

    // Get user document
    let user;
    try {
      user = await usersCollection.findOne({ _id: userId });
    } catch (findError) {
      console.error('[X Disconnect] Error finding user:', findError);
      return jsonResponse({ error: 'Failed to find user' }, 500);
    }

    if (!user) {
      console.log(`[X Disconnect] User not found: ${userId}`);
      return jsonResponse({ error: 'User not found.' }, 404);
    }

    // Check if X account is linked
    const hasXData = user.linkedXId || user.linkedXUsername || user.linkedXAccessToken;
    
    if (!hasXData) {
      console.log(`[X Disconnect] No X account data found for user ${userId}`);
      return jsonResponse({ 
        success: true, 
        message: 'X account is already disconnected.',
        alreadyDisconnected: true 
      });
    }

    let accessTokenToRevoke = null;
    
    // Try to decrypt access token if it exists
    if (user.linkedXAccessToken) {
      try {
        accessTokenToRevoke = decrypt(user.linkedXAccessToken);
      } catch (error) {
        console.warn(`[X Disconnect] Failed to decrypt access token for user ${userId}:`, error);
      }
    }

    // Attempt to revoke the token with X
    if (X_CLIENT_ID && accessTokenToRevoke) {
      try {
        const revokeResponse = await fetch('https://api.twitter.com/2/oauth2/revoke', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            token: accessTokenToRevoke,
            client_id: X_CLIENT_ID, 
            token_type_hint: 'access_token'
          }),
        });
        
        if (revokeResponse.ok) {
          const revokeData = await revokeResponse.json();
          console.log(`[X Disconnect] Token revocation response:`, revokeData);
        } else {
          const errorText = await revokeResponse.text();
          console.warn(`[X Disconnect] Token revocation failed (${revokeResponse.status}): ${errorText}`);
        }
      } catch (revokeError: any) {
        console.error(`[X Disconnect] Exception during token revocation:`, revokeError);
      }
    }

    // Remove X-related fields from the database
    try {
      const updateResult = await usersCollection.updateOne(
        { _id: userId },
        {
          $unset: {
            linkedXId: "",
            linkedXUsername: "",
            linkedXProfileImageUrl: "",
            linkedXAccessToken: "",
            linkedXRefreshToken: "",
            linkedXScopes: "",
            linkedXConnectedAt: "",
            followsDefAIRewards: "",
          },
          $set: {
            updatedAt: new Date(),
          }
        }
      );

      console.log(`[X Disconnect] Database update result:`, updateResult);
      
      return jsonResponse({ 
        success: true, 
        message: 'X account disconnected successfully.',
        tokenRevoked: !!accessTokenToRevoke,
        dataCleared: updateResult.modifiedCount > 0
      });
      
    } catch (updateError) {
      console.error('[X Disconnect] Database update error:', updateError);
      return jsonResponse({ error: 'Failed to update user data' }, 500);
    }

  } catch (error: any) {
    console.error('[X Disconnect] Unexpected error:', error);
    return jsonResponse({ 
      error: 'An unexpected error occurred', 
      details: error.message 
    }, 500);
  }
}

// Handle preflight requests
export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { 
    status: 200,
    headers: {
      'Allow': 'POST, OPTIONS',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
    }
  });
}

// Explicitly handle other methods
export async function GET(req: NextRequest) {
  return jsonResponse({ error: 'Method not allowed. Use POST.' }, 405);
}

export async function PUT(req: NextRequest) {
  return jsonResponse({ error: 'Method not allowed. Use POST.' }, 405);
}

export async function DELETE(req: NextRequest) {
  return jsonResponse({ error: 'Method not allowed. Use POST.' }, 405);
}