# New App Build Guide — Multi-Tenant Products Platform

> A complete reference for a new agent to build a standalone SaaS app that reuses the auth,
> multi-tenant, landing page, and product systems from this repo.
> Goal: users sign up, create their workspace (tenant), build a landing page, and manage
> a product catalog with **categories + subcategories** that are **global** (shared across all tenants).
> Products are tenant-scoped; categories and subcategories are not.

---

## What to Reuse Verbatim

Copy these directories wholesale — they are self-contained and need no modification:

| Source | What it is |
|--------|-----------|
| `backend/users/` | CustomUser model, Supabase JWT auth, register/login/switchTenant mutations |
| `backend/core/` | Tenant + TenantMembership models, migrations |
| `backend/users/auth.py` | JWT decode, `get_user_from_request`, `get_tenant_from_user` |
| `frontend/src/pages/Login.tsx` | Login page (Supabase email/password) |
| `frontend/src/pages/ForgotPassword.tsx` | Password reset request |
| `frontend/src/pages/ResetPassword.tsx` | Password reset confirmation |
| `frontend/src/components/AuthGuard.tsx` | Route guard that redirects unauthenticated users |
| `frontend/src/lib/apollo.ts` | Apollo Client wired to backend with Supabase JWT |
| `frontend/src/lib/toast.tsx` | Toast notification system |
| `frontend/src/lib/theme.ts` | Dark mode toggle persisted to localStorage |
| `frontend/src/components/layout/CMSLayout.tsx` | Shell layout: sidebar + topbar + outlet |
| `frontend/src/components/layout/Sidebar.tsx` | Dynamic sidebar driven by tenant modules |
| `frontend/src/pages/Websites.tsx` | Create/edit workspaces with module picker |
| `frontend/src/pages/Settings.tsx` | Tenant name/slug/color/template settings |
| `frontend/src/pages/Dashboard.tsx` | Multi-module stat dashboard |
| `frontend/src/pages/LandingPages.tsx` | Landing page list |
| `frontend/src/pages/LandingPageEditor.tsx` | Full tabbed landing page editor |

---

## Repo Structure for the New App

```
/backend     Django + Strawberry GraphQL
/frontend    React + Vite CMS (admin UI)
/website     Next.js 15 public-facing website (optional for this app)
/venv        Python virtual environment
```

Running commands:
```bash
# Backend
cd backend && python manage.py runserver

# CMS
cd frontend && pnpm dev   # http://localhost:5173

# Public website (optional)
cd website && pnpm dev    # http://localhost:3000
```

---

## Backend

### Stack

- Python 3.12 + Django 5 + Strawberry GraphQL
- PostgreSQL
- Supabase (auth only — JWT issuer)
- Two GraphQL endpoints:
  - `/graphql/` — authenticated CMS schema (requires `Authorization: Bearer <jwt>`)
  - `/t/<tenant_slug>/graphql/` — public read-only schema (no auth, published content only)

### Required Environment Variables

```
SECRET_KEY=
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1
DB_NAME=postgres
DB_USER=postgres
DB_PASSWORD=
DB_HOST=localhost
DB_PORT=5432
SUPABASE_JWT_SECRET=       # only needed for HS256 fallback
NEXT_PUBLIC_SUPABASE_URL=  # e.g. https://xyz.supabase.co
CORS_ALLOWED_ORIGINS=http://localhost:5173
```

### Django Apps

```
cms_backend/   Django project (settings, urls, schema merge)
core/          Tenant, TenantMembership
users/         CustomUser, Supabase auth, register/switchTenant mutations
content/       Category, Subcategory, Product, LandingPage (and sub-items)
```

### Settings (`cms_backend/settings.py`)

Copy exactly from this repo. Key additions:

```python
INSTALLED_APPS = [
    ...
    'core',
    'users',
    'content',
]
AUTH_USER_MODEL = 'users.CustomUser'
SUPABASE_JWT_SECRET = config('SUPABASE_JWT_SECRET', default='')
SUPABASE_URL = config('NEXT_PUBLIC_SUPABASE_URL', default='')
```

