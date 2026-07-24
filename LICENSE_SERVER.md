# Mrjee Signed License Contract

The Commercial Edition uses the HTTPS base URL configured in
`MRJEE_LICENSE_SERVER_URL` and calls `/v1/licenses/activate` or
`/v1/licenses/refresh`. Database/admin credentials and the Ed25519 private key
must never be packaged in Electron.

## Request

`POST {MRJEE_LICENSE_SERVER_URL}/v1/licenses/activate`

```json
{
  "licenseKey": "MRJEE-XXXX-XXXX-XXXX",
  "machineId": "sha256-machine-fingerprint",
  "appVersion": "1.9.6",
  "platform": "win32"
}
```

## Successful response

```json
{
  "valid": true,
  "certificate": {
    "payload": {
      "version": 1,
      "licenseId": "uuid",
      "deviceId": "uuid",
      "machineId": "sha256-machine-fingerprint",
      "customer": "Example Store",
      "plan": "professional",
      "kind": "subscription",
      "issuedAt": "2026-07-24T00:00:00.000Z",
      "subscriptionEndsAt": "2026-08-24T00:00:00.000Z",
      "paymentGraceEndsAt": "2026-08-27T00:00:00.000Z",
      "offlineValidUntil": "2026-08-07T00:00:00.000Z",
      "features": ["pdf", "raw", "zpl", "sbpl"]
    },
    "signature": "base64url-ed25519-signature",
    "keyId": "mrjee-production-1"
  }
}
```

For a lifetime license, `subscriptionEndsAt`, `paymentGraceEndsAt`, and
`offlineValidUntil` are `null`. A rejected key returns:

```json
{ "valid": false, "reason": "License expired" }
```

The desktop verifies every certificate locally using `license-public.pem`.
Subscription certificates permit at most 14 days offline and never exceed the
known subscription plus payment-grace deadline. The license key and bearer
token are encrypted using Electron `safeStorage` (Windows DPAPI).

## Print API authentication

Both `/api/print` and `/api/print-direct` require:

```http
Authorization: Bearer YOUR_SECRET_TOKEN
Content-Type: application/json
```

Invalid/expired licenses return `423 LICENSE_REQUIRED`. Missing or invalid
tokens return `401 UNAUTHORIZED`.
