import { Connection, PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddress, getAccount, TokenAccountNotFoundError } from '@solana/spl-token';
import { validateSolanaAddress } from '@/lib/validation';

const MAX_DECIMALS = 18;
const MIN_DECIMALS = 0;

// Rate limiting: Simple in-memory cache with TTL
interface CacheEntry {
  data: TokenBalanceResult;
  timestamp: number;
  attempts: number;
}

const balanceCache = new Map<string, CacheEntry>();
const CACHE_TTL = 60000; // 60 seconds (increased to reduce excessive calls)
const MAX_ATTEMPTS_PER_MINUTE = 5; // Reduced to prevent re-render loops
const RATE_LIMIT_WINDOW = 60000; // 1 minute

// Security: Sanitized error messages for production
const SANITIZED_ERRORS = {
  INVALID_ADDRESS: 'Invalid wallet address format',
  INVALID_TOKEN: 'Invalid token configuration',
  NETWORK_ERROR: 'Network temporarily unavailable',
  RATE_LIMITED: 'Too many requests, please try again later',
  SERVICE_ERROR: 'Service temporarily unavailable'
} as const;

export interface TokenBalanceResult {
  balance: number;
  hasAccount: boolean;
  error?: string;
  cached?: boolean;
}

interface SecurityConfig {
  enableRateLimit: boolean;
  enableCaching: boolean;
  logLevel: 'none' | 'error' | 'warn' | 'info';
  maxRetries: number;
  timeoutMs: number;
}

const defaultSecurityConfig: SecurityConfig = {
  enableRateLimit: true, // Always enable to prevent excessive re-renders
  enableCaching: true,
  logLevel: process.env.NODE_ENV === 'production' ? 'error' : 'warn',
  maxRetries: 3,
  timeoutMs: 10000 // 10 second timeout
};

/**
 * SECURITY: Rate limiting check
 */
function checkRateLimit(walletAddress: string, config: SecurityConfig): boolean {
  if (!config.enableRateLimit) return true;
  
  const cacheKey = `rate_${walletAddress}`;
  const now = Date.now();
  const entry = balanceCache.get(cacheKey);
  
  if (!entry) {
    balanceCache.set(cacheKey, {
      data: { balance: 0, hasAccount: false },
      timestamp: now,
      attempts: 1
    });
    return true;
  }
  
  // Reset counter if window expired
  if (now - entry.timestamp > RATE_LIMIT_WINDOW) {
    entry.attempts = 1;
    entry.timestamp = now;
    return true;
  }
  
  entry.attempts++;
  return entry.attempts <= MAX_ATTEMPTS_PER_MINUTE;
}

/**
 * SECURITY: Safe logging with data masking
 */
function secureLog(level: SecurityConfig['logLevel'], message: string, data?: any) {
  if (level === 'none') return;
  
  // Mask sensitive data in production
  const sanitizedData = data ? {
    ...data,
    walletAddress: data.walletAddress ? `${data.walletAddress.slice(0, 4)}...${data.walletAddress.slice(-4)}` : undefined,
    ata: data.ata ? `${data.ata.slice(0, 4)}...${data.ata.slice(-4)}` : undefined
  } : undefined;
  
  const logFn = console[level] || console.log;
  logFn(`[TokenBalance]`, message, sanitizedData);
}

/**
 * SECURITY: Get cached result if valid
 */
function getCachedResult(cacheKey: string, config: SecurityConfig): TokenBalanceResult | null {
  if (!config.enableCaching) return null;
  
  const entry = balanceCache.get(cacheKey);
  if (!entry) return null;
  
  const isExpired = Date.now() - entry.timestamp > CACHE_TTL;
  if (isExpired) {
    balanceCache.delete(cacheKey);
    return null;
  }
  
  return { ...entry.data, cached: true };
}

/**
 * SECURITY: Set cache entry
 */
function setCacheEntry(cacheKey: string, result: TokenBalanceResult, config: SecurityConfig) {
  if (!config.enableCaching) return;
  
  balanceCache.set(cacheKey, {
    data: result,
    timestamp: Date.now(),
    attempts: 0
  });
}

