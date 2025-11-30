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
- **Coverage Requirements**: Functions 100%, Lines 99%, Statements 97%, Branches 80% (high-quality thresholds)

### Code Quality
- `npm run lint` - Run ESLint to check code quality
- `npm run lint:fix` - Auto-fix ESLint errors where possible
- `npm run format` - Format code with Prettier
- `npm run format:check` - Check if code is formatted correctly
- **Pre-commit hooks**: Husky + lint-staged automatically run linting and formatting on staged files

### Database Management
- Use Prisma commands for database operations:
  - `npx prisma generate` - Generate Prisma client
  - `npx prisma db push` - Push schema changes to database
  - `npx prisma migrate dev` - Create and apply migrations
  - `npx prisma studio` - Open Prisma Studio for database inspection

### Test Data & Utilities
- `node scripts/insert-test-data.js` - Insert test data into database
- `node scripts/test-prisma.js` - Test Prisma connection

### Docker Commands
- **Production Environment**:
  - `docker compose up -d` - Start all services in production mode
  - `docker compose down` - Stop all services
  - `docker compose logs -f app` - View application logs
  - `docker compose exec app npx prisma migrate deploy` - Run migrations
- **Development Environment** (with hot reload):
  - `docker compose -f docker-compose.dev.yml up -d` - Start dev environment
  - `docker compose -f docker-compose.dev.yml down` - Stop dev environment
  - `docker compose -f docker-compose.dev.yml logs -f app` - View logs
- **Utility Commands**:
  - `docker compose exec app sh` - Access application container shell
  - `docker compose exec db psql -U cemetery_user -d komine_cemetery_crm` - Access PostgreSQL
  - `docker compose exec app npx prisma studio` - Open Prisma Studio
  - `docker compose down -v` - Remove all containers and volumes
- **See DOCKER_SETUP.md for comprehensive Docker documentation**

## Architecture Overview

### Core Structure
- **src/index.ts** - Main application entry point configuring Express server, middleware, and routes
- **prisma/schema.prisma** - Complete database schema with all models and relationships
- **Server Port**: Default 4000 (configurable via PORT environment variable)
- **Database**: PostgreSQL with comprehensive cemetery management schema

### Middleware Stack (in order)
The server applies middleware in this critical order:
1. **Helmet** (`getHelmetOptions()`) - Security headers (CSP, HSTS, etc.)
2. **CORS** (`getCorsOptions()`) - Cross-origin resource sharing with origin whitelist
3. **HPP Protection** - HTTP Parameter Pollution prevention
4. **express.json()** - JSON body parser (10mb limit)
5. **express.urlencoded()** - URL-encoded body parser (10mb limit)
6. **sanitizeInput** - XSS protection via input sanitization
7. **Rate Limiter** - DDoS protection (100 requests per 15 minutes)
8. **requestLogger** - Logs all HTTP requests with timestamps and user info
9. **securityHeaders** - Additional security headers
10. **Routes** - API endpoints
11. **notFoundHandler** - Catches 404 errors for undefined routes
12. **errorHandler** - Global error handler (must be last)

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
- **Plots** - Cemetery plot/contract management (`/api/v1/plots`)
  - **New ContractPlot-centric architecture** (v2.0 - migrated from Gravestone model)
  - **Data model**: PhysicalPlot (1) → ContractPlot (N) → SaleContract (1:1) → Customer (1:1)
  - **Core endpoints**:
    - `GET /plots` - List all contract plots with pagination and search
    - `POST /plots` - Create new physical plot + contract plot + sale contract + customer
    - `GET /plots/:id` - Get contract plot details with all related data
    - `PUT /plots/:id` - Update contract plot (supports partial updates)
    - `DELETE /plots/:id` - Soft delete contract plot and related entities
  - **Additional endpoints**:
    - `GET /plots/:id/contracts` - Get all contracts for a physical plot (for split sales)
    - `POST /plots/:id/contracts` - Add new contract to existing physical plot
    - `GET /plots/:id/inventory` - Get physical plot inventory status (total/allocated/available area)
  - **Features**:
    - Split sales support (multiple contracts per physical plot)
    - Automatic inventory management and status updates
    - Contract area validation
    - Transaction-based atomic operations
    - Optional related data: WorkInfo, BillingInfo, UsageFee, ManagementFee
    - Integration with CollectiveBurial, FamilyContact, BuriedPerson