---

### Core Models (`core/models.py`)

Copy verbatim from this repo. These are unchanged:

```python
class Tenant(models.Model):
    name          # CharField
    slug          # SlugField, unique
    color         # CharField (hex, default '#334155')
    template      # CharField (default 'modern')
    template_config  # JSONField (per-template copy overrides)
    modules       # JSONField (list of enabled module keys, e.g. ["products","landingpage"])
    status        # TextChoices: TRIAL, ACTIVE, SUSPENDED, CANCELLED

class TenantMembership(models.Model):
    tenant  # FK → Tenant
    user    # FK → CustomUser
    role    # TextChoices: OWNER, ADMIN, EDITOR, VIEWER
    is_active  # BooleanField
```

Migrations (core): `0001–0005` from this repo cover everything needed.

---

### User Models (`users/models.py`)

Copy verbatim:

```python
class CustomUser(AbstractUser):
    display_name  # CharField
    role          # owner / admin / editor / viewer
    supabase_id   # CharField, unique — links to Supabase auth.users.id
    active_tenant # FK → Tenant (currently selected workspace)
```

---

### Auth Flow (`users/auth.py`)

Copy verbatim. Summary:

1. Frontend signs user in via Supabase (`supabase.auth.signIn`)
2. Supabase returns a JWT with `sub = supabase_id`
3. Frontend sends `Authorization: Bearer <jwt>` on every GraphQL request
4. `get_user_from_request(info)` decodes JWT → looks up `CustomUser` by `supabase_id`
5. `get_tenant_from_user(user)` returns `user.active_tenant` (with fallback to first membership)

Key functions:
- `decode_jwt(token)` — supports ES256 (JWKS) and HS256 (legacy); caches JWKS for 1 hour
- `get_user_from_request(info: Info) -> CustomUser`
- `get_tenant_from_user(user) -> Tenant`

---

### Content Models (`content/models.py`) — NEW for this app

**Key design decision: categories and subcategories are global — no `tenant` FK.**
Every tenant's product catalog draws from the same shared category tree.
Only `Product` is tenant-scoped.

```python
class Category(models.Model):
    """Global — shared across all tenants. No tenant FK."""
    name      = CharField(max_length=100)
    slug      = SlugField(unique=True)   # globally unique slug
    created_at = DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [UniqueConstraint(fields=['slug'], name='uniq_category_slug')]


class Subcategory(models.Model):
    """Global — belongs to a Category, no tenant FK."""
    category  = FK → Category, related_name='subcategories', on_delete=CASCADE
    name      = CharField(max_length=100)
    slug      = SlugField()
    created_at = DateTimeField(auto_now_add=True)

    class Meta:
        # slug must be unique within its parent category, but same slug can exist under different categories
        constraints = [UniqueConstraint(fields=['category', 'slug'], name='uniq_subcategory_cat_slug')]


class Product(models.Model):
    """Tenant-scoped. Points to global Category/Subcategory."""
    class Status(TextChoices):
        DRAFT     = 'draft'
        PUBLISHED = 'published'
        ARCHIVED  = 'archived'

    tenant           = FK → Tenant                        # tenant-scoped
    title            = CharField(max_length=255)
    slug             = SlugField()
    description      = TextField(blank=True)
    status           = CharField(Status choices, default DRAFT)
    cover_image      = ImageField(upload_to='products/', null=True, blank=True)
    price            = DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    compare_at_price = DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    sku              = CharField(max_length=100, blank=True)
    stock            = PositiveIntegerField(null=True, blank=True)
    brand            = CharField(max_length=100, blank=True)
    category         = FK → Category, null=True, blank=True    # global
    subcategory      = FK → Subcategory, null=True, blank=True # global
    created_by       = FK → CustomUser, null=True
    created_at       = DateTimeField(auto_now_add=True)
    updated_at       = DateTimeField(auto_now=True)
    published_at     = DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [UniqueConstraint(fields=['tenant', 'slug'], name='uniq_product_tenant_slug')]
```