/**
 * PRODUCTION-READY: Safely checks the balance of a specific token for a wallet address.
 * Includes security measures: input validation, rate limiting, caching, timeout handling.
 * 
 * @param connection - Solana connection
 * @param walletAddress - The wallet's public key
 * @param tokenMintAddress - The token mint address
 * @param decimals - Number of decimals for the token
 * @param allowOwnerOffCurve - Whether to allow owner off curve (for smart contracts/PDAs)
 * @param config - Security configuration options
 * @returns TokenBalanceResult with balance, account existence status, and any errors
 */
export async function getTokenBalance(
  connection: Connection,
  walletAddress: PublicKey,
  tokenMintAddress: string,
  decimals: number = 9,
  allowOwnerOffCurve: boolean = false,
  config: Partial<SecurityConfig> = {}
): Promise<TokenBalanceResult> {
  const securityConfig = { ...defaultSecurityConfig, ...config };
  const walletString = walletAddress.toBase58();
  const cacheKey = `balance_${walletString}_${tokenMintAddress}_${decimals}_${allowOwnerOffCurve}`;
  
  try {
    // SECURITY: Input validation
    if (!validateSolanaAddress(walletString)) {
      secureLog(securityConfig.logLevel, 'Invalid wallet address', { walletAddress: walletString });
      return {
        balance: 0,
        hasAccount: false,
        error: SANITIZED_ERRORS.INVALID_ADDRESS
      };
    }
    
    if (!validateSolanaAddress(tokenMintAddress)) {
      secureLog(securityConfig.logLevel, 'Invalid token mint', { tokenMintAddress });
      return {
        balance: 0,
        hasAccount: false,
        error: SANITIZED_ERRORS.INVALID_TOKEN
      };
    }
    
    // SECURITY: Rate limiting
    if (!checkRateLimit(walletString, securityConfig)) {
      secureLog(securityConfig.logLevel, 'Rate limit exceeded', { walletAddress: walletString });
      return {
        balance: 0,
        hasAccount: false,
        error: SANITIZED_ERRORS.RATE_LIMITED
      };
    }
    
    // SECURITY: Check cache
    const cachedResult = getCachedResult(cacheKey, securityConfig);
    if (cachedResult) {
      secureLog(securityConfig.logLevel, 'Returning cached result', { walletAddress: walletString });
      return cachedResult;
    }
    
    // SECURITY: Create PublicKey with error handling
    let mint: PublicKey;
    try {
      mint = new PublicKey(tokenMintAddress);
    } catch (error) {
      secureLog(securityConfig.logLevel, 'Invalid mint address', { error: error instanceof Error ? error.message : 'Unknown error' });
      return {
        balance: 0,
        hasAccount: false,
        error: SANITIZED_ERRORS.INVALID_TOKEN
      };
    }
    
    // SECURITY: Validate decimals
    if (decimals < MIN_DECIMALS || decimals > MAX_DECIMALS) {
      secureLog(securityConfig.logLevel, 'Invalid decimals', { decimals });
      return {
        balance: 0,
        hasAccount: false,
        error: SANITIZED_ERRORS.INVALID_TOKEN
      };
    }
    
    // SECURITY: Get associated token address with timeout
    let ata: PublicKey;
    try {
      ata = await getAssociatedTokenAddress(mint, walletAddress, allowOwnerOffCurve);
    } catch (error) {
      secureLog(securityConfig.logLevel, 'Failed to get ATA', { error: error instanceof Error ? error.message : 'Unknown error' });
      return {
        balance: 0,
        hasAccount: false,
        error: SANITIZED_ERRORS.SERVICE_ERROR
      };
    }
    
    // SECURITY: Get account info with timeout and retries
    let accountInfo;
    let retries = 0;
    
    while (retries < securityConfig.maxRetries) {
      try {
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Timeout')), securityConfig.timeoutMs);
        });
        
        const accountPromise = getAccount(connection, ata);
        accountInfo = await Promise.race([accountPromise, timeoutPromise]) as any;
        break; // Success, exit retry loop
        
      } catch (error) {
        retries++;
        secureLog(securityConfig.logLevel, `Account fetch attempt ${retries} failed`, { 
          error: error instanceof Error ? error.message : 'Unknown error',
          retries 
        });
        
        if (retries >= securityConfig.maxRetries) {
          if (error instanceof TokenAccountNotFoundError) {
            // Account doesn't exist, which is valid
            const result = { balance: 0, hasAccount: false };
            setCacheEntry(cacheKey, result, securityConfig);
            return result;
          } else {
            return {
              balance: 0,
              hasAccount: false,
              error: SANITIZED_ERRORS.NETWORK_ERROR
            };
          }
        }
        
        // Wait before retry (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, retries) * 100));
      }
    }
    
    // SECURITY: Calculate balance safely
    let balance: number;
    try {
      const rawBalance = accountInfo.amount;
      balance = Number(rawBalance) / Math.pow(10, decimals);
      
      // Handle edge cases
      if (!isFinite(balance)) {
        balance = 0;
      }
    } catch (error) {
      secureLog(securityConfig.logLevel, 'Balance calculation error', { error: error instanceof Error ? error.message : 'Unknown error' });
      return {
        balance: 0,
        hasAccount: true,
        error: SANITIZED_ERRORS.SERVICE_ERROR
      };
    }
    
    const result: TokenBalanceResult = {
      balance,
      hasAccount: true
    };
    
    // SECURITY: Cache successful result
    setCacheEntry(cacheKey, result, securityConfig);
    
    return result;
    
  } catch (error) {
    secureLog(securityConfig.logLevel, 'Unexpected error in getTokenBalance', { 
      error: error instanceof Error ? error.message : 'Unknown error',
      walletAddress: walletString 
    });
    
    return {
      balance: 0,
      hasAccount: false,
      error: SANITIZED_ERRORS.SERVICE_ERROR
    };
  }
}

