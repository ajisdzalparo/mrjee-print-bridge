# Mrjee License Server Contract

The desktop app validates licenses against the HTTPS endpoint configured in
`MRJEE_LICENSE_SERVER_URL`. Keep database/admin credentials on that server;
never package them in Electron.

## Request

`POST MRJEE_LICENSE_SERVER_URL`

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
  "expiresAt": "2027-07-24T00:00:00.000Z",
  "customer": "Example Store"
}
```

For a lifetime license, return `null` for `expiresAt`. A rejected key should
return HTTP 401/403 and:

```json
{ "valid": false, "reason": "License expired" }
```

After a successful online check, the desktop app permits a 72-hour offline
grace period. The license key, bearer token, and validation cache are stored in
`electron-store`; secret strings are encrypted with Electron `safeStorage`
(Windows DPAPI) before persistence.

## Print API authentication

Both `/api/print` and `/api/print-direct` require:

```http
Authorization: Bearer YOUR_SECRET_TOKEN
Content-Type: application/json
```

Invalid/expired licenses return `423 LICENSE_REQUIRED`. Missing or invalid
tokens return `401 UNAUTHORIZED`.
