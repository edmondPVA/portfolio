# Edmond Polinar · VA & QA Portfolio

My personal portfolio website, showing my work as a **Virtual Assistant** and a **Quality Assurance tester**.

**Live site:** [edmondpva.github.io/portfolio](https://edmondpva.github.io/portfolio)

## What's on the site

- **Two tracks**, one for each kind of work:
  - **Virtual Assistant**: data entry and records, admin and documentation, customer and client support, automation and CRM follow-up
  - **Quality Assurance**: functional and end-to-end testing, regression and sanity testing, exploratory testing, defect reports and test cases
- **Project case studies** with screenshots and short videos:
  - **Order logging, automated**: a buyflow automation that runs a test order and stores the order data in Google Sheets, replacing eight manual steps with one run
  - **CRM Practice Simulator**: a browser-based CRM I built to practice VA work ([repo](https://github.com/edmondPVA/CRM-practice-simulator) · [live demo](https://edmondpva.github.io/CRM-practice-simulator/))
  - **CRM Event Automation with n8n**: CRM events that trigger real welcome, thank-you and feedback emails and log to Google Sheets
- **Work history** across QA, customer support and office administration
- **Contact form** that sends messages straight to my inbox

## How it's built

| Part | Built with |
| --- | --- |
| Website | Plain HTML, CSS and JavaScript, hosted on GitHub Pages. No frameworks, no build step |
| Contact form | [Web3Forms](https://web3forms.com) for email delivery, plus a copy saved to the database |
| Admin dashboard | A private, login-protected page (`/admin/`) where I read messages and edit my profile, skills, experience, projects and media without touching code |
| Database and login | [Supabase](https://supabase.com), with Row Level Security rules so visitors can only send a message and only I can read them |

## Project structure

```
portfolio/
├── index.html          # The public website
├── favicon.svg
├── admin/              # Private admin dashboard and login page
├── assets/             # Screenshots and videos for each case study
└── supabase/           # Database setup scripts and security rules
```

## Security

The only keys in this repository are the **public** Supabase publishable key and the Web3Forms access key. Both are designed to be visible in front-end code. What visitors can do is controlled by the database rules, not by hiding the keys. Private keys are never committed (see `.gitignore` and `.env.example`).

Setting up the admin dashboard: see [`supabase/README.md`](supabase/README.md).

## Contact

**Edmond Polinar** · General Santos City, Philippines
[LinkedIn](https://www.linkedin.com/in/edmond-polinar-957346413/) · [GitHub](https://github.com/edmondPVA) · or use the contact form on the [live site](https://edmondpva.github.io/portfolio)
