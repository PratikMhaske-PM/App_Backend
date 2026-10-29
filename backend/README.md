# Service-Provider Backend API & Security System

A modular, secure, production-grade backend built with **Node.js**, **Express.js**, **TypeScript**, and **SQLite**.
Designed following clean architecture and the repository pattern to power client applications (e.g., Next.js frontend, mobile apps).

---

## 🚀 Quick Start

### 1. Prerequisites
- **Node.js** (v18.0.0 or higher)
- **npm** (v9.0.0 or higher)

### 2. Installation
```bash
# Navigate to backend folder
cd backend

# Install dependencies (if not already installed)
npm install
```

### 3. Environment Setup
The `.env` file is pre-configured for local development. Default configuration:
```env
PORT=5001
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
DATABASE_PATH=database.sqlite
JWT_ACCESS_SECRET=metarulex2026hdhdujuenneuennhhdhueuuruhdbuwuwhbe
JWT_ACCESS_EXPIRES_IN=15m
JWT_ISSUER=my-backend
JWT_AUDIENCE=my-frontend
BCRYPT_ROUNDS=12
```

### 4. Start Development Server
```bash
npm run dev
```
The server will start at: **`http://localhost:5001`**

---

## 📁 System Architecture & Request Flow

```
Client (Next.js / Mobile / Postman / cURL)
  ↓
Express Routes (Route paths & mount points)
  ↓
Middleware (Auth, Rate Limiting, Role Verification, Zod Validation)
  ↓
Controllers (HTTP request / response extraction)
  ↓
Services (Domain business rules, lifecycle validation, stats calculation)
  ↓
Repositories (Parameterized SQLite SQL queries, transactions)
  ↓
SQLite Database (Foreign keys, unique constraints, indexes)
```

### Directory Structure

```
backend/
├── package.json               # Dependencies and scripts
├── tsconfig.json              # Strict TypeScript options
├── nodemon.json               # Dev live-reload configuration
├── .env                       # Local environment variables
└── src/
    ├── server.ts              # Server bootstrap and graceful shutdown
    ├── app.ts                 # Express setup, middleware & route mounting
    │
    ├── config/
    │   ├── env.ts             # Zod-validated environment variables
    │   └── database.ts        # Database connection instance
    │
    ├── database/
    │   ├── sqlite.ts          # Unified SQLite adapter (node:sqlite & fallback engine)
    │   └── schema.sql         # Relational schema (tables, foreign keys, indexes)
    │
    ├── middlewares/
    │   ├── auth.middleware.ts     # JWT Bearer verification & role check
    │   ├── rateLimit.middleware.ts# Brute-force rate limiter
    │   ├── validate.middleware.ts # Zod body, query, and parameter validation
    │   ├── notFound.middleware.ts # 404 handler
    │   └── error.middleware.ts    # Centralized JSON error envelope
    │
    ├── modules/
    │   ├── auth/              # Authentication (register, login, me)
    │   ├── categories/        # Service categories (browse, lookup)
    │   ├── workers/           # Worker directory, search, stats, availability
    │   ├── bookings/          # Booking lifecycle (create, accept, reject, cancel, complete)
    │   ├── reviews/           # Reviews and rating recalculation
    │   ├── users/             # User profile and password management
    │   └── admin/             # Worker verification & platform overview
    │
    ├── repositories/          # Parameterized data access layer
    │   ├── user.repo.ts       # User persistence
    │   ├── category.repo.ts   # Category persistence
    │   ├── worker.repo.ts     # Worker profiles, filtering & DB aggregations
    │   ├── booking.repo.ts    # Bookings & schedule conflict detection
    │   └── review.repo.ts     # Reviews & rating aggregation
    │
    ├── utils/
    │   ├── apiResponse.ts     # Standardized JSON response helpers
    │   ├── AppError.ts        # Operational error class
    │   ├── hash.ts            # Bcrypt hashing with 72-byte ceiling
    │   ├── jwt.ts             # JWT token issuance and verification
    │   └── logger.ts          # Pino logger with secret redaction
    │
    ├── types/
    │   ├── express.d.ts       # Express Request augmentation (req.user)
    │   └── common.types.ts    # Core TypeScript domain entities & DTOs
    │
    └── tests/
        ├── auth.test.ts       # Authentication tests
        ├── categories.test.ts # Categories API tests
        ├── workers.test.ts    # Worker search, stats & availability tests
        ├── bookings.test.ts   # Booking lifecycle tests
        ├── reviews.test.ts    # Review & rating tests
        └── users_admin.test.ts# User profile & Admin management tests
```

