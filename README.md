# Skopia — Video Content, Playback & Viewer Interaction

This source implements **Video Content, Playback, Viewer Interaction, Accounts, Subscriptions, and Payment Management**. It is a Java web application with a MySQL database and a responsive UI based on the supplied Skopia design.

## Included features

- Browse, search, and filter published videos
- HTML5 video playback with play, pause, seek, volume, and full-screen controls
- Automatic playback-position saving and continue-watching history
- Video title, description, category, creator, upload date, views, and duration
- Like/unlike videos
- Add and remove videos from a watchlist
- Post and delete viewer comments
- Creator Studio to upload, edit, publish/draft, and delete videos
- Local MP4/WebM/OGG/MOV uploads and image thumbnails (maximum request size: 250 MB)
- Responsive desktop, tablet, and mobile layout
- Viewer and creator account registration with server-side validation
- Secure login sessions using HTTP-only, SameSite cookies
- PBKDF2-SHA256 password hashing (passwords are never stored in plain text)
- Role-based protection for Creator Studio and upload/edit/delete operations
- Monthly and yearly premium subscriptions with premium-video access control
- Full owner-scoped payment CRUD: create by demo checkout, list/read history, edit plan/status, and delete
- Layered payment validation that stores and returns only card brand and last four digits

Reporting, notification, advertisement, and platform-admin functions are intentionally excluded.

> **Payment mode:** Checkout runs in demo mode because no external payment-provider account is configured. It records a successful test transaction and activates access, but it never charges a real card. Use test card `4242 4242 4242 4242`, any future `MM/YY`, and any three-digit security code. Connect Stripe, PayHere, or another provider before accepting real payments.

## Requirements

- Java 17 or newer (Java 25 is already installed on this computer)
- XAMPP with the **MySQL** service running
- Internet on the first run to download MySQL Connector/J; the connector is then cached in `lib/`

## Run with IntelliJ and Smart Tomcat

1. Open this project in IntelliJ IDEA and allow Maven to load `pom.xml`.
2. In the XAMPP Control Panel, start **MySQL** only. Smart Tomcat will start Tomcat, so do not also start Tomcat from XAMPP.
3. Open **Run > Edit Configurations**, click **+**, and select **Smart Tomcat**.
4. Use these values:

   - **Tomcat Server:** `C:\xampp\tomcat`
   - **Deployment Directory:** `C:\Users\User\Downloads\untitled1\src\main\webapp`
   - **Context Path:** `/untitled1`
   - **Server Port:** `8080`
   - **Use classpath of module:** `untitled1`

5. Run the Smart Tomcat configuration and open <http://localhost:8080/untitled1/>.

The default XAMPP database settings are already configured: host `127.0.0.1`, port `3306`, database `skopia`, user `root`, and an empty password. The application creates its database, tables, and demo records automatically.

## Run as a standalone application on Windows

1. Open **XAMPP Control Panel** and click **Start** beside MySQL.
2. Double-click `run.bat`, or open PowerShell in this folder and run:

   ```powershell
   .\run.ps1
   ```

3. Open <http://localhost:8080>.

On first start, the server automatically creates the `skopia` database, tables, demo users, categories, and sample videos. The default XAMPP credentials are used: user `root` with no password.

## Database configuration

If your MySQL setup differs, set environment variables before running:

```powershell
$env:DB_HOST = '127.0.0.1'
$env:DB_PORT = '3306'
$env:DB_NAME = 'skopia'
$env:DB_USER = 'root'
$env:DB_PASSWORD = 'your-password'
.\run.ps1
```

You can inspect or import the schema manually from `database/schema.sql` in phpMyAdmin. Automatic initialization is safe to run repeatedly because tables and seed records use `IF NOT EXISTS`/`INSERT IGNORE`.

## Demo identities

- Viewer: `viewer@skopia.test` / `Viewer123!`
- Creator: `creator@skopia.test` / `Creator123!`

You can also create viewer or creator accounts from the header. Passwords must be 8-128 characters and contain uppercase, lowercase, and numeric characters. Sessions last seven days in memory and are cleared whenever the Java server restarts.

## Main source structure

```text
SOUCE/
├── database/schema.sql
├── public/
│   ├── index.html
│   ├── styles.css
│   └── app.js
├── src/main/java/com/skopia/
│   ├── SkopiaServer.java
│   ├── VideoRepository.java
│   ├── Database.java
│   ├── MultipartForm.java
│   ├── Json.java
│   └── Config.java
├── uploads/
├── run.bat
└── run.ps1
```

## Validation rules

Validation runs in both the browser and Java backend. The backend remains authoritative and rejects invalid requests with HTTP `400` and a clear JSON error message.

- Video title: 3–180 characters
- Description: maximum 4000 characters
- Duration: whole number from 1–86400 seconds
- Category: positive ID that must exist in MySQL
- Video and thumbnail URLs: HTTP/HTTPS only, maximum 700 characters
- Video uploads: MP4, WebM, OGG, or MOV; maximum 250 MB; file signature checked
- Thumbnail uploads: JPG, PNG, or WebP; maximum 10 MB; file signature checked
- Access type: `FREE` or `PREMIUM`
- Status: `PUBLISHED` or `DRAFT`
- Comments: required after trimming, maximum 1000 characters
- Search: maximum 100 characters
- IDs: positive whole numbers
- Playback position: whole number from 0–86400 seconds
- Referenced videos, categories, and parent comments must exist and match the current resource
- Payment plan: `MONTHLY` or `YEARLY`
- Cardholder name: 2–100 characters with control characters rejected
- Card number: 13–19 digits, optional spaces/hyphens, and a valid Luhn checksum
- Expiry: `MM/YY`, current or future, and no more than 20 years ahead
- Security code: 3–4 digits; never stored or returned
- Payment update status: `SUCCEEDED` or `REFUNDED`; failed/refunded records cannot return to succeeded
- Payment IDs: positive whole numbers, authenticated, and restricted to the owning account

See `VALIDATION_TEST_REPORT.md` for the test evidence.

## API summary

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/auth/register` | Create and sign in to an account |
| POST | `/api/auth/login` | Validate credentials and start a session |
| POST | `/api/auth/logout` | End the current session |
| GET | `/api/auth/me` | Read the signed-in account |
| GET | `/api/payments/status` | Read the current premium subscription |
| GET | `/api/payments` | List the signed-in user's safe payment history |
| POST | `/api/payments` | Process a validated demo checkout and create a payment |
| POST | `/api/payments/checkout` | Backward-compatible alias for creating a payment |
| GET | `/api/payments/{id}` | Read one owned payment |
| PUT | `/api/payments/{id}` | Update an owned payment plan/status |
| DELETE | `/api/payments/{id}` | Delete an owned payment record |
| GET | `/api/videos` | Browse/search/filter videos |
| GET | `/api/videos/{id}` | Read video details |
| POST | `/api/videos` | Upload a creator video |
| PUT | `/api/videos/{id}` | Edit creator video metadata |
| DELETE | `/api/videos/{id}` | Delete creator video |
| POST | `/api/videos/{id}/like` | Toggle like |
| POST | `/api/videos/{id}/save` | Toggle watchlist |
| GET/POST | `/api/videos/{id}/comments` | Read/post comments |
| POST | `/api/videos/{id}/progress` | Save playback position |
| GET | `/api/history` | View watch history |
| GET | `/api/watchlist` | View saved videos |
