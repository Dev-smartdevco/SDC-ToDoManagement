# MY OS — Personal Command Center

Personal productivity admin system by **SmartDevCo**.

Open the app, see what you should work on **now**, finish what is due **today**, capture anything quickly, and review the day without friction.

## Stack

- Frontend: Next.js, TypeScript, Tailwind CSS
- Backend: Node.js, Express, TypeScript, REST
- Database: PostgreSQL (Prisma)

## Setup

1. Copy environment files if needed:

```bash
cp .env.example backend/.env
```

2. Install dependencies:

```bash
npm install
```

3. Run migrations and seed:

```bash
npm run db:migrate
npm run db:seed
```

4. Start both apps:

```bash
npm run dev
```

- Web: `http://localhost:3000`
- API: `http://localhost:4000`

## Login

- Email: `admin@smartdevco.com`
- Password: value of `ADMIN_PASSWORD` in `backend/.env`

There is no public registration. This is a personal admin system.

## Keyboard

- `N` new task
- `Q` quick add
- `/` search
- `T` go to Today
- `Esc` close modal
- `Space` start/pause focus (when a focus session is active)

Shortcuts are ignored while typing in inputs.

## Language

English is the default. Switch to Arabic from the sidebar. The document direction becomes `rtl`.
