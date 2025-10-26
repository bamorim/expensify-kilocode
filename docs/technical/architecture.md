# Architecture Documentation

## Overview

This document outlines the technical architecture of the Expensify application, built using the T3 Stack with Next.js, TypeScript, Prisma, tRPC, NextAuth, and Vitest.

## Technology Stack

### Core Technologies

- **Next.js** - React framework with App Router
- **TypeScript** - Type-safe JavaScript
- **Prisma** - Database ORM with PostgreSQL
- **tRPC** - End-to-end typesafe APIs with TanStack Query integration
- **NextAuth** - Authentication framework for Next.js
- **Tailwind CSS** - Utility-first CSS framework
- **Zod** - Schema validation and type inference

### Development Tools

- **ESLint** - Code linting
- **Prettier** - Code formatting
- **Vitest** - Unit testing framework with multi-environment setup
- **pnpm** - Package manager

## Client-Server Architecture

### tRPC Integration

The application uses tRPC to create a type-safe interface between client and server. This eliminates the need for manual API type definitions and provides end-to-end type safety.

#### Server-Side Structure

```
src/server/
├── api/
│   ├── root.ts              # Main tRPC router
│   ├── trpc.ts              # tRPC configuration and middleware
│   └── routers/             # Domain-specific routers with business logic
│       ├── post.ts          # Post-related procedures and logic
│       ├── organization.ts   # Organization management procedures
│       ├── user-management.ts # User role management procedures
│       └── [other-routers]/
├── auth/                    # NextAuth configuration
│   ├── index.ts            # Auth exports
│   └── config.ts           # Auth configuration
├── db/                     # Database configuration
│   ├── index.ts            # Prisma client
│   └── __mocks__/          # Test database mocks
└── permissions.ts           # Role-based permissions system
```

#### Client-Side Integration

The client uses TanStack Query (React Query) for state management and caching:

```typescript
// src/trpc/react.tsx
export const api = createTRPCReact<AppRouter>();

// Usage in components
const { data, isLoading } = api.post.all.useQuery();
const createPost = api.post.create.useMutation();
```

### NextAuth Authentication

NextAuth provides authentication with session management integrated into the tRPC context:

```typescript
// Server context includes session
export const createTRPCContext = async (opts: { headers: Headers }) => {
  const session = await auth();
  return { db, session, ...opts };
};

// Protected procedures can access session
const protectedProcedure = t.procedure.use(enforceUserIsAuthed);
```

## Business Logic Organization

### tRPC Router Pattern

Business logic is organized directly within tRPC routers, keeping the architecture simple and focused:

```typescript
// src/server/api/routers/post.ts
export const postRouter = createTRPCRouter({
  all: publicProcedure.query(async ({ ctx }) => {
    // Business logic directly in the router
    return await ctx.db.post.findMany({
      orderBy: { createdAt: "desc" },
    });
  }),
  
  create: protectedProcedure
    .input(z.object({ title: z.string(), content: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Business logic and validation
      return await ctx.db.post.create({
        data: {
          title: input.title,
          content: input.content,
          authorId: ctx.session.user.id,
        },
      });
    }),
});
```

**Benefits of this approach:**
- **Simpler architecture** - No additional abstraction layer
- **Direct database access** - Business logic has immediate access to Prisma client
- **Easy testing** - Test the entire procedure including business logic
- **Type safety** - Full end-to-end type safety with tRPC

**When to consider services:**
- Complex business logic that spans multiple routers
- Logic that needs to be reused across different procedures
- Heavy computational operations that benefit from separation

## Role-Based Access Control (RBAC)

### Permission System

The application implements a comprehensive role-based access control system with two primary roles:

1. **ADMIN** - Full administrative access to organization resources
2. **MEMBER** - Limited access to organization resources

### Permission Definitions

Permissions are defined in `src/server/permissions.ts`:

```typescript
export const PERMISSIONS = {
  // Organization permissions
  ORG_VIEW: "org:view",
  ORG_UPDATE: "org:update",
  ORG_DELETE: "org:delete",
  
  // Member management permissions
  MEMBER_VIEW: "member:view",
  MEMBER_INVITE: "member:invite",
  MEMBER_UPDATE_ROLE: "member:update_role",
  MEMBER_REMOVE: "member:remove",
  
  // Expense permissions (for future use)
  EXPENSE_CREATE: "expense:create",
  EXPENSE_VIEW_OWN: "expense:view_own",
  EXPENSE_VIEW_ALL: "expense:view_all",
  // ... more permissions
} as const;
```

### Authorization Middleware

Authorization is implemented through a centralized middleware function in `src/server/api/trpc.ts`:

```typescript
export async function authorize(
  db: PrismaClient,
  userId: string,
  organizationId: string,
  requiredPermissions: Permission | Permission[]
): Promise<UserRole> {
  // Get user's role in organization
  const userRole = await getUserRole(userId, organizationId, db);
  
  if (!userRole) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You are not a member of this organization",
    });
  }
  
  // Check if user has required permissions
  const permissions = Array.isArray(requiredPermissions)
    ? requiredPermissions
    : [requiredPermissions];
    
  const hasRequiredPermission = permissions.some(permission =>
    hasPermission(userRole, permission)
  );
  
  if (!hasRequiredPermission) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You don't have permission to perform this action",
    });
  }
  
  return userRole;
}
```