The LandingPage models are copied verbatim from `content/models.py` in this repo:
`LandingPage`, `LandingFeature`, `LandingTestimonial`, `LandingPricingPlan`,
`LandingFaqItem`, `LandingStatItem`, `LandingLogo` — no changes needed.

---

### GraphQL Schemas

#### Authenticated Schema (`cms_backend/schema.py`)

Merge `ContentQuery + ContentMutation + UserQuery + UserMutation`:

```python
import strawberry
from content.queries import ContentQuery
from content.mutations import ContentMutation
from users.mutations import UserQuery, UserMutation

@strawberry.type
class Query(ContentQuery, UserQuery): pass

@strawberry.type
class Mutation(ContentMutation, UserMutation): pass

schema = strawberry.Schema(query=Query, mutation=Mutation)
```

#### URL Wiring (`cms_backend/urls.py`)

```python
from strawberry.django.views import GraphQLView
from django.views.decorators.csrf import csrf_exempt
from cms_backend.schema import schema
from content.public_schema import public_schema   # see below

urlpatterns = [
    path('graphql/', csrf_exempt(GraphQLView.as_view(schema=schema))),
    path('t/<slug:tenant_slug>/graphql/', csrf_exempt(PublicGraphQLView.as_view())),
    path('media/', ...),
]
```

#### Authenticated Content Queries (`content/queries.py`)

Required queries for Products + Categories + Subcategories + Landing Pages:

```
# Categories and subcategories — NO tenant filter, they are global
categories(search?)              → [CategoryType]
subcategories(categoryId)        → [SubcategoryType]

# Products — ALWAYS filter by tenant
products(status?, categoryId?,   → [ProductType]
         subcategoryId?, search?,
         limit?, offset?)
productById(id)                  → ProductType

# Landing Pages — ALWAYS filter by tenant
landingPages                     → [LandingPageType]
landingPageById(id)              → LandingPageType (prefetch all sub-items)

# Stats — covers tenant's products only
dashboardStats                   → DashboardStats { moduleStats: [ModuleStatType] }
recentActivity(limit)            → [RecentActivityItem]
```

**Rule**: `categories` and `subcategories` queries fetch from the global table — no tenant
filter. `products`, `landingPages`, and all write mutations always filter by
`tenant = get_tenant_from_user(user)`.

#### Authenticated Content Mutations (`content/mutations.py`)

```
# Categories — GLOBAL, no tenant check. Restrict to Django admin or a superuser flag
# in production; for now expose to all authenticated users as read/write.
createCategory(name)               → CategoryType
updateCategory(id, name)           → CategoryType
deleteCategory(id)                 → bool   # cascades subcategories

# Subcategories — GLOBAL, no tenant check
createSubcategory(name, categoryId) → SubcategoryType
updateSubcategory(id, name)         → SubcategoryType
deleteSubcategory(id)               → bool

# Products — tenant-scoped (always resolve + filter by tenant)
createProduct(title, description?, price?, compareAtPrice?, sku?,
              stock?, brand?, categoryId?, subcategoryId?, status?)
                                    → ProductType
updateProduct(id, ...same fields)   → ProductType
deleteProduct(id)                   → bool
uploadProductCover(id, file)        → ProductType
removeProductCover(id)              → ProductType
bulkUpdateProductStatus(ids, status) → int
bulkDeleteProducts(ids)             → int

# Landing Pages — tenant-scoped. Copy verbatim from content/mutations.py in this repo
createLandingPage(...)              → LandingPageType
updateLandingPage(...)              → LandingPageType
deleteLandingPage(id)               → bool
# + all sub-item CRUD: createLandingFeature, updateLandingFeature, deleteLandingFeature
# + reorderLandingFeatures, reorderLandingTestimonials, reorderLandingPricingPlans,
#   reorderLandingFaqItems, reorderLandingStatItems, reorderLandingLogos
```

