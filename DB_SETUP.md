# Database Setup Guide

This guide explains how to set up and manage the PostgreSQL database for the Study Resources Center project.

## Prerequisites

- PostgreSQL installed and running
- Node.js and npm installed

## Initial Setup

1. Make sure PostgreSQL is running
2. Set up your `.env` file with the correct database connection string
   ```
   DATABASE_URL="postgresql://username:password@localhost:5432/game_proxy_db?schema=public"
   ```
   Replace `username` and `password` with your actual PostgreSQL credentials.

3. Install dependencies:
   ```bash
   npm install
   ```

4. Generate Prisma client:
   ```bash
   npm run prisma:generate
   ```

5. Run database migrations to create tables:
   ```bash
   npm run prisma:migrate
   ```

6. Seed the database with initial data:
   ```bash
   node db/setup.js
   ```

## Default Credentials

After setup, you can log in with:
- Username: `admin`
- Password: `admin123`

**Important:** Change these credentials in production.

## Database Management

### Prisma Studio

You can use Prisma Studio to view and edit your database:

```bash
npm run prisma:studio
```

This will open a web interface at http://localhost:5555

### Creating Migrations

If you change the schema.prisma file, create a new migration:

```bash
npx prisma migrate dev --name describe_your_changes
```

### Applying Migrations

In development:
```bash
npx prisma migrate dev
```

In production:
```bash
npx prisma migrate deploy
```

## Database Models

The database includes the following models:

1. **User** - User accounts for authentication
2. **Chat** - Chat rooms for group discussions
3. **ChatMessage** - Messages in chat rooms
4. **GameSaveData** - Saved game data for users
5. **ProxiedUrl** - History of URLs accessed through the proxy

## Database Backup

Backup the PostgreSQL database:

```bash
pg_dump -U username game_proxy_db > backup.sql
```

Restore from backup:

```bash
psql -U username game_proxy_db < backup.sql
```

## Environment-Specific Configuration

For different environments, create separate .env files:
- `.env.development`
- `.env.production`

## Troubleshooting

If you encounter errors:

1. Check your PostgreSQL service is running
2. Verify the connection string in your `.env` file 
3. Ensure your PostgreSQL user has the proper permissions
4. Check for conflicting table names or schema issues

For more help, consult the [Prisma documentation](https://www.prisma.io/docs/). 