Fitness Buddy — starter full-stack skeleton

Structure:

- backend/ (Express + SQLite)
- frontend/ (React + Vite)

Quick start (PowerShell):

# Backend

cd backend; npm install; npm run dev

# Frontend (in a new terminal)

cd frontend; npm install; npm run dev

Notes:

- Backend uses a local SQLite file at backend/db.sqlite
- Create `.env` files from the provided `.env.example` templates
  - Backend: `backend/.env` (PORT, JWT_SECRET, DB_FILE)
  - Frontend: `frontend/.env` (VITE_API_URL)
  - Default JWT secret is only for development; set JWT_SECRET for production
