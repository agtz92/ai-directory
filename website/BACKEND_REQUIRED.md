# Queries y mutations requeridos en el backend GraphQL

Endpoint público: `http://localhost:8000/public/graphql/`  
Endpoint privado (auth): `http://localhost:8000/graphql/`

Este documento lista lo que el frontend necesita. Fue generado inspeccionando el schema real con introspección y probando las queries directamente.

---

## URGENTE: Query `buscarSubcategorias` para el autocomplete del buscador

El dropdown de búsqueda en el home y en `/buscar` necesita buscar **subcategorías** (los productos específicos) por texto libre. Actualmente `subcategorias(categoriaSlug: String!)` requiere un slug obligatorio, lo que hace imposible cargar todas o buscar por texto.

### Firma requerida

```graphql
type Query {
  buscarSubcategorias(
    search: String!   # texto que escribe el usuario (mínimo 2 chars)
    limit: Int = 8    # para no sobre-cargar el dropdown
  ): [SubcategoriaSearchResult!]!
}

type SubcategoriaSearchResult {
  id: ID!
  nombre: String!
  slug: String!
  categoriaNombre: String!   # nombre de la categoría padre (para mostrar contexto)
  categoriaSlug: String!     # para construir la URL /categorias/[cat]/[sub]
}
```

### URL que el frontend construirá al seleccionar

```
/categorias/[categoriaSlug]/[subcategoriaSlug]
```

### Comportamiento

- Búsqueda ILIKE `%search%` sobre `nombre` de la subcategoría
- Solo subcategorías activas / publicadas
- Ordenadas por relevancia (exact match primero, luego startsWith, luego contains)
- **Sin autenticación** — es un endpoint público

### Contexto

El frontend carga las opciones del dropdown al primer keystroke (≥2 chars) y cancela el request anterior si el usuario sigue escribiendo (debounce 280ms). El `limit: 8` es suficiente para el dropdown.

---

## Bug crítico: `directorio(search: ...)` retorna 0 resultados

**Reproducción directa:**

```bash
# Retorna 1 empresa ✓
curl -X POST http://localhost:8000/public/graphql/ \
  -H "Content-Type: application/json" \
  -d '{"query":"{ directorio(search: \"\", categoriaSlug: \"\", ciudad: \"\", estado: \"\", limit: 5) { total empresas { nombreComercial } } }"}'

# Retorna 0 empresas ✗ (debería retornar las mismas)
curl -X POST http://localhost:8000/public/graphql/ \
  -H "Content-Type: application/json" \
  -d '{"query":"{ directorio(search: \"abanicos\", categoriaSlug: \"\", ciudad: \"\", estado: \"\", limit: 5) { total empresas { nombreComercial } } }"}'
```

**Comportamiento esperado:** `search` debe hacer búsqueda parcial (ILIKE o full-text) sobre:
- `nombreComercial` de la empresa
- `descripcion` de la empresa
- Nombres de categorías y subcategorías asociadas

El frontend pasa exactamente lo que el usuario escribe en la barra de búsqueda. Si `search` no funciona, `/buscar` siempre muestra 0 resultados.

---

## Estado actual del schema

### Queries que SÍ existen

| Query | Args disponibles | Notas |
|---|---|---|
| `categorias` | `search: String = ""`, `activasOnly: Boolean = true` | Funciona ✓ |
| `categoria` | `id: ID!` | Solo por ID, no por slug |
| `subcategorias` | `categoriaId: ID`, `search: String` | Falta arg `categoriaSlug` |
| `miEmpresa` | (requiere auth) | Solo empresa del usuario autenticado |
| `solicitudesCotizacion` | (requiere auth) | — |
| `dashboardStats` | (requiere auth) | — |
| `me` | (requiere auth) | — |

### Queries que el frontend llama y **NO existen**

- `directorio(...)` — usado en `/buscar` y `/categorias/[slug]`
- `empresa(slug: String!)` — usado en `/empresas/[slug]`

---

## 1. Query `directorio` — REQUERIDO

Listado y búsqueda pública de empresas. Se usa en dos páginas:

