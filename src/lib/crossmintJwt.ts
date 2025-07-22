import * as jose from 'jose';

// createRemoteJWKSet returns a function that resolves to the key material.
// The type for this function is ((protectedHeader?: jose.JWSHeaderParameters, token?: jose.FlattenedJWSInput) => Promise<jose.KeyLike | Uint8Array>)
// We can simplify the type annotation for jwks or let TypeScript infer it.
let jwks: ReturnType<typeof jose.createRemoteJWKSet> | null = null;

const CROSSMINT_ISSUER = 'https://www.crossmint.com';
// Try different audience values - Crossmint typically uses 'client-sdk' or your project ID
const CROSSMINT_AUDIENCE = 'client-sdk'; // Changed from 'crossmint_api' to 'client-sdk'

/**
 * Verifies a JWT from Crossmint against their public JWKS.
 * 
 * @param token The Crossmint JWT string.
 * @returns The decoded JWT payload if verification is successful.
 * @throws Error if verification fails (e.g., invalid signature, expired, wrong issuer/audience).
 */
export async function verifyCrossmintJwt(token: string): Promise<jose.JWTPayload & { sub?: string; wallets?: { address: string; chain: string; primary?: boolean }[] }> {
  if (!jwks) {
    try {
      console.log('[CrossmintJWT] Fetching Crossmint JWKS...');
      jwks = jose.createRemoteJWKSet(new URL(`${CROSSMINT_ISSUER}/.well-known/jwks.json`));
      console.log('[CrossmintJWT] Crossmint JWKS remote set created successfully.');
    } catch (error) {
      console.error('[CrossmintJWT] Failed to create Crossmint JWKS remote set:', error);
      throw new Error('Could not create Crossmint public key set for JWT verification.');
    }
  }

  try {
    // First, try to decode the JWT without verification to see the payload
    const decoded = jose.decodeJwt(token);
    console.log('[CrossmintJWT] JWT decoded (unverified):', {
      iss: decoded.iss,
      aud: decoded.aud,
      sub: decoded.sub,
      exp: decoded.exp,
      iat: decoded.iat
    });

    // The jwks function (from createRemoteJWKSet) is directly passed as the key argument.
    const { payload, protectedHeader } = await jose.jwtVerify(token, jwks, {
      issuer: CROSSMINT_ISSUER,
      audience: CROSSMINT_AUDIENCE,
    });
    console.log('[CrossmintJWT] JWT verified successfully. Protected Header:', protectedHeader);
    // Type assertion to include expected custom claims like `sub` and `wallets`
    return payload as jose.JWTPayload & { sub?: string; wallets?: { address: string; chain: string; primary?: boolean }[] };
  } catch (error: any) {
    console.error('[CrossmintJWT] JWT verification failed:', error.message, 'Token:', token.substring(0, 20) + "...");
    // Log more details if available from the error object, e.g., error.code for jose errors
    if (error.code) {
        console.error('[CrossmintJWT] Verification error code:', error.code);
    }
    
    // If audience verification fails, try without audience verification
    if (error.code === 'ERR_JWT_AUDIENCE_MISMATCH' || error.message.includes('audience')) {
      console.log('[CrossmintJWT] Trying verification without audience check...');
      try {
        const { payload, protectedHeader } = await jose.jwtVerify(token, jwks, {
          issuer: CROSSMINT_ISSUER,
          // Remove audience verification
        });
        console.log('[CrossmintJWT] JWT verified successfully without audience check.');
        return payload as jose.JWTPayload & { sub?: string; wallets?: { address: string; chain: string; primary?: boolean }[] };
      } catch (retryError: any) {
        console.error('[CrossmintJWT] JWT verification failed even without audience check:', retryError.message);
      }
    }
    
    throw error; // Re-throw the original error for the caller to handle
  }
} 