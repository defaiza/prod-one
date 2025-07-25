"use client";

import { useSession } from "next-auth/react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useEffect, useState } from "react";

export default function DebugAuthPage() {
  const { data: session, status, update } = useSession();
  const wallet = useWallet();
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (message: string) => {
    const timestamp = new Date().toISOString();
    setLogs(prev => [...prev, `[${timestamp}] ${message}`]);
    console.log(`[Debug Auth] ${message}`);
  };

  useEffect(() => {
    addLog(`Auth status: ${status}`);
    addLog(`Session exists: ${!!session}`);
    addLog(`Session user: ${JSON.stringify(session?.user)}`);
  }, [status, session]);

  useEffect(() => {
    addLog(`Wallet connected: ${wallet.connected}`);
    addLog(`Wallet address: ${wallet.publicKey?.toBase58() || 'none'}`);
  }, [wallet.connected, wallet.publicKey]);

  const handleRefreshSession = async () => {
    addLog('Refreshing session...');
    try {
      await update();
      addLog('Session refreshed');
    } catch (error) {
      addLog(`Error refreshing session: ${error}`);
    }
  };

  return (
    <div className="min-h-screen p-8 bg-gray-50">
      <h1 className="text-2xl font-bold mb-6">Authentication Debug Page</h1>
      
      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Session Info</h2>
          <div className="space-y-2 text-sm">
            <p><strong>Status:</strong> {status}</p>
            <p><strong>Session ID:</strong> {session?.user?.id || 'none'}</p>
            <p><strong>Wallet in Session:</strong> {session?.user?.walletAddress || 'none'}</p>
            <p><strong>X ID:</strong> {session?.user?.xId || 'none'}</p>
            <p><strong>Role:</strong> {session?.user?.role || 'none'}</p>
          </div>
          <button 
            onClick={handleRefreshSession}
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Refresh Session
          </button>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Wallet Info</h2>
          <div className="space-y-2 text-sm">
            <p><strong>Connected:</strong> {wallet.connected ? 'Yes' : 'No'}</p>
            <p><strong>Address:</strong> {wallet.publicKey?.toBase58() || 'none'}</p>
            <p><strong>Wallet Name:</strong> {wallet.wallet?.adapter.name || 'none'}</p>
            <p><strong>Connecting:</strong> {wallet.connecting ? 'Yes' : 'No'}</p>
          </div>
          <div className="mt-4">
            <WalletMultiButton />
          </div>
        </div>
      </div>

      <div className="mt-6 bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4">Debug Logs</h2>
        <div className="bg-gray-100 p-4 rounded max-h-96 overflow-y-auto">
          {logs.length === 0 ? (
            <p className="text-gray-500">No logs yet...</p>
          ) : (
            logs.map((log, index) => (
              <p key={index} className="text-xs font-mono mb-1">{log}</p>
            ))
          )}
        </div>
      </div>

      <div className="mt-6 bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4">Full Session Data</h2>
        <pre className="bg-gray-100 p-4 rounded overflow-x-auto text-xs">
          {JSON.stringify(session, null, 2)}
        </pre>
      </div>
    </div>
  );
} 