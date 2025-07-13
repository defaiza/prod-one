# DeFAI Rewards Platform

A comprehensive user engagement and rewards platform built on Solana blockchain, featuring social media integration, squad-based governance, and token reward distribution.

![Platform Overview](./template-image.jpg)

## Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Running the Application](#running-the-application)
- [Project Structure](#project-structure)
- [Core Features Documentation](#core-features-documentation)
- [API Documentation](#api-documentation)
- [Testing](#testing)
- [Deployment](#deployment)
- [Contributing](#contributing)
- [Troubleshooting](#troubleshooting)
- [License](#license)

## Overview

DeFAI Rewards is a cutting-edge platform that combines social engagement, blockchain technology, and community governance to create a comprehensive rewards ecosystem. Users can earn points through various activities, participate in squad-based governance, and receive token rewards based on their contributions.

### Core Value Propositions

- **Social Engagement Rewards**: Earn points for X (Twitter) activities and referrals
- **Squad-Based Governance**: Create and join squads to participate in collective decision-making
- **Token Distribution**: Fair and transparent token reward system with proposal voting
- **Blockchain Integration**: Built on Solana for fast, low-cost transactions
- **Real-time Notifications**: Stay updated with WebSocket-powered notifications

## Key Features

### User Management & Authentication
- **X (Twitter) OAuth Integration**: Secure authentication using social accounts
- **Multi-Wallet Support**: Connect and manage multiple Solana wallets
- **Profile Management**: Customizable user profiles with social links

### Points & Rewards System
- **Multi-Action Point System**: Earn points for:
  - Initial platform connection
  - Social media engagement
  - Following official accounts
  - Successful referrals
  - Daily check-ins
  - Quest completion
- **Dynamic Leaderboard**: Real-time ranking system
- **Airdrop Eligibility**: Automatic calculation based on activity

### Squad System
- **Squad Creation**: Form teams with up to 100 members
- **Tiered Progression**: Three tiers based on collective points
- **Squad Governance**: Leaders can create proposals for token distribution
- **Invitation System**: Private invite links with expiration

### Proposal & Voting System
- **Democratic Voting**: Weight-based voting system
- **Proposal Lifecycle**: Active → Closed → Archived workflow
- **Real-time Progress**: Visual indicators for quorum and approval
- **Automated Processing**: Cron jobs for proposal execution

### Blockchain Features
- **Token Escrow**: Secure token holding and distribution
- **NFT Integration**: Support for Core NFT assets
- **Crossmint Integration**: Simplified wallet creation and management
- **Multi-RPC Support**: Fallback RPC endpoints for reliability

## Tech Stack

### Frontend
- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: Shadcn/ui
- **State Management**: Zustand
- **Form Handling**: React Hook Form with Zod validation

### Backend
- **API**: Next.js API Routes
- **Authentication**: NextAuth.js
- **Database**: MongoDB with Mongoose ODM
- **Real-time**: Server-Sent Events (SSE)
- **Queue System**: RabbitMQ (optional)
- **Caching**: Redis

### Blockchain
- **Network**: Solana
- **Wallet Integration**: Solana Wallet Adapter
- **NFT Standard**: Metaplex
- **Smart Contracts**: Anchor Framework

### Infrastructure
- **Deployment**: Vercel/AWS/Docker
- **CDN**: Fleek for decentralized storage
- **Monitoring**: OpenTelemetry
- **Analytics**: Custom event tracking

## Prerequisites

- Node.js v18.x or later
- npm/yarn/pnpm package manager
- MongoDB instance (local or Atlas)
- Solana wallet for testing
- X (Twitter) Developer Account

## Installation

1. **Clone the repository**
```bash
git clone https://github.com/defai/tokenEscrowFE.git
cd tokenEscrowFE
```

2. **Install dependencies**
```bash
npm install
# or
yarn install
# or
pnpm install
```

3. **Setup environment variables**
```bash
cp .env.example .env.local
```

4. **Configure MongoDB indexes**
```javascript
// Connect to your MongoDB instance and run:
use defaiaffiliate;
db.users.createIndex({ xUserId: 1 }, { unique: true, sparse: true });
db.users.createIndex({ walletAddress: 1 }, { unique: true, sparse: true });
db.users.createIndex({ referralCode: 1 }, { unique: true, sparse: true });
db.squads.createIndex({ name: 1 }, { unique: true });
db.proposals.createIndex({ squadId: 1, status: 1 });
```

## Configuration

### Essential Environment Variables

Create a `.env.local` file with the following variables:

```bash
# Database Configuration
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/?retryWrites=true&w=majority
MONGODB_DB_NAME=defaiaffiliate

# Authentication
NEXTAUTH_SECRET=your-secret-key # Generate: openssl rand -base64 32
NEXTAUTH_URL=http://localhost:3000

# X (Twitter) OAuth
X_CLIENT_ID=your-x-client-id
X_CLIENT_SECRET=your-x-client-secret
X_CALLBACK_URL=http://localhost:3000/api/x/connect/callback
X_TOKEN_ENCRYPTION_KEY=32-byte-hex-string # Generate: openssl rand -hex 32
DEFAI_REWARDS_X_USER_ID=twitter-user-id # Get from tweeterid.com

# Solana Configuration
NEXT_PUBLIC_RPC=https://api.mainnet-beta.solana.com
NEXT_PUBLIC_SOLANA_NETWORK=mainnet-beta
NEXT_PUBLIC_DEFAI_TOKEN_MINT_ADDRESS=token-mint-address
NEXT_PUBLIC_DEFAI_TOKEN_DECIMALS=6

# Crossmint Integration
NEXT_PUBLIC_CROSSMINT_CLIENT_SIDE=your-client-key
NEXT_PUBLIC_CROSSMINT_API_KEY=your-api-key
CROSSMINT_AUDIENCE=your-audience-id

# Redis Configuration (Optional)
REDIS_URL=redis://localhost:6379

# Admin Configuration
ADMIN_X_IDS=comma,separated,handles
ADMIN_WALLET_ADDRESSES=comma,separated,addresses

# Feature Flags
NEXT_PUBLIC_MIN_DEFAI_BALANCE=100
NEXT_PUBLIC_REQUIRED_DEFAI_AMOUNT=5000
```

### Proposal System Configuration

```bash
# Frontend Settings
NEXT_PUBLIC_SQUAD_POINTS_TO_CREATE_PROPOSAL=10000
NEXT_PUBLIC_MIN_POINTS_TO_VOTE=500
NEXT_PUBLIC_PROPOSAL_BROADCAST_THRESHOLD=1000
NEXT_PUBLIC_PROPOSALS_PER_PAGE=10

# Backend/Cron Settings
CRON_PROPOSAL_PASS_THRESHOLD=0
CRON_PROPOSAL_ARCHIVE_DELAY_DAYS=7
CRON_SECRET=your-cron-secret
```

## Running the Application

### Development Mode
```bash
npm run dev
# Application runs on http://localhost:3000
```

### Production Build
```bash
npm run build
npm run start
```

### Run with Docker
```bash
docker build -t defai-rewards .
docker run -p 3000:3000 --env-file .env.local defai-rewards
```

## Project Structure

```
tokenEscrowFE/
├── src/
│   ├── app/                    # Next.js 14 App Router pages
│   │   ├── api/               # API routes
│   │   ├── admin/             # Admin dashboard pages
│   │   ├── profile/           # User profile pages
│   │   ├── squads/            # Squad management pages
│   │   └── proposals/         # Proposal voting pages
│   ├── components/            # React components
│   │   ├── layout/           # Layout components
│   │   ├── proposals/        # Proposal-specific components
│   │   ├── squads/           # Squad-specific components
│   │   └── ui/               # Shadcn UI components
│   ├── lib/                   # Core libraries and utilities
│   │   ├── auth.ts           # NextAuth configuration
│   │   ├── mongodb.ts        # Database connection
│   │   └── encryption.ts     # Token encryption utilities
│   ├── hooks/                # Custom React hooks
│   ├── store/                # Zustand state management
│   ├── types/                # TypeScript type definitions
│   └── utils/                # Utility functions
├── scripts/                   # Utility scripts
│   ├── cron/                 # Cron job scripts
│   └── migration/            # Database migration scripts
├── public/                    # Static assets
├── tests/                     # Test files
│   ├── e2e/                  # End-to-end tests
│   └── unit/                 # Unit tests
└── docs/                      # Additional documentation
```

## Core Features Documentation

### Authentication Flow
1. User clicks "Connect with X"
2. OAuth redirect to Twitter
3. Callback handles token exchange
4. User session created with NextAuth
5. MongoDB user record created/updated

### Points Calculation
- Initial connection: 100 points
- Social share: 50 points
- Follow @defAIRewards: 200 points
- Successful referral: 500 points
- Daily check-in: 10 points
- Quest completion: Variable

### Squad Tiers
- **Tier 1**: 1,000 points, max 10 members
- **Tier 2**: 5,000 points, max 50 members
- **Tier 3**: 10,000 points, max 100 members

### Proposal Voting
- Proposals require minimum squad points to create
- Voting weight equals user's points
- Votes: Upvote (+1), Downvote (-1), Abstain (0)
- Quorum: Minimum participation threshold
- Pass threshold: Net positive votes

## API Documentation

### Authentication Endpoints
- `POST /api/auth/wallet-login` - Wallet-based authentication
- `GET /api/x/connect/initiate` - Start X OAuth flow
- `GET /api/x/connect/callback` - Handle OAuth callback
- `POST /api/x/connect/disconnect` - Disconnect X account

### User Management
- `GET /api/users/my-details` - Get current user details
- `GET /api/users/my-points` - Get user points breakdown
- `GET /api/users/leaderboard` - Get top users
- `POST /api/users/link-wallet` - Link Solana wallet

### Squad Management
- `POST /api/squads/create` - Create new squad
- `POST /api/squads/join` - Join squad
- `GET /api/squads/my-squad` - Get user's squad
- `POST /api/squads/invitations/send` - Send invitation

### Proposal System
- `GET /api/proposals/active` - Get active proposals
- `POST /api/proposals/[id]/vote` - Submit vote
- `GET /api/proposals/[id]` - Get proposal details

## Testing

### Unit Tests
```bash
npm run test
```

### End-to-End Tests
```bash
# Install Playwright
npx playwright install

# Run tests
npm run test:e2e

# Run in headed mode
npm run test:e2e -- --headed
```

### Test Coverage
```bash
npm run test:coverage
```

## Deployment

### Vercel Deployment
1. Connect GitHub repository to Vercel
2. Configure environment variables in Vercel dashboard
3. Set up cron jobs in `vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/cron/process-proposals",
      "schedule": "0 */6 * * *"
    },
    {
      "path": "/api/cron/quest-lifecycle",
      "schedule": "0 0 * * *"
    }
  ]
}
```

### Docker Deployment
```bash
# Build image
docker build -t defai-rewards:latest .

# Run container
docker run -d \
  --name defai-rewards \
  -p 3000:3000 \
  --env-file .env.production \
  defai-rewards:latest
```

### Production Checklist
- [ ] Set production environment variables
- [ ] Configure MongoDB indexes
- [ ] Set up SSL certificates
- [ ] Configure CORS policies
- [ ] Enable rate limiting
- [ ] Set up monitoring and alerts
- [ ] Configure backup strategies
- [ ] Test all OAuth flows
- [ ] Verify WebSocket connections
- [ ] Run security audit

## Contributing

We welcome contributions! Please follow these guidelines:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Standards
- Write TypeScript with strict mode enabled
- Follow ESLint and Prettier configurations
- Write tests for new features
- Update documentation as needed
- Ensure all tests pass before submitting PR

## Troubleshooting

### Common Issues

**MongoDB Connection Failed**
- Verify connection string format
- Check IP whitelist in MongoDB Atlas
- Ensure database user has correct permissions

**X OAuth Error**
- Verify X_CALLBACK_URL matches app configuration
- Check X_CLIENT_ID and X_CLIENT_SECRET
- Ensure redirect URIs are properly configured

**500 Internal Server Error**
- Check server logs for detailed error
- Verify all environment variables are set
- Check MongoDB connection
- Ensure X_TOKEN_ENCRYPTION_KEY is 32-byte hex

**WebSocket Connection Issues**
- Verify NEXT_PUBLIC_WEBSOCKET_URL
- Check CORS configuration
- Ensure SSL certificates are valid

### Debug Mode
Enable debug logging:
```bash
DEBUG=* npm run dev
```

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For support and questions:
- Create an issue on GitHub
- Join our Discord community
- Follow [@defAIRewards](https://twitter.com/defAIRewards) on X

---

Built with ❤️ by the DeFAI team