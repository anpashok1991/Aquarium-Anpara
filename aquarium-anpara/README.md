# Aquarium Anpara

A full-featured e-commerce web application for a pet and aquarium store, built with Node.js, Express, EJS, Prisma ORM, and SQLite.

## Features

### Customer Features
- Product browsing with search, filter, sort, and pagination
- Product detail pages with images, reviews, and related products
- Shopping cart (session-based for guests, persistent for logged-in users) with **Save for Later**
- Quantity adjustment with +/- buttons and **manual number input**
- Guest checkout — place orders without logging in
- Checkout with saved addresses or manual shipping details
- **"Go to Cart"** button replaces "Add" after item is added to cart
- Order tracking by order number
- Wishlist functionality
- User registration and login (email/phone + password)
- Google Sign-In authentication
- Dark/light mode theme toggle
- WhatsApp integration for order inquiries

### Admin Features
- Dashboard with key metrics (orders, revenue, products, customers)
- Product CRUD with image upload
- Category management with parent-child hierarchy and **image upload**
- Brand management
- Order management with status updates
- Customer viewing
- Inventory management with stock adjustments and logs
- Coupon management with validation
- Review moderation (approve/delete/reply)
- Reports (sales, products, stock)
- Banner management with image upload
- Gallery management
- Settings management
- User management (create admin/staff accounts, change roles, activate/deactivate)
- Contact message management
- Admin page protection (requires admin/staff login)

### Authentication & Security
- JWT-based authentication with httpOnly cookies
- Role-based access control (admin, staff, customer)
- Google OAuth2 Sign-In integration
- Admin page server-side protection via middleware
- Password hashing with bcryptjs
- Rate limiting on API endpoints
- Helmet security headers
- File upload validation (images only, 5MB limit)

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js |
| Framework | Express.js v4.18.2 |
| Template Engine | EJS |
| ORM | Prisma v7 (`@prisma/client` + `@prisma/adapter-better-sqlite3`) |
| Database | SQLite (better-sqlite3) |
| Authentication | JWT + bcryptjs |
| Google Auth | google-auth-library |
| File Upload | Multer |
| Security | Helmet, CORS, express-rate-limit |
| Frontend | Bootstrap 5.3.3, Font Awesome 6.5.1, Vanilla JS |

## Project Structure

```
aquarium-anpara/
├── .env                        # Environment variables
├── .gitignore
├── package.json                # Dependencies and scripts
├── prisma/
│   ├── schema.prisma           # Prisma schema (21 models)
│   └── prisma.config.ts        # Prisma config
├── server.js                   # Main Express server
├── data/                       # SQLite database files
├── uploads/                    # User-uploaded files
│   ├── banners/
│   ├── categories/
│   ├── gallery/
│   ├── products/
│   └── settings/
├── public/                     # Static assets
│   ├── css/style.css           # Premium glassmorphism UI
│   └── js/app.js
├── server/
│   ├── database.js             # Prisma client wrapper
│   ├── seed.js                 # Database seeder
│   ├── middleware/
│   │   └── auth.js             # JWT auth + role middleware (async)
│   └── routes/
│       ├── addresses.js        # Saved addresses CRUD
│       ├── admin.js            # Admin user management
│       ├── auth.js             # Login, register, Google auth
│       ├── banners.js          # Banner CRUD
│       ├── brands.js           # Brand CRUD
│       ├── cart.js             # Cart with save-for-later
│       ├── categories.js       # Category CRUD (tree)
│       ├── contact.js          # Contact messages
│       ├── coupons.js          # Coupon CRUD + validation
│       ├── customers.js        # Customer management
│       ├── gallery.js          # Gallery CRUD
│       ├── inventory.js        # Stock management
│       ├── notifications.js    # User notifications
│       ├── orders.js           # Orders CRUD + tracking
│       ├── pages.js            # EJS page routes (async)
│       ├── products.js         # Product CRUD (search/paginate)
│       ├── reports.js          # Dashboard analytics
│       ├── reviews.js          # Review moderation
│       ├── settings.js         # App settings
│       └── wishlist.js         # Wishlist toggle
└── views/                      # EJS templates
    ├── partials/               # Header, footer
    ├── admin/                  # Admin panel pages
    ├── index.ejs               # Homepage with hero carousel
    ├── shop.ejs                # Product listing
    ├── cart.ejs                # Cart + save-for-later
    ├── checkout.ejs            # Checkout form
    ├── product.ejs             # Product detail
    ├── about.ejs, contact.ejs, gallery.ejs, etc.
```

## Setup & Installation

### Prerequisites
- Node.js (v20+)
- npm

### Steps

1. **Install dependencies:**
   ```bash
   cd aquarium-anpara
   npm install
   ```

2. **Configure environment variables:**
   Edit `.env` and set your values:
   ```
   PORT=3000
   JWT_SECRET=your-secret-key
   DB_PATH=./data/aquarium.db
   GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
   ```

