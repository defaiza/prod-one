import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { connectToDatabase, UserDocument } from '@/lib/mongodb';
import { encrypt } from '@/lib/encryption';
import { cookies } from 'next/headers';
import { ObjectId } from 'mongodb';

const X_CLIENT_ID = process.env.X_CLIENT_ID;
const X_CLIENT_SECRET = process.env.X_CLIENT_SECRET;
const X_CALLBACK_URL = process.env.X_CALLBACK_URL;

// Helper function to determine if this is a JSON request
function isJsonRequest(req: NextRequest): boolean {
  const accept = req.headers.get('accept') || '';
  const contentType = req.headers.get('content-type') || '';
  return accept.includes('application/json') || contentType.includes('application/json') || 
         req.url.includes('/_next/data/') || req.url.includes('.json');
}

// Helper function to create response based on request type
function createResponse(req: NextRequest, redirectUrl: string, error?: string) {
  if (isJsonRequest(req)) {
    // Return JSON response for Next.js router
    if (error) {
      return NextResponse.json({ error }, { status: 500 });
    }
    return NextResponse.json({ redirect: redirectUrl });
  } else {
    // Return redirect for regular browser navigation
    return NextResponse.redirect(new URL(redirectUrl, req.nextUrl.origin));
  }
}

export async function GET(req: NextRequest) {
  console.log('[X Connect Callback] Callback endpoint called');
  
  // Log environment variable status (without exposing secrets)
  console.log('[X Connect Callback] Environment check:', {
    hasClientId: !!X_CLIENT_ID,
    hasClientSecret: !!X_CLIENT_SECRET,
    hasCallbackUrl: !!X_CALLBACK_URL,
    callbackUrl: X_CALLBACK_URL // This is safe to log
  });

  if (!X_CLIENT_ID || !X_CLIENT_SECRET || !X_CALLBACK_URL) {
    console.error('[X Connect Callback] Missing environment variables:', {
      X_CLIENT_ID: !!X_CLIENT_ID,
      X_CLIENT_SECRET: !!X_CLIENT_SECRET,
      X_CALLBACK_URL: !!X_CALLBACK_URL
    });
    return createResponse(req, '/profile?x_connect_error=config', 'Missing X OAuth configuration');
  }

  // Get session
  let session;
  try {
    session = await getServerSession(authOptions);
    console.log('[X Connect Callback] Session status:', {
      hasSession: !!session,
      hasUser: !!session?.user,
      hasDbId: !!session?.user?.dbId
    });
  } catch (sessionError) {
    console.error('[X Connect Callback] Session error:', sessionError);
    return createResponse(req, '/profile?x_connect_error=session_error', 'Session error');
  }

  if (!session || !session.user || !session.user.dbId) {
    console.error('[X Connect Callback] User not authenticated or dbId missing');
    return createResponse(req, '/profile?x_connect_error=auth', 'User not authenticated');
  }

  // Get cookies
  let storedState, codeVerifier;
  try {
    const cookieStore = cookies();
    storedState = cookieStore.get('x_oauth_state')?.value;
    codeVerifier = cookieStore.get('x_pkce_code_verifier')?.value;
    
    console.log('[X Connect Callback] Cookie status:', {
      hasState: !!storedState,
      hasVerifier: !!codeVerifier
    });

    // Clear cookies immediately after retrieving them
    cookieStore.delete('x_oauth_state');
    cookieStore.delete('x_pkce_code_verifier');
  } catch (cookieError) {
    console.error('[X Connect Callback] Cookie error:', cookieError);
    return createResponse(req, '/profile?x_connect_error=cookie_error', 'Cookie error');
  }

  if (!storedState || !codeVerifier) {
    console.error('[X Connect Callback] OAuth state or PKCE verifier missing from cookies');
    return createResponse(req, '/profile?x_connect_error=missing_params', 'Missing OAuth parameters');
  }

  // Parse URL parameters
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const receivedState = url.searchParams.get('state');
  const error = url.searchParams.get('error');

  console.log('[X Connect Callback] URL parameters:', {
    hasCode: !!code,
    hasState: !!receivedState,
    hasError: !!error,
    error: error
  });

  if (error) {
    console.error(`[X Connect Callback] Error from X: ${error} - ${url.searchParams.get('error_description')}`);
    return createResponse(req, `/profile?x_connect_error=${error}`, `X OAuth error: ${error}`);
  }

  if (!code) {
    console.error('[X Connect Callback] Authorization code missing from X callback');
    return createResponse(req, '/profile?x_connect_error=no_code', 'No authorization code');
  }

  if (receivedState !== storedState) {
    console.error('[X Connect Callback] State mismatch:', {
      received: receivedState,
      stored: storedState
    });
    return createResponse(req, '/profile?x_connect_error=state_mismatch', 'State mismatch');
  }

  try {
    // 1. Exchange authorization code for tokens
    console.log('[X Connect Callback] Exchanging code for tokens...');
    
    const tokenBody = new URLSearchParams({
      code: code,
      grant_type: 'authorization_code',
      client_id: X_CLIENT_ID,
      redirect_uri: X_CALLBACK_URL,
      code_verifier: codeVerifier,
    });

    console.log('[X Connect Callback] Token request params:', {
      redirect_uri: X_CALLBACK_URL,
      grant_type: 'authorization_code',
      hasCode: !!code,
      hasVerifier: !!codeVerifier
    });

    const tokenResponse = await fetch('https://api.twitter.com/2/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${X_CLIENT_ID}:${X_CLIENT_SECRET}`).toString('base64')}`,
      },
      body: tokenBody,
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('[X Connect Callback] Token exchange failed:', {
        status: tokenResponse.status,
        statusText: tokenResponse.statusText,
        error: errorText
      });
      
      // Try to parse as JSON if possible
      try {
        const errorData = JSON.parse(errorText);
        throw new Error(errorData.error_description || errorData.error || 'Failed to get X token');
      } catch {
        throw new Error(`Token exchange failed: ${tokenResponse.status} ${errorText}`);
      }
    }

    const tokens = await tokenResponse.json();
    const accessToken = tokens.access_token;
    const refreshToken = tokens.refresh_token;
    const scopes = tokens.scope ? tokens.scope.split(' ') : [];
    
    console.log('[X Connect Callback] Token exchange successful:', {
      hasAccessToken: !!accessToken,
      hasRefreshToken: !!refreshToken,
      scopes: scopes.join(', ')
    });

    if (!accessToken) {
      throw new Error('No access token received from X');
    }

    // 2. Fetch X user profile data
    console.log('[X Connect Callback] Fetching user profile...');
    
    const userProfileUrl = new URL('https://api.twitter.com/2/users/me');
    userProfileUrl.searchParams.set('user.fields', 'id,username,profile_image_url');

    const userProfileResponse = await fetch(userProfileUrl.toString(), {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!userProfileResponse.ok) {
      const errorText = await userProfileResponse.text();
      console.error('[X Connect Callback] User profile fetch failed:', {
        status: userProfileResponse.status,
        statusText: userProfileResponse.statusText,
        error: errorText
      });
      throw new Error(`Failed to fetch X user profile: ${userProfileResponse.status}`);
    }

    const userProfileData = await userProfileResponse.json();
    const xUserProfile = userProfileData.data;

    if (!xUserProfile || !xUserProfile.id) {
      console.error('[X Connect Callback] Invalid user profile data:', userProfileData);
      throw new Error('Invalid user profile data received from X');
    }

    console.log('[X Connect Callback] User profile fetched:', {
      id: xUserProfile.id,
      username: xUserProfile.username,
      hasProfileImage: !!xUserProfile.profile_image_url
    });

    // 3. Update user document in DB
    console.log('[X Connect Callback] Updating database...');
    
    let db, usersCollection;
    try {
      const connection = await connectToDatabase();
      db = connection.db;
      usersCollection = db.collection<UserDocument>('users');
    } catch (dbError) {
      console.error('[X Connect Callback] Database connection error:', dbError);
      throw new Error('Database connection failed');
    }
    
    const updateData: any = {
      linkedXId: xUserProfile.id,
      linkedXUsername: xUserProfile.username,
      linkedXProfileImageUrl: xUserProfile.profile_image_url,
      linkedXAccessToken: encrypt(accessToken),
      linkedXScopes: scopes,
      linkedXConnectedAt: new Date(),
      updatedAt: new Date(),
    };

    // Only set refresh token if it exists
    if (refreshToken) {
      updateData.linkedXRefreshToken = encrypt(refreshToken);
    }

    const updateResult = await usersCollection.updateOne(
      { _id: new ObjectId(session.user.dbId) },
      { $set: updateData }
    );

    if (updateResult.matchedCount === 0) {
      console.error('[X Connect Callback] User not found in DB:', session.user.dbId);
      throw new Error('User not found for updating X details');
    }

    console.log(`[X Connect Callback] Successfully linked X account @${xUserProfile.username} for user ${session.user.dbId}`);
    
    // Redirect to profile with success message
    return createResponse(req, '/profile?x_connect_success=true');

  } catch (error: any) {
    console.error('[X Connect Callback] Error during callback processing:', {
      error: error.message,
      stack: error.stack
    });
    
    // Clean up URL for error message
    const errorMessage = encodeURIComponent(error.message.replace(/[^a-zA-Z0-9\s]/g, '').substring(0, 50));
    return createResponse(req, `/profile?x_connect_error=${errorMessage}`, error.message);
  }
}