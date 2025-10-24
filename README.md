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
- Default JWT secret is in code for development; set JWT_SECRET environment variable for production
