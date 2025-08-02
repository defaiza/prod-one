import { NextRequest, NextResponse } from 'next/server';

// Force dynamic rendering for this API route since it uses request headers
export const dynamic = 'force-dynamic';

// Explicit allowlist of variables that are safe to expose
const ALLOWED_ENV_VARS = [
  'NEXT_PUBLIC_SOLANA_RPC_URL',
  'NEXT_PUBLIC_DEFAI_TOKEN_MINT_ADDRESS', 
  'NEXT_PUBLIC_REQUIRED_DEFAI_AMOUNT',
  'NEXT_PUBLIC_DEFAI_TOKEN_DECIMALS',
] as const;

export async function GET(request: NextRequest) {
  try {
    // Set CORS headers for production
    const headers = new Headers();
    headers.set('Cache-Control', 'public, max-age=300, must-revalidate');
    headers.set('X-Content-Type-Options', 'nosniff');
    headers.set('Content-Type', 'application/json');
    
    // In production, set proper CORS
    if (process.env.NODE_ENV === 'production') {
      const origin = request.headers.get('origin');
      const allowedOrigins = [
        'https://squad.defairewards.net',
        'https://defairewards.net',
        'https://www.defairewards.net'
      ];
      
      if (origin && allowedOrigins.includes(origin)) {
        headers.set('Access-Control-Allow-Origin', origin);
        headers.set('Access-Control-Allow-Credentials', 'true');
      }
    }

    // Collect allowed environment variables
    const envVars: Record<string, string> = {};
    
    ALLOWED_ENV_VARS.forEach(varName => {
      const value = process.env[varName];
      if (value) {
        envVars[varName] = value;
      }
    });

    // Return the environment variables
    return NextResponse.json(envVars, { headers });

  } catch (error) {
    console.error('[Env API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 