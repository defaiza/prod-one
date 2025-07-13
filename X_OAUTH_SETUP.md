# X OAuth Setup Guide

## Required Environment Variables

Add these to your production environment:

```bash
# X OAuth Configuration
X_CLIENT_ID=your_x_oauth_client_id
X_CLIENT_SECRET=your_x_oauth_client_secret
X_CALLBACK_URL=https://squad.defairewards.net/api/x/connect/callback

# Encryption key for X tokens (must be 32-byte hex string)
# Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
X_TOKEN_ENCRYPTION_KEY=your_32_byte_hex_string_here

# Cookie domain for production (optional - helps with subdomain issues)
COOKIE_DOMAIN=.defairewards.net
```

## Generate Encryption Key

Run this command to generate a secure encryption key:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## X App Configuration

1. Go to https://developer.twitter.com/en/portal/projects-and-apps
2. Create or select your app
3. Set up OAuth 2.0:
   - Enable OAuth 2.0
   - Set Type of App: "Web App"
   - Add Callback URL: `https://squad.defairewards.net/api/x/connect/callback`
   - Website URL: `https://squad.defairewards.net`

## Troubleshooting 500 Errors

1. **Check Environment Variables**: Ensure all required variables are set
2. **Verify Callback URL**: Must match exactly what's configured in X Developer Portal
3. **Check Logs**: The callback route logs detailed error information
4. **Cookie Issues**: If using subdomains, set `COOKIE_DOMAIN=.defairewards.net` 