---

## 🔒 Security Implementations

1. **Authentication & Authorization**:
   - Short-lived JWT access tokens (`15m`) with strict signature, issuer, audience, and algorithm checks.
   - Password hashing using **bcrypt** with `12` rounds and a strict **72-byte ceiling** preventing Blowfish DOS truncation vulnerabilities.
   - Role-Based Access Control (**RBAC**): `customer`, `worker`, `admin`.
   - Resource ownership verification preventing unauthorized updates.
   - Prevention of privilege escalation: public registration and profile updates cannot elevate to `admin`.

2. **Database Security & Relational Integrity**:
   - 100% parameterized SQL queries (`?` placeholders) preventing SQL injection attacks.
   - Enforced SQLite foreign keys (`PRAGMA foreign_keys = ON;`).
   - Unique constraints on emails, slugs, and single review per booking.
   - Atomic database transactions for multi-step mutations (e.g., submitting review and recalculating worker ratings).

3. **HTTP & Middleware Security**:
   - Helmet secure HTTP headers (XSS, HSTS, frameguard, etc.).
   - CORS enabled with credentials.
   - Strict request body size ceiling (`10kb`).
   - Rate limiting on sensitive endpoints.
   - Strict input validation with Zod on request bodies, query params, and route parameters.
   - Centralized error handler masking stack traces and internal database errors in production.

---

## 📡 API Reference & Contracts

### Standard Response Formats

**Success (`200 OK` / `201 Created`):**
```json
{
  "success": true,
  "message": "Request completed successfully",
  "data": {}
}
```

**Error (`400`, `401`, `403`, `404`, `429`, `500`):**
```json
{
  "success": false,
  "message": "Something went wrong",
  "errors": []
}
```

---

### 1. Service Categories

#### `GET /categories` (or `/api/categories`)
Fetch all available service categories.
- **Auth**: None (Public)
- **Response**:
  ```json
  {
    "success": true,
    "message": "Categories retrieved successfully",
    "data": {
      "categories": [
        {
          "id": "cat_electrical",
          "name": "Electrical",
          "slug": "electrical",
          "description": "Wiring, lighting, and electrical repairs",
          "icon": "zap"
        }
      ],
      "total": 6
    }
  }
  ```

#### `GET /categories/:id`
Fetch single category by ID or slug.

---

### 2. Workers

#### `GET /workers` (or `/api/workers`)
Search, filter, and paginate verified workers.
- **Auth**: None (Public)
- **Query Parameters**:
  - `category_id`: Filter by category ID (e.g. `cat_electrical`)
  - `search`: Keyword search in title, bio, or worker name
  - `page`: Page number (default: `1`)
  - `limit`: Page size (default: `10`, max: `50`)
  - `sort_by`: `rating` | `hourly_rate` | `experience_years` | `created_at`
  - `order`: `asc` | `desc`

#### `GET /workers/:id`
Fetch worker public profile and details. Customers never receive sensitive fields (e.g. password hashes).

#### `GET /workers/:id/reviews`
Fetch reviews for a worker with pagination.

#### `PATCH /workers/me/availability`
Allow authenticated workers to update their availability.
- **Auth**: Bearer token (Worker role)
- **Body**:
  ```json
  {
    "is_available": true,
    "availability_status": "available"
  }
  ```

#### `GET /workers/me/stats`
Fetch worker statistics calculated from real database records.
- **Auth**: Bearer token (Worker role)
- **Response**:
  ```json
  {
    "success": true,
    "message": "Worker statistics retrieved successfully",
    "data": {
      "totalBookings": 12,
      "completedBookings": 9,
      "cancelledBookings": 1,
      "pendingBookings": 2,
      "confirmedBookings": 0,
      "totalEarnings": 585.0,
      "averageRating": 4.9,
      "totalReviews": 9
    }
  }
  ```

#### `GET /workers/me/profile`
Fetch current authenticated worker's profile.

#### `PATCH /workers/me/profile`
Update current authenticated worker's profile (title, bio, hourly rate, experience, location).

---

### 3. Bookings Management Module