Important Strawberry rules (copy from this repo):
- Product and LandingPage mutations must call `get_user_from_request(info)` and `get_tenant_from_user(user)`
- Category/Subcategory mutations only need `get_user_from_request(info)` (auth check, no tenant filter)
- Strawberry auto-converts `snake_case → camelCase` in the GraphQL schema
- Input fields with Python `default=''` are `String!` in GraphQL — send `''` not `null`
- When creating a product with a subcategory, validate `subcategory.category_id == categoryId`

#### Public Schema (`content/public_schema.py`)

No auth. Serves published content for the public website. Needed queries:

```
tenant                              → { name, template, modules }
landingPage(slug)                   → LandingPageType (published only, all sub-items)
products(categorySlug?, subcategorySlug?, search?)  → [ProductType] (published only, tenant-scoped)
product(slug)                       → ProductType (tenant-scoped)
categories                          → [CategoryType]  # global — no tenant filter
subcategories(categorySlug)         → [SubcategoryType]  # global — no tenant filter
```

Must resolve tenant via URL path param `tenant_slug` (not from auth).
Category/subcategory queries return the full global list — no tenant filter applies.

---

### User Mutations (`users/mutations.py`)

Copy verbatim from this repo. All these mutations are unchanged:

| Mutation | What it does |
|----------|-------------|
| `register(email, displayName)` | Post-Supabase signup: creates CustomUser + first Tenant + TenantMembership |
| `createWebsite(name, color, modules)` | Creates a new Tenant and adds caller as OWNER |
| `updateWebsite(tenantId, name, color, modules)` | Updates tenant (OWNER only) |
| `switchTenant(tenantId)` | Changes `user.active_tenant`, returns updated MeType |
| `updateTenant(name, slug, color)` | Updates name/slug/color of active tenant |
| `updateTemplate(template)` | Sets active tenant's template (modern/retro/futuristic/executive) |
| `updateTemplateConfig(config)` | Saves per-template JSON copy overrides |
| `reactivateModule(key)` | Appends a module key back to tenant.modules |
| `updateProfile(displayName)` | Updates user's display name |

`MeType` fields returned by all user mutations:
```
id, email, displayName, role
tenantSlug, tenantName, tenantId, tenantColor, tenantTemplate, tenantTemplateConfig, tenantModules
tenants: [TenantInfoType]   ← all workspaces the user belongs to
```

---

## CMS Frontend (`/frontend`)

### Stack

- React 18 + Vite + TypeScript
- Apollo Client (GraphQL) — copy `frontend/src/lib/apollo.ts` verbatim
- React Hook Form + Zod validation
- React Router v6
- Tailwind CSS + shadcn/ui components
- Zustand (`useAuthStore`) — stores Supabase session and JWT
- Supabase JS client for auth

### Module Config (`frontend/src/lib/modules.ts`)

For this new app register only the modules you need:

```typescript
export const CONTENT_MODULES: ContentModule[] = [
  {
    key: 'products',
    label: 'Products',
    description: 'Product catalog with categories and subcategories',
    icon: Package,
    navItems: [
      { to: '/products',              label: 'Products',      icon: Package },
      { to: '/products/categories',   label: 'Categories',    icon: Tag },
    ],
  },
  {
    key: 'landingpage',
    label: 'Landing Pages',
    description: 'Marketing landing pages',
    icon: Layout,
    navItems: [
      { to: '/landing-pages', label: 'Landing Pages', icon: Layout },
    ],
  },
]
```

The sidebar reads `me.tenantModules` from GraphQL and auto-renders nav grouped by module.
No other sidebar changes needed — it is entirely data-driven.

### Routes (`frontend/src/App.tsx`)

```tsx
// Public (no auth)
/login
/forgot-password
/reset-password

// Protected (wrapped by AuthGuard + CMSLayout)
/                          → Dashboard
/products                  → Products list
/products/new              → ProductEditor
/products/:id/edit         → ProductEditor
/products/categories       → Categories (with subcategory management inline)
/landing-pages             → LandingPages list
/landing-pages/new         → LandingPageEditor
/landing-pages/:id/edit    → LandingPageEditor
/websites                  → Websites (workspace management)
/settings                  → Settings
```

