# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is Cemetery CRM (kurosakicrm) - a comprehensive backend system for managing cemetery and gravestone information, built with Node.js, Express, TypeScript, Prisma, and PostgreSQL. The system manages complex relationships between gravestones, applicants, contractors, usage fees, management fees, and related entities.

## Development Commands

### Server Management
- `npm run dev` - Start development server with hot reload (ts-node-dev)
- `npm start` - Start production server (requires build first)
- `npm run build` - Compile TypeScript to JavaScript

### Testing
- `npm test` - Run all tests with Jest
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Generate test coverage report
- `npm run test:e2e` - Run Playwright end-to-end tests
- `npm run test:e2e:ui` - Run Playwright tests with UI mode
- `npm run test:e2e:debug` - Debug Playwright tests
- **Running Single Test**: `npm test -- path/to/test.ts` or `npm test -- --testNamePattern="test name"`
- **Coverage Requirement**: 100% coverage across all metrics (branches, functions, lines, statements)

### Database Management
- Use Prisma commands for database operations:
  - `npx prisma generate` - Generate Prisma client
  - `npx prisma db push` - Push schema changes to database
  - `npx prisma migrate dev` - Create and apply migrations
  - `npx prisma studio` - Open Prisma Studio for database inspection

### Test Data & Utilities
- `node scripts/insert-test-data.js` - Insert test data into database
- `node scripts/test-prisma.js` - Test Prisma connection

## Architecture Overview

### Core Structure
- **src/index.ts** - Main application entry point configuring Express server, middleware, and routes
- **prisma/schema.prisma** - Complete database schema with all models and relationships
- **Server Port**: Default 4000 (configurable via PORT environment variable)
- **Database**: PostgreSQL with comprehensive cemetery management schema

### Middleware Stack (in order)
The server applies middleware in this critical order:
1. **CORS** - Cross-origin resource sharing
2. **express.json()** - JSON body parser
3. **express.urlencoded({ extended: true })** - URL-encoded body parser
4. **requestLogger** - Logs all HTTP requests with timestamps and user info
5. **securityHeaders** - Sets security-related HTTP headers
6. **Routes** - API endpoints
7. **notFoundHandler** - Catches 404 errors for undefined routes
8. **errorHandler** - Global error handler (must be last)

### Modular Organization
Each business entity has its own module with consistent structure:
```
src/
├── entity-name/
│   ├── entityController.ts    # Business logic and database operations
│   └── entityRoutes.ts        # Express route definitions
├── middleware/
│   ├── auth.ts               # Supabase JWT authentication middleware
│   ├── permission.ts         # Role-based permission checking
│   ├── errorHandler.ts       # Global error handling & custom error classes
│   └── logger.ts             # Request logging & security headers
└── auth/
    ├── authController.ts     # Authentication endpoints (login, logout, password change)
    └── authRoutes.ts         # Auth route definitions
```

### Currently Implemented Modules
- **Plots** - Cemetery plot/gravestone management (`/api/v1/plots`)
  - Full CRUD operations
  - Complex nested data handling (applicant, contractor, billing info, family contacts, etc.)
  - Transaction-based updates with history tracking
- **Auth** - Authentication system (`/api/v1/auth`)
  - Supabase-based JWT authentication
  - Login, logout, current user info, password change

### Planned Business Entities
The following entities are defined in the database schema but routes not yet implemented:
- **Applicants** - People who apply for gravestone usage (1:1 with Gravestone)
- **Contractors** - People who contract gravestone usage (1:N with Gravestone)
- **Usage Fees & Management Fees** - Financial information
- **Billing Info** - Payment and bank account details
- **Family Contacts** - Emergency and family contact information
- **Burials** - Information about people buried at gravestones
- **Constructions** - Construction and maintenance work records
- **Histories** - Audit trail for all changes

### Master Data System
Comprehensive master data tables for:
- Usage status, cemetery types, denominations, gender
- Payment methods, tax types, calculation types
- Account types, recipient types, relations
- Construction types, update types, prefectures

### Authentication & Authorization
- **Supabase-based authentication** - JWT tokens issued by Supabase Auth
- **Staff table integration** - User info stored in PostgreSQL, linked via `supabase_uid`
- **Role-based access control**: viewer, operator, manager, admin
- **Permission middleware** (`requirePermission`) for fine-grained access control
- **API permission matrix** in `src/middleware/permission.ts` defines access for each endpoint
- Authentication middleware in `src/middleware/auth.ts`:
  - `authenticate` - Requires valid JWT token and active user
  - `optionalAuthenticate` - Allows unauthenticated requests but populates user if token provided
- When Supabase environment variables are not set, authentication endpoints return 503 (Service Unavailable)

## Database Architecture

### Key Design Patterns
- **Soft Delete**: Most entities use `deleted_at` for logical deletion
- **Effective Dating**: Many entities have `effective_start_date` and `effective_end_date`
- **Audit Trail**: History table tracks all changes with before/after record IDs
- **Master Data**: Centralized code/name pairs for dropdown values

### Critical Relationships
- **Gravestone → Applicant**: 1:1 (unique gravestone_id in applicants)
- **Gravestone → Contractor**: 1:N (multiple contractors per gravestone over time)
- **Complex Many-to-Many**: BillingInfo, FamilyContact, Burial, History link both Gravestone and Contractor

### Performance Considerations
- Indexed on frequently searched fields (gravestone_code, usage_status, names, phones)
- Composite indexes for common query patterns
- Cascade deletes configured for referential integrity

