# WhatsApp Webhook Receiver - Codebase Documentation

## 1. Overview

This project is a Node.js (Express) gateway for Meta's **WhatsApp Cloud API**. It provides:
- **Webhook Handling:** Verifies Meta challenges and accepts incoming WhatsApp events.
- **Payload Processing & Storage:** Parses incoming messages and system events, persisting them atomically to JSON files.
- **Media Download & Secure Access:** Downloads media files locally and serves them via expiring, HMAC-signed temporary URLs.
- **Multicast Webhook Forwarding:** Relays received messages to configurable external URLs.
- **Outbound Messaging:** Sends text and media messages via Meta Graph API v23.0.
- **Admin Management:** REST API and web dashboard (`/admin`) to manage messages and forward targets.

---

## 2. Directory Structure

```text
meta-webhook/
├── data/
│   ├── messages.json              # Local JSON store for messages & events
│   └── forwarding_domains.json    # Configured webhook forward destinations
├── logs/
│   └── server.log                 # Winston file log output
├── public/
│   ├── admin.html                 # Dashboard single-page application
│   └── uploads/                   # Downloaded media assets (images, audio, video)
├── src/
│   ├── server.js                  # Process entry point; handles startup & shutdown signals
│   ├── app.js                     # Express app setup, middleware, and route mounting
│   ├── config/
│   │   └── env.js                 # Environment variable parsing & validation
│   ├── controllers/
│   │   ├── webhookController.js   # Webhook verification, parsing, auto-reply & relay
│   │   ├── messageController.js   # CRUD operations for messages & outbound send
│   │   └── domainController.js    # CRUD operations for forward target URLs
│   ├── middleware/
│   │   ├── auth.js                # Bearer PIN authentication (ADMIN_PIN)
│   │   ├── apiKeyAuth.js          # API key authentication (API_KEY / ADMIN_PIN)
│   │   └── logger.js              # Winston logger configuration
│   ├── routes/
│   │   ├── webhook.js             # /webhook routes
│   │   ├── messages.js            # /api/messages routes & /temp-media/:token
│   │   └── domains.js             # /api/forward-urls routes
│   ├── services/
│   │   └── whatsapp.js            # Meta Graph API client (send messages, download media)
│   └── utils/
│       ├── cryptoHelper.js        # HMAC token generator & verifier for media links
│       ├── storage.js             # Atomic read/write helpers for JSON databases
│       └── verifySignature.js     # Meta x-hub-signature-256 HMAC-SHA256 validator
├── .env.example                   # Environment configuration template
├── ecosystem.config.js            # PM2 process configuration
└── package.json                   # Dependencies and scripts
```

---

## 3. Core Components & Flow

### A. Webhook Ingestion (`src/controllers/webhookController.js`)
1. **Verification (`GET /webhook`):** Meta sends `hub.mode`, `hub.verify_token`, and `hub.challenge`. The server validates `hub.verify_token === config.VERIFY_TOKEN` and echoes `hub.challenge`.
2. **Event Delivery (`POST /webhook`):**
   - Signature checked by `verifySignature.js` using `APP_SECRET` (if configured).
   - Responds immediately with `200 { status: 'success' }` to satisfy Meta SLA.
   - Asynchronously parses messages (`text`, `image`, `video`, `audio`) or system events (`account_alerts`, `message_template_status_update`, etc.).
   - Downloads incoming media to `public/uploads/` (falls back to placeholder media if token is not configured in dev).
   - Generates expiring signed URL (`/api/messages/temp-media/<token>?key=<key>`, 10-minute validity).
   - Persists message to `data/messages.json`.
   - Relays payload to all active forward URLs (`forwardWebhook`) with optional phone number filtering (`isPhoneAllowed`: exact numbers, international formats, `62812*` wildcards, and `62XXXXXX` digit masks).
   - If text equals `"hi"` (case-insensitive), sends auto-reply `"Halo"` via Meta Graph API.

### B. Outbound Messaging (`src/services/whatsapp.js`)
- Uses Meta Graph API endpoint: `https://graph.facebook.com/v23.0/<PHONE_NUMBER_ID>/messages`.
- `sendTextMessage(to, textBody)`: Sends plain text.
- `sendMediaMessage(to, type, options)`: Sends images, videos, audio, or documents by URL or Meta Media ID.
- Automatically handles filename and caption mapping.

### C. Data Persistence (`src/utils/storage.js`)
- JSON-backed persistence without external DB requirement.
- Uses atomic file write pattern: writes to `<file>.tmp` first, then calls `fs.renameSync` to prevent corrupted states during unexpected crashes.

### D. Security & Authentication
- **Admin API:** Protected by `src/middleware/auth.js` (`Authorization: Bearer <ADMIN_PIN>`).
- **Send API (`POST /api/messages/send`):** Protected by `src/middleware/apiKeyAuth.js` (`x-api-key` header or `Authorization: Bearer <key>`).
- **Media Link Protection:** Media download URLs require both an HMAC-SHA256 token (timestamped) and a valid `key` query parameter.
- **Network Guardrails:** `helmet`, `cors`, and `express-rate-limit` (100 req/min).

---

## 4. API Endpoints

| Method | Path | Auth Required | Description |
|---|---|---|---|
| `GET` | `/` | None | Health check & service info |
| `GET` | `/admin` | None (UI prompts PIN) | Web Admin Dashboard |
| `GET` | `/webhook` | None (Meta tokens) | Meta verification handshake |
| `POST` | `/webhook` | HMAC Signature (opt) | Meta incoming events callback |
| `GET` | `/api/messages/temp-media/:token` | Media Key query param | Download temporary media |
| `POST` | `/api/messages/send` | `API_KEY` or `ADMIN_PIN` | Send outbound WhatsApp message |
| `GET` | `/api/messages` | `ADMIN_PIN` | List all stored messages |
| `GET` | `/api/messages/:id` | `ADMIN_PIN` | Get single message by ID |
| `POST` | `/api/messages` | `ADMIN_PIN` | Manually insert message record |
| `PUT` | `/api/messages/:id` | `ADMIN_PIN` | Update message record |
| `DELETE` | `/api/messages/:id` | `ADMIN_PIN` | Delete message record |
| `DELETE` | `/api/messages` | `ADMIN_PIN` | Clear entire message database |
| `GET` | `/api/forward-urls` | `ADMIN_PIN` | List forwarding destinations |
| `POST` | `/api/forward-urls` | `ADMIN_PIN` | Add or update forward destination |
| `DELETE` | `/api/forward-urls/:id` | `ADMIN_PIN` | Delete forward destination |

---

## 5. Configuration Reference (`.env`)

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `PORT` | No | `2958` | Port to listen on (binds `0.0.0.0`) |
| `VERIFY_TOKEN` | Yes | `my_secret_verify_token` | Meta webhook setup token |
| `WHATSAPP_TOKEN` | Yes | - | Meta Cloud API permanent system access token |
| `PHONE_NUMBER_ID` | Yes | - | Meta WhatsApp Business phone number ID |
| `APP_SECRET` | No | `""` | Meta app secret for HMAC payload validation |
| `ADMIN_PIN` | Yes | `123456` | Secret PIN for dashboard and CRUD routes |
| `API_KEY` | No | `""` | Dedicated key for outbound `/api/messages/send` |
| `FORWARD_URL` | No | - | Optional static default relay target |
| `FORWARD_PHONE_FILTER` | No | - | Optional phone filter for static relay target |
| `LOG` | No | `true` | Set to `false` to disable file logging |
| `LOG_LEVEL` | No | `info` | Winston log severity level |
| `NODE_ENV` | No | `development` | Runtime environment name |
