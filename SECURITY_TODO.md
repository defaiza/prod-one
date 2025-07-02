# Security Vulnerability TODO Tracker

## 🔴 CRITICAL Priority (Fix Immediately)

### 1. Dependency Vulnerabilities
- [x] **pbkdf2 v3.1.2** - 2 Critical CVEs ✅ (Fixed via npm audit fix)
  - CVE-2025-6547: Silently disregards Uint8Array input, returning static keys
  - CVE-2025-6545: Returns predictable uninitialized/zero-filled memory
  - **Fix**: Updated to v3.1.3 in package.json and package-lock.json
  
- [ ] **bigint-buffer v1.1.5** - High severity (CVE-2025-3194)
  - Buffer overflow vulnerability in toBigIntLE() function
  - **Fix**: No patch available - need to find alternative or vendor fork
  - **Action Required**: This is a transitive dependency of @solana/spl-token

### 2. Authentication & Secrets
- [x] **Hard-coded JWT tokens and API keys** ✅
  - Multiple JWT tokens and API keys in .env.local.backup
  - **Fix**: File removed, but MUST ROTATE ALL CREDENTIALS
  
- [ ] **Unprotected API endpoints** (ALREADY FIXED ✅)
  - /api/check-airdrop ✅
  - /api/referrals/register ✅
  - /api/referrals/get-code ✅

## 🟠 HIGH Priority (Fix Today)

### 3. Network Security
- [ ] **axios v0.27.2** - Multiple vulnerabilities
  - CVE-2025-27152: SSRF and credential leakage via absolute URLs
  - CSRF vulnerability (GHSA-wf5p-g6vw-rhxx)
  - **Fix**: Update to v0.30.0

- [x] **CORS Misconfiguration** ✅
  - User-controlled origin in /api/config/env.ts
  - **Fix**: Implemented proper origin whitelist validation

### 4. Cryptographic Issues
- [x] **GCM authentication tag length** ✅
  - Missing tag length specification in crypto operations
  - **Fix**: Added authTagLength: 16 to all createCipheriv/createDecipheriv calls

## 🟡 MEDIUM Priority (Fix This Week)

### 5. Infrastructure Security
- [x] **Missing SRI (Subresource Integrity)** ✅ (Partial)
  - External resources loaded without integrity checks
  - **Fix**: Added integrity attribute to index.html script
  - **TODO**: Update PLACEHOLDER_HASH with actual SRI hash

- [x] **Next.js v14.2.23** - Low severity (CVE-2025-48068) ✅
  - Information exposure in dev server
  - **Fix**: Updated to v14.2.30 in package.json

### 6. Input Validation
- [ ] **brace-expansion v1.1.11** - ReDoS vulnerability
  - CVE-2025-5889: Regular expression denial of service
  - **Fix**: Update to v1.1.12

## 🟢 LOW Priority (Monitor)

### 7. Code Quality
- [x] **Unsafe string concatenation** ✅ (Not found)
  - SQL injection risks in database queries
  - **Fix**: No vulnerable patterns found in codebase

- [x] **Missing rate limiting** ✅
  - Enhanced rate limiting middleware added

### 8. Hard-coded Secrets
- [x] **Chromatic project token** ✅
  - **Fix**: Changed to use environment variable $CHROMATIC_PROJECT_TOKEN
  
- [x] **Mint Tier script placeholders** ✅
  - **Fix**: Changed to use environment variables

## Fix Status Summary
- ✅ Fixed: 11 items (API auth, rate limiting, CORS, crypto, Next.js, hardcoded secrets)
- ⏳ In Progress: 1 item (SRI - needs actual hash)
- ❌ Pending: 3 items (axios, bigint-buffer, brace-expansion)

## Verification Commands
```bash
# Check vulnerable dependencies
npm audit

# Verify secrets are not in git
git grep -i "secret\|password\|token\|key" --exclude-dir=node_modules

# Test API endpoints
curl -X POST http://localhost:3000/api/check-airdrop
``` 