- **Auth** - Authentication system (`/api/v1/auth`)
  - Supabase-based JWT authentication
  - Login, logout, current user info, password change

### Planned Business Entities
The following entities are defined in the database schema but routes not yet implemented:
- **Family Contacts** - Emergency and family contact information (linked to PhysicalPlot)
- **Buried Persons** - Information about people buried at physical plots
- **Collective Burials** - Mass burial management (integrated with PhysicalPlot via `physical_plot_id`)
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

### Critical Relationships (v2.0 - ContractPlot Model)
- **PhysicalPlot → ContractPlot**: 1:N (supports split sales - multiple contracts per physical plot)
- **ContractPlot → SaleContract**: 1:1 (each contract has one sale contract)
- **SaleContract → Customer**: 1:1 (each sale contract has one customer)
- **Customer → WorkInfo**: 1:1 (optional work/company information)
- **Customer → BillingInfo**: 1:1 (optional billing/bank information)
- **ContractPlot → UsageFee**: 1:1 (optional usage fee details)
- **ContractPlot → ManagementFee**: 1:1 (optional management fee details)
- **PhysicalPlot → FamilyContact**: 1:N (family contacts linked to physical plot)
- **PhysicalPlot → BuriedPerson**: 1:N (burial records linked to physical plot)
- **PhysicalPlot → CollectiveBurial**: 1:N (collective burial requests linked to physical plot)

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

**Swagger UI** (Interactive API Documentation):
- **Endpoint**: `GET /api-docs`
- **URL**: `http://localhost:4000/api-docs` (when server is running)
- **Features**:
  - Interactive API specification viewer
  - Try it out functionality to test APIs directly from browser
  - JWT authentication support for protected endpoints
  - Request/response sample code generation
  - Custom styling with hidden topbar
  - Custom site title: "墓石管理システム API Documentation"

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
- **High test coverage required** - Functions 100%, Lines 99%, Statements 97%, Branches 80%
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
  - Local: `postgresql://username:password@localhost:5432/komine_cemetery_crm`
  - Docker: Automatically constructed from `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_PORT`
- **ALLOWED_ORIGINS**: Comma-separated list of allowed CORS origins (e.g., "https://example.com,https://app.example.com")
  - In development, if not set, all origins are allowed
  - In production, this is REQUIRED - unset will reject all cross-origin requests
- **SUPABASE_URL**: Supabase project URL (optional, auth endpoints return 503 if not set)
- **SUPABASE_SERVICE_ROLE_KEY**: Supabase service role key (optional, auth endpoints return 503 if not set)
- **PORT**: Server port (optional, defaults to 4000)
- **NODE_ENV**: Environment mode (development, test, production)

### Docker-specific Environment Variables
- **DB_USER**: PostgreSQL username (default: cemetery_user)
- **DB_PASSWORD**: PostgreSQL password (default: cemetery_password)
- **DB_NAME**: PostgreSQL database name (default: komine_cemetery_crm)
- **DB_PORT**: PostgreSQL port (default: 5432)

See `PRODUCTION_SETUP.md` for detailed production deployment configuration and `DOCKER_SETUP.md` for Docker-specific setup including CORS setup, security checklist, and troubleshooting.

## CI/CD Pipeline

### GitHub Actions Workflow
- **Workflow file**: `.github/workflows/ci.yml`
- **Triggers**: Push/PR to `main` or `develop` branches
- **Permissions**:
  - `contents: read` - Repository content access
  - `security-events: write` - SARIF upload to GitHub Security
  - `actions: read` - Workflow run information access
- **Jobs**:
  - **Build**: TypeScript compilation check, Prisma client generation
  - **Lint & Format Check**: ESLint + Prettier validation
  - **Swagger Validation**: OpenAPI spec validation
  - **Security Audit**: npm audit (moderate+ vulnerabilities)
  - **Docker Security Scan**: Trivy vulnerability scanner (CRITICAL/HIGH)
  - **Test**: Run all 428 tests on Node.js 18.x, 20.x, 22.x (parallel)
  - **Coverage**: Generate and upload to Codecov (Node 20.x only)
  - **All Checks Passed**: Final validation gate

