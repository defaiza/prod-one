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
    const csvPath = path.join(process.cwd(), 'public', 'MAY20DeFAIHOLDERS.csv');
    
    // Check if file exists
    if (!fs.existsSync(csvPath)) {
      console.error('CSV file not found at:', csvPath);
      return NextResponse.json({ error: 'May 20 holders data file not found' }, { status: 500 });
    }

    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    
    // Parse CSV lines
    const lines = csvContent.split('\n').filter(line => line.trim().length > 0);
    
    if (lines.length === 0) {
      return NextResponse.json({ error: 'No data found in May 20 holders file' }, { status: 500 });
    }

    // Skip header line and search for wallet
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const columns = line.split(',');
      if (columns.length < 3) continue; // Ensure we have all required columns
      
      const csvWalletAddress = columns[0]?.trim();
      const quantity = columns[2]?.trim();
      
      if (csvWalletAddress && csvWalletAddress.toLowerCase() === walletAddress.toLowerCase()) {
        return NextResponse.json({
          found: true,
          walletAddress: csvWalletAddress,
          quantity: parseFloat(quantity) || 0,
          message: 'You had DeFAI on May 20. You must Mint an OG Ticket to receive these tokens which will vest over 90 days.'
        });
      }
    }

    // Not found
    return NextResponse.json({
      found: false,
      message: 'Wallet address not found in May 20 DeFAI holders data'
    });

  } catch (error) {
    console.error('Error checking May 20 holders:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return NextResponse.json({ 
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
    }, { status: 500 });
  }
} 