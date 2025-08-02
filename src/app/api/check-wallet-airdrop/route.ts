import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const walletAddress = searchParams.get('address');

    if (!walletAddress) {
      return NextResponse.json({ error: 'Wallet address is required' }, { status: 400 });
    }

    // Read the CSV file
    const csvPath = path.join(process.cwd(), 'public', 'airdrop_export_2025-07-30.csv');
    
    // Check if file exists
    if (!fs.existsSync(csvPath)) {
      console.error('CSV file not found at:', csvPath);
      return NextResponse.json({ error: 'Airdrop data file not found' }, { status: 500 });
    }

    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    
    // Parse CSV lines
    const lines = csvContent.split('\n').filter(line => line.trim().length > 0);
    
    if (lines.length === 0) {
      return NextResponse.json({ error: 'No data found in airdrop file' }, { status: 500 });
    }

    const headers = lines[0].split(',');
    
    // Find the wallet address (case-insensitive)
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const columns = line.split(',');
      if (columns.length < 4) continue; // Ensure we have all required columns
      
      const csvWalletAddress = columns[0]?.trim();
      const totalEstimatedAirdrop = columns[1]?.trim();
      const currentPoints = columns[2]?.trim();
      const initialAirdropAmount = columns[3]?.trim();
      
      if (csvWalletAddress && csvWalletAddress.toLowerCase() === walletAddress.toLowerCase()) {
        return NextResponse.json({
          found: true,
          walletAddress: csvWalletAddress,
          totalEstimatedAirdrop: parseFloat(totalEstimatedAirdrop) || 0,
          currentPoints: parseInt(currentPoints) || 0,
          initialAirdropAmount: parseFloat(initialAirdropAmount) || 0
        });
      }
    }

    // Not found
    return NextResponse.json({
      found: false,
      message: 'Wallet address not found in airdrop data'
    });

  } catch (error) {
    console.error('Error checking wallet airdrop:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return NextResponse.json({ 
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
    }, { status: 500 });
  }
} 