# Synergy Recovery OS

Internal recovery management tool for Synergy Bonding Solutions Pvt Ltd (Pune), supporting the Polygum, Ombond, and Stick-onn brands.

## Tech Stack

- Next.js 14 (App Router) + TypeScript
- Tailwind CSS + shadcn/ui + lucide-react
- Prisma ORM + Supabase Postgres
- NextAuth.js authentication
- Recharts for analytics visualizations
- Anthropic SDK for AI features
- React Hook Form + Zod for forms and validation
- Sonner for toast notifications
- date-fns for date utilities

## Project Setup

1. Install dependencies:

```bash
npm install
```

2. Create local environment file:

```bash
cp .env.example .env.local
```

3. Fill all required values in `.env.local`.

4. Prisma setup:

```bash
npx prisma generate
```

5. Start development server:

```bash
npm run dev
```

6. Open [http://localhost:3000](http://localhost:3000).

## Deployment Checklist

1. Create Supabase project.
2. Push schema: `npx prisma db push`.
3. Seed data: `npx prisma db seed`.
4. Push to GitHub.
5. Import to Vercel.
6. Add all env vars.
7. Deploy.
8. Visit `/api/auth/seed-admin` (one-time, then remove route).
9. Login with admin credentials.
10. Setup Python bridge on office PC.
