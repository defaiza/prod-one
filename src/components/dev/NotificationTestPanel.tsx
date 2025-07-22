'use client';

import { useSession } from 'next-auth/react';
import { toast } from 'sonner';
import { NotificationType } from '@/lib/mongodb'; // For typing handleSendTestNotification
import { useState } from 'react'; // Import useState for input field

// Define an interface for the mockData if it becomes more complex
interface MockData {
  mockSquadName?: string;
  mockRelatedUserName?: string;
  mockBadgeName?: string;
  // Add other mock data keys as needed
}

export default function NotificationTestPanel() {
  const { data: session, status: authStatus, update: updateNextAuthSession } = useSession();
  const [pointsToAward, setPointsToAward] = useState<string>("100000"); // State for points input

  const handleSendTestNotification = async (type: NotificationType = 'generic', mockData: MockData = {}) => {
    let toastMessage = "Sending generic test notification...";
    if (type !== 'generic') {
      toastMessage = `Sending test notification for type: ${type}...`;
    }
    toast.info(toastMessage);

    try {
      const endpoint = type === 'generic' ? '/api/dev/test-notification' : '/api/dev/trigger-specific-notification';
      // For generic, body is empty; for specific, it includes notificationType and mockData
      const body = type === 'generic' ? {} : { notificationType: type, ...mockData };
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await response.json();

      if (response.ok) {
        toast.success(data.message || "Test notification sent!");
      } else {
        toast.error(data.error || "Failed to send test notification.");
      }
    } catch (error) {
      toast.error("Error sending test notification.");
      console.error("Test notification error:", error);
    }
  };

  const handleAwardTestPoints = async () => {
    const amount = parseInt(pointsToAward, 10);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Please enter a valid positive number for points.");
      return;
    }
    toast.info(`Awarding ${amount} test points...`);
    try {
      const response = await fetch('/api/dev/award-test-points', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount }),
      });
      const data = await response.json();
      if (response.ok) {
        toast.success(data.message || "Test points awarded!");
        // Attempt to refresh the NextAuth session to get updated user data (like points)
        await updateNextAuthSession(); 
      } else {
        toast.error(data.error || "Failed to award test points.");
      }
    } catch (error) {
      toast.error("Error awarding test points.");
      console.error("Test points award error:", error);
    }
  };

  // Render nothing if not authenticated (buttons are meant for logged-in dev testing)
  if (authStatus !== 'authenticated') {
    return null;
  }

  return (
    <div className="my-4 p-4 bg-yellow-100 border border-yellow-300 rounded-lg shadow-lg space-y-3 max-w-md mx-auto">
      <h3 className="text-lg font-semibold text-yellow-800 text-center mb-2">Dev: Tools Panel</h3>
      
      {/* Points Awarder */}
      <div className="p-3 border-t border-yellow-400/50 mt-3 pt-3">
        <h4 className="text-md font-semibold text-yellow-700 mb-1.5 text-center">Award Test Points</h4>
        <div className="flex items-center space-x-2">
          <input 
            type="number"
            value={pointsToAward}
            onChange={(e) => setPointsToAward(e.target.value)}
            placeholder="Amount (e.g., 100000)"
            className="w-full px-3 py-1.5 border border-yellow-500 rounded-md shadow-sm focus:ring-yellow-600 focus:border-yellow-600 text-sm"
          />
          <button
            onClick={handleAwardTestPoints}
            className="px-4 py-1.5 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-md transition-colors text-sm whitespace-nowrap"
          >
            Award Points
          </button>
        </div>
        <p className='text-xs text-yellow-700 mt-1 text-center'>Adds specified points to your account.</p>
      </div>

      <div className="border-t border-yellow-400/50 mt-3 pt-3">
        <h4 className="text-md font-semibold text-yellow-700 mb-1.5 text-center">Trigger Test Notifications</h4>
        {/* Generic Test Button */}
        <div>
          <button 
            onClick={() => handleSendTestNotification('generic')}
            className="w-full px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white font-semibold rounded-md transition-colors"
          >
            Send Generic Test Notification
          </button>
          <p className='text-xs text-yellow-700 mt-1 text-center'>Sends a basic notification.</p>
        </div>

        {/* Squad Invite */}
        <div>
          <button 
            onClick={() => handleSendTestNotification('squad_invite_received', { mockSquadName: 'The Testers', mockRelatedUserName: 'InvitingBot' })}
            className="w-full px-4 py-2 bg-teal-500 hover:bg-teal-600 text-white font-semibold rounded-md transition-colors"
          >
            Test: Receive Squad Invite
          </button>
          <p className='text-xs text-teal-700 mt-1 text-center'>Simulates you receiving a squad invitation.</p>
        </div>

        {/* Badge Earned */}
        <div>
          <button 
            onClick={() => handleSendTestNotification('badge_earned', { mockBadgeName: 'Test Pilot Badge' })}
            className="w-full px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white font-semibold rounded-md transition-colors"
          >
            Test: Earn a Badge
          </button>
          <p className='text-xs text-indigo-700 mt-1 text-center'>Simulates you earning a new badge.</p>
        </div>

        {/* Referral Success */}
        <div>
          <button 
            onClick={() => handleSendTestNotification('referral_success', { mockRelatedUserName: 'ReferredPal' })}
            className="w-full px-4 py-2 bg-pink-500 hover:bg-pink-600 text-white font-semibold rounded-md transition-colors"
          >
            Test: Referral Success (You Referred)
          </button>
          <p className='text-xs text-pink-700 mt-1 text-center'>Simulates you successfully referring a friend.</p>
        </div>

        {/* Quest Reward */}
        <div>
          <button 
            onClick={() => handleSendTestNotification('quest_reward_received', { mockRelatedUserName: 'Epic Quest Completion', mockSquadName: 'Legendary Loot +5000XP' })}
            className="w-full px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white font-semibold rounded-md transition-colors"
          >
            Test: Quest Reward Received
          </button>
          <p className='text-xs text-purple-700 mt-1 text-center'>Simulates you receiving a quest reward.</p>
        </div>
      </div>
    </div>
  );
} 