3. **Generate Prisma client & seed the database:**
   ```bash
   npx prisma generate
   node server/seed.js
   ```

4. **Start the server:**
   ```bash
   node server.js
   ```

5. **Access the application:**
   - Homepage: http://localhost:3000
   - Admin Panel: http://localhost:3000/admin

### Default Accounts

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@aquariumanpara.com | admin123 |
| Customer | rahul@test.com | customer123 |
| Customer | priya@test.com | customer123 |

## Switching to Another Database (PostgreSQL / SQL Server)

Prisma ORM makes database switching configuration-only. To migrate:

1. **Install the appropriate adapter:**
   ```bash
   npm install @prisma/adapter-pg pg          # PostgreSQL
   # or
   npm install @prisma/adapter-mssql mssql    # SQL Server
   ```

2. **Update `prisma/schema.prisma`** — change the datasource provider:
   ```prisma
   datasource db {
     provider = "postgresql"   // or "sqlserver"
   }
   ```

3. **Update `server/database.js`** — swap the adapter:
   ```js
   const { PrismaPg } = require('@prisma/adapter-pg');
   const { Pool } = require('pg');
   const pool = new Pool({ connectionString: process.env.DATABASE_URL });
   const adapter = new PrismaPg(pool);
   const prisma = new PrismaClient({ adapter });
   ```

4. **Run Prisma migrations** to create/update the schema:
   ```bash
   npx prisma migrate dev --name init
   ```

5. **Seed the database:**
   ```bash
   node server/seed.js
   ```

No code changes to routes, queries, or business logic are needed — Prisma handles the SQL dialect differences.

## Google Sign-In Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a project and enable Google Identity Services
3. Create OAuth 2.0 credentials (Web application type)
4. Add authorized JavaScript origins (e.g., `http://localhost:3000`)
5. Copy the Client ID and set it in `.env`:
   ```
   GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
   ```

## API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login with email/phone + password |
| POST | `/api/auth/google` | Login/register with Google |
| POST | `/api/auth/logout` | Clear auth cookie |
| GET | `/api/auth/me` | Get current user |
| PUT | `/api/auth/profile` | Update profile |
| PUT | `/api/auth/change-password` | Change password |

### Admin
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/users` | List all users |
| POST | `/api/admin/users` | Create admin/staff account |
| PUT | `/api/admin/users/:id/role` | Update user role |
| PUT | `/api/admin/users/:id/status` | Activate/deactivate user |

### Admin Page Routes (Server-Side Protected)
All `/admin/*` page routes require a valid JWT token with `admin` or `staff` role. Unauthenticated users are redirected to `/login`.

## Authentication Flow

1. **Password-based login:** User submits email/phone + password. Server validates credentials, returns JWT token (set as httpOnly cookie + response body).
2. **Google Sign-In:** User clicks Google button, authenticates with Google, receives credential token. Client sends token to `/api/auth/google`, server verifies with Google and creates/returns user.
3. **Authorization:** JWT token is sent with each API request (via `Authorization: Bearer` header or `token` cookie). Middleware verifies token and checks role for protected routes.
4. **Admin page protection:** EJS page routes for `/admin/*` use `requireAdminPage` middleware which reads the JWT from cookies/header, verifies the user has admin/staff role, and redirects to login if not.

## Database

The database schema is defined in `prisma/schema.prisma` and managed by Prisma. It includes 21 models:

- `users` — User accounts with role, auth_provider, is_active
- `products` — Product catalog with pricing, stock, SEO
- `categories` — Hierarchical categories (self-referencing)
- `brands` — Product brands
- `customers` — Customer profiles
- `orders` / `order_items` — Order management
- `cart` — Shopping cart (session or user-based, with `saved_for_later`)
- `wishlists` — User wishlists
- `coupons` — Discount codes
- `reviews` — Product reviews
- `inventory_logs` — Stock movement tracking
- `payments` — Payment records
- `notifications` — User notifications
- `audit_logs` — Action audit trail
- `banners` — Homepage banners
- `gallery` — Gallery images
- `contact_messages` — Contact form submissions
- `product_images` — Product image gallery
- `addresses` — Saved user addresses
- `settings` — Key-value app settings

SQLite database is stored at `./data/aquarium.db` with WAL mode enabled.

## UI Design

The frontend uses a premium glassmorphism design with:

- Blue, aqua, teal, and white color palette
- Glass cards with backdrop-filter blur
- Gradient overlays and soft shadows
- Rounded corners throughout
- Smooth scroll and fade-in animations
- Button ripple effects
- Loading skeleton placeholders
- Hero carousel with gradient overlay
- Horizontal scroll categories with snap-scroll
- Centralized image configuration block in `views/index.ejs`
- Fully responsive (desktop, tablet, mobile)
- Dark/light mode toggle with localStorage persistence

## License

Private — Aquarium Anpara
