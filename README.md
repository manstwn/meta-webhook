# WhatsApp Cloud API Webhook Receiver

A production-ready Node.js Express server to handle Meta WhatsApp Cloud API Webhooks. It handles webhook verification, signature validation, rate limiting, and auto-replies ("Halo" to "hi").

## Features

- **Webhook Verification:** Seamless validation with Meta's setup challenge (`GET /webhook`).
- **Signature Security:** Verify payloads using `x-hub-signature-256` HMAC-SHA256 signatures with `APP_SECRET`.
- **Auto-Reply Service:** Automatically replies "Halo" via Graph API to messages containing "hi" (case-insensitive).
- **Secure Storage:** Automatically saves incoming webhook payloads safely into a local `data/messages.json` file using atomic writes.
- **Admin Dashboard UI:** Exposes a gorgeous glassmorphic portal at `/admin` to view, search, edit, and delete stored webhook records.
- **Production Guardrails:**
  - Rate limiting (max 100 requests per minute).
  - Security headers using `helmet` and `cors` support.
  - Logging via `winston` to both console and `logs/server.log`.
  - Global uncaught exception handlers (process does not crash on unhandled errors).
- **Process Management:** Configured for PM2.

## Installation

Install all required dependencies:

```bash
npm install
```

## Configuration

Configure environment settings in the `.env` file at the root directory:

```ini
PORT=2958
VERIFY_TOKEN=my_secret_verify_token
WHATSAPP_TOKEN=YOUR_PERMANENT_ACCESS_TOKEN
PHONE_NUMBER_ID=123456789012345
APP_SECRET=YOUR_META_APP_SECRET (Optional, if omitted, signature checks are bypassed)
LOG_LEVEL=info
```

## Running the Server

### Direct Execution

Start the server using Node:

```bash
npm start
```

### Running with PM2

Start the server under PM2 manager:

```bash
pm2 start ecosystem.config.js
```

### View PM2 Logs

To watch the live logs:

```bash
pm2 logs whatsapp-webhook
```

### Restart with PM2

To reload/restart the process:

```bash
pm2 restart whatsapp-webhook
```

## Admin Dashboard

You can access the built-in message portal in your browser:
* URL: `http://localhost:2958/admin`
* Features: View stored payloads, search by number or body text, filter by status, manually insert records, update notes, and delete items.

## Verification & Endpoint Tests

### Health Check
Request: `GET http://localhost:2958/`
Expected Response:
```json
{
  "status": "ok",
  "service": "WhatsApp Cloud API",
  "port": 2958
}
```

### Meta Verification Handshake
Request: `GET http://localhost:2958/webhook?hub.mode=subscribe&hub.verify_token=my_secret_verify_token&hub.challenge=test_challenge`
Expected Response: `test_challenge` (HTTP 200)

### Incoming Message (POST)
Request: `POST http://localhost:2958/webhook`
Body:
```json
{
  "object": "whatsapp_business_account",
  "entry": [
    {
      "id": "1234567890",
      "changes": [
        {
          "value": {
            "messaging_product": "whatsapp",
            "metadata": {
              "display_phone_number": "15550000000",
              "phone_number_id": "123456789012345"
            },
            "messages": [
              {
                "from": "628123456789",
                "id": "wamid.HBg...",
                "timestamp": "1675200000",
                "text": {
                  "body": "hi"
                },
                "type": "text"
              }
            ]
          },
          "field": "messages"
        }
      ]
    }
  ]
}
```
Expected Response: `{"status":"success"}` (HTTP 200)
*Action:* Automatically stores the payload immediately, then asynchronously replies "Halo" in the background.

### Messages CRUD API
* **List all:** `GET /api/messages`
* **Get single:** `GET /api/messages/:id`
* **Create manual record:** `POST /api/messages`
* **Update properties:** `PUT /api/messages/:id` (body fields: `notes`, `status`, `body`, etc.)
* **Delete record:** `DELETE /api/messages/:id`

