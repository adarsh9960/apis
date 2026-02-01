# InstaTool Backend API

Backend API for InstaTool - Multi-Platform Social Media Automation

## Deploy to Vercel

### One-Click Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/adarsh9960/insta-tools-backend)

### Manual Deploy

1. Install Vercel CLI:
```bash
npm install -g vercel
```

2. Login to Vercel:
```bash
vercel login
```

3. Deploy:
```bash
cd backend
vercel
```

4. Set Environment Variables in Vercel Dashboard:
   - `MONGODB_URI`
   - `JWT_SECRET`
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - `GOOGLE_REDIRECT_URI`
   - `RAZORPAY_KEY_ID`
   - `RAZORPAY_KEY_SECRET`
   - `ADMIN_EMAIL`
   - `SETUP_FEE`
   - `MONTHLY_SUBSCRIPTION_URL`

5. Link custom domain:
   - Go to Vercel Dashboard → Your Project → Settings → Domains
   - Add `api.itzadarsh.co.in`

## Local Development

```bash
npm install
npm run dev
```

## API Endpoints

- `GET /` - Health check
- `POST /api/auth/register` - Register user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user
- `GET /api/reviews` - Get reviews (authenticated)
- `POST /api/payments/setup-fee/create` - Create setup fee order
- `GET /api/google/auth-url` - Get Google OAuth URL
