import { useState, useEffect } from 'react';

interface EnvVars {
  NEXT_PUBLIC_SOLANA_RPC_URL?: string;
  NEXT_PUBLIC_DEFAI_TOKEN_MINT_ADDRESS?: string;
  NEXT_PUBLIC_REQUIRED_DEFAI_AMOUNT?: string;
  NEXT_PUBLIC_DEFAI_TOKEN_DECIMALS?: string;
}

let cachedEnvVars: EnvVars | null = null;
let fetchAttempted = false;

export function useEnv() {
  const [envVars, setEnvVars] = useState<EnvVars | null>(cachedEnvVars);
  const [isLoading, setIsLoading] = useState(!cachedEnvVars && !fetchAttempted);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (cachedEnvVars || fetchAttempted) {
      return; // Already cached or attempted
    }

    const fetchEnvVars = async () => {
      fetchAttempted = true;
      
      try {
        setIsLoading(true);
        
        // Set timeout for production to prevent hanging
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        const response = await fetch('/api/config/env', {
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          throw new Error(`API failed with status: ${response.status}`);
        }

        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          throw new Error('API returned non-JSON response');
        }

        const data = await response.json();
        cachedEnvVars = data;
        setEnvVars(data);
        setError(null);
        console.log('[useEnv] Successfully loaded environment variables from API');
      } catch (err) {
        console.warn('[useEnv] API failed, using fallback environment variables:', err);
        
        // Immediate fallback to process.env for client-side NEXT_PUBLIC_ variables
        const fallbackEnvVars: EnvVars = {
          NEXT_PUBLIC_SOLANA_RPC_URL: process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',
          NEXT_PUBLIC_DEFAI_TOKEN_MINT_ADDRESS: process.env.NEXT_PUBLIC_DEFAI_TOKEN_MINT_ADDRESS || '6Y7LbYB3tfGBG6CSkyssoxdtHb77AEMTRVXe8JUJRwZ7',
          NEXT_PUBLIC_REQUIRED_DEFAI_AMOUNT: process.env.NEXT_PUBLIC_REQUIRED_DEFAI_AMOUNT || '5000',
          NEXT_PUBLIC_DEFAI_TOKEN_DECIMALS: process.env.NEXT_PUBLIC_DEFAI_TOKEN_DECIMALS || '9',
        };
        
        // Filter out undefined values and keep only defined ones
        const filteredEnvVars = Object.fromEntries(
          Object.entries(fallbackEnvVars).filter(([_, value]) => value !== undefined)
        ) as EnvVars;
        
        cachedEnvVars = filteredEnvVars;
        setEnvVars(filteredEnvVars);
        setError(null); // Don't treat fallback as an error since we have defaults
        console.log('[useEnv] Using fallback environment variables:', filteredEnvVars);
      } finally {
        setIsLoading(false);
      }
    };

    // Debounce in production to prevent rapid API calls
    const timeoutId = setTimeout(fetchEnvVars, process.env.NODE_ENV === 'production' ? 100 : 0);
    return () => clearTimeout(timeoutId);
  }, []);

  return { envVars, isLoading, error };
}

// Utility function to get specific env var with multiple fallbacks
export function getEnvVar(key: keyof EnvVars, envVars: EnvVars | null): string | undefined {
  // Try the provided envVars first
  if (envVars && envVars[key]) {
    return envVars[key];
  }
  
  // Fallback to process.env
  const processEnvValue = process.env[key];
  if (processEnvValue) {
    return processEnvValue;
  }
  
  // Final fallback to hardcoded defaults for critical values
  const defaults: Record<string, string> = {
    'NEXT_PUBLIC_SOLANA_RPC_URL': 'https://api.mainnet-beta.solana.com',
    'NEXT_PUBLIC_DEFAI_TOKEN_MINT_ADDRESS': '6Y7LbYB3tfGBG6CSkyssoxdtHb77AEMTRVXe8JUJRwZ7',
    'NEXT_PUBLIC_REQUIRED_DEFAI_AMOUNT': '5000',
    'NEXT_PUBLIC_DEFAI_TOKEN_DECIMALS': '9',
  };
  
  return defaults[key];
} 