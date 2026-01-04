# Smart Bed Planner API

Backend service for the Smart Bed Admission Planner production system.

## Stack
- Node.js + Express (TypeScript)
- PostgreSQL with Prisma ORM
- JWT authentication with role-based access control
- Zod for payload validation

## Getting Started

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Configure environment**
   Copy `.env.example` to `.env` and adjust values (database credentials, JWT secrets, port).

3. **Run database migrations**
   ```bash
   npx prisma migrate dev --name init
   ```

4. **Start development server**
   ```bash
   npm run dev
   ```

5. **Health check**
   Visit `http://localhost:4000/api/health` to verify the API is running.

## Project Structure

```
server/
├── prisma/
│   └── schema.prisma      # Database schema
├── src/
│   ├── app.ts             # Express app configuration
│   ├── server.ts          # Entry point
│   ├── config/            # Environment & configuration helpers
│   ├── middleware/        # Error and not-found middleware
│   ├── routes/            # Route definitions
│   └── services/          # Prisma client and shared services
├── package.json
├── tsconfig.json
└── .env.example
```

## Next Steps
- Implement authentication routes (login, refresh, logout) using hashed passwords.
- Add CRUD endpoints for patients, bookings, bed snapshots with validation & role checks.
- Record audit logs for critical actions.
- Build reporting/export endpoints (CSV/Excel/PDF) with filters.
- Integrate automated tests (Jest / supertest) and CI workflow.
- Prepare Dockerfile and deployment pipeline for staging/production environments.
