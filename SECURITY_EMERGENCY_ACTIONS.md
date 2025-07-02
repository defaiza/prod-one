# 🚨 EMERGENCY SECURITY ACTIONS - CRITICAL

Based on your devops security report, take these actions IMMEDIATELY:

## 1. DELETE EXPOSED BACKUP FILE (NOW!)

```bash
# Delete the exposed backup file containing secrets
rm .env.local.backup

# Ensure it's also removed from git history if committed
git rm --cached .env.local.backup
git commit -m "Remove exposed backup file"

# If already pushed to remote, you'll need to clean git history
# Use BFG Repo-Cleaner or git filter-branch
```

## 2. ROTATE ALL EXPOSED CREDENTIALS (URGENT)

### X (Twitter) OAuth Credentials
1. Go to https://developer.twitter.com/en/portal/projects-and-apps
2. Find your app
3. Regenerate ALL keys:
   - `X_CLIENT_ID`
   - `X_CLIENT_SECRET`
   - `X_API_KEY`
   - `X_API_SECRET`

### NextAuth Secret
```bash
# Generate new secret
openssl rand -base64 32
```
Update `NEXT_AUTH_SECRET` in production immediately.

### MongoDB Connection String
1. Log into MongoDB Atlas
2. Database Access → Edit user → Change password
3. Update `MONGODB_URI` with new password

### Other API Keys
- Crossmint API keys
- Fleek API credentials
- Any other exposed keys

## 3. SECURE VULNERABLE ENDPOINTS

### Already Secured:
- ✅ `/api/check-airdrop` - Added rate limiting + auth for DB updates
- ✅ `/api/referrals/register` - Now requires authentication
- ✅ `/api/referrals/get-code` - Auth required for new users

### Still Need Securing:
Run these commands to see all unprotected endpoints:
```bash
grep -r "export async function" src/app/api --include="*.ts" | \
grep -v "getServerSession\|withAuth" | \
cut -d: -f1 | sort | uniq
```

## 4. DEPLOY SECURITY FIXES

### Add to your deployment:
```bash
# 1. Update environment variables with rotated credentials
# 2. Deploy the secured endpoints
git add -A
git commit -m "SECURITY: Add authentication and rate limiting to vulnerable endpoints"
git push

# 3. Monitor for any errors after deployment
```

## 5. MONGODB BILLING INVESTIGATION

### Check Attack Timeline:
1. MongoDB Atlas → Activity → Profiler
2. Filter by date when bill spiked
3. Look for:
   - High volume from specific IPs
   - Repeated queries to same endpoints
   - Unusual patterns

### Request Billing Adjustment:
Email MongoDB support with:
- Security report showing exposed endpoints
- Timeline of fixes implemented
- Request for billing credit due to malicious activity

## 6. IMPLEMENT MONITORING

### Set Up Alerts:
1. MongoDB Atlas:
   - Operations > 1000/minute
   - New connections > 50
   - Bill projection > €50

2. Application Monitoring:
   - Failed auth attempts > 100/hour
   - 429 responses > 1000/hour
   - New user creation > 100/day

## 7. SECURITY AUDIT CHECKLIST

- [ ] Delete `.env.local.backup`
- [ ] Rotate X/Twitter credentials
- [ ] Rotate NextAuth secret
- [ ] Update MongoDB password
- [ ] Deploy secured endpoints
- [ ] Enable MongoDB IP whitelist
- [ ] Set up monitoring alerts
- [ ] Review git history for other exposed files
- [ ] Add `.env*` to `.gitignore`
- [ ] Enable 2FA on all service accounts

## PREVENTION

### Never commit:
- `.env*` files
- `*.backup` files
- API keys in code
- Connection strings

### Always use:
- Environment variables
- Secrets management service
- Rate limiting on ALL endpoints
- Authentication by default

### Add pre-commit hook:
```bash
# .husky/pre-commit
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

# Check for secrets
if git diff --cached --name-only | xargs grep -E "(SECRET|KEY|TOKEN|PASSWORD)" 2>/dev/null; then
  echo "🚨 Possible secrets detected in commit!"
  echo "Please review your changes"
  exit 1
fi
```

## CONTACT

If you need help:
- MongoDB Support: support@mongodb.com
- Twitter/X Developer Support: https://developer.twitter.com/en/support
- Report security incidents to your security team immediately 