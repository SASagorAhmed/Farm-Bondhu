# FarmBondhu

FarmBondhu is a green SaaS enterprise ecosystem for Bangladesh. It connects agriculture, GreenBondhu Marketplace commerce, VetBondhu animal care, MediBondhu human healthcare, community learning, AI-assisted tools, and admin operations inside one role-based digital platform.

FarmBondhu is not only for agriculture users. A person can use only the service they need: buy from the marketplace, book a doctor consultation, get veterinary support for a pet or livestock animal, run a seller shop, manage a farm, join the community, or operate the platform as an admin.

Each module keeps its own routes, permissions, data flow, and visual identity so the platform can grow as an enterprise product without mixing business domains.

---

## Platform Vision

FarmBondhu is designed as a multi-service SaaS platform where different users enter through different needs:

| User need | FarmBondhu service |
| --- | --- |
| Manage farm operations | Farm management workspace |
| Buy products or supplies | GreenBondhu Marketplace |
| Sell products online | Seller and vendor shop tools |
| Get animal or pet care | VetBondhu veterinary service |
| Book a human doctor | MediBondhu healthcare service |
| Learn and ask questions | Community and learning modules |
| Create shop visuals | Seller photo editor |
| Manage platform operations | Admin and support center |

The product goal is to provide a trusted green digital ecosystem where agriculture, healthcare, commerce, and support services can work together while still remaining cleanly separated.

---

## Core Services

### Farm Management

FarmBondhu helps farmers and farm operators manage day-to-day agricultural work. The farm workspace supports records and workflows for farms, animals, sheds, health, production, finances, sales, and related operations.

This is one major vertical of the platform, but not the only purpose of FarmBondhu.

### GreenBondhu Marketplace

GreenBondhu Marketplace is FarmBondhu's commerce hub. It supports buyers, sellers, vendors, and admins across product browsing, carts, checkout, order tracking, seller storefronts, inventory, reviews, flash sales, wholesale pricing, official shop tools, and marketplace moderation.

The codebase may still use `marketplace` as the internal route and module name, while GreenBondhu Marketplace can be used as the public-facing brand name for the commerce experience.

Developer reference: [docs/marketplace.md](docs/marketplace.md)

### VetBondhu

VetBondhu provides animal-care and veterinary services. It is built for livestock owners, pet owners, farmers, and vets who need veterinary consultation, booking, waiting rooms, video calls, prescriptions, and preserved consultation history.

VetBondhu stays separate from MediBondhu in routes, database tables, query keys, UI theme, and business rules.

Call workflow reference: [VETCALL.md](VETCALL.md)

### MediBondhu

MediBondhu provides human healthcare services. Patients can discover doctors, check availability, book online or chamber appointments, join waiting rooms, attend online consultations, and preserve chat history after a consultation ends.

MediBondhu is not a veterinary module. It uses its own appointment model, doctor availability, human-care routes, and `medibondhu_appointments` data flow.

Status reference: [docs/MEDIBONDHU_BOOKING_STATUS.md](docs/MEDIBONDHU_BOOKING_STATUS.md)

### Community and Learning

FarmBondhu includes social and knowledge-sharing features for posts, questions, answers, learning access, and community support. These features help users learn, discuss problems, and share practical knowledge.

### Cow Weight and AI Tools

The platform includes AI-assisted and computer-vision workflows such as cow weight and meat estimation, plus AI help features for farm-related guidance and productivity.

### Seller Photo Editor

The seller photo editor is a design workspace for product photos, shop banners, logos, profile images, and promotional visuals. It uses a Fabric.js-powered editor and connects to shop/product workflows.

### Admin, Support, and Moderation

FarmBondhu includes enterprise admin tools for approvals, user access, marketplace moderation, seller lane review, support chat, notification privacy, email audit, order oversight, reports, and platform governance.

---

## Who Can Use FarmBondhu?

| User type | What they can do |
| --- | --- |
| Farmers | Manage farms, animals, production, and agricultural records |
| Buyers | Browse GreenBondhu Marketplace, cart products, order, and track purchases |
| Sellers and vendors | Run shops, manage inventory, receive orders, chat with buyers, and manage payouts |
| Pet and livestock owners | Use VetBondhu for veterinary consultation and animal-care support |
| Patients | Use MediBondhu to find doctors and book human healthcare consultations |
| Doctors | Manage MediBondhu schedules, appointments, patients, and consultations |
| Vets | Handle VetBondhu consultation requests, prescriptions, and animal-care records |
| Admins | Review access, moderate marketplace activity, support users, and manage platform operations |

---

## Enterprise Capabilities

