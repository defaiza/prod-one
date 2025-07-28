import { useState, useEffect } from 'react';

interface EnvVars {
  NEXT_PUBLIC_SOLANA_RPC_URL?: string;
  NEXT_PUBLIC_DEFAI_TOKEN_MINT_ADDRESS?: string;
  NEXT_PUBLIC_REQUIRED_DEFAI_AMOUNT?: string;
  NEXT_PUBLIC_DEFAI_TOKEN_DECIMALS?: string;
}

let cachedEnvVars: EnvVars | null = null;

export function useEnv() {
  const [envVars, setEnvVars] = useState<EnvVars | null>(cachedEnvVars);
  const [isLoading, setIsLoading] = useState(!cachedEnvVars);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (cachedEnvVars) {
      return; // Already cached
    }

    const fetchEnvVars = async () => {
      try {
        setIsLoading(true);
        const response = await fetch('/api/config/env');
        
        if (!response.ok) {
          throw new Error(`Failed to fetch env vars: ${response.status}`);
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
        console.warn('[useEnv] API failed, falling back to process.env:', err);
        
        // Fallback to process.env for client-side NEXT_PUBLIC_ variables
        const fallbackEnvVars: EnvVars = {
          NEXT_PUBLIC_SOLANA_RPC_URL: process.env.NEXT_PUBLIC_SOLANA_RPC_URL,
          NEXT_PUBLIC_DEFAI_TOKEN_MINT_ADDRESS: process.env.NEXT_PUBLIC_DEFAI_TOKEN_MINT_ADDRESS,
          NEXT_PUBLIC_REQUIRED_DEFAI_AMOUNT: process.env.NEXT_PUBLIC_REQUIRED_DEFAI_AMOUNT,
          NEXT_PUBLIC_DEFAI_TOKEN_DECIMALS: process.env.NEXT_PUBLIC_DEFAI_TOKEN_DECIMALS,
        };
        
        // Filter out undefined values
        const filteredEnvVars = Object.fromEntries(
          Object.entries(fallbackEnvVars).filter(([_, value]) => value !== undefined)
        ) as EnvVars;
        
        cachedEnvVars = filteredEnvVars;
        setEnvVars(filteredEnvVars);
        setError(null); // Don't treat fallback as an error
        console.log('[useEnv] Using fallback environment variables:', filteredEnvVars);
      } finally {
        setIsLoading(false);
      }
    };

    fetchEnvVars();
  }, []);

  return { envVars, isLoading, error };
}

// Utility function to get specific env var with fallback
export function getEnvVar(key: keyof EnvVars, envVars: EnvVars | null): string | undefined {
  return envVars?.[key] || process.env[key];
} 