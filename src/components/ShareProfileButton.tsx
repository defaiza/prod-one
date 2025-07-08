'use client';

import React, { useState } from 'react';
import { toast } from 'sonner';
import { getRandomShareCopy, formatProfileShareText } from '@/utils/shareVariations';

interface ShareProfileButtonProps {
  walletAddress: string;
  username?: string;
  points: number;
  airdropTier?: string;
}

const ShareProfileButton: React.FC<ShareProfileButtonProps> = ({
  walletAddress,
  username,
  points,
  airdropTier
}) => {
  const [isOpen, setIsOpen] = useState(false);
  
  const profileUrl = typeof window !== 'undefined' 
    ? `${window.location.origin}/profile/${walletAddress}`
    : `/profile/${walletAddress}`;
  
  const handleCopyLink = () => {
    navigator.clipboard.writeText(profileUrl).then(() => {
      toast.success("Profile link copied to clipboard!");
      setIsOpen(false);
    }).catch(err => {
      toast.error("Failed to copy link.");
    });
  };
  
  const shareToTwitter = () => {
    // Get random share copy
    const shareCopy = getRandomShareCopy();
    const shareText = formatProfileShareText(
      shareCopy.profileTemplate,
      username ? `@${username}` : '',
      points.toLocaleString(),
      airdropTier ? ` | ${airdropTier} tier` : '',
      'DeFAIRewards'
    );
    
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(profileUrl)}`;
    window.open(twitterUrl, '_blank');
    setIsOpen(false);
  };
  
  const shareToTelegram = () => {
    // Get random share copy for Telegram too
    const shareCopy = getRandomShareCopy();
    const shareText = formatProfileShareText(
      shareCopy.profileTemplate,
      username ? `@${username}` : '',
      points.toLocaleString(),
      airdropTier ? ` | ${airdropTier} tier` : '',
      'DeFAIRewards'
    );
    
    const telegramUrl = `https://t.me/share/url?url=${encodeURIComponent(profileUrl)}&text=${encodeURIComponent(shareText)}`;
    window.open(telegramUrl, '_blank');
    setIsOpen(false);
  };
  
  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2.5 px-5 rounded-lg shadow-md hover:shadow-lg transform hover:scale-105 transition-all duration-150 ease-in-out"
      >
        🔗 Share Profile
      </button>
      
      {isOpen && (
        <div className="absolute bottom-full left-0 mb-2 w-48 bg-gray-800 rounded-lg shadow-xl border border-gray-700 p-2 z-50">
          <button 
            onClick={handleCopyLink}
            className="w-full text-left px-4 py-2 text-sm text-white hover:bg-gray-700 rounded transition-colors"
          >
            📋 Copy Link
          </button>
          <button 
            onClick={shareToTwitter}
            className="w-full text-left px-4 py-2 text-sm text-white hover:bg-gray-700 rounded transition-colors"
          >
            𝕏 Share on X/Twitter
          </button>
          <button 
            onClick={shareToTelegram}
            className="w-full text-left px-4 py-2 text-sm text-white hover:bg-gray-700 rounded transition-colors"
          >
            ✈️ Share on Telegram
          </button>
        </div>
      )}
    </div>
  );
};

export default ShareProfileButton; 