- `/buscar?q=...&ciudad=...&estado=...` — búsqueda libre
- `/categorias/[slug]?ciudad=...&page=...` — filtrado por categoría con paginación

### Firma esperada

```graphql
type Query {
  directorio(
    search: String = ""
    categoriaSlug: String = ""
    ciudad: String = ""
    estado: String = ""
    limit: Int = 20
    offset: Int = 0
  ): DirectorioResult!
}

type DirectorioResult {
  total: Int!
  hasMore: Boolean!
  empresas: [EmpresaCard!]!
}

type EmpresaCard {
  id: ID!
  nombreComercial: String!
  slug: String!
  ciudad: String
  estado: String
  plan: String!
  scoreCompletitud: Int
  verified: Boolean!
  logoUrl: String
  categorias: [CategoriaRef!]!
}

type CategoriaRef {
  nombre: String!
  slug: String!
}
```

### Comportamiento esperado

- Solo devuelve empresas con `status = "published"` (o equivalente activo)
- `search` filtra por `nombreComercial`, `descripcion`, y keywords de subcategorías
- `categoriaSlug` filtra por categoría principal o cualquier categoría asociada
- `ciudad` y `estado` son filtros opcionales (match parcial o exacto)
- `offset` para paginación: la página `/categorias/[slug]` usa pages de 20 en 20
- `hasMore: true` cuando `offset + limit < total`

---

## 2. Query `empresa(slug)` — REQUERIDO

Perfil público de una empresa por slug. Usado en `/empresas/[slug]`.

### Firma esperada

```graphql
type Query {
  empresa(slug: String!): EmpresaPerfil
}

type EmpresaPerfil {
  id: ID!
  nombreComercial: String!
  slug: String!
  descripcion: String
  ciudad: String
  estado: String
  pais: String
  telefono: String
  sitioWeb: String
  whatsapp: String
  plan: String!
  scoreCompletitud: Int
  verified: Boolean!
  publishedAt: String
  logoUrl: String
  portadaUrl: String
  categoriaPrincipal: CategoriaRef
  categorias: [CategoriaRef!]!
}
```

### Comportamiento esperado

- Retorna `null` si la empresa no existe o no está publicada (el frontend llama `notFound()`)
- Solo empresas públicas/publicadas deben ser accesibles

---

## 3. Arg `categoriaSlug` en `subcategorias` — REQUERIDO

El frontend llama:

```graphql
subcategorias(categoriaSlug: $slug) { id nombre slug }
```

Pero el schema actual solo acepta `categoriaId: ID` y `search: String`.

### Cambio requerido

Agregar el arg `categoriaSlug: String` a la query `subcategorias`:

```graphql
subcategorias(
  categoriaId: ID
  categoriaSlug: String   # ← agregar esto
  search: String = ""
): [SubcategoriaType!]!
```

---

## 4. Mutation `enviarSolicitudCotizacion` — VERIFICAR

Usada en `/cotizacion/[empresa_slug]` (página client-side). Puede que ya exista — verificar si está en el schema.

### Firma esperada

```graphql
type Mutation {
  enviarSolicitudCotizacion(
    empresaSlug: String!
    nombreContacto: String!
    emailContacto: String!
    telefono: String
    empresaCompradora: String
    mensaje: String!
  ): Boolean!
}
```

### Comportamiento esperado

- Envía notificación/email al `emailContacto` de la empresa destino
- No requiere autenticación (es un formulario público)
- Retorna `true` si se envió correctamente, lanza error GraphQL si falla

---

## Notas adicionales

### Autenticación en queries públicos

Los queries `directorio`, `empresa`, y la mutation `enviarSolicitudCotizacion` son **públicos** — no deben requerir JWT ni sesión.

### Campos `logoUrl` / `portadaUrl`

El frontend espera URLs absolutas (o relativas a la raíz). Si se guardan como rutas relativas en la DB, el resolver debe construir la URL completa.

### Slug de empresas

El frontend genera URLs como `/empresas/mi-empresa-ejemplo` — el slug debe ser único y estable (no cambiar si se edita el nombre comercial).
