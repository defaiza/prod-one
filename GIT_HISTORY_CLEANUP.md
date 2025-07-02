# 🚨 CRITICAL: Clean Git History of Exposed Secrets

Your `.env.local.backup` file containing secrets has been in git history for multiple commits. This means **anyone who clones your repo can see these secrets** even though we removed the file.

## Option 1: BFG Repo-Cleaner (Recommended)

### 1. Install BFG
```bash
brew install bfg
# or download from https://rtyley.github.io/bfg-repo-cleaner/
```

### 2. Clone a fresh copy of your repo
```bash
cd /tmp
git clone --mirror https://github.com/YOUR_USERNAME/tokenEscrowFE.git
cd tokenEscrowFE.git
```

### 3. Run BFG to remove the file
```bash
bfg --delete-files .env.local.backup
```

### 4. Clean up and force push
```bash
git reflog expire --expire=now --all && git gc --prune=now --aggressive
git push --force
```

## Option 2: git filter-branch

```bash
# WARNING: This rewrites history
git filter-branch --force --index-filter \
  'git rm --cached --ignore-unmatch .env.local.backup' \
  --prune-empty --tag-name-filter cat -- --all

# Force push
git push origin --force --all
git push origin --force --tags
```

## Option 3: If Repository is Private

If this is a private repository with few contributors:

1. **Nuclear Option**: Delete and recreate the repository
   - Export issues/PRs if needed
   - Delete the repository
   - Create a new one
   - Push clean code without history

2. **Or**: Keep the current state but:
   - Rotate ALL credentials immediately
   - Add security scanning to CI/CD
   - Audit who has access to the repository

## ⚠️ Important Notes

1. **Force pushing rewrites history** - Coordinate with your team
2. **All clones must be refreshed** after cleaning:
   ```bash
   git fetch --all
   git reset --hard origin/main
   ```
3. **Forks may still contain the secrets** - Contact fork owners

## After Cleaning

1. Rotate all exposed credentials
2. Enable GitHub secret scanning: Settings → Security → Code security
3. Add pre-commit hooks to prevent future leaks
4. Consider using GitHub's push protection

## Secrets That Were Exposed

From the security report, these were in your `.env.local.backup`:
- X_CLIENT_SECRET
- X_API_SECRET  
- NEXT_AUTH_SECRET
- Multiple API keys
- JWT tokens
- OAuth credentials

**ALL OF THESE MUST BE ROTATED IMMEDIATELY** 