#### API 1: Create Booking (`POST /bookings` or `/api/bookings`)
Allow an authenticated customer to create a booking with an available worker.
- **Role**: `customer` (Bearer token)
- **Body**:
  ```json
  {
    "worker_id": "wrk_demo_1",
    "category_id": "cat_electrical",
    "service_description": "Fix flickering lights and circuit inspection",
    "booking_date": "2026-11-25",
    "booking_time": "10:00",
    "address": "742 Evergreen Terrace, Springfield",
    "latitude": 40.7128,
    "longitude": -74.0060,
    "total_price": 70.0
  }
  ```
- **Rules Enforced**:
  - Customer ID is retrieved strictly from the JWT token (never trusted from client body).
  - Validates worker exists, is approved, and provides the selected service category.
  - Verifies worker availability.
  - Prevents customer from booking themselves.
  - Rejects overlapping confirmed bookings for the worker.
  - Rejects duplicate pending requests for the same worker and date.
  - Initial status is set to `PENDING`.

#### API 2: Get My Bookings (`GET /bookings/me?status=&page=&limit=`)
Fetch bookings belonging strictly to the authenticated customer.
- **Role**: `customer` (Bearer token)
- **Query Parameters**:
  - `status`: Filter by status case-insensitively (e.g. `PENDING`, `CONFIRMED`, `CANCELLED`)
  - `page`: Page number (default: `1`)
  - `limit`: Items per page (default: `10`, max: `50`)
- **Features**:
  - Automatically filters by authenticated customer ID from token.
  - Sorted by booking date descending.
  - Includes worker details (name, title, phone) and category information.
  - Returns pagination metadata (`page`, `limit`, `total`, `totalPages`).

#### API 3: Get Booking Details (`GET /bookings/:id`)
Fetch complete details of a specific booking with ownership validation.
- **Roles**: `customer`, `worker` (and `admin`)
- **Rules Enforced**:
  - Allows customer who created it or assigned worker (or admin).
  - Unrelated customers or workers are rejected with `403 Forbidden`.
  - Sensitive authentication credentials and password hashes are never exposed.

#### API 4: Cancel Booking (`PATCH /bookings/:id/cancel`)
Allow a customer to cancel their own booking.
- **Role**: `customer` (Bearer token)
- **Body**:
  ```json
  {
    "cancellation_reason": "Emergency travel required, need to reschedule"
  }
  ```
- **Rules Enforced**:
  - Verifies booking ownership.
  - Prevents cancellation of `COMPLETED`, `CANCELLED`, or `REJECTED` bookings.
  - Sets status to `CANCELLED` and records `cancelled_at` timestamp and reason.

#### API 5: Get Booking QR Code (`GET /bookings/:id/qr`)
Generate or retrieve a QR code associated with a booking.
- **Role**: `customer` (Bearer token)
- **Features**:
  - Verifies booking ownership.
  - Generates verifiable QR Code containing booking ID, customer ID, worker ID, and HMAC verification hash.
  - Returns SVG XML, Base64 Data URI, and verification token.

---

### 4. Reviews

#### `POST /api/reviews`
Submit a review for a completed service.
- **Auth**: Bearer token (Customer only)
- **Body**:
  ```json
  {
    "booking_id": "bkg_12345",
    "rating": 5,
    "comment": "Punctual, professional, and excellent quality work!"
  }
  ```
- **Rules Enforced**:
  - Only the customer who made the booking can submit.
  - Booking status must be `completed`.
  - Only one review allowed per booking.
  - Rating must be integer 1 to 5.
  - Worker's `rating_avg` and `reviews_count` are recalculated in a database transaction.

#### `GET /api/reviews/:id`
Fetch single review details.

#### `PATCH /api/reviews/:id`
Owner customer updates their review rating and comment.

#### `DELETE /api/reviews/:id`
Owner customer or admin deletes review. Worker rating is recalculated.

---

### 5. User Profile Management

#### `GET /users/me`
Fetch authenticated user profile (password hash omitted).

#### `PATCH /users/me`
Update name, phone, or avatar URL. Role cannot be escalated.

#### `PATCH /users/me/password`
Change password securely by verifying current password and hashing the new password.

---

### 6. Admin Management & Worker Verification

#### `GET /admin/workers`
Admin views all workers across verification statuses (`pending`, `approved`, `rejected`).
- **Auth**: Bearer token (`admin` role only)

