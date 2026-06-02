# FarmBondhu

FarmBondhu is a full-stack agriculture platform for Bangladesh, bringing farm management, marketplace commerce, veterinary care, human healthcare, community learning, and AI-assisted tools into one role-based workspace.

The project is designed for farmers, buyers, sellers, vets, MediBondhu doctors, and platform admins. Each module has its own routes, permissions, UI theme, and data flow so the platform can grow without mixing business domains.

---

## Highlights

- **Farm management:** Track farms, animals, sheds, health, production, and operational workflows.
- **Marketplace:** Browse products, manage carts and checkout, run seller shops, handle orders, reviews, inventory, flash sales, and buyer-seller chat.
- **VetBondhu:** Veterinary consultation booking, waiting room, video calls, prescriptions, and consultation history.
- **MediBondhu:** Human-care doctor discovery, availability, appointments, online consultations, 20-second rejoin grace, and chat history.
- **Cow weight and AI tools:** Computer-vision-assisted cow weight workflows and farm assistance features.
- **Community and learning:** Knowledge sharing, Q&A, posts, answers, and educational access.
- **Admin operations:** Role approvals, marketplace moderation, seller lanes, customer support, email audit, reports, and platform management.
- **Seller photo editor:** Fabric.js-powered design workspace for shop, product, banner, logo, and profile assets.

---

## Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | React, TypeScript, Vite, React Router |
| UI | Tailwind CSS, shadcn/ui, Framer Motion |
| State and data | TanStack React Query, React Context |
| Backend | Node.js, Express, modular REST APIs |
| Database | PostgreSQL |
| Realtime | Supabase realtime channels and polling fallbacks |
| Video calls | ZegoCloud |
| Media | Cloudinary |
| Email | Brevo / SMTP |
| AI | OpenRouter and computer vision workflows |

---

## Main Modules

### Marketplace

FarmBondhu Marketplace supports buyer browsing, carts, checkout, seller storefronts, inventory, order management, reviews, flash sales, official shop tools, chat receipts, message translation, and moderation workflows.

Developer reference: [docs/marketplace.md](docs/marketplace.md)

### VetBondhu

VetBondhu is the veterinary-care module. It handles animal-focused consultation booking, vet-side requests, waiting rooms, Zego video calls, prescriptions, and preserved consultation messages.

Call workflow reference: [VETCALL.md](VETCALL.md)

### MediBondhu

MediBondhu is the human-care module. It stays separate from VetBondhu and uses its own appointment routes, tables, doctor availability, patient booking flow, online rooms, and grace-period behavior.

Status reference: [docs/MEDIBONDHU_BOOKING_STATUS.md](docs/MEDIBONDHU_BOOKING_STATUS.md)

### Farm, Community, Learning, and Admin

The platform also includes farm operations, community posts and answers, learning access, notifications, profile management, Access Center permissions, support chat, admin review tools, reporting, and platform governance.

Project reference: [aboutproject.md](aboutproject.md)

---

## Repository Structure

```text
FarmBondhu/
|-- backend/          # Express API, routes, services, schema bootstrap
|-- frontend/         # React + Vite application
|-- docs/             # Module references and QA notes
|-- scripts/          # Data/build helper scripts
|-- VETCALL.md        # Consultation workflow source of truth
`-- aboutproject.md   # High-level project documentation
```

---

## Local Development

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend runs with Vite. Configure frontend environment variables in the appropriate local env file for API URL, Supabase, and integration keys used by the browser.

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

---

## Screenshots

Add screenshots or GIFs here when public assets are ready:

| Area | Preview |
| --- | --- |
| Marketplace | Coming soon |
| VetBondhu Consultation | Coming soon |
| MediBondhu Doctor Booking | Coming soon |
| Seller Photo Editor | Coming soon |
| Admin Dashboard | Coming soon |

---

## Documentation

- [Project overview](aboutproject.md)
- [Marketplace reference](docs/marketplace.md)
- [Consultation workflow](VETCALL.md)
- [MediBondhu booking status](docs/MEDIBONDHU_BOOKING_STATUS.md)
- [MediBondhu QA checklist](docs/MEDIBONDHU_QA_TWO_BROWSER.md)
- [Backend setup](backend/README.md)
- [Frontend setup](frontend/README.md)

---

## Development Principles

- Keep VetBondhu and MediBondhu separate in routes, data, query keys, and themes.
- Preserve user privacy across notifications, orders, chats, and role-specific dashboards.
- Match UI colors to the active workspace/module.
- Prefer shared services and documented workflows for marketplace, consultation, and admin features.
- Keep production builds compatible with strict dependency resolution.

---

## Status

FarmBondhu is under active development. The repository includes production-oriented modules, active feature work, and living documentation for major workflows.