### Security Scanning
- **Dependabot**: Automated dependency updates (weekly, Monday 9:00 JST)
  - npm packages
  - GitHub Actions
  - Docker base images
- **npm audit**: Runs on every push/PR (moderate+ level)
- **Trivy**: Docker image vulnerability scanning with GitHub Security integration
  - Uses CodeQL Action v4 for SARIF upload
  - SARIF file existence check before upload
  - Continues on error to prevent blocking other jobs
  - **Note**: SARIF upload requires GitHub Code Scanning to be enabled
    - Public repositories: Code Scanning available for free
    - Private repositories: Requires GitHub Advanced Security (paid)
    - If not enabled, workflow continues with warning (table output still available)
- Results uploaded to GitHub Security tab for centralized management (when Code Scanning enabled)

See `CI_CD_SETUP.md` for detailed setup instructions and `SECURITY.md` for security policy.

### Test Environment
- CI uses **Prisma Mock** (not real PostgreSQL) for fast execution
- All tests run in ~5-7 seconds
- Coverage artifacts stored for 30 days
- Build artifacts stored for 7 days

## Important Notes

- **Health check endpoint**: `GET /health` returns server status, uptime, and environment
- **API documentation endpoint**: `GET /api-docs` provides interactive Swagger UI for API testing and documentation
- **Server startup**: Displays ASCII art banner with port, environment, health check URL, and API Docs URL
- **Request logging**: All requests logged with timestamp, method, path, status code, duration, and user info
- **Security**:
  - Helmet security headers (CSP, HSTS, X-Frame-Options, etc.)
  - CORS with origin whitelist (`ALLOWED_ORIGINS` env var)
  - Rate limiting (100 req/15min global, 5 req/15min for auth)
  - HPP protection against parameter pollution
  - XSS sanitization on all inputs
- **Documentation**:
  - Project overview: README.md
  - Contributing guidelines: CONTRIBUTING.md
  - Security policy: SECURITY.md
  - Change history: CHANGELOG.md
  - API specification: API_SPECIFICATION.md, swagger.yaml, swagger.json
  - Database specification: DATABASE_SPECIFICATION.md
  - Docker setup: DOCKER_SETUP.md
  - Production setup: PRODUCTION_SETUP.md
  - CI/CD setup: CI_CD_SETUP.md
  - Postman collection: postman-collection.json
- **Language**: Japanese language content throughout (墓石管理システム = Cemetery Management System)
- **Test suite**: 428 tests with high coverage thresholds (Functions 100%, Lines 99%, Statements 97%, Branches 80%)
- **Testing approach**: Mock Prisma client defined in `__mocks__/@prisma/client.ts`

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

### CI/CD Coverage Threshold Failures
If GitHub Actions CI fails with "coverage threshold not met":
- Current thresholds: Functions 100%, Lines 99%, Statements 97%, Branches 80%
- Check `jest.config.js` line 16-22 for threshold configuration
- These are high-quality thresholds; 100% on all metrics is unrealistic for complex controllers
- See commit history for rationale on current threshold values

### CORS Issues in Production
If frontend cannot connect to backend:
- Verify `ALLOWED_ORIGINS` environment variable is set correctly
- Must be comma-separated, no spaces: `"https://app.com,https://admin.app.com"`
- Include protocol (https://) and exact domain (no wildcards)
- Check server logs for "CORS blocked:" warnings
- See `PRODUCTION_SETUP.md` for detailed troubleshooting

### Docker Issues
If Docker containers fail to start or connect:
- **Database connection errors**: Check `DB_USER`, `DB_PASSWORD`, `DB_NAME` in `.env`
- **Port conflicts**: Change `PORT` or `DB_PORT` in `.env` if already in use
- **Permission errors**: Ensure proper file permissions on volumes
- **Container not updating**: Rebuild with `docker compose build --no-cache`
- **Prisma client errors**: Run `docker compose exec app npx prisma generate`
- See `DOCKER_SETUP.md` for comprehensive troubleshooting guide