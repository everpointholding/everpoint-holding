# EverPoint Holding — Full-Stack Cloudflare Website

This project replaces the browser-only demo with a real Cloudflare backend.

## Architecture

- Cloudflare Workers + Static Assets: website and API
- Cloudflare D1: admins, employees, applications, messages, notifications, sessions and upload metadata
- Supabase Storage: private employee PDF uploads
- GitHub: source control and automatic Cloudflare deployment

Cloudflare Workers can deploy Worker code and static assets together; D1 is accessed through a Worker binding, while private employee PDFs are stored in Supabase Storage. See the official docs linked in the setup guide below.

## Important security change

There are **no hard-coded admin credentials** in the public JavaScript. Admin passwords are stored as salted PBKDF2 hashes in D1. Sessions are random, HttpOnly cookies whose hashes are stored in D1.

## Cloudflare browser setup

1. Create a GitHub repository and upload this project.
2. In Cloudflare Dashboard open **Workers & Pages → Create application → Import a repository** and connect GitHub.
3. Create a D1 database named `everpoint-holding`.
4. In Supabase Storage, create the private bucket `employee-documents` and allow `application/pdf`.
5. Replace `REPLACE_WITH_YOUR_D1_DATABASE_ID` in `wrangler.jsonc` with the database ID shown by Cloudflare.
6. Run the migration from the D1 dashboard if you prefer the browser, or use the migration command in `package.json`.
7. In Cloudflare Worker Settings → Variables and Secrets, add `SUPABASE_URL` and `SUPABASE_SECRET_KEY` as secrets, plus `SETUP_TOKEN`.
8. Configure the GitHub/Workers build to deploy with `npx wrangler deploy` (no build command needed).
9. After the first deployment, open `/setup.html` on the Worker URL.
10. Enter your setup token, admin email, and strong password.
11. Keep `/setup.html` available permanently; it can update/reset the admin account when the setup token is supplied.

### Secrets

In Cloudflare Worker **Settings → Variables and Secrets**, add:

- `SETUP_TOKEN` — a long private bootstrap/reset token.
- `SUPABASE_URL` — your Supabase project URL.
- `SUPABASE_SECRET_KEY` — your Supabase secret/service key. Never expose it in GitHub or frontend code.

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

Applications are stored in D1 and appear in the admin dashboard.

## Uploads

Employees can upload PDFs up to 15 MB. Files are stored privately in Supabase Storage; D1 stores the upload metadata. The admin dashboard can list and download them through authenticated API routes.

## Recommended production hardening

- Put the site behind your custom domain and HTTPS.
- Use a strong unique setup token and remove/rotate it after bootstrap.
- Enable Cloudflare WAF/rate limiting as traffic grows.
- Consider Cloudflare Turnstile on the public application form to reduce automated spam.
- Keep applicant data access limited to authorized HR/admin users.

## Official Cloudflare documentation

- Workers Static Assets: https://developers.cloudflare.com/workers/static-assets/
- GitHub integration: https://developers.cloudflare.com/workers/ci-cd/builds/git-integration/github-integration/
- D1: https://developers.cloudflare.com/d1/get-started/
- Supabase Storage: https://supabase.com/docs/guides/storage
- Worker bindings: https://developers.cloudflare.com/workers/runtime-apis/bindings/
