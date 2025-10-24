Backend (Express + SQLite)

Run instructions (PowerShell):

1. cd backend
2. npm install
3. npm run dev # requires nodemon (devDependency)

API endpoints:

- POST /api/signup { name, email, password }
- POST /api/login { email, password }
- GET /api/profile (Authorization: Bearer <token>)