### Pages to Copy Verbatim

These pages from this repo need zero changes:

- `Login.tsx`, `ForgotPassword.tsx`, `ResetPassword.tsx`
- `Dashboard.tsx` — already module-aware; just register your modules
- `Websites.tsx` — workspace CRUD + module picker
- `Settings.tsx` — tenant settings + template picker
- `LandingPages.tsx` — landing page list table
- `LandingPageEditor.tsx` — full tabbed editor (9 tabs)

### Pages to Build New

#### `Products.tsx` — product list

Table with:
- Status tabs (All / Published / Draft / Archived)
- Search input (queries `products(search: ...)`)
- Sort (title, price, created_at)
- Bulk actions: mark published/draft/archived, delete (with confirmation)
- Row actions: edit link, quick status toggle, delete
- Pagination

#### `ProductEditor.tsx` — create/edit product

Form fields:
- Title (auto-generates slug; lock/unlock toggle)
- Description (textarea or markdown)
- Status select (Draft / Published / Archived)
- Price, Compare-at Price
- SKU, Stock, Brand
- Category select (loads from global `categories` query — same list for all tenants)
- Subcategory select (loads from `subcategories(categoryId)` — re-fetches when category changes; clears selection when category changes)
- Cover image upload (multipart via `uploadProductCover` mutation)
- Save / Save & Publish buttons

#### `Categories.tsx` — category + subcategory management

Two panels on one page:
1. **Categories** — global list with create/rename/delete. Each row has an expand arrow.
2. **Subcategories** — shown inline or in a side panel when a category is selected. Create/rename/delete subcategories under the selected category.

Because categories are global, changes made here affect all tenants. Show a warning
banner: _"Categories are shared across all accounts."_

Queries needed: `categories`, `subcategories(categoryId: selectedId)`
Mutations needed: `createCategory`, `updateCategory`, `deleteCategory`,
                  `createSubcategory`, `updateSubcategory`, `deleteSubcategory`

No tenant context is needed for these queries/mutations — they hit the global table.

### Auth Store (`frontend/src/lib/authStore.ts`)

Copy from `useAuthStore` in this repo. Stores:
- `session` — Supabase session object
- `token` — JWT string (sent as `Authorization: Bearer <token>`)
- `setSession(session)` — called after `supabase.auth.signIn()`
- `clearSession()` — called on logout

Apollo client reads `token` from the store via an auth link:

```typescript
const authLink = new ApolloLink((operation, forward) => {
  const token = useAuthStore.getState().token
  if (token) {
    operation.setContext({ headers: { Authorization: `Bearer ${token}` } })
  }
  return forward(operation)
})
```

### Registration Flow

1. User fills signup form → `supabase.auth.signUp({ email, password })`
2. Supabase returns session with JWT
3. Frontend immediately calls `register(email, displayName)` mutation with the JWT
4. Backend creates `CustomUser` + first `Tenant` + `TenantMembership(role=OWNER)`
5. `active_tenant` is set on the user
6. `MeType` returned — frontend stores `tenantSlug`, `tenantModules`, etc.

### Login Flow

1. `supabase.auth.signInWithPassword({ email, password })`
2. Store session in `useAuthStore`
3. Apollo auto-attaches JWT to all subsequent requests
4. Call `me` query on first load to hydrate tenant context

---

## Public Website (`/website`) — Optional

Only needed if you want a public-facing storefront at a tenant URL.

### Stack

- Next.js 15 App Router
- TypeScript + Tailwind CSS v4
- ISR (`export const revalidate = 60` on every page)
- Reads `NEXT_PUBLIC_TENANT_SLUG` env var to resolve which tenant to serve

### Environment Variables

```
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
NEXT_PUBLIC_TENANT_SLUG=<your-tenant-slug>
```

