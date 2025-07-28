// @ts-nocheck
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSession, signIn, signOut as nextAuthSignOut } from "next-auth/react";
import { useWallet } from '@solana/wallet-adapter-react';
import { useConnection } from '@solana/wallet-adapter-react';
import { toast } from 'sonner';
import { PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddress, getAccount } from '@solana/spl-token';
import { checkRequiredEnvVars } from '@/utils/checkEnv';
import { useEnv, getEnvVar } from '@/hooks/useEnv';
import { useUserAirdrop, UserAirdropData } from '@/hooks/useUserAirdrop';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { hasSufficientDefaiBalance } from '@/utils/tokenBalance';

export function useHomePageLogic() {
  const { data: session, status: authStatus, update: updateSession } = useSession();
  const wallet = useWallet();
  const { connection } = useConnection();
  const { setVisible: setWalletModalVisible } = useWalletModal();
  
  // Get environment variables via API to bypass Next.js bundling issues
  const { envVars, isLoading: isEnvLoading, error: envError } = useEnv();
  const userAirdrop = useUserAirdrop();
  
  // ALL STATE HOOKS MUST BE CALLED BEFORE ANY CONDITIONAL LOGIC
  const [typedAddress, setTypedAddress] = useState('');
  const [airdropCheckResultForTyped, setAirdropCheckResultForTyped] = useState<number | string | null>(null);
  const [isCheckingAirdropForTyped, setIsCheckingAirdropForTyped] = useState(false);
  const [isRewardsActive, setIsRewardsActive] = useState(false);
  const [isActivatingRewards, setIsActivatingRewards] = useState(false);
  const [otherUserData, setOtherUserData] = useState<Partial<UserAirdropData & { referralCode?: string; completedActions?: string[]; xUsername?: string; squadId?: string }>>({});
  const [mySquadData, setMySquadData] = useState(null);
  const [isFetchingSquad, setIsFetchingSquad] = useState(false);
  const [userCheckedNoSquad, setUserCheckedNoSquad] = useState(false);
  const [initialReferrer, setInitialReferrer] = useState(null);
  const [pendingInvites, setPendingInvites] = useState([]);
  const [isFetchingInvites, setIsFetchingInvites] = useState(false);
  const [isProcessingInvite, setIsProcessingInvite] = useState(null);
  const [squadInviteIdFromUrl, setSquadInviteIdFromUrl] = useState(null);
  const [currentTotalAirdropForSharing, setCurrentTotalAirdropForSharing] = useState(0);
  const [isCheckingDefaiBalance, setIsCheckingDefaiBalance] = useState(false);
  const [hasSufficientDefai, setHasSufficientDefai] = useState<boolean | null>(null);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [isProcessingLinkInvite, setIsProcessingLinkInvite] = useState(false);
  const [activationAttempted, setActivationAttempted] = useState(false);
  const [prevWalletAddress, setPrevWalletAddress] = useState<string | null>(null);
  const [isDesktop, setIsDesktop] = useState(false);
  const [totalCommunityPoints, setTotalCommunityPoints] = useState<number | null>(null);
  const [defaiBalance, setDefaiBalance] = useState<number | null>(null);
  const [isWalletSigningIn, setIsWalletSigningIn] = useState(false);
  const [walletSignInAttempted, setWalletSignInAttempted] = useState(false);
  const [userDetailsFetched, setUserDetailsFetched] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);
  
  // Production-safe refs and guards
  const walletPromptedRef = useRef(false);
  const lastAuthCheckRef = useRef<string>('');
  const renderCountRef = useRef(0);
  const lastRenderTimeRef = useRef(0);
  const isInitializedRef = useRef(false);
  
  // Production hydration fix
  useEffect(() => {
    setIsHydrated(true);
    isInitializedRef.current = true;
  }, []);
  
  // NOW THAT ALL HOOKS ARE CALLED, WE CAN APPLY PRODUCTION GUARDS
  // Production guard: Prevent excessive re-renders
  const now = Date.now();
  renderCountRef.current += 1;
  if (now - lastRenderTimeRef.current < 100) { // Throttle to max 10 renders per second
    if (renderCountRef.current > 50) {
      console.warn('[useHomePageLogic] Excessive re-renders detected, throttling...', {
        renderCount: renderCountRef.current,
        authStatus,
        walletConnected: wallet.connected
      });
      // Instead of early return, just set a flag to return minimal data at the end
      const shouldThrottle = true;
      if (shouldThrottle) {
        return {
          session: null,
          authStatus: 'loading',
          wallet,
          connection,
          userAirdropData: { points: null, initialDefai: null, totalDefai: null, isLoading: true },
          userData: {},
          typedAddress: '',
          setTypedAddress: () => {},
          airdropCheckResultForTyped: null,
          setAirdropCheckResult: () => {},
          isCheckingAirdrop: false,
          setIsCheckingAirdrop: () => {},
          isRewardsActive: false,
          isActivatingRewards: false,
          setOtherUserData: () => {},
          mySquadData: null,
          isFetchingSquad: false,
          userCheckedNoSquad: false,
          initialReferrer: null,
          pendingInvites: [],
          isFetchingInvites: false,
          isProcessingInvite: null,
          setIsProcessingInvite: () => {},
          squadInviteIdFromUrl: null,
          setSquadInviteIdFromUrl: () => {},
          currentTotalAirdropForSharing: 0,
          setCurrentTotalAirdropForSharing: () => {},
          isCheckingDefaiBalance: false,
          hasSufficientDefai: null,
          setHasSufficientDefai: () => {},
          showWelcomeModal: false,
          setShowWelcomeModal: () => {},
          isProcessingLinkInvite: false,
          setIsProcessingLinkInvite: () => {},
          activationAttempted: false,
          isDesktop: false,
          setIsDesktop: () => {},
          totalCommunityPoints: null,
          setTotalCommunityPoints: () => {},
          defaiBalance: null,
          setDefaiBalance: () => {},
          handleWalletConnectSuccess: () => {},
          fetchMySquadData: () => {},
          fetchPendingInvites: () => {},
          checkDefaiBalance: () => {},
          activateRewardsAndFetchData: () => {},
          handleFullLogout: () => {},
        };
      }
    }
  } else {
    renderCountRef.current = 0;
    lastRenderTimeRef.current = now;
  }
  
  // Debug logging (only in development)
  if (process.env.NODE_ENV === 'development') {
    console.log('[useHomePageLogic] Current state:', {
      authStatus,
      sessionUser: session?.user,
      walletConnected: wallet.connected,
      walletAddress: wallet.publicKey?.toBase58(),
      sessionWalletAddress: session?.user?.walletAddress
    });
  }

  // Fallback for production if env API fails
  const getEnvVarWithFallback = (key: string) => {
    if (envVars && envVars[key]) {
      return envVars[key];
    }
    // Use process.env directly as fallback
    if (typeof window !== 'undefined' && (window as any)[key]) {
      return (window as any)[key];
    }
    return process.env[key];
  };

  const combinedUserData = {
    ...otherUserData,
    points: userAirdrop.points,
    initialAirdropAmount: userAirdrop.initialDefai,
  };

  // Simplified airdrop sharing calculation
  useEffect(() => {
    if (userAirdrop.totalDefai !== null) {
        setCurrentTotalAirdropForSharing(userAirdrop.totalDefai + (defaiBalance || 0));
    } else if (defaiBalance !== null) {
        setCurrentTotalAirdropForSharing(defaiBalance);
    } else {
        setCurrentTotalAirdropForSharing(0);
    }
  }, [userAirdrop.totalDefai, defaiBalance]);

  const handleWalletConnectSuccess = useCallback(async () => {
    console.log("[handleWalletConnectSuccess] Called with:", {
      walletPublicKey: wallet.publicKey?.toBase58(),
      sessionXId: session?.user?.xId,
      sessionExists: !!session
    });
    
    if (!wallet.publicKey) {
      console.log("[handleWalletConnectSuccess] Missing wallet public key");
      return;
    }
    
    toast.info("Linking your wallet to your account...");
    try {
      const response = await fetch('/api/users/link-wallet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: wallet.publicKey.toBase58() }),
      });
      const data = await response.json();
      console.log("[handleWalletConnectSuccess] Link wallet response:", data);
      
      if (response.ok) {
        toast.success(data.message || "Wallet linked successfully!");
        // Force a session update
        await updateSession();
      } else {
        console.error("[handleWalletConnectSuccess] API error linking wallet", data);
        toast.error(data.error || "Failed to link wallet.");
      }
    } catch (error) {
      console.error("[handleWalletConnectSuccess] Exception linking wallet", error);
      toast.error("An error occurred while linking your wallet.");
    }
  }, [wallet.publicKey, updateSession]);

  const fetchMySquadData = useCallback(async (userWalletAddress: string | null | undefined) => {
    if (!userWalletAddress || isFetchingSquad || userCheckedNoSquad) return;
    setIsFetchingSquad(true);
    try {
      const response = await fetch(`/api/squads/my-squad?userWalletAddress=${encodeURIComponent(userWalletAddress)}`);
      if (response.ok) {
        const data = await response.json();
        if (data.squad) {
          setMySquadData(data.squad);
          setUserCheckedNoSquad(false);
        } else {
          setMySquadData(null);
          setUserCheckedNoSquad(true);
        }
      } else {
        const errorData = await response.json();
        console.error("[fetchMySquadData] Failed to fetch squad data:", errorData.error || response.statusText);
        setMySquadData(null);
        if (response.status === 404) {
          setUserCheckedNoSquad(true);
        }
      }
    } catch (error) {
      console.error("[fetchMySquadData] Error fetching squad data:", error);
      setMySquadData(null);
    }
    setIsFetchingSquad(false);
  }, [isFetchingSquad, userCheckedNoSquad]);

  const fetchPendingInvites = useCallback(async () => {
    if (!wallet.connected || !session || !session.user?.xId || isFetchingInvites) {
        return;
    }
    setIsFetchingInvites(true);
    try {
      const response = await fetch('/api/squads/invitations/my-pending');
      if (response.ok) {
        const data = await response.json();
        setPendingInvites(data.invitations || []);
      } else {
        console.error("[fetchPendingInvites] API error", await response.text());
        setPendingInvites([]);
      }
    } catch (error) {
      console.error("[fetchPendingInvites] Exception", error);
      setPendingInvites([]);
    }
    setIsFetchingInvites(false);
  }, [wallet.connected, session, isFetchingInvites]);

  const checkDefaiBalance = useCallback(async (userPublicKey: PublicKey | null, conn: any) => {
    if (!userPublicKey || !conn || isCheckingDefaiBalance) {
        return;
    }
    setIsCheckingDefaiBalance(true);
    
    try {
      const result = await hasSufficientDefaiBalance(conn, userPublicKey);
      
      setDefaiBalance(result.balance);
      setHasSufficientDefai(result.hasSufficient);
      
      if (result.error) {
        console.warn("DeFAI balance check warning:", result.error);
      }
      
      console.log(`[checkDefaiBalance] Balance: ${result.balance}, Required: ${result.required}, Sufficient: ${result.hasSufficient}`);
    } catch (e) {
      console.error("Could not fetch DeFAI balance", e);
      setDefaiBalance(0);
      setHasSufficientDefai(false);
    }
    
    setIsCheckingDefaiBalance(false);
  }, [isCheckingDefaiBalance]);

  const activateRewardsAndFetchData = useCallback(async (connectedWalletAddress: string, xUserId: string | null, userDbId: string | undefined) => {
    if (isActivatingRewards || activationAttempted) return;
    
    setActivationAttempted(true);
    setIsActivatingRewards(true);
    const referralCodeToUse = initialReferrer;
    toast.info("Activating your DeFAI Rewards account...");
    
    try {
      const response = await fetch('/api/users/activate-rewards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          walletAddress: connectedWalletAddress, 
          xUserId: xUserId || null,
          userDbId: userDbId, 
          referredByCode: referralCodeToUse,
          squadInviteIdFromUrl: squadInviteIdFromUrl 
        }),
      });
      const data = await response.json();
      if (response.ok) {
        const userFromResponse = data.user || data;
        setOtherUserData({
            referralCode: userFromResponse.referralCode,
            completedActions: userFromResponse.completedActions,
            xUsername: userFromResponse.xUsername,
            squadId: userFromResponse.squadId,
        });
        setIsRewardsActive(true);
        toast.success("Rewards account activated!");
        
        // Fetch additional data
        if (connectedWalletAddress) {
          fetchMySquadData(connectedWalletAddress);
          fetchPendingInvites();
        }
        if (wallet.publicKey && connection) {
          checkDefaiBalance(wallet.publicKey, connection);
        }
      } else {
        console.error("[activateRewardsAndFetchData] API error", data);
        toast.error(data.error || "Failed to activate rewards account");
        setIsRewardsActive(false);
        setOtherUserData({});
      }
    } catch (error) {
      console.error("[activateRewardsAndFetchData] Exception", error);
      toast.error("An error occurred while activating your account");
      setIsRewardsActive(false);
      setOtherUserData({});
    }
    setIsActivatingRewards(false);
  }, [initialReferrer, squadInviteIdFromUrl, fetchMySquadData, fetchPendingInvites, checkDefaiBalance, wallet.publicKey, connection, isActivatingRewards, activationAttempted]);

  // PRODUCTION-SAFE: Main authentication and wallet connection handler
  useEffect(() => {
    // Wait for hydration in production
    if (!isHydrated) return;
    
    const handleWalletAuth = async () => {
      // Create a unique key for this auth check to prevent duplicate calls
      const authCheckKey = `${authStatus}-${wallet.connected}-${!!wallet.publicKey}-${!!session?.user?.walletAddress}-${isRewardsActive}-${activationAttempted}-${isWalletSigningIn}-${walletSignInAttempted}`;
      
      // Prevent duplicate auth checks
      if (lastAuthCheckRef.current === authCheckKey) {
        return;
      }
      lastAuthCheckRef.current = authCheckKey;
      
      console.log('[useHomePageLogic] Auth check:', authCheckKey);
      
      // Case 1: Wallet connected but not authenticated - sign in
      if (wallet.connected && wallet.publicKey && authStatus !== "authenticated" && !isWalletSigningIn && !walletSignInAttempted) {
        console.log('[useHomePageLogic] Starting wallet sign-in...');
        setIsWalletSigningIn(true);
        setWalletSignInAttempted(true);
        
        try {
          const result = await signIn('wallet', { 
            walletAddress: wallet.publicKey.toBase58(), 
            chain: "solana", 
            redirect: false,
            callbackUrl: window.location.pathname
          });
          
          if (result?.error) {
            console.error('[useHomePageLogic] Sign-in error:', result.error);
            toast.error(`Authentication failed: ${result.error}`);
            setWalletSignInAttempted(false);
          } else if (result?.ok) {
            console.log('[useHomePageLogic] Sign-in successful');
            // In production, force a hard reload for session consistency
            setTimeout(() => {
              if (typeof window !== 'undefined') {
                window.location.href = window.location.pathname;
              }
            }, 1000); // Longer delay for production
          }
        } catch (err) {
          console.error('[useHomePageLogic] Sign-in exception:', err);
          toast.error('Failed to authenticate wallet. Please try again.');
          setWalletSignInAttempted(false);
        }
        setIsWalletSigningIn(false);
        return;
      }

      // Case 2: Authenticated but wallet not in session - link wallet
      if (authStatus === "authenticated" && wallet.connected && wallet.publicKey && !session?.user?.walletAddress && !isActivatingRewards) {
        console.log('[useHomePageLogic] Linking wallet to session...');
        await handleWalletConnectSuccess();
        return;
      }

      // Case 3: Authenticated with wallet in session but rewards not active - activate rewards
      if (authStatus === "authenticated" && session?.user?.walletAddress && wallet.connected && wallet.publicKey && !isRewardsActive && !isActivatingRewards && !activationAttempted) {
        console.log('[useHomePageLogic] Activating rewards...');
        await activateRewardsAndFetchData(
          wallet.publicKey.toBase58(),
          session.user.xId || null,
          session.user.dbId
        );
        return;
      }

      // Case 4: Everything ready, check DeFAI balance if needed
      if (authStatus === "authenticated" && wallet.connected && wallet.publicKey && isRewardsActive && hasSufficientDefai === null && !isCheckingDefaiBalance) {
        console.log('[useHomePageLogic] Checking DeFAI balance...');
        checkDefaiBalance(wallet.publicKey, connection);
        return;
      }

      // Case 5: Fetch pending invites for authenticated users with X auth
      if (authStatus === "authenticated" && wallet.connected && session?.user?.xId && isRewardsActive && !isFetchingInvites && pendingInvites.length === 0) {
        console.log('[useHomePageLogic] Fetching pending invites...');
        fetchPendingInvites();
        return;
      }
    };

    // Debounce the auth handler in production
    const timeoutId = setTimeout(handleWalletAuth, process.env.NODE_ENV === 'production' ? 300 : 0);
    return () => clearTimeout(timeoutId);
  }, [
    isHydrated,
    authStatus,
    wallet.connected,
    wallet.publicKey,
    session?.user?.walletAddress,
    session?.user?.xId,
    session?.user?.dbId,
    isRewardsActive,
    isActivatingRewards,
    activationAttempted,
    isWalletSigningIn,
    walletSignInAttempted,
    hasSufficientDefai,
    isCheckingDefaiBalance,
    isFetchingInvites,
    pendingInvites.length,
    handleWalletConnectSuccess,
    activateRewardsAndFetchData,
    checkDefaiBalance,
    fetchPendingInvites,
    connection
  ]);

  // Reset state when wallet disconnects
  useEffect(() => {
    if (!wallet.connected) {
      setWalletSignInAttempted(false);
      setPrevWalletAddress(null);
      setActivationAttempted(false);
      setIsRewardsActive(false);
      setOtherUserData({});
      setMySquadData(null);
      setUserCheckedNoSquad(false);
      setHasSufficientDefai(null);
      setPendingInvites([]);
      setDefaiBalance(null);
      lastAuthCheckRef.current = '';
    }
  }, [wallet.connected]);

  // Handle wallet address changes
  useEffect(() => {
    const currentAddress = wallet.publicKey ? wallet.publicKey.toBase58() : null;
    if (currentAddress && currentAddress !== prevWalletAddress) {
      console.log('[useHomePageLogic] Wallet address changed, resetting state');
      setPrevWalletAddress(currentAddress);
      setUserCheckedNoSquad(false);
      setActivationAttempted(false);
      setIsRewardsActive(false);
      setOtherUserData({});
      setMySquadData(null);
      setHasSufficientDefai(null);
      setPendingInvites([]);
      setWalletSignInAttempted(false);
      lastAuthCheckRef.current = '';
    }
  }, [wallet.publicKey, prevWalletAddress]);

  // Initialize URL parameters (only once)
  useEffect(() => {
    if (!isInitializedRef.current) return;
    
    const urlParams = new URLSearchParams(window.location.search);
    const refCode = urlParams.get('ref');
    if (refCode) {
       localStorage.setItem('referralCode', refCode);
       setInitialReferrer(refCode);
    } else {
       const savedRefCode = localStorage.getItem('referralCode');
       if (savedRefCode) setInitialReferrer(savedRefCode);
    }
    const squadInviteParam = urlParams.get('squadInvite');
    if (squadInviteParam) {
      setSquadInviteIdFromUrl(squadInviteParam);
    }
  }, [isHydrated]);

  // Fetch user details when authenticated (debounced)
  useEffect(() => {
    if (authStatus !== 'authenticated' || userDetailsFetched || !isHydrated) return;
    
    const timeoutId = setTimeout(async () => {
      try {
        const res = await fetch('/api/users/my-details');
        const data = await res.json();
        if (res.ok) {
          setOtherUserData(prev => ({
            ...prev,
            referralCode: data.referralCode ?? prev.referralCode,
            completedActions: data.completedActions ?? prev.completedActions,
            xUsername: data.xUsername ?? prev.xUsername,
            squadId: data.squadId ?? prev.squadId,
          }));
          setUserDetailsFetched(true);
        }
      } catch (e) {
        console.warn('[useHomePageLogic] Unable to fetch my-details:', e);
      }
    }, 500);
    
    return () => clearTimeout(timeoutId);
  }, [authStatus, userDetailsFetched, isHydrated]);

  // Check environment variables (debounced)
  useEffect(() => {
    if (!isHydrated) return;
    
    const timeoutId = setTimeout(() => {
      if (envVars && !isEnvLoading) {
        try {
          checkRequiredEnvVars(envVars);
        } catch (e) {
          console.warn('[useHomePageLogic] Environment variable check failed:', e);
        }
      } else if (envError) {
        console.error('[useHomePageLogic] Failed to load environment variables:', envError);
      }
    }, 1000);
    
    return () => clearTimeout(timeoutId);
  }, [envVars, isEnvLoading, envError, isHydrated]);

  // Initialize desktop detection
  useEffect(() => {
    if (!isHydrated) return;
    
    const checkDesktop = () => setIsDesktop(window.innerWidth >= 1024);
    checkDesktop();
    window.addEventListener('resize', checkDesktop);
    return () => window.removeEventListener('resize', checkDesktop);
  }, [isHydrated]);

  // Fetch total community points (debounced)
  useEffect(() => {
    if (!isHydrated) return;
    
    const timeoutId = setTimeout(() => {
      fetch('/api/stats/total-points')
        .then(async res => {
          if (!res.ok) throw new Error('Network error fetching total points');
          return res.json();
        })
        .then(data => {
          if (data.totalCommunityPoints !== undefined && data.totalCommunityPoints !== null) {
            setTotalCommunityPoints(data.totalCommunityPoints);
          } else {
            setTotalCommunityPoints(0);
          }
        })
        .catch(err => {
          console.error("Failed to fetch total community points for dashboard", err);
          setTotalCommunityPoints(0);
        });
    }, 1500);
    
    return () => clearTimeout(timeoutId);
  }, [isHydrated]);

  const handleFullLogout = useCallback(async () => {
    toast.info("Signing out and disconnecting wallet...");
    if (wallet.connected) {
      try {
        await wallet.disconnect();
      } catch (e) {
        console.error("[handleFullLogout] Error disconnecting wallet:", e);
      }
    }
    try {
      await nextAuthSignOut({ redirect: false, callbackUrl: '/' }); 
      // Reset all state
      setOtherUserData({}); 
      setMySquadData(null);
      setUserCheckedNoSquad(false);
      setHasSufficientDefai(null);
      setPendingInvites([]);
      setDefaiBalance(null); 
      setIsRewardsActive(false); 
      setActivationAttempted(false); 
      setWalletSignInAttempted(false);
      setUserDetailsFetched(false);
      lastAuthCheckRef.current = '';
      sessionStorage.setItem('logoutInProgress', 'true');
      window.location.href = '/';
    } catch (e) {
      console.error("[handleFullLogout] Error during signOut:", e);
      toast.error("Error signing out.");
      if (window.location.pathname !== '/') {
        window.location.href = '/';
      }
    }
  }, [wallet]);

  // Auto-prompt wallet modal after authentication (debounced)
  useEffect(() => {
    if (!isHydrated) return;
    
    const timeoutId = setTimeout(() => {
      const wasLoggingOut = sessionStorage.getItem('logoutInProgress') === 'true';
      if (wasLoggingOut) {
        sessionStorage.removeItem('logoutInProgress');
        if (typeof setWalletModalVisible === 'function') { 
          setWalletModalVisible(false); 
        }
        walletPromptedRef.current = true; 
        return; 
      }
      
      if (authStatus === "authenticated" && !wallet.connected && !wallet.connecting && !walletPromptedRef.current) {
        walletPromptedRef.current = true;
        if (typeof setWalletModalVisible === 'function') { 
          setTimeout(() => setWalletModalVisible(true), 100); 
        }
      }
      
      if (wallet.connected) {
        walletPromptedRef.current = false;
      } else if (authStatus === "unauthenticated" && !wasLoggingOut) { 
        walletPromptedRef.current = false;
      }
    }, 200);
    
    return () => clearTimeout(timeoutId);
  }, [authStatus, wallet.connected, wallet.connecting, setWalletModalVisible, isHydrated]);

  // Periodic points polling for active users (reduced frequency in production)
  useEffect(() => {
    if (!isHydrated) return;
    
    let intervalId: any;
    if (authStatus === 'authenticated' && isRewardsActive) {
      const fetchLatestPoints = async () => {
        try {
          const res = await fetch('/api/users/my-details');
          const data = await res.json();
          if (res.ok && typeof data.points === 'number') {
            setOtherUserData(prev => ({ ...prev, points: data.points }));
          }
        } catch (e) {
          console.warn('[useHomePageLogic] points polling failed', e);
        }
      };
      
      // Initial fetch after delay
      setTimeout(fetchLatestPoints, 2000);
      // Longer polling interval in production
      const pollingInterval = process.env.NODE_ENV === 'production' ? 60000 : 30000;
      intervalId = setInterval(fetchLatestPoints, pollingInterval);
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [authStatus, isRewardsActive, isHydrated]);

  // Production safety: Don't return data until hydrated
  if (!isHydrated) {
    return {
      session: null,
      authStatus: 'loading',
      wallet,
      connection,
      userAirdropData: { points: null, initialDefai: null, totalDefai: null, isLoading: true },
      userData: {},
      typedAddress: '',
      setTypedAddress: () => {},
      airdropCheckResultForTyped: null,
      setAirdropCheckResult: () => {},
      isCheckingAirdrop: false,
      setIsCheckingAirdrop: () => {},
      isRewardsActive: false,
      isActivatingRewards: false,
      setOtherUserData: () => {},
      mySquadData: null,
      isFetchingSquad: false,
      userCheckedNoSquad: false,
      initialReferrer: null,
      pendingInvites: [],
      isFetchingInvites: false,
      isProcessingInvite: null,
      setIsProcessingInvite: () => {},
      squadInviteIdFromUrl: null,
      setSquadInviteIdFromUrl: () => {},
      currentTotalAirdropForSharing: 0,
      setCurrentTotalAirdropForSharing: () => {},
      isCheckingDefaiBalance: false,
      hasSufficientDefai: null,
      setHasSufficientDefai: () => {},
      showWelcomeModal: false,
      setShowWelcomeModal: () => {},
      isProcessingLinkInvite: false,
      setIsProcessingLinkInvite: () => {},
      activationAttempted: false,
      isDesktop: false,
      setIsDesktop: () => {},
      totalCommunityPoints: null,
      setTotalCommunityPoints: () => {},
      defaiBalance: null,
      setDefaiBalance: () => {},
      handleWalletConnectSuccess: () => {},
      fetchMySquadData: () => {},
      fetchPendingInvites: () => {},
      checkDefaiBalance: () => {},
      activateRewardsAndFetchData: () => {},
      handleFullLogout: () => {},
    };
  }

  return {
    session,
    authStatus,
    wallet,
    connection,
    userAirdropData: userAirdrop,
    userData: combinedUserData,
    typedAddress,
    setTypedAddress,
    airdropCheckResultForTyped,
    setAirdropCheckResult: setAirdropCheckResultForTyped,
    isCheckingAirdrop: isCheckingAirdropForTyped,
    setIsCheckingAirdrop: setIsCheckingAirdropForTyped,
    isRewardsActive,
    isActivatingRewards,
    setOtherUserData,
    mySquadData,
    isFetchingSquad,
    userCheckedNoSquad,
    initialReferrer,
    pendingInvites,
    isFetchingInvites,
    isProcessingInvite,
    setIsProcessingInvite,
    squadInviteIdFromUrl,
    setSquadInviteIdFromUrl,
    currentTotalAirdropForSharing,
    setCurrentTotalAirdropForSharing,
    isCheckingDefaiBalance,
    hasSufficientDefai,
    setHasSufficientDefai,
    showWelcomeModal,
    setShowWelcomeModal,
    isProcessingLinkInvite,
    setIsProcessingLinkInvite,
    activationAttempted,
    isDesktop,
    setIsDesktop,
    totalCommunityPoints,
    setTotalCommunityPoints,
    defaiBalance,
    setDefaiBalance,
    handleWalletConnectSuccess,
    fetchMySquadData,
    fetchPendingInvites,
    checkDefaiBalance,
    activateRewardsAndFetchData,
    handleFullLogout,
  };
} 