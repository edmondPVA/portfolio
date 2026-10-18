# Admin dashboard: Supabase setup

The portfolio is a static site, so the login, the messages inbox and (later) your editable content live in
[Supabase](https://supabase.com). The website only ever holds the **public** project URL and **publishable**
key (in `admin/config.js`). Those are designed to be public. What anyone can actually do with them is decided by
the database rules in `schema.sql`, not by hiding pages.

## One-time setup

1. **Turn off public sign-ups.** In Supabase: Authentication, then the sign-in settings. Make sure
   "Allow new users to sign up" is **off**. There is no registration page on the site.
2. **Create your admin user.** Authentication, then Users, then Add user. Use your email and a strong password,
   and tick **Auto Confirm User**.
3. **Run the database setup.** SQL Editor, then New query. Paste all of `supabase/schema.sql` and click Run.
   It is safe to run again. The last query should show one row with your email. If it shows no rows, the user
   in step 2 does not exist yet: create it, then run the file again.
4. **Sign in** at `/admin/login/` on your site.

## What the rules guarantee

| Who | Messages | Admin list |
| --- | --- | --- |
| Website visitor | Can **add** a message (name, email, subject, message only). Cannot read, change or delete anything. | No access |
| Signed-in stranger (not in `admins`) | Sees nothing, changes nothing | No access |
| You (listed in `admins`) | Read, delete, and change only the read/unread flag | No access (managed here in SQL) |

Even if someone found the login page, or somehow created an account, they could not read your messages.

## Never do this

* Never put the `service_role` / secret key, your Supabase password, or any email-service key in `admin/config.js`,
  any other front-end file, or GitHub. Those belong only in Supabase's server-side secrets.
* Never commit a `.env` file. `.gitignore` blocks it, and `.env.example` shows the placeholders.

## Good to know

* **Same-site caution:** the admin session is kept in your browser's local storage for `edmondpva.github.io`.
  Do not host pages from people you do not trust on that same address.
* **Spam:** anyone can submit the contact form (that is how contact forms work). The database limits each
  field's size, and Web3Forms filters spam for the email side. If spam ever becomes a problem, add a CAPTCHA.
* **Email replies** (a later step) need an email provider such as Resend. Its secret key would be stored as a
  Supabase Edge Function secret, never in this repository.

## Troubleshooting

| Message on the dashboard | Fix |
| --- | --- |
| "The database is not set up yet" | Run `schema.sql` (step 3). |
| "This account is not authorized" | Your user is not in `admins`. Check the email in section 3 of `schema.sql` and run it again. |
| "Email is not confirmed" | In Supabase, open the user and confirm it, or re-create it with Auto Confirm ticked. |
| "Incorrect email or password" | Reset the password under Authentication, then Users. |
