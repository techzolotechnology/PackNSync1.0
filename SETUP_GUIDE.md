# 🛠️ PickAndSync Setup Guide

To get the application fully functional, you need to configure several external services. Follow this guide to obtain and set up all required environment variables.

---

## 1. Database (PostgreSQL)
Used for storing all application data (users, trips, expenses).
- **Service:** [PostgreSQL Downloads](https://www.postgresql.org/download/) or [Supabase](https://supabase.com/) (Cloud).
- **Steps:**
    1. Install PostgreSQL and create a database named `packandsync`.
    2. Update `DATABASE_URL` in `backend/.env`.
    - **Format:** `postgresql://USER:PASSWORD@localhost:5432/packandsync`

## 2. Google OAuth & Maps
Used for user authentication and location search.
- **Service:** [Google Cloud Console](https://console.cloud.google.com/)
- **Steps:**
    1. **Project:** Create a "New Project".
    2. **Auth:** Go to **APIs & Services > Credentials** > **OAuth client ID** (Web).
        - **Callback:** `http://localhost:3001/api/auth/google/callback`
        - **Keys:** Copy `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` to `backend/.env`.
    3. **Maps:** Search for **Maps JavaScript API** and Enable it. Create an API Key.
        - **Key:** Copy to `VITE_GOOGLE_MAPS_API_KEY` in `frontend/.env`.

## 3. Stripe (Payments)
Used for handling trip-related expenses.
- **Service:** [Stripe Dashboard](https://dashboard.stripe.com/register)
- **Steps:**
    1. Go to **Developers > API keys**.
    2. **Keys:** 
        - `STRIPE_SECRET_KEY` (sk_...) -> `backend/.env`
        - `VITE_STRIPE_PUBLISHABLE_KEY` (pk_...) -> `frontend/.env`
    3. **Webhook:** Go to **Webhooks**, set URL to `http://localhost:3001/api/payments/webhook`, and copy the **Signing secret** to `STRIPE_WEBHOOK_SECRET`.

## 4. Cloudinary (Media Storage)
Used for trip images and avatars.
- **Service:** [Cloudinary Console](https://cloudinary.com/console)
- **Steps:**
    1. Sign up and go to your Dashboard.
    2. **Keys:** Copy **Cloud Name**, **API Key**, and **API Secret** to `backend/.env`.

## 5. Resend (Emails)
Used for notifications and invites.
- **Service:** [Resend Dashboard](https://resend.com/overview)
- **Steps:**
    1. Go to **API Keys** and create a new key.
    2. **Key:** Copy to `RESEND_API_KEY` in `backend/.env`.

## 6. Redis (Caching)
Used for performance.
- **Service:** [Redis for Windows](https://github.com/tporadowski/redis/releases) or [Upstash](https://upstash.com/).
- **Steps:**
    1. Install and start Redis.
    2. **URL:** Default is `redis://localhost:6379`.

## 7. Ride Services (Uber)
Used for real-time ride pricing and automated connections.
- **Service:** [Uber Developer Dashboard](https://developer.uber.com/dashboard/)
- **Steps:**
    1. **Login:** Sign in to the [Uber Developer Portal](https://developer.uber.com/).
    2. **Create App:** Click **Create App** and give it a name (e.g., "PickAndSync").
    3. **Configure Auth:** Go to the **Settings** or **Auth** tab:
        - **Redirect URI:** Add `http://localhost:3001/api/rides/auth/uber/callback`
        - **Origin URI:** Add `http://localhost:5173` (Frontend URL)
    4. **Keys:** Copy the **Client ID** and **Client Secret**.
        - Add them to `backend/.env` as `UBER_CLIENT_ID` and `UBER_CLIENT_SECRET`.
    5. **Scopes:** Ensure your app has access to `rides.three_minute_estimate` (default for dev) or request `rides.estimate`.

> [!NOTE]
> **Ola & Rapido:** These services use a real-time OTP bridge. To enable them, you simply need to verify your phone number in the app; no developer portal setup is required for the current implementation phase.

---

## 🚀 Final Steps
1. Fill in all the keys in `backend/.env` and `frontend/.env`.
2. **Generate JWT Secrets:** These are NOT from a website. You must create your own random strings.
   - **Command:** Run this in your terminal to get a secure string: 
     ```bash
     node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
     ```
   - Copy the output to `JWT_SECRET` and `JWT_REFRESH_SECRET` in `backend/.env`.
3. Run migrations:
   ```bash
   cd backend
   npx prisma migrate dev
   ```
4. Start the app:
   ```bash
   npm run dev
   ```
