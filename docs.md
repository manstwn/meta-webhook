# WhatsApp Webhook Receiver API Documentation

This document describes how to use and test the endpoints exposed by the WhatsApp Webhook server.

All private admin endpoints under `/api/messages/*` require authentication using the `ADMIN_PIN` configured in your `.env` file.

---

## Authentication

Authentication is performed via HTTP Bearer token using the `ADMIN_PIN`. 

**Header Format:**
```http
Authorization: Bearer <ADMIN_PIN>
```
*Example:* `Authorization: Bearer 123456`

If this header is missing or incorrect, protected endpoints will respond with `401 Unauthorized`.

---

## Public Endpoints

### 1. Health Check
Retrieves the service running state, environment configuration, and listening port.

* **URL:** `/`
* **Method:** `GET`
* **Headers:** *None*
* **Response:**
  * **Status:** `200 OK`
  * **Content-Type:** `application/json`
  * **Body:**
    ```json
    {
      "status": "ok",
      "service": "WhatsApp Cloud API",
      "port": 2958
    }
    ```

* **Example Request:**
  ```bash
  curl -X GET http://localhost:2958/
  ```

---

### 2. Meta Webhook Verification
Handles the verification handshake initiated by Meta when registering your Webhook URL.

* **URL:** `/webhook`
* **Method:** `GET`
* **Headers:** *None*
* **Query Parameters:**
  * `hub.mode` (String, required): Must be `subscribe`.
  * `hub.verify_token` (String, required): Must match `VERIFY_TOKEN` in `.env`.
  * `hub.challenge` (String, required): Handshake challenge string.

* **Response:**
  * **Status:** `200 OK` (returns the value of `hub.challenge` as plain text).
  * **Status:** `403 Forbidden` (if the verify token does not match).

* **Example Request:**
  ```bash
  curl -X GET "http://localhost:2958/webhook?hub.mode=subscribe&hub.verify_token=my_secret_verify_token&hub.challenge=test_challenge_code"
  ```

---

### 3. Receive WhatsApp Event Callback
Receives real-time webhook callback events dispatched by Meta when contacts send messages to your business number. 

* **URL:** `/webhook`
* **Method:** `POST`
* **Headers:**
  * `Content-Type: application/json`
  * `X-Hub-Signature-256: sha256=<signature>` (Optional: validated only if `APP_SECRET` is set in `.env`).
* **Request Body Structure:**
  ```json
  {
    "object": "whatsapp_business_account",
    "entry": [
      {
        "id": "BUSINESS_ACCOUNT_ID",
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

* **Behavior:**
  - Responds immediately with `200 OK` (`{"status":"success"}`).
  - Persists the message payload into `data/messages.json`.
  - Asynchronously dispatches an automatic reply ("Halo") if the message body is "hi" (case-insensitive).

* **Example Request:**
  ```bash
  curl -X POST http://localhost:2958/webhook \
    -H "Content-Type: application/json" \
    -d '{
      "object": "whatsapp_business_account",
      "entry": [{
        "id": "12345",
        "changes": [{
          "value": {
            "messaging_product": "whatsapp",
            "messages": [{
              "from": "628123456789",
              "id": "wamid.mock_curl_message_id",
              "timestamp": "1719830000",
              "text": {
                "body": "hi"
              },
              "type": "text"
            }]
          },
          "field": "messages"
        }]
      }]
    }'
  ```

---

## Protected CRUD Endpoints (API/Admin)

### 4. List All Messages
Retrieves all stored webhook messages sorted with the newest records first.

* **URL:** `/api/messages`
* **Method:** `GET`
* **Headers:** `Authorization: Bearer <PIN>`
* **Response:**
  * **Status:** `200 OK`
  * **Body:**
    ```json
    [
      {
        "id": "wamid.mock_curl_message_id",
        "from": "628123456789",
        "body": "hi",
        "type": "text",
        "timestamp": 1719830000,
        "status": "replied",
        "replied": true,
        "createdAt": "2026-07-01T12:47:15.000Z",
        "notes": ""
      }
    ]
    ```

* **Example Request:**
  ```bash
  curl -X GET http://localhost:2958/api/messages \
    -H "Authorization: Bearer 123456"
  ```

---

### 5. Get Message Details
Retrieves metadata of a single message by its database ID.

* **URL:** `/api/messages/:id`
* **Method:** `GET`
* **Headers:** `Authorization: Bearer <PIN>`
* **Response:**
  * **Status:** `200 OK`
  * **Status:** `404 Not Found` (if ID does not exist)
  * **Body:** Same message structure as above.

* **Example Request:**
  ```bash
  curl -X GET http://localhost:2958/api/messages/wamid.mock_curl_message_id \
    -H "Authorization: Bearer 123456"
  ```

---

### 6. Create Message Manually
Manually inserts a message record directly into the JSON database.

* **URL:** `/api/messages`
* **Method:** `POST`
* **Headers:**
  * `Content-Type: application/json`
  * `Authorization: Bearer <PIN>`
* **Request Body:**
  ```json
  {
    "from": "628123456789",
    "body": "How are you?",
    "type": "text",
    "status": "received",
    "notes": "Added via API command line"
  }
  ```
* **Response:**
  * **Status:** `201 Created`
  * **Body:** Returns the created record including generated UUID and timestamps.

* **Example Request:**
  ```bash
  curl -X POST http://localhost:2958/api/messages \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer 123456" \
    -d '{
      "from": "628123456789",
      "body": "How are you?",
      "notes": "Added via API"
    }'
  ```

---

### 7. Update Message Details
Modifies properties (such as text body, status, auto-replied flag, or notes) of a stored message.

* **URL:** `/api/messages/:id`
* **Method:** `PUT`
* **Headers:**
  * `Content-Type: application/json`
  * `Authorization: Bearer <PIN>`
* **Request Body (Pass only the fields to update):**
  ```json
  {
    "notes": "Reviewed and marked resolved",
    "status": "replied"
  }
  ```
* **Response:**
  * **Status:** `200 OK`
  * **Body:** Returns the fully updated message record.

* **Example Request:**
  ```bash
  curl -X PUT http://localhost:2958/api/messages/wamid.mock_curl_message_id \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer 123456" \
    -d '{
      "notes": "Verified automatically replied",
      "status": "replied"
    }'
  ```

---

### 8. Delete Message
Deletes a message record from the local database file.

* **URL:** `/api/messages/:id`
* **Method:** `DELETE`
* **Headers:** `Authorization: Bearer <PIN>`
* **Response:**
  * **Status:** `200 OK`
  * **Body:**
    ```json
    {
      "success": true,
      "message": "Message wamid.mock_curl_message_id deleted successfully."
    }
    ```

* **Example Request:**
  ```bash
  curl -X DELETE http://localhost:2958/api/messages/wamid.mock_curl_message_id \
    -H "Authorization: Bearer 123456"
  ```
