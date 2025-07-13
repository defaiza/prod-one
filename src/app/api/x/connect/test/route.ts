import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  return NextResponse.json({ 
    message: 'Test endpoint working',
    method: 'GET',
    timestamp: new Date().toISOString()
  });
}

export async function POST(req: NextRequest) {
  return NextResponse.json({ 
    message: 'Test endpoint working',
    method: 'POST',
    timestamp: new Date().toISOString()
  });
}