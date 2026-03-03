# Fitness Buddy

A full-stack fitness platform built for gym members, trainers, and gym owners.

It combines gym operations, social engagement, and AI-assisted nutrition tracking in one application.

## Tech Stack

- **Frontend:** React + Vite
- **Backend:** Node.js + Express
- **Database:** SQLite (default) with MongoDB support in selected routes
- **Auth:** JWT-based authentication
- **Media Uploads:** Local uploads with optional Cloudinary
- **AI Nutrition:** Google Gemini API

## Core Features

- Role-based access (member, trainer, owner)
- Gym profile and membership management
- Equipment browsing and booking flows
- Social feed with posts, likes, follow/unfollow
- AI meal image analysis for calories/macros
- Daily diet log and streak tracking
- Rewards and points tracking

## Project Structure

```text
FITNESS_BUDDY/
  backend/      # Express API, DB layer, routes, uploads
  frontend/     # React app (Vite)
  render.yaml   # Render deployment config
  vercel.json   # Vercel frontend config
```

## Local Setup

### Prerequisites

- Node.js 20+
- npm 9+

### 1) Backend Setup

```powershell
cd backend
npm install
Copy-Item .env.example .env
npm run dev
```

Backend runs on `http://localhost:4000` by default.

### 2) Frontend Setup (new terminal)

```powershell
cd frontend
npm install
Copy-Item .env.example .env
npm run dev
```

Frontend runs on Vite default port (usually `http://localhost:5173`).

## Environment Variables

### Backend (`backend/.env`)

- `PORT` (default: `4000`)
- `HOST` (default: `0.0.0.0`)
- `JWT_SECRET` (required for auth)
- `DB_FILE` (default local SQLite file)
- `GOOGLE_API_KEY` (required for AI diet analysis)
  - supports **multiple keys** separated by commas for fallback
- `GOOGLE_GEMINI_MODEL` (optional model override)
- `UPLOADS_DIR` (optional uploads location)
- `CLOUDINARY_URL` (optional cloud media storage)

### Frontend (`frontend/.env`)

- `VITE_API_URL` (backend base URL, example: `http://localhost:4000`)

## Useful Scripts

### Backend

- `npm run dev` — start with nodemon
- `npm start` — production start

### Frontend

- `npm run dev` — local development
- `npm run build` — production build
- `npm run preview` — preview built app

## API Highlights

- `POST /api/signup`
- `POST /api/login`
- `GET /api/profile`
- `POST /api/diet/analyze`
- `POST /api/diet/log`
- `GET /api/diet/logs?date=YYYY-MM-DD`
- `POST /api/posts`
- `GET /api/feed`

Most protected routes require:

```http
Authorization: Bearer <token>
```

## Troubleshooting

### Port already in use (`EADDRINUSE`)

```powershell
Get-NetTCPConnection -LocalPort 4000 -State Listen |
  Select-Object -ExpandProperty OwningProcess -Unique |
  ForEach-Object { Stop-Process -Id $_ -Force }
```

### Feed images not loading

- Ensure backend is running and `/uploads/...` is reachable
- Verify `UPLOADS_DIR` points to a writable and served folder

### AI diet analyze errors

- Confirm `GOOGLE_API_KEY` is set
- If you hit quota/rate limits, add fallback keys via comma-separated `GOOGLE_API_KEY`
- If model issues occur, set `GOOGLE_GEMINI_MODEL` explicitly

## Deployment Notes

- Frontend can be deployed on Vercel
- Backend can be deployed on Render
- In Vercel project settings, set `VITE_API_URL` to your Render backend URL (example: `https://fitness-new-buddy.onrender.com`)
- Use environment variables from `.env.example` in deployment dashboards

## Security Notes

- Do not commit real API keys or secrets
- Rotate keys if they were exposed
- Use a strong `JWT_SECRET` in production
