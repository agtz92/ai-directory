# Guía para editar planes y limitantes

> **Para agentes futuros:** Este documento describe exactamente qué tocar, qué no tocar, y cómo el frontend se entera de los cambios.

---

## Fuente única de verdad

**`backend/directorio/plan_limits.py`** es el único archivo que define qué puede hacer cada plan. El frontend **nunca** hardcodea estos valores — los recibe del backend vía GraphQL.

---

## Caso 1 — Cambiar el valor de un límite existente

Edita `_LIMITS` en `plan_limits.py`:

```python
_LIMITS: dict[str, dict[str, Any]] = {
    'free': {
        'max_categorias': 1,      # ← cambiar aquí
        ...
    },
    'starter': {
        'max_categorias': 3,      # ← cambiar aquí
        ...
    },
}
```

**Después:** Reiniciar Django (`python manage.py runserver` o `systemctl restart gunicorn`).
No se necesita migración ni cambiar el frontend.

---

## Caso 2 — Agregar un nuevo campo de límite

### Paso 1 — Agregar la clave a `_LIMITS`

```python
_LIMITS = {
    'free':       { ..., 'max_usuarios': 1 },
    'starter':    { ..., 'max_usuarios': 3 },
    'pro':        { ..., 'max_usuarios': 10 },
    'enterprise': { ..., 'max_usuarios': _UNLIMITED },
}
```

### Paso 2 — Agregar el campo a `PlanLimitsType`

```python
@strawberry.type
class PlanLimitsType:
    ...
    max_usuarios: int   # ← agregar aquí
```

### Paso 3 — Agregar el campo a `build_plan_limits()`

```python
def build_plan_limits(plan: str) -> PlanLimitsType:
    d = get_limits(plan)
    return PlanLimitsType(
        ...
        max_usuarios=d['max_usuarios'],   # ← agregar aquí
    )
```

### Paso 4 — Agregar el campo a `PlanLimits` en el frontend

Archivo: `frontend/lib/auth-store.ts`

```typescript
export interface PlanLimits {
  ...
  maxUsuarios: number   // ← agregar aquí (camelCase)
}
```

### Paso 5 — Agregar el campo al fragmento GraphQL

Archivo: `frontend/lib/graphql/mutations.ts` (fragmento `ME_FIELDS`)
y `frontend/lib/graphql/queries.ts` (query `ME_QUERY`):

```graphql
planLimits {
  ...
  maxUsuarios    # ← agregar aquí
}
```

### Paso 6 — Usar el nuevo límite

En el frontend con `usePlan()`:
```typescript
const { limits } = usePlan()
if (currentUsers >= limits.maxUsuarios) { ... }
```

En el backend con `enforce_max()`:
```python
from directorio.plan_limits import enforce_max
enforce_max(empresa, 'max_usuarios', current_count, 'usuarios')
```

---

## Caso 3 — Agregar un plan nuevo (e.g., 'business')

### Paso 1 — Agregar a `_LIMITS`
```python
'business': {
    'max_categorias': 10,
    ...
}
```

### Paso 2 — Agregar a `_PLAN_META`
```python
_PLAN_META = {
    ...
    'business': ('Business', 1499),
}
```

### Paso 3 — Agregar a `EmpresaPerfil.Plan` en `models.py`
```python
class Plan(models.TextChoices):
    ...
    BUSINESS = 'business', 'Business $1,499/mes'
```

### Paso 4 — Crear migración
```bash
python manage.py makemigrations directorio --name="add_business_plan"
python manage.py migrate
```

### Paso 5 — Actualizar frontend
En `frontend/lib/auth-store.ts`:
```typescript
export type EmpresaPlan = 'free' | 'starter' | 'pro' | 'enterprise' | 'business'
```

En `frontend/lib/use-plan.ts`:
```typescript
const PLAN_RANK: Record<EmpresaPlan, number> = {
  free: 0, starter: 1, business: 2, pro: 3, enterprise: 4,
}
```

---

## Caso 4 — Agregar enforcement en el backend (nueva mutation)

Cuando una mutation debe respetar un límite, usar los helpers de `plan_limits.py`:

```python
from directorio.plan_limits import enforce_max, enforce_bool

# Para límites numéricos (e.g., cuántos usuarios puede invitar)
enforce_max(empresa, 'max_usuarios', current_user_count, 'usuarios')

# Para features booleanas (e.g., puede subir galería)
enforce_bool(empresa, 'puede_ver_leads', 'ver leads')
```

Ambas funciones lanzan `ValueError` con mensaje legible. Strawberry lo convierte automáticamente en un error GraphQL que el frontend puede mostrar con `toast.error(err.message)`.

---

## Cómo el frontend conoce los límites

### Flujo normal (login / register)

```
POST /graphql  mutation Register / query Me
    ↓
backend _build_me() llama build_plan_limits(empresa.plan)
    ↓
GraphQL response incluye:
  me {
    empresaPlan
    planLimits {
      maxCategorias maxSubcategorias
      puedeVerLeads puedeSubirPortada
      maxFotosGaleria badgeVerificado soporte
    }
  }
    ↓
setMe(result.data.me)  →  Zustand store
    ↓
usePlan().limits.maxCategorias  → usado en componentes
```

### Para la página de precios (sin auth)

```typescript
// website o frontend, sin auth
const { data } = await fetch('/public/graphql/', {
  method: 'POST',
  body: JSON.stringify({
    query: `{ planes { slug nombre precioMensual limits {
      maxCategorias puedeVerLeads puedeSubirPortada
    } } }`,
  }),
})
```

El endpoint `/public/graphql/` no requiere token y devuelve todos los planes con sus límites. Útil para renderizar tablas de comparación de planes.

---

## Valor "ilimitado"

El backend usa `999` como sentinel de "sin límite". **No renderizar este número en UI.**

```typescript
// frontend/lib/use-plan.ts expone:
const { limitLabel, isUnlimited } = usePlan()

limitLabel(limits.maxCategorias)  // → "Sin límite" si es 999, o "3" si es 3
isUnlimited(limits.maxCategorias) // → true si es 999
```

Si necesitas un sentinel diferente, cambia `_UNLIMITED = 999` en `plan_limits.py`
**y** `UNLIMITED = 999` en `frontend/lib/use-plan.ts`.

---

## Resumen de archivos involucrados

| Archivo | Qué contiene | Cuándo tocarlo |
|---|---|---|
| `backend/directorio/plan_limits.py` | Tabla de límites, tipos GraphQL, helpers | Siempre al cambiar planes |
| `backend/directorio/models.py` | `EmpresaPerfil.Plan` TextChoices | Solo al agregar un plan nuevo |
| `backend/directorio/mutations.py` | `enforce_*` en mutations | Al agregar enforcement a una acción |
| `backend/users/mutations.py` | `MeType`, `_build_me()` | Al agregar campos a `MeType` |
| `frontend/lib/auth-store.ts` | Interfaz `PlanLimits`, tipo `EmpresaPlan` | Al agregar campos o planes |
| `frontend/lib/graphql/queries.ts` | `ME_QUERY` con `planLimits { ... }` | Al agregar campos a `planLimits` |
| `frontend/lib/graphql/mutations.ts` | Fragmento `ME_FIELDS` compartido | Al agregar campos a `planLimits` |
| `frontend/lib/use-plan.ts` | Hook `usePlan()`, `PLAN_RANK` | Al agregar planes nuevos |
