# MediBondhu: Zego token contract (backend + UIKit)

This document describes how the **server token** from our API relates to the **UIKit production kit token** the browser must pass to `ZegoUIKitPrebuilt.create()`. Getting this wrong led to client errors such as `Cannot read properties of undefined (reading 'createSpan')` because the UIKit bundle initialized internal tracing only on the expected kit-token path.

## Backend: `POST /v1/tools/zego-token`

- **Route:** `POST /v1/tools/zego-token` (see `backend/src/routes/v1/tools.js`).
- **Auth:** `Authorization: Bearer <access_token>` (authenticated user).
- **Body (JSON):**
  - `roomId` (string, required): use the consultation **booking id** as the Zego room id (same value the patient and vet join).
  - `userName` (string, required): display name for the participant.
- **Response (JSON):**
  - `token` (string): server-generated credential (HMAC kit token) for the authenticated `req.userId`, room, and user name.
  - `appID` (number): Zego application id from `ZEGOCLOUD_APP_ID`.
- **Server env:** `ZEGOCLOUD_APP_ID`, `ZEGOCLOUD_SERVER_SECRET` must be set or the endpoint returns `503`.

The `token` field is the **server secret–backed token** suitable as the second argument to UIKit’s production kit-token builder. It is **not** the final string you pass to `create()`.

## Frontend: UIKit production kit token + `create`

Implementation reference: `frontend/src/pages/medibondhu/ConsultationRoom.tsx`.

1. Call the endpoint above with `roomId: bookingId` and `userName: user.name`.
2. Dynamically import `@zegocloud/zego-uikit-prebuilt`.
3. Build the kit token:

   ```ts
   const kitToken = ZegoUIKitPrebuilt.generateKitTokenForProduction(
     Number(appID),
     String(token), // response `token` from backend
     String(bookingId),
     String(user.id),
     String(user.name || "User")
   );
   ```

4. Create the prebuilt instance with **only** the kit token:

   ```ts
   const zp = ZegoUIKitPrebuilt.create(kitToken);
   ```

5. Call `zp.joinRoom({ ... })` with your container and scenario (e.g. `OneONoneCall`).

## Contract summary

| Layer        | Value | Role |
|-------------|--------|------|
| API `token` | String from `POST .../zego-token` | **Server token** input to `generateKitTokenForProduction` |
| API `appID` | Number | First argument to `generateKitTokenForProduction` |
| `kitToken`  | Return value of `generateKitTokenForProduction` | **Only** valid input to `ZegoUIKitPrebuilt.create()` for this flow |

**Do not** pass the raw API `token` into `create()`. Each browser tab loads its own SDK instance and repeats this flow independently (two-browser testing is normal).
