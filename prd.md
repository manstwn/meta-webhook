Below is a **complete Production-Ready PRD** for an AI Code Builder (Claude Code, Cursor, Windsurf, Gemini CLI, Codex, etc.) to build a **Meta WhatsApp Cloud API Webhook Server**.

This PRD assumes:

* ✅ Ubuntu VPS
* ✅ Node.js installed
* ✅ Cloudflare Tunnel already configured
* ✅ Public domain already points to VPS
* ✅ Port **2958** already exposed
* ✅ You only need the webhook server

---

# PRD

# WhatsApp Cloud API Webhook Server

## Project Name

WhatsApp Cloud API Webhook Receiver

---

# Objective

Build a production-ready Node.js application that can receive WhatsApp Cloud API webhooks from Meta.

The application must:

* Verify webhook during Meta setup
* Receive incoming messages
* Log all webhook payloads
* Automatically reply "Halo" whenever someone sends "hi"
* Listen on port **2958**
* Be production ready
* Run forever using PM2
* Ready behind Cloudflare Tunnel

---

# Technology

Backend

* Node.js 22+
* Express
* Axios
* dotenv
* morgan
* helmet
* cors

Optional

* Winston logger

---

# Folder Structure

```
whatsapp-webhook/

│
├── src/
│   ├── app.js
│   ├── server.js
│   │
│   ├── routes/
│   │      webhook.js
│   │
│   ├── controllers/
│   │      webhookController.js
│   │
│   ├── services/
│   │      whatsapp.js
│   │
│   ├── middleware/
│   │      logger.js
│   │
│   ├── utils/
│   │      verifySignature.js
│   │
│   └── config/
│          env.js
│
├── logs/
│
├── .env
├── package.json
├── ecosystem.config.js
└── README.md
```

---

# Environment Variables

```
PORT=2958

VERIFY_TOKEN=my_secret_verify_token

WHATSAPP_TOKEN=YOUR_PERMANENT_ACCESS_TOKEN

PHONE_NUMBER_ID=123456789012345

APP_SECRET=OPTIONAL

LOG_LEVEL=info
```

---

# Express Configuration

Enable

```
helmet()

cors()

express.json()

morgan("combined")
```

---

# Listening Port

```
2958
```

No HTTPS.

Cloudflare Tunnel handles SSL.

---

# Routes

## GET /webhook

Used by Meta verification.

Implementation

Read

```
hub.mode
hub.verify_token
hub.challenge
```

If

```
hub.verify_token
==
VERIFY_TOKEN
```

Return

```
200

hub.challenge
```

Otherwise

```
403 Forbidden
```

---

## POST /webhook

Receives webhook events.

Return HTTP 200 immediately.

Process asynchronously.

---

# Webhook Processing

Extract

```
entry

changes

value

messages
```

If message exists

Extract

```
from

type

text.body

timestamp

id
```

Log

```
Incoming Message

Phone

Text

Timestamp
```

---

# Auto Reply Logic

If

```
text.body

equals

hi
```

(case insensitive)

Send

```
Halo
```

using Cloud API

---

# WhatsApp Sending Service

POST

```
https://graph.facebook.com/v23.0/{PHONE_NUMBER_ID}/messages
```

Headers

```
Authorization:
Bearer TOKEN

Content-Type:
application/json
```

Payload

```json
{
  "messaging_product": "whatsapp",
  "to": "628123456789",
  "type": "text",
  "text": {
    "body": "Halo"
  }
}
```

---

# Logging

Console

AND

```
logs/server.log
```

Log

Startup

Incoming webhook

Outgoing message

Errors

Verification attempts

---

# Health Check

GET

```
/
```

Return

```json
{
  "status":"ok",
  "service":"WhatsApp Cloud API",
  "port":2958
}
```

---

# Error Handling

Catch all exceptions.

Return

```
500
```

Log stack trace.

Never crash process.

---

# PM2

Provide

```
ecosystem.config.js
```

Example

```javascript
module.exports = {
  apps: [
    {
      name: "whatsapp-webhook",
      script: "./src/server.js",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "500M",
      env: {
        NODE_ENV: "production"
      }
    }
  ]
}
```

---

# README

Must include

Install

```
npm install
```

Run

```
npm start
```

PM2

```
pm2 start ecosystem.config.js
```

Logs

```
pm2 logs whatsapp-webhook
```

Restart

```
pm2 restart whatsapp-webhook
```

---

# Meta Webhook Configuration

The application must support

```
GET /webhook
```

for verification.

Example

```
https://yourdomain.com/webhook
```

Verify Token

```
my_secret_verify_token
```

---

# Cloudflare Tunnel

Cloudflare Tunnel already forwards

```
https://yourdomain.com

↓

localhost:2958
```

The application must only listen on

```
0.0.0.0:2958
```

---

# Security

Helmet

Body size limit

```
5MB
```

Rate limit

```
100 req/min
```

Reject invalid JSON.

Never expose stack traces.

---

# Dependencies

```
express

dotenv

axios

helmet

cors

morgan

express-rate-limit

winston

pm2
```

---

# Testing

Health

```
GET /
```

Expected

```
200
```

---

Verification

```
GET /webhook
```

with

```
hub.verify_token

hub.challenge
```

Expected

```
200

challenge
```

---

Incoming message

POST

```
/webhook
```

Expected

```
200
```

Log payload.

---

Incoming

```
hi
```

Expected

Outgoing

```
Halo
```

---

# Production Acceptance Criteria

The project is complete only if all of the following are true:

* Express server starts without errors.
* Server listens on **0.0.0.0:2958**.
* Cloudflare Tunnel forwards traffic successfully.
* `GET /` returns service health.
* `GET /webhook` correctly completes Meta's verification challenge.
* `POST /webhook` accepts and logs webhook events.
* Receiving the message **"hi"** (case-insensitive) triggers a reply of **"Halo"** through the WhatsApp Cloud API.
* Logs are written to both the console and `logs/server.log`.
* Environment variables are loaded from `.env`.
* The application can be managed with PM2 and automatically restarts on failure.
* The codebase follows a modular structure with routes, controllers, services, middleware, configuration, and utilities separated appropriately.
* No secrets (tokens, app secret, verify token) are hardcoded into the source code.

---

## Values to Use in Meta Webhook Configuration

Since your infrastructure is already in place, configure the webhook in the Meta Developer Console as follows:

* **Callback URL:** `https://<your-domain>/webhook`
* **Verify Token:** `my_secret_verify_token` (must exactly match `VERIFY_TOKEN` in your `.env`)
* **Server Listen Address:** `0.0.0.0:2958`
* **Cloudflare Tunnel Target:** `http://localhost:2958`

After deployment, clicking **Verify and Save** in Meta should trigger a `GET /webhook` request, and the server should respond with the `hub.challenge` value, completing webhook verification successfully.