## API Structure

### Base URL Pattern
All APIs follow: `/api/v1/{entity-name}`

### Authentication
- **Login**: `POST /api/v1/auth/login`
- **JWT tokens** required for all non-auth endpoints
- **Permission checks** based on user role and endpoint requirements

### Common Patterns
- **CRUD operations** follow RESTful conventions
- **Search functionality** with pagination support
- **Master data access** via `/api/v1/masters/{master-type}`
- **Validation endpoints** for business rules

### Error Handling
Global error handler in `src/middleware/errorHandler.ts` provides:
- **Automatic Prisma error mapping** (P2002 → 409 Conflict, P2025 → 404 Not Found, etc.)
- **Custom error classes**: `ValidationError`, `UnauthorizedError`, `ForbiddenError`, `NotFoundError`, `ConflictError`
- **404 handler** (`notFoundHandler`) for undefined routes

Standardized response format:
```typescript
interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details: Array<{ field?: string; message: string; }>;
  };
}
```

Success response format:
```typescript
interface SuccessResponse<T> {
  success: true;
  data: T;
}
```

### API Documentation
Complete OpenAPI 3.0 specification available:
- **swagger.yaml** - YAML format specification
- **swagger.json** - JSON format specification

**Swagger Management Commands**:
- `npm run swagger:validate` - Validate OpenAPI specification
- `npm run swagger:json` - Convert YAML to JSON format
- `npm run swagger:build` - Build both YAML and JSON documentation

The specification includes:
- All 45+ endpoints with detailed request/response schemas
- JWT authentication documentation
- Role-based permission requirements
- Comprehensive error response definitions
- Complete data model schemas based on Prisma models

## Development Guidelines

### Code Organization
- Follow the established modular pattern for new entities
- Controllers handle business logic and database operations
- Routes define endpoint mappings and middleware application
- Middleware handles cross-cutting concerns (auth, permissions, validation)

### Database Operations
- Use Prisma Client for all database interactions
- Implement soft delete patterns consistently
- Maintain audit trails through History table
- Handle effective dating for temporal data

### Testing Standards
- **100% test coverage required** - all branches, functions, lines, and statements
- Tests located in `tests/` directory mirroring `src/` structure
- Use `tests/setup.ts` for test configuration
- Mock Prisma client defined in `__mocks__/@prisma/client.ts`
- **Express Request type extension** - Tests must declare global Express.Request interface with `user` property
  ```typescript
  declare global {
    namespace Express {
      interface Request {
        user?: {
          id: number;
          email: string;
          name: string;
          role: string;
          is_active: boolean;
          supabase_uid: string;
        };
      }
    }
  }
  ```
- Controller tests use transaction mocks with spy functions to track calls
- Both unit tests for controllers and integration tests for routes

### Security Requirements
- Never log or expose sensitive data (passwords, tokens)
- Implement proper input validation for all endpoints
- Use bcrypt for password hashing
- Validate JWT tokens and check permissions on protected routes

## Key Business Rules

### Cemetery Management
- Each gravestone has unique code (e.g., "A-56")
- Gravestones can have multiple contractors over time
- One applicant per gravestone (who initially applied)
- Financial tracking through usage fees and management fees

### Data Integrity
- Logical deletion preserves historical data
- Effective dating tracks temporal changes
- Master data provides controlled vocabularies
- History table maintains complete audit trail

### Permission Model
- **viewer**: Read-only access to most data
- **operator**: Can create and update records
- **manager**: Can delete records and access reports
- **admin**: Full system access including user management

## Environment Configuration

### Required Environment Variables
- **DATABASE_URL**: PostgreSQL connection string for Prisma
- **SUPABASE_URL**: Supabase project URL (optional, auth endpoints return 503 if not set)
- **SUPABASE_SERVICE_ROLE_KEY**: Supabase service role key (optional, auth endpoints return 503 if not set)
- **PORT**: Server port (optional, defaults to 4000)
- **NODE_ENV**: Environment mode (development, test, production)

## Important Notes

- **Health check endpoint**: `GET /health` returns server status, uptime, and environment
- **Server startup**: Displays ASCII art banner with port, environment, and health check URL
- **Request logging**: All requests logged with timestamp, method, path, status code, duration, and user info
- **Security headers**: X-Content-Type-Options, X-Frame-Options, X-XSS-Protection automatically set
- API specification documents available: API_SPECIFICATION.md, swagger.yaml, swagger.json
- Database specification available: DATABASE_SPECIFICATION.md
- Postman collection available: postman-collection.json
- Japanese language content throughout (墓石管理システム = Cemetery Management System)
- Comprehensive test suite with 100% coverage requirement ensures reliability
- Tests use mock Prisma client defined in `__mocks__/@prisma/client.ts`

## Troubleshooting

### Supabase Authentication Not Available
If you see "Supabase認証サービスが利用できません" (503 errors on auth endpoints):
- Set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in your `.env` file
- The server will start successfully but auth endpoints will be unavailable until configured

### TypeScript Errors in Tests
If you see `'user' does not exist in type 'Partial<Request>'`:
- Add the Express Request type extension at the top of your test file (see Testing Standards above)

### Prisma Transaction Mocks Not Working
- Create spy functions outside the transaction implementation
- Pass the spies into the mock transaction callback
- See `tests/plots/plotController.test.ts` for examples