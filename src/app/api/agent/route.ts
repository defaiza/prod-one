import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { message, walletAddress } = await req.json();

    if (!message || !walletAddress) {
      return NextResponse.json(
        { error: 'Message and wallet address are required' },
        { status: 400 }
      );
    }

    // Eliza OS API endpoint
    const elizaEndpoint = process.env.ELIZA_API_URL || 'http://localhost:3000/api/eliza';
    
    const response = await fetch(elizaEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.ELIZA_API_KEY}`,
      },
      body: JSON.stringify({
        message,
        context: {
          walletAddress,
          userId: session.user.id,
          username: session.user.name,
          // Add any other context you want to pass to Eliza
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Eliza API error: ${response.statusText}`);
    }

    const data = await response.json();

    return NextResponse.json({
      response: data.response,
      // Include any additional data from Eliza that you want to pass to the client
    });
  } catch (error) {
    console.error('Agent API error:', error);
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    );
  }
} 