### Client-Side Authorization

Client-side authorization helpers are provided in `src/lib/authorization.ts`:

```typescript
// Permission checking functions
export function canUserPerform(role: UserRole, permission: Permission): boolean;
export function canUserPerformAny(role: UserRole, permissions: Permission[]): boolean;
export function canUserPerformAll(role: UserRole, permissions: Permission[]): boolean;

// React hooks for components
export function usePermission(role: UserRole | undefined, permission: Permission): boolean;
export function useAnyPermission(role: UserRole | undefined, permissions: Permission[]): boolean;

// Permission guard components
export function PermissionGuard({ role, permission, fallback, children }: PermissionGuardProps);
export function AnyPermissionGuard({ role, permissions, fallback, children }: AnyPermissionGuardProps);
```

## User Management System

### User-Organization Model

The application uses a many-to-many relationship between users and organizations through the UserOrganization model:

```typescript
model UserOrganization {
  id        String   @id @default(cuid())
  userId     String
  orgId      String   @map("organizationId")
  role       UserRole  @default(MEMBER)
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  organization Organization @relation(fields: [orgId], references: [id], onDelete: Cascade)

  @@unique([userId, orgId])
}
```

### User Management Procedures

The user management router provides procedures for role management:

```typescript
export const userManagementRouter = createTRPCRouter({
  // Update a user's role in an organization (admin only)
  updateUserRole: protectedProcedure
    .input(updateUserRoleSchema)
    .mutation(async ({ ctx, input }) => {
      // Authorize user to update roles
      await authorize(
        ctx.db,
        ctx.session.user.id,
        input.organizationId,
        PERMISSIONS.MEMBER_UPDATE_ROLE
      );
      
      // Prevent the last admin from being demoted
      if (targetUserOrg.role === UserRole.ADMIN && input.role !== UserRole.ADMIN) {
        const adminCount = await ctx.db.userOrganization.count({
          where: {
            organizationId: input.organizationId,
            role: UserRole.ADMIN,
          },
        });
        
        if (adminCount <= 1) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Cannot remove the last admin from an organization",
          });
        }
      }
      
      // Update the user's role
      return await ctx.db.userOrganization.update({
        where: {
          userId_organizationId: {
            userId: input.userId,
            organizationId: input.organizationId,
          },
        },
        data: { role: input.role },
      });
    }),
    
  // Remove a user from an organization (admin only)
  removeUserFromOrganization: protectedProcedure
    .input(removeUserFromOrganizationSchema)
    .mutation(async ({ ctx, input }) => {
      // Similar authorization and last admin protection
      // ...
    }),
});
```

## Testing Strategy

### Vitest Configuration

The project uses Vitest with a multi-environment setup:

- **Server tests** (`src/server/**/*.test.ts`): Run in `node` environment
- **App tests** (`src/app/**/*.test.{ts,tsx}`): Run in `jsdom` environment with React setup

### Transactional Testing

The application uses transactional testing for database operations using `@chax-at/transactional-prisma-testing`. This approach:

1. **Wraps each test in a transaction** - Database changes are isolated
2. **Automatically rolls back** - No test data persists between tests
3. **Provides realistic testing** - Tests run against actual database operations
4. **Ensures test isolation** - No cross-test contamination

```typescript
// src/server/db/__mocks__/index.ts
import { PrismaTestingHelper } from "@chax-at/transactional-prisma-testing";

const prismaTestingHelper = new PrismaTestingHelper(originalPrismaClient);
export const db = prismaTestingHelper.getProxyClient();

beforeEach(async () => {
  await prismaTestingHelper.startNewTransaction();
});

afterEach(() => {
  prismaTestingHelper?.rollbackCurrentTransaction();
});
```

### Testing Patterns

#### Server-Side Testing (Transactional)

For integration testing with real database operations:

```typescript
import { describe, it, expect } from "vitest";
import { createCaller } from "~/server/api/root";
import { db } from "~/server/db/__mocks__";

describe("User Management Router", () => {
  it("should update user role", async () => {
    const caller = createCaller({ db, session: mockSession, headers: new Headers() });
    
    // This runs in a transaction and gets rolled back
    const result = await caller.updateUserRole({ 
      userId: "user123",
      organizationId: "org456",
      role: "ADMIN"
    });
    
    expect(result.role).toEqual("ADMIN");
  });
});
```

#### Component Testing

**UI Testing Strategy**: Manual testing is preferred for complex UI components. Only test stateless components that are easy to test:

```typescript
// Only test simple, stateless components
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SimpleComponent } from "./SimpleComponent";

describe("SimpleComponent", () => {
  it("should render with correct text", () => {
    render(<SimpleComponent text="Hello" />);
    expect(screen.getByText("Hello")).toBeInTheDocument();
  });
});
```

### Testing Best Practices

1. **Use transactional testing** for database operations in tRPC procedures
2. **Test procedures end-to-end** using `createCaller` for realistic testing
3. **Mock external dependencies** for unit tests when needed
4. **Test business logic** directly in the procedures where it lives
5. **Keep component tests simple** and focused on rendering
6. **Use integration tests** for critical user flows through tRPC
7. **Prefer manual testing** for complex UI interactions
