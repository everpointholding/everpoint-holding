EVERPOINT HOLDING — FRONTEND ADMIN & EMPLOYEE PORTAL
====================================================

This version includes the upgraded visual experience requested by EverPoint Holding:
- More welcoming, human, premium dashboard styling
- Human-centered photographic hero visual in the employee portal
- Softer cards, richer spacing, rounded controls, better hierarchy and responsive layouts
- Improved public home/service/careers styling
- Upgraded employee dashboard, document center, upload area, chat and notification center
- Upgraded private admin control center
- Admin remains accessible only at /admin.html

Important architecture note:
This is still the frontend-only version. Shared data across different devices requires the online backend/database version discussed separately.

Document Center updated to the seven requested downloadable PDFs.


CAREERS / MICROSOFT TEAMS UPDATE
- Preferred roles are Data Entry, Records Entry Clerk, Executive Assistance, and Data Entry Clerk.
- Applicants select employment type (Full-Time/Part-Time/Contract) and work arrangement (Remote/Hybrid/On-site).
- Microsoft Teams account/email is required on the application form.
- The form is prepared for Microsoft Teams Workflows webhook delivery. Set window.EVERPOINT_TEAMS_SUBMISSION_URL to the webhook URL, or preferably route the request through the Netlify Function backend in production.
- Microsoft Teams delivery is not active until the Teams workflow/webhook is connected.


Careers update: Microsoft Teams email/username is now a required applicant contact field. Applications are saved directly to the frontend admin dashboard and include the Teams contact for recruitment follow-up. No Teams webhook is required for this version. A true Teams webhook can be added later through the Netlify Function backend if desired.
