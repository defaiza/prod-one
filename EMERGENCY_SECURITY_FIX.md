# 🚨 EMERGENCY SECURITY FIX - MongoDB Billing Attack

## Critical Finding

Your MongoDB billing spike is likely caused by **malicious actors exploiting unprotected API endpoints**. We found 20+ API routes performing database operations without authentication!

## Attack Vector

Someone discovered these endpoints and is likely running automated scripts to:
- Call `/api/check-airdrop` thousands of times with different wallet addresses
- Exploit `/api/referrals/register` to award points
- Hammer other unprotected endpoints

Each call triggers MongoDB operations, explaining the €450 bill.

## Immediate Actions (DO NOW!)

### 1. Add Rate Limiting to Vercel (5 minutes)

Add to `vercel.json`:
```json
{
  "functions": {
    "src/app/api/**/*.ts": {
      "maxDuration": 10
    }
  },
  "headers": [
    {
      "source": "/api/(.*)",
      "headers": [
        {
          "key": "X-RateLimit-Limit",
          "value": "100"
        },
        {
          "key": "X-RateLimit-Window",
          "value": "60"
        }
      ]
    }
  ]
}
```

### 2. Emergency Middleware (10 minutes)

Create `src/middleware/emergency-auth.ts`:
```typescript
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Temporarily block all unauthenticated API access
export function middleware(request: NextRequest) {
  // List of public endpoints (minimal)
  const publicEndpoints = [
    '/api/auth',
    '/api/og-image',
  ];
  
  const pathname = request.nextUrl.pathname;
  
  // Check if it's an API route
  if (pathname.startsWith('/api/')) {
    // Allow public endpoints
    const isPublic = publicEndpoints.some(endpoint => 
      pathname.startsWith(endpoint)
    );
    
    if (!isPublic) {
      // Check for session cookie
      const sessionCookie = request.cookies.get('next-auth.session-token') || 
                           request.cookies.get('__Secure-next-auth.session-token');
      
      if (!sessionCookie) {
        console.warn(`[SECURITY] Blocked unauthenticated request to: ${pathname}`);
        return NextResponse.json(
          { error: 'Authentication required' },
          { status: 401 }
        );
      }
    }
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: '/api/:path*',
};
```

### 3. Fix Critical Endpoints (15 minutes)

Replace the vulnerable endpoints:

**Fix `/api/check-airdrop/route.ts`:**
```typescript
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';

export async function GET(request: Request) {
  // Add rate limiting
  const ip = request.headers.get('x-forwarded-for') || 'unknown';
  
  // Simple in-memory rate limit (better: use Redis)
  if (!global.rateLimitMap) global.rateLimitMap = new Map();
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute
  const limit = 10; // 10 requests per minute
  
  const userRequests = global.rateLimitMap.get(ip) || [];
  const recentRequests = userRequests.filter((time: number) => now - time < windowMs);
  
  if (recentRequests.length >= limit) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }
  
  global.rateLimitMap.set(ip, [...recentRequests, now]);
  
  // Continue with existing logic but only update DB for authenticated users
  const session = await getServerSession(authOptions);
  // ... rest of the code
}
```

### 4. MongoDB Atlas Actions (URGENT)

1. **Check Current Connections:**
   - Log into MongoDB Atlas
   - Go to Metrics → Database Metrics
   - Check "Connections" graph for spikes

2. **View Operation Logs:**
   - Go to Activity → Profiler
   - Look for repeated operations from same IP

3. **Set Connection Limits:**
   - Atlas → Database → Configuration
   - Set max connections to 100

4. **Enable IP Whitelist (if not already):**
   - Network Access → Add IP Address
   - Only allow your server IPs

### 5. Monitor Attack Pattern

Run this script to see recent activity:
```bash
npm run mongodb:monitor
```

Look for:
- Collections with unexpected high document counts
- Recent spikes in specific collections

## Permanent Fixes (This Week)

1. **Add authentication to all endpoints:**
```typescript
import { withAuth } from '@/middleware/authGuard';

const handler = withAuth(async (request, session) => {
  // Your protected endpoint logic
});

export const GET = handler;
```

2. **Implement proper rate limiting:**
   - Use Redis for distributed rate limiting
   - Add Cloudflare or similar WAF

3. **Add request validation:**
   - Validate all input parameters
   - Add request size limits
   - Sanitize user input

4. **Security audit:**
   - Review all API endpoints
   - Add security headers
   - Implement CORS properly

## Checking for Damage

```javascript
// Check for suspicious users created recently
const recentUsers = await db.collection('users').find({
  createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
}).limit(100).toArray();

console.log('Recent users:', recentUsers.length);

// Check for unusual referral activity
const referralAbuse = await db.collection('actions').find({
  actionType: 'referral_bonus',
  timestamp: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
}).toArray();

console.log('Recent referrals:', referralAbuse.length);
```

## Contact MongoDB Support

Email MongoDB Atlas support immediately:
- Explain you had exposed endpoints
- Request billing adjustment for malicious traffic
- Ask for attack pattern analysis

## Prevent Future Attacks

1. **Security Checklist:**
   - [ ] All API routes have authentication
   - [ ] Rate limiting implemented
   - [ ] MongoDB connection limits set
   - [ ] IP whitelist enabled
   - [ ] Monitoring alerts configured

2. **Code Review Process:**
   - Never merge API routes without auth checks
   - Use `withAuth` wrapper by default
   - Regular security audits

Remember: The immediate priority is to stop the attack by adding authentication and rate limiting. The MongoDB optimization (indexes, connection pools) will help with legitimate traffic, but won't stop malicious requests. 