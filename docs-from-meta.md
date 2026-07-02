Dokumen
Sekilas
Referensi webhook pesan gambar
Konten pada halaman ini telah diterjemahkan dari bahasa Inggris ke bahasa lain menggunakan AI. Konten yang diterjemahkan AI mungkin berisi kesalahan, kelalaian, atau makna yang tidak diinginkan. Karena bahasa yang diterjemahkan AI mungkin tidak akurat atau tidak jelas, Anda dapat merujuk ke konten sumber asli dalam bahasa Inggris untuk halaman ini guna meninjau panduan yang dimaksud.
Was this helpful?
Referensi webhook pesan gambar
Updated: 17 Jun 2026
Referensi ini menjelaskan peristiwa pemicu dan konten payload untuk webhook messages akun WhatsApp Business untuk pesan yang berisi gambar.
Pemicu
Pengguna WhatsApp mengirim gambar ke bisnis.
Pengguna WhatsApp meneruskan pesan gambar ke bisnis.
Pengguna WhatsApp meneruskan pesan tombol balasan interaktif ke bisnis.
Pengguna WhatsApp mengirim gambar ke bisnis melalui Iklan yang Mengarahkan ke WhatsApp.
Sintaks
{
  "object": "whatsapp_business_account",
  "entry": [
    {
      "id": "<WHATSAPP_BUSINESS_ACCOUNT_ID>",
      "changes": [
        {
          "value": {
            "messaging_product": "whatsapp",
            "metadata": {
              "display_phone_number": "<BUSINESS_DISPLAY_PHONE_NUMBER>",
              "phone_number_id": "<BUSINESS_PHONE_NUMBER_ID>"
            },
            "contacts": [
              {
                "profile": {
                  "name": "<WHATSAPP_USER_PROFILE_NAME>"
                },
                "wa_id": "<WHATSAPP_USER_ID>",
                "identity_key_hash": "<IDENTITY_KEY_HASH>" <!-- only included if identity change check enabled -->
              }
            ],
            "messages": [
              {
                "from": "<WHATSAPP_USER_PHONE_NUMBER>",
                "id": "<WHATSAPP_MESSAGE_ID>",
                "timestamp": "<WEBHOOK_TRIGGER_TIMESTAMP>",
                "type": "image",
                "image": {
                  "caption": "<MEDIA_ASSET_CAPTION>",
                  "mime_type": "<MEDIA_ASSET_MIME_TYPE>",
                  "sha256": "<MEDIA_ASSET_SHA256_HASH>",
                  "id": "<MEDIA_ASSET_ID>",
                  "url": "<MEDIA_ASSET_URL>"
                },

                <!-- only included if message was forwarded to business by a user -->
                "context": {
                  "forwarded": true, <!-- only if forwarded 5 times or less -->
                  "frequently_forwarded": true <!-- only if forwarded more than 5 times  -->
                },

                <!-- only included if message sent via a Click to WhatsApp ad -->
                "referral": {
                  "source_url": "<AD_URL>",
                  "source_id": "<AD_ID>",
                  "source_type": "ad",
                  "body": "<AD_PRIMARY_TEXT>",
                  "headline": "<AD_HEADLINE>",
                  "media_type": "<AD_MEDIA_TYPE>",
                  "image_url": "<AD_IMAGE_URL>",
                  "video_url": "<AD_VIDEO_URL>",
                  "thumbnail_url": "<AD_VIDEO_THUMBNAIL>",
                  "ctwa_clid": "<AD_CLICK_ID>",
                  "welcome_message": {
                    "text": "<AD_GREETING_TEXT>"
                  }
                }
              }
            ]
          },
          "field": "messages"
        }
      ]
    }
  ]
}
Parameter
Placeholder	Deskripsi	Nilai contoh
<AD_CLICK_ID>
String
ID klik iklan yang mengarahkan ke WhatsApp.
Properti ctwa_clid dihilangkan seluruhnya untuk pesan yang berasal dari iklan di Status WhatsApp (penempatan iklan Status WhatsApp⁠).
Aff-n8ZTODiE79d22KtAwQKj9e_mIEOOj27vDVwFjN80dp4_0NiNhEgpGo0AHemvuSoifXaytfTzcchptiErTKCqTrJ5nW1h7IHYeYymGb5K5J5iTROpBhWAGaIAeUzHL50
<AD_GREETING_TEXT>
String
Teks pembuka iklan klik ke WhatsApp.
Hi there! Let us know how we can help!
<AD_HEADLINE>
String
Judul iklan klik ke WhatsApp.
Chat with us
<AD_ID>
String
ID iklan klik ke WhatsApp.
120226305854810726
<AD_IMAGE_URL>
String
URL gambar iklan klik ke WhatsApp. Hanya disertakan jika iklan adalah iklan gambar.
https://scontent.xx.fbcdn.net/v/t45.1...
<AD_MEDIA_TYPE>
String
Jenis media iklan klik ke WhatsApp. Nilai bisa berupa:
image — Menunjukkan iklan gambar.
video — Menunjukkan iklan video.
image
<AD_PRIMARY_TEXT>
String
Teks utama iklan klik ke WhatsApp.
Summer succulents are here!
<AD_URL>
String
URL iklan klik ke WhatsApp.
https://fb.me/3cr4Wqqkv
<AD_VIDEO_THUMBNAIL>
String
URL gambar mini video iklan klik ke WhatsApp. Hanya disertakan jika iklan adalah iklan video.
https://scontent.xx.fbcdn.net/v/t45.3...
<AD_VIDEO_URL>
String
URL video iklan klik ke WhatsApp. Hanya disertakan jika iklan adalah iklan video.
https://scontent.xx.fbcdn.net/v/t45.2...
<BUSINESS_DISPLAY_PHONE_NUMBER>
String
Nomor telepon tampilan bisnis.
15550783881
<BUSINESS_PHONE_NUMBER_ID>
String
ID nomor telepon bisnis.
106540352242922
<IDENTITY_KEY_HASH>
String
Hash kunci identitas. Hanya disertakan jika Anda telah mengaktifkan fitur pemeriksaan perubahan identitas.
DF2lS5v2W6x=
<MEDIA_ASSET_CAPTION>
String
Teks keterangan aset media.
Taj Mahal
<MEDIA_ASSET_ID>
String
ID aset media. Anda dapat melakukan GET pada ID ini untuk mendapatkan URL aset, lalu melakukan GET pada URL yang ditampilkan (menggunakan token akses Anda) untuk mendapatkan aset yang mendasarinya.
1003383421387256
<MEDIA_ASSET_MIME_TYPE>
String
Jenis MIME aset media.
image/jpeg
<MEDIA_ASSET_SHA256_HASH>
String
Hash SHA-256 aset media.
SfInY0gGKTsJlUWbwxC1k+FAD0FZHvzwfpvO0zX0GUI=
<MEDIA_ASSET_URL>
String
Properti JSON ini dirilis secara bertahap kepada developer selama beberapa minggu, mulai 12 November 2025, dan mungkin tidak langsung tersedia untuk Anda.
URL Media. Anda bisa mengueri URL ini secara langsung dengan token akses Anda untuk mengunduh aset media.
https://lookaside.fbsbx.com/whatsapp_business/attachments/?mid=133...
<WEBHOOK_TRIGGER_TIMESTAMP>
String
Cap waktu Unix yang mengindikasikan kapan webhook dipicu.
1739321024
<WHATSAPP_BUSINESS_ACCOUNT_ID>
String
ID Akun WhatsApp Business.
102290129340398
<WHATSAPP_MESSAGE_ID>
String
ID pesan WhatsApp.
wamid.HBgLMTY1MDM4Nzk0MzkVAgASGBQzQUFERjg0NDEzNDdFODU3MUMxMAA=
<WHATSAPP_USER_ID>
String
ID pengguna WhatsApp. Perhatikan bahwa ID dan nomor telepon pengguna WhatsApp mungkin tidak selalu cocok.
16505551234
<WHATSAPP_USER_PHONE_NUMBER>
String
Nomor telepon pengguna WhatsApp. Ini adalah nilai yang sama yang diberikan oleh API sebagai nilai input saat mengirim pesan ke pengguna WhatsApp. Perhatikan bahwa nomor telepon dan ID pengguna WhatsApp mungkin tidak selalu cocok.
+16505551234
<WHATSAPP_USER_PROFILE_NAME>
String
Nama pengguna WhatsApp seperti yang tertera di profil mereka di klien WhatsApp.
Sheena Nelson
Contoh
{
  "object": "whatsapp_business_account",
  "entry": [
    {
      "id": "102290129340398",
      "changes": [
        {
          "value": {
            "messaging_product": "whatsapp",
            "metadata": {
              "display_phone_number": "15550783881",
              "phone_number_id": "106540352242922"
            },
            "contacts": [
              {
                "profile": {
                  "name": "Sheena Nelson"
                },
                "wa_id": "16505551234"
              }
            ],
            "messages": [
              {
                "from": "16505551234",
                "id": "wamid.HBgLMTY1MDM4Nzk0MzkVAgASGBQzQTRBNjU5OUFFRTAzODEwMTQ0RgA=",
                "timestamp": "1744344496",
                "type": "image",
                "image": {
                  "caption": "Taj Mahal",
                  "mime_type": "image/jpeg",
                  "sha256": "SfInY0gGKTsJlUWbwxC1k+FAD0FZHvzwfpvO0zX0GUI=",
                  "id": "1003383421387256",
                  "url": "https://lookaside.fbsbx.com/whatsapp_business/attachments/?mid=133..."
                }
              }
            ]
          },
          "field": "messages"
        }
      ]
    }
  ]
}