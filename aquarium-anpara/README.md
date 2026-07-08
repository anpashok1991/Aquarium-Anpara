# Aquarium Anpara

A full-featured e-commerce web application for a pet and aquarium store, built with Node.js, Express, EJS, and SQLite.

## Features

### Customer Features
- Product browsing with search, filter, sort, and pagination
- Product detail pages with images, reviews, and related products
- Shopping cart (session-based for guests, persistent for logged-in users)
- Checkout with shipping details and payment method selection
- Order tracking by order number
- Wishlist functionality
- User registration and login (email/phone + password)
- Google Sign-In authentication
- Dark/light mode theme toggle
- WhatsApp integration for order inquiries

### Admin Features
- Dashboard with key metrics (orders, revenue, products, customers)
- Product CRUD with image upload
- Category management with parent-child hierarchy
- Brand management
- Order management with status updates
- Customer viewing
- Inventory management with stock adjustments and logs
- Coupon management with validation
- Review moderation (approve/delete/reply)
- Reports (sales, products, stock)
- Banner and gallery management
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
| Database | SQLite (better-sqlite3) |
| Authentication | JWT + bcryptjs |
| Google Auth | google-auth-library |
| File Upload | Multer |
| Security | Helmet, CORS, express-rate-limit |
| Frontend | Bootstrap 5.3.3, Font Awesome 6.5.1, Vanilla JS |

## Project Structure

```
aquarium-anpara/
├── .env                    # Environment variables
├── package.json            # Dependencies and scripts
├── server.js               # Main Express server
├── data/                   # SQLite database files
├── uploads/                # User-uploaded files
│   ├── banners/
│   ├── gallery/
│   ├── products/
│   └── settings/
├── public/                 # Static assets
│   ├── css/style.css
│   └── js/app.js
├── server/
│   ├── database.js         # Schema, migrations, indexes
│   ├── seed.js             # Database seeder
│   ├── middleware/
│   │   └── auth.js         # JWT auth + role middleware
│   └── routes/
│       ├── auth.js         # Login, register, Google auth, logout
│       ├── admin.js        # Admin user management API
│       ├── products.js     # Product CRUD
│       ├── categories.js   # Category CRUD
│       ├── brands.js       # Brand CRUD
│       ├── cart.js         # Shopping cart
│       ├── orders.js       # Order management
│       ├── coupons.js      # Coupon management
│       ├── inventory.js    # Stock management
│       ├── reviews.js      # Review moderation
│       ├── reports.js      # Dashboard reports
│       ├── pages.js        # EJS page routes
│       └── ...             # Other API routes
└── views/                  # EJS templates
    ├── partials/           # Header, footer
    ├── admin/              # Admin panel pages
    └── ...                 # Customer-facing pages
```

## Setup & Installation

### Prerequisites
- Node.js (v16+)
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

3. **Seed the database:**
   ```bash
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

SQLite database stored at `./data/aquarium.db` with WAL mode. Schema includes 17 tables:

- `users` - User accounts with role, auth_provider, is_active
- `products` - Product catalog with pricing, stock, SEO
- `categories` - Hierarchical categories
- `brands` - Product brands
- `customers` - Customer profiles
- `orders` / `order_items` - Order management
- `cart` - Shopping cart (session or user-based)
- `wishlists` - User wishlists
- `coupons` - Discount codes
- `reviews` - Product reviews
- `inventory_logs` - Stock movement tracking
- `payments` - Payment records
- `notifications` - User notifications
- `audit_logs` - Action audit trail
- `banners` - Homepage banners
- `gallery` - Gallery images
- `contact_messages` - Contact form submissions

## License

Private - Aquarium Anpara
