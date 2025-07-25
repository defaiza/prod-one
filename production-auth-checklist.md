# Production Authentication Fix Checklist

## Environment Variables to Verify

Please ensure these are set correctly in your production environment:

```
NEXTAUTH_URL=https://squad.defairewards.net
NEXTAUTH_SECRET=<your-secret-key>
NODE_ENV=production
```

## Critical Points

1. **NEXTAUTH_URL** must be exactly `https://squad.defairewards.net` (with https, no trailing slash)
2. **NEXTAUTH_SECRET** must be set and match across all deployments
3. **Cookie Domain** - The code now sets cookies for `.defairewards.net` domain in production

## Deployment Steps

1. Deploy the updated code with the fixes
2. Clear your browser cookies for defairewards.net domain
3. Try logging in again

## If Issue Persists

Check the production logs for:
- Any NextAuth errors
- Cookie setting failures
- Database connection issues

## Temporary Workaround

If users need immediate access while you deploy:
1. Have them clear all cookies for defairewards.net
2. Use an incognito/private browser window
3. Try a different browser

## Verification

After deployment, check:
1. Browser DevTools > Application > Cookies
2. Look for `__Secure-next-auth.session-token` cookie
3. Verify it has the correct domain (`.defairewards.net`) 