#### `PATCH /admin/workers/:id/verify`
Approve or reject a worker.
- **Body**:
  ```json
  {
    "status": "approved"
  }
  ```

#### `GET /admin/stats`
Platform overview statistics (total users, workers, bookings, revenue).

---

### 7. Worker Jobs Module (Module A)

#### `GET /jobs/requests?status=&page=&limit=`
Retrieve open/requested service jobs within worker's category. Sanitizes customer sensitive information.
- **Auth**: Bearer token (`worker` role)

#### `GET /jobs/me?status=&page=&limit=`
Retrieve jobs assigned to authenticated worker with history and pagination.
- **Auth**: Bearer token (`worker` role)

#### `GET /jobs/:id`
Retrieve detailed information for a specific job. Enforces worker assignment verification.
- **Auth**: Bearer token (`worker` role)

#### `PATCH /jobs/:id/status`
Update job status through strict state machine transitions (`pending` -> `confirmed`/`accepted` -> `in_progress` -> `completed`).
- **Auth**: Bearer token (`worker` role)
- **Body**:
  ```json
  {
    "status": "in_progress",
    "note": "Arrived on location"
  }
  ```

#### `POST /bookings/:id/verify-qr`
Worker scans and verifies customer booking QR code token. Prevents replay and duplicate scans.
- **Auth**: Bearer token (`worker` role)
- **Body**:
  ```json
  {
    "token": "QR_bkg_12345"
  }
  ```

---

### 8. Address Management (Module D)

#### `GET /addresses?page=&limit=`
Retrieve authenticated user's saved addresses.
- **Auth**: Bearer token (All authenticated users)

#### `POST /addresses`
Create an address attached to the authenticated user.
- **Auth**: Bearer token (All authenticated users)
- **Body**:
  ```json
  {
    "label": "Home",
    "street": "123 Main Street",
    "city": "Springfield",
    "state": "IL",
    "postal_code": "62704",
    "is_default": true
  }
  ```

#### `PATCH /addresses/:id`
Update an address enforcing user ownership check.
- **Auth**: Bearer token (Owner user only)

#### `DELETE /addresses/:id`
Delete an address enforcing user ownership check.
- **Auth**: Bearer token (Owner user only)

---

### 9. Worker KYC Verification (Module E)

#### `POST /kyc/submit`
Worker submits identity verification document. Sets initial status to `pending` and prevents duplicate pending applications.
- **Auth**: Bearer token (`worker` role)
- **Body**:
  ```json
  {
    "document_type": "passport",
    "document_number": "P-987654321",
    "full_name": "Alex Rodriguez",
    "document_url": "https://example.com/docs/passport.pdf"
  }
  ```

#### `GET /kyc/status`
Worker checks KYC verification status.
- **Auth**: Bearer token (`worker` role)

#### `PATCH /admin/kyc/:id`
Administrator reviews and approves or rejects worker KYC application. Blocks self-approval.
- **Auth**: Bearer token (`admin` role)
- **Body**:
  ```json
  {
    "status": "approved"
  }
  ```

---

### 10. SOS Emergency Alerts (Module F)

#### `POST /sos`
Dispatch an emergency alert during home service visits with rate limiting and duplicate prevention.
- **Auth**: Bearer token (All authenticated users)
- **Body**:
  ```json
  {
    "emergency_type": "security",
    "latitude": 40.7128,
    "longitude": -74.0060,
    "notes": "Immediate assistance requested"
  }
  ```

---

### 11. Notifications (Module G)

#### `GET /notifications?status=all&page=&limit=`
Retrieve authenticated user's notifications. Supports read/unread filtering.
- **Auth**: Bearer token (All authenticated users)

---

## 🧪 Pre-Seeded Accounts for Immediate Testing

You can test immediately with these pre-seeded accounts:

| Role | Email | Password | Details |
|---|---|---|---|
| **Customer** | `user@example.com` | `Password123!` | Pre-seeded customer account |
| **Worker** | `worker@example.com` | `Password123!` | Pre-seeded Master Electrician |
| **Admin** | `admin@example.com` | `Password123!` | Platform Administrator |

---

## 🧪 Automated Test Suite

Run the full automated test suite (63 unit & integration tests covering auth, categories, workers, bookings, reviews, and admin APIs):

```bash
npm test
```
To run tests in watch mode:
```bash
npm run test:watch
```
