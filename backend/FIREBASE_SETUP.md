# Firebase + FastAPI Setup Guide

## 1. Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click **Add project**, enter a name (e.g. `chicken-erp`), follow the wizard
3. Once created, click the ⚙️ gear icon → **Project settings**

## 2. Enable Firebase Auth (Email/Password)

1. In the Firebase Console sidebar → **Build → Authentication**
2. Click **Get started**
3. Under **Sign-in method**, enable **Email/Password**
4. Create your first user:
   - Go to the **Users** tab → **Add user**
   - Email: `admin@supplier.com`
   - Password: `admin123` (change in production!)

## 3. Create a Firestore Database

1. Sidebar → **Build → Firestore Database**
2. Click **Create database**
3. Choose **Start in production mode** (we'll set rules next)
4. Select a region close to your users

### Security Rules

In **Firestore → Rules**, paste:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Authenticated users can read/write all collections
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

> For production, tighten rules per collection and role.

## 4. Generate a Service Account Key (Backend)

1. ⚙️ **Project settings → Service accounts**
2. Click **Generate new private key**
3. Save the JSON file as `backend/service-account.json`
4. **Never commit this file to git** — add it to `.gitignore`

## 5. Get Web App Config (Frontend)

1. ⚙️ **Project settings → General → Your apps**
2. Click **Add app → Web** (the `</>` icon)
3. Register the app, then copy the config object:
   ```js
   apiKey: "...",
   authDomain: "...",
   projectId: "...",
   storageBucket: "...",
   messagingSenderId: "...",
   appId: "..."
   ```
4. Create `frontend-vite/.env` using these values (see `.env.example`)

## 6. Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # macOS/Linux

# Install dependencies
pip install -r requirements.txt

# Create .env from template
cp .env.example .env
# Edit .env — set FIREBASE_CREDENTIALS_PATH to your service-account.json path

# Seed Firestore with initial data (run once)
python seed_firestore.py

# Start the server
uvicorn server:app --reload --port 8000
```

## 7. Frontend Setup

```bash
cd frontend-vite

# Install dependencies
npm install

# Create .env from template
cp .env.example .env
# Edit .env — fill in your Firebase web config values

# Start dev server
npm run dev
```

## 8. Verify

1. Open `http://localhost:5173` — you should see the login page
2. Sign in with `admin@supplier.com` / `admin123`
3. Navigate to a supplier → dashboard
4. Check Firestore Console to see documents being created

## Firestore Collections

| Collection | Purpose |
|---|---|
| `products` | Product types (chicken, mutton) |
| `suppliers` | Supplier master data |
| `sub_parties` | Sub-parties under each supplier |
| `weight_entries` | Daily weight entries per party |
| `financial_entries` | Customer allocations (totals overview + financial breakdown) |
| `section_f_entries` | Section F / other calculations |
| `price_rates` | Historical price rates per product |
| `daily_carryover` | End-of-day stock balance (M.Iruppu for next day) |

## Environment Variables

### Backend (`backend/.env`)

| Variable | Description |
|---|---|
| `FIREBASE_CREDENTIALS_PATH` | Path to service-account JSON |
| `CORS_ORIGINS` | Comma-separated allowed origins |
| `LOG_LEVEL` | Python logging level (INFO, DEBUG, etc.) |

### Frontend (`frontend-vite/.env`)

| Variable | Description |
|---|---|
| `VITE_FIREBASE_API_KEY` | Firebase API key |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase auth domain |
| `VITE_FIREBASE_PROJECT_ID` | Firebase project ID |
| `VITE_FIREBASE_STORAGE_BUCKET` | Firebase storage bucket |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Messaging sender ID |
| `VITE_FIREBASE_APP_ID` | Firebase app ID |
| `VITE_API_BASE_URL` | Backend URL (default: `http://localhost:8000`) |

## API Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api` | - | Health check |
| POST | `/api/auth/login` | - | Verify Firebase ID token |
| GET | `/api/products` | - | List products |
| GET | `/api/suppliers?productType=` | - | List suppliers |
| GET | `/api/suppliers/:id` | - | Get supplier with sub-parties |
| POST | `/api/suppliers` | ✓ | Create supplier |
| POST | `/api/suppliers/:id/sub-parties` | ✓ | Add sub-party |
| DELETE | `/api/suppliers/:id/sub-parties/:spId` | ✓ | Delete sub-party |
| GET | `/api/weight-entries?date=&supplierId=` | - | List weight entries |
| POST | `/api/weight-entries` | ✓ | Create weight entry |
| PATCH | `/api/weight-entries/:id` | ✓ | Update weight entry |
| DELETE | `/api/weight-entries/:id` | ✓ | Soft-delete weight entry |
| GET | `/api/dashboard?date=&productType=` | - | Full dashboard aggregate |
| POST | `/api/dashboard/confirm?date=` | ✓ | Confirm & save carryover |
| GET | `/api/financial-entries?date=&section=` | - | List financial entries |
| POST | `/api/financial-entries` | ✓ | Create financial entry |
| PATCH | `/api/financial-entries/:id` | ✓ | Update financial entry |
| DELETE | `/api/financial-entries/:id` | ✓ | Delete financial entry |
| PATCH | `/api/financial-entries/reorder` | ✓ | Batch reorder |
| GET | `/api/section-f-entries?date=` | - | List section F entries |
| POST | `/api/section-f-entries` | ✓ | Create section F entry |
| PATCH | `/api/section-f-entries/:id` | ✓ | Update section F entry |
| DELETE | `/api/section-f-entries/:id` | ✓ | Delete section F entry |
| GET | `/api/price-rates?date=&productTypeId=` | - | Get effective rate |
| POST | `/api/price-rates` | ✓ | Create price rate |
