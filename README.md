# EverPoint Holding — Full-Stack Netlify Website

## Architecture

- Netlify static hosting (`public/`): the website, careers page, employee portal and admin dashboard
- Netlify Functions (`netlify/functions/api.mjs`): the `/api/*` backend
- Netlify Database (managed Postgres): admins, employees, applications, messages, notifications, sessions and upload metadata. Migrations in `netlify/database/migrations/` are applied automatically on every deploy.
- Netlify Blobs: private employee PDF uploads (store `employee-documents`)

## Important security change

There are **no hard-coded admin credentials** in the public JavaScript. Admin passwords are stored as salted PBKDF2 hashes in the database. Sessions are random, HttpOnly cookies whose hashes are stored in the database.

## Netlify setup

1. In the Netlify dashboard open **Project configuration → Environment variables** and add `SETUP_TOKEN` — a long private bootstrap/reset token. Optionally add `SESSION_DAYS` (defaults to 7).
2. Deploy the site (push to the connected branch or trigger a deploy).
3. Open `/setup.html` on the live site, enter your setup token, admin email and a strong password.
4. `/setup.html` stays available; it can update/reset the admin account whenever the setup token is supplied.

Do not commit secrets to GitHub.

## Admin credentials

The initial admin account is created through `/setup.html`. After logging in, use **Security Settings** to change the admin email and password. Passwords are never displayed in the frontend source.

## Employee access

Employees are created from the admin dashboard. Their access code is stored as a salted hash. The admin can replace an employee's access code, but cannot read the old code.

## Careers

The Careers form includes:

- Data Entry
- Records Entry Clerk
- Executive Assistance
- Data Entry Clerk
- Full-Time / Part-Time / Contract
- Remote / Hybrid / On-site
- Required Microsoft Teams email/username for recruitment follow-up

Applications are stored in Netlify Database and appear in the admin dashboard.

## Uploads

Employees can upload PDFs up to 15 MB. Files are stored privately in Netlify Blobs; the database stores the upload metadata. The admin dashboard can list and download them through authenticated API routes.

## Recommended production hardening

- Put the site behind your custom domain (HTTPS is automatic on Netlify).
- Use a strong unique setup token and rotate it after bootstrap.
- Consider spam protection on the public application form.
- Keep applicant data access limited to authorized HR/admin users.
