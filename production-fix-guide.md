# Production Authentication Fix Guide

## Issues Identified

1. **Environment API returning HTML** - The `/api/config/env` endpoint was in Pages Router but production uses App Router
2. **Session not persisting after wallet login** - Cookie domain and session handling issues
3. **Infinite authentication loop** - Sign-in succeeds but session doesn't update

## Fixes Applied

### 1. Created App Router Environment Endpoint
- Created `/src/app/api/config/env/route.ts` to replace the Pages Router version
- Added proper CORS headers for production domains
- Returns required environment variables as JSON

### 2. Updated Authentication Flow
- Added `callbackUrl` to signIn calls to maintain proper session state
- Added fallback for environment variables if API fails
- Improved error handling and session management

### 3. Fixed Cookie Configuration
- Updated auth cookies to use `.defairewards.net` domain
- Added secure cookie settings for production
- Ensured proper session token handling

## Deployment Steps

1. **Deploy the code changes**
   ```bash
   git add .
   git commit -m "Fix production auth issues"
   git push origin main
   ```

2. **Verify environment variables in production**
   ```
   NEXTAUTH_URL=https://squad.defairewards.net
   NEXTAUTH_SECRET=<your-secret>
   NODE_ENV=production
   MONGODB_URI=<your-mongodb-uri>
   MONGODB_DB_NAME=<your-db-name>
   
   # Token config
   NEXT_PUBLIC_DEFAI_TOKEN_MINT_ADDRESS=<token-mint>
   NEXT_PUBLIC_REQUIRED_DEFAI_AMOUNT=5000
   NEXT_PUBLIC_DEFAI_TOKEN_DECIMALS=6
   NEXT_PUBLIC_SOLANA_RPC_URL=<your-rpc-url>
   ```

3. **Clear CDN/Cache if applicable**
   - Clear Cloudflare or other CDN cache
   - Ensure new API routes are accessible

4. **Test the fix**
   - Clear browser cookies for defairewards.net
   - Visit https://squad.defairewards.net
   - Connect wallet
   - Verify session persists and dashboard loads

## Troubleshooting

If issues persist:

1. **Check browser console for errors**
   - Look for 404s on API routes
   - Check for CORS errors
   - Verify session cookie is set

2. **Check server logs**
   - Look for NextAuth errors
   - Verify MongoDB connection
   - Check for environment variable issues

3. **Test with debug page**
   - Visit https://squad.defairewards.net/debug-auth
   - Check session state and wallet connection

## Temporary Workarounds

If immediate access is needed:

1. Users can try:
   - Clear all cookies for defairewards.net
   - Use incognito/private browsing
   - Try a different browser
   - Disconnect and reconnect wallet

2. For persistent issues:
   - Check if Pages Router is enabled in production build
   - Verify all API routes are accessible
   - Consider rolling back if critical

## Monitoring

After deployment:
- Monitor error logs for authentication failures
- Check session creation rate
- Watch for 404s on API endpoints
- Monitor user reports

## Success Indicators

The fix is successful when:
- Users can connect wallet and see dashboard
- No infinite loops or page refreshes
- Session persists across page loads
- Environment variables load correctly
- No console errors about missing APIs 