- **Role-based access:** Separate capabilities for buyers, sellers, farmers, vets, doctors, admins, and support workflows.
- **Privacy-aware data:** User-specific orders, notifications, chats, consultations, and dashboards are separated by account and role.
- **Realtime experiences:** Supabase realtime and polling fallbacks support consultation updates, chat, notifications, and marketplace activity.
- **Video consultations:** ZegoCloud powers VetBondhu and MediBondhu online rooms with module-specific behavior.
- **Commerce operations:** Product listings, carts, checkout, order tracking, seller dashboards, reviews, inventory, flash sales, and payouts.
- **Healthcare workflows:** Doctor/vet availability, appointment booking, waiting rooms, consultation rooms, rejoin grace periods, and preserved chat history.
- **Admin governance:** Approvals, moderation, reports, email audit, support chat, seller lane review, and platform management.
- **Design tools:** Built-in seller photo editor for creating marketplace-ready assets.

---

## Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | React, TypeScript, Vite, React Router |
| UI system | Tailwind CSS, shadcn/ui, Framer Motion |
| Client state | React Context, TanStack React Query |
| Backend | Node.js, Express, modular REST APIs |
| Database | PostgreSQL |
| Realtime | Supabase realtime channels with polling fallbacks |
| Authentication | JWT-based auth middleware and role/capability checks |
| Video calls | ZegoCloud |
| Media and uploads | Cloudinary |
| Email | Brevo / SMTP |
| AI and assistance | OpenRouter, computer-vision workflows |
| PDF and documents | Prescription and order-related document utilities |

---

## Repository Structure

```text
FarmBondhu/
|-- backend/          # Express API, routes, services, schema bootstrap
|-- frontend/         # React + Vite application
|-- docs/             # Module references, QA notes, and workflow docs
|-- scripts/          # Data and build helper scripts
|-- VETCALL.md        # Consultation workflow source of truth
|-- aboutproject.md   # High-level project documentation
`-- README.md         # GitHub project profile
```

---

## Key Documentation

- [Project overview](aboutproject.md)
- [Marketplace reference](docs/marketplace.md)
- [Consultation workflow](VETCALL.md)
- [MediBondhu booking status](docs/MEDIBONDHU_BOOKING_STATUS.md)
- [MediBondhu QA checklist](docs/MEDIBONDHU_QA_TWO_BROWSER.md)
- [MediBondhu Zego token notes](docs/MEDIBONDHU_ZEGO_TOKEN.md)
- [Backend setup](backend/README.md)
- [Frontend setup](frontend/README.md)

---

## Local Development

### Prerequisites

- Node.js and npm
- PostgreSQL database connection
- Environment variables for the frontend and backend
- Optional integration keys for Supabase, ZegoCloud, Cloudinary, Brevo/SMTP, and OpenRouter

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend runs with Vite. Configure browser-facing environment variables for API URL, Supabase, and enabled integrations.

### Backend

```bash
cd backend
cp .env.example .env
npm install
npm run dev
```

At minimum, configure database and auth-related values in `backend/.env`. See [backend/README.md](backend/README.md) and [backend/.env.example](backend/.env.example) for the full environment list.

Useful backend checks:

```bash
GET http://localhost:3001/api/health
GET http://localhost:3001/api/v1
```

---

## Deployment Notes

- **Frontend:** Deploy from `frontend/` with a standard `npm install` and `npm run build`.
- **Backend:** Deploy from `backend/` as an Express server or serverless function, depending on host configuration.
- **Environment:** Production must provide database, JWT/auth, CORS origin, public API URL, and integration secrets for enabled services.
- **Vercel:** The frontend is compatible with strict npm peer dependency resolution on React 18.
- **Security:** Do not commit real `.env` files or production secrets.

---

## Screenshots and Demo

Add screenshots, GIFs, or hosted demo links here when public assets are ready:

| Area | Preview |
| --- | --- |
| FarmBondhu workspace | Coming soon |
| GreenBondhu Marketplace | Coming soon |
| VetBondhu consultation | Coming soon |
| MediBondhu doctor booking | Coming soon |
| Seller photo editor | Coming soon |
| Admin dashboard | Coming soon |

---

## Product Principles

- FarmBondhu is the umbrella SaaS platform.
- GreenBondhu Marketplace is the commerce hub under FarmBondhu.
- VetBondhu and MediBondhu are separate modules and should not share routes, data tables, query keys, or UI themes.
- Users should see only their own private notifications, orders, chats, and consultation records.
- Each workspace should use module-matched branding and permissions.
- Enterprise features should be built with auditability, privacy, and operational clarity in mind.

---

## Current Status

FarmBondhu is under active development. The repository includes production-oriented modules, active feature work, and living documentation for major workflows.

Planned public README improvements:

- Add real product screenshots.
- Add deployment URLs when production domains are final.
- Add a short architecture diagram.
- Add contribution and license details when the project is ready for public collaboration.