/**
 * Get DeFAI token balance for a wallet address
 * Uses the DeFAI token mint address from environment variables
 * 
 * @param connection - Solana connection
 * @param walletAddress - The wallet's public key
 * @param allowOwnerOffCurve - Whether to allow owner off curve (for smart contracts/PDAs)
 * @param config - Security configuration options
 * @returns TokenBalanceResult with DeFAI balance
 */
export async function getDefaiBalance(
  connection: Connection,
  walletAddress: PublicKey,
  allowOwnerOffCurve: boolean = false,
  config: Partial<SecurityConfig> = {}
): Promise<TokenBalanceResult> {
  const defaiMintAddress = process.env.NEXT_PUBLIC_DEFAI_TOKEN_MINT;
  
  if (!defaiMintAddress) {
    console.error('NEXT_PUBLIC_DEFAI_TOKEN_MINT environment variable not set');
    return {
      balance: 0,
      hasAccount: false,
      error: 'Token configuration not found'
    };
  }
  
  return getTokenBalance(
    connection,
    walletAddress,
    defaiMintAddress,
    9, // DeFAI has 9 decimals
    allowOwnerOffCurve,
    config
  );
}

/**
 * Check if a wallet has sufficient DeFAI balance for certain operations
 * 
 * @param connection - Solana connection
 * @param walletAddress - The wallet's public key
 * @param allowOwnerOffCurve - Whether to allow owner off curve (for smart contracts/PDAs)
 * @param config - Security configuration options
 * @returns Object with hasSufficient flag, actual balance, required amount, and any errors
 */
export async function hasSufficientDefaiBalance(
  connection: Connection,
  walletAddress: PublicKey,
  allowOwnerOffCurve: boolean = false,
  config: Partial<SecurityConfig> = {}
): Promise<{ hasSufficient: boolean; balance: number; required: number; error?: string }> {
  const requiredAmount = parseInt(process.env.NEXT_PUBLIC_REQUIRED_DEFAI_AMOUNT || '5000', 10);
  
  const result = await getDefaiBalance(connection, walletAddress, allowOwnerOffCurve, config);
  
  if (result.error) {
    return {
      hasSufficient: false,
      balance: 0,
      required: requiredAmount,
      error: result.error
    };
  }
  
  return {
    hasSufficient: result.balance >= requiredAmount,
    balance: result.balance,
    required: requiredAmount
  };
}

/**
 * Clear the token balance cache
 * Useful for testing or when you need fresh data
 */
export function clearTokenBalanceCache(): void {
  balanceCache.clear();
}

/**
 * Get cache statistics for monitoring
 * @returns Object with cache size and number of entries
 */
export function getCacheStats(): { size: number; entries: number } {
  return {
    size: balanceCache.size,
    entries: Array.from(balanceCache.values()).length
  };
} 