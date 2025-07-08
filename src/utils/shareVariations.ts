export interface ShareCopyVariation {
  airdropTemplate: string;
  profileTemplate: string;
}

const shareCopyVariations: ShareCopyVariation[] = [
  {
    airdropTemplate: `I'm getting {amount} $DEFAI from @{handle} in the migration! 🚀 My referral link: {url} \nGet ready for DEFAI SUMMER - buy $DeFAI now! #DeFAIRewards #TGE #AI #Solana`,
    profileTemplate: `Check out my DeFAI Rewards profile! {username} | {points} points{tier} | @{handle}`
  },
  {
    airdropTemplate: `Just secured {amount} $DEFAI tokens in the @{handle} migration! 🔥 Join through my link: {url} \nDeFAI SUMMER is coming - don't miss out! #DeFAIRewards #TGE #AI #Solana`,
    profileTemplate: `My @{handle} journey so far: {username} | Earned {points} points{tier} | Building the future of AI agents!`
  },
  {
    airdropTemplate: `Migration confirmed: {amount} $DEFAI incoming! 💎 @{handle} is revolutionizing AI agents. \nJoin me: {url} \nPrepare for DEFAI SUMMER! #DeFAIRewards #TGE #AI #Solana`,
    profileTemplate: `Proud member of the DeFAI community! {username} | {points} points earned{tier} | @{handle}`
  },
  {
    airdropTemplate: `Claiming {amount} $DEFAI in the @{handle} migration! 🎯 The future of AI is here. \nGet yours: {url} \nDeFAI SUMMER loading... #DeFAIRewards #TGE #AI #Solana`,
    profileTemplate: `DeFAI Rewards stats: {username} | {points} points accumulated{tier} | Join the revolution @{handle}`
  },
  {
    airdropTemplate: `{amount} $DEFAI secured through @{handle}! 🌟 AI agents are the future. \nDon't miss out: {url} \nDeFAI SUMMER approaching fast! #DeFAIRewards #TGE #AI #Solana`,
    profileTemplate: `My DeFAI achievements: {username} | Total: {points} points{tier} | Powered by @{handle}`
  }
];

export function getRandomShareCopy(): ShareCopyVariation {
  const randomIndex = Math.floor(Math.random() * shareCopyVariations.length);
  return shareCopyVariations[randomIndex];
}

export function formatAirdropShareText(
  template: string,
  amount: string,
  handle: string,
  url: string
): string {
  return template
    .replace('{amount}', amount)
    .replace('{handle}', handle)
    .replace('{url}', url);
}

export function formatProfileShareText(
  template: string,
  username: string,
  points: string,
  tier: string,
  handle: string
): string {
  return template
    .replace('{username}', username)
    .replace('{points}', points)
    .replace('{tier}', tier)
    .replace('{handle}', handle);
}