### Critical Next.js 15 Rule

`params` is a **Promise** in Next.js 15. Always await before destructuring:

```typescript
// CORRECT
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  ...
}
```

### Data Layer (`website/lib/graphql.ts`)

Single `gql<T>()` wrapper hitting `/t/<TENANT_SLUG>/graphql/`:

```typescript
export async function gql<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const url = `${process.env.NEXT_PUBLIC_API_BASE_URL}/t/${process.env.NEXT_PUBLIC_TENANT_SLUG}/graphql/`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
    next: { revalidate: 60 },
  })
  const json = await res.json()
  return json.data as T
}
```

### Routes

```
/                          → Landing page (redirect to /lp/<default-slug> or homepage)
/lp/[slug]                 → Landing page renderer
/products                  → Product catalog (grid)
/products/[slug]           → Product detail
/products/category/[slug]  → Products filtered by category
/products/category/[catSlug]/[subSlug]  → Products filtered by subcategory
```

### Template System

Copy `website/lib/templates/` verbatim. Each template exports `<XxxLayout>` with
`{ siteName, enabledModules, children }` props.

`website/app/layout.tsx` fetches `tenant.template` from public schema and renders
the matching layout component. Copy this file verbatim.

---

## Key Patterns to Follow Everywhere

### Tenant Scoping Rules

Products and landing pages are always tenant-scoped. Categories and subcategories are global.

```python
# Products — always filter by tenant
tenant = get_tenant_from_user(user)
products = Product.objects.filter(tenant=tenant)
product  = Product.objects.get(id=id, tenant=tenant)   # never omit tenant= here

# Categories — global, no tenant filter
categories = Category.objects.all()
category   = Category.objects.get(id=id)               # no tenant check needed

# Subcategories — global, scoped only to their parent category
subcategories = Subcategory.objects.filter(category_id=category_id)
```

Never add `tenant=` to Category or Subcategory queries — the model has no such field.

### Slug Auto-Generation

Products: slug must be unique per tenant.
Categories / Subcategories: slug must be unique globally (categories) or per parent (subcategories).

```python
from django.utils.text import slugify

# For products (tenant-scoped)
base_slug = slugify(title)
slug = base_slug
counter = 1
while Product.objects.filter(tenant=tenant, slug=slug).exists():
    slug = f'{base_slug}-{counter}'
    counter += 1

# For categories (globally unique)
base_slug = slugify(name)
slug = base_slug
counter = 1
while Category.objects.filter(slug=slug).exists():
    slug = f'{base_slug}-{counter}'
    counter += 1

# For subcategories (unique within parent category)
base_slug = slugify(name)
slug = base_slug
counter = 1
while Subcategory.objects.filter(category_id=category_id, slug=slug).exists():
    slug = f'{base_slug}-{counter}'
    counter += 1
```

### Subcategory Constraint

A subcategory is always scoped to `(category, slug)` — unique within its parent category.
When deleting a category, subcategories cascade (Django `on_delete=CASCADE`).
When creating a product with a subcategory, validate that `subcategory.category_id == categoryId`
to prevent mismatched category/subcategory pairs.

### GraphQL Strawberry Notes

- Snake_case fields auto-convert to camelCase in the schema (`cover_image` → `coverImage`)
- Optional fields with `default=''` become `String!` — client must send `''` not `null`
- Use `strawberry.ID` for ID inputs; Strawberry handles int/string coercion
- For file uploads use `strawberry.scalar` Upload type (multipart/form-data)

### Migrations Order

Run in this order for a clean setup:

```bash
python manage.py makemigrations core
python manage.py makemigrations users
python manage.py makemigrations content
python manage.py migrate
```

---

## What NOT to Build

This guide intentionally omits:

- Blog, Recipes, Real Estate, Reviews modules — not needed
- Custom domain support (Caddy + tenantByDomain) — not needed
- Docker Compose — out of scope
- CI/CD — out of scope

The landing page module and the product module (with categories + subcategories) are
the only content modules this new app needs.
