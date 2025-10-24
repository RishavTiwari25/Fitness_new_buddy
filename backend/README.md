Backend (Express + SQLite)

Run instructions (PowerShell):

1. cd backend
2. npm install
3. npm run dev # requires nodemon (devDependency)

Environment variables:

- Copy `.env.example` to `.env` and adjust values
- `PORT` (default 4000)
- `JWT_SECRET` (change for production)
- `DB_FILE` (optional custom SQLite path)

API endpoints:

- POST /api/signup { name, email, password }
- POST /api/login { email, password }
- GET /api/profile (Authorization: Bearer <token>)
