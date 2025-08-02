import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const walletAddress = searchParams.get('address');

    if (!walletAddress) {
      return NextResponse.json({ error: 'Wallet address is required' }, { status: 400 });
    }

    // Read the CSV file
    const csvPath = path.join(process.cwd(), 'public', '10_1AIR - Sheet1.csv');
    
    // Check if file exists
    if (!fs.existsSync(csvPath)) {
      console.error('CSV file not found at:', csvPath);
      return NextResponse.json({ error: 'March 31 holders data file not found' }, { status: 500 });
    }

    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    
    // Parse CSV lines
    const lines = csvContent.split('\n').filter(line => line.trim().length > 0);
    
    if (lines.length === 0) {
      return NextResponse.json({ error: 'No data found in March 31 holders file' }, { status: 500 });
    }

    // Skip header line and search for wallet
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const columns = line.split(',');
      if (columns.length < 4) continue; // Ensure we have all required columns
      
      const csvWalletAddress = columns[0]?.trim();
      const quantity = columns[2]?.trim();
      const airdropAmount = columns[3]?.trim();
      
      if (csvWalletAddress && csvWalletAddress.toLowerCase() === walletAddress.toLowerCase()) {
        return NextResponse.json({
          found: true,
          walletAddress: csvWalletAddress,
          quantity: parseFloat(quantity) || 0,
          airdropAmount: parseFloat(airdropAmount) || 0,
          message: 'You had DeFAI prior to March 31. Log into defai.gg and these tokens will vest over 90 days.'
        });
      }
    }

    // Not found
    return NextResponse.json({
      found: false,
      message: 'Wallet address not found in March 31 DeFAI holders data'
    });

  } catch (error) {
    console.error('Error checking March 31 holders:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return NextResponse.json({ 
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
    }, { status: 500 });
  }
} 