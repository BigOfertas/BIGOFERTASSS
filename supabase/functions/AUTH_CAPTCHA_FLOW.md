# Auth CAPTCHA flow

Production Supabase Auth has Cloudflare Turnstile enabled.

The storefront obtains a Turnstile token and sends it to `auth-email-2fa`. The Edge Function forwards that token to the Supabase password grant as `gotrue_meta_security.captcha_token`. It must not consume the same token with a separate Siteverify request before the Supabase Auth call.

When email 2FA is enabled, the password grant is performed again after the email code is validated, so the 2FA screen obtains a fresh Turnstile token for that second grant.

CAPTCHA/configuration failures must remain distinguishable from invalid email/password errors so customers are not incorrectly told their credentials are wrong.
