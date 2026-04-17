import { gql } from '@apollo/client'

// Fields shared by all MeType responses
const STAFF_ME_FIELDS = `
  id email displayName staffRole
  tenantSlug tenantName tenantId
`

export const STAFF_ME_QUERY = gql`
  query StaffMe {
    me {
      ${STAFF_ME_FIELDS}
    }
  }
`

export const STAFF_STATS_QUERY = gql`
  query StaffStats {
    staffStats {
      totalEmpresas porPlan publicadas borradores archivadas
    }
  }
`

export const STAFF_EMPRESAS_QUERY = gql`
  query StaffEmpresas(
    $search: String
    $plan: String
    $status: String
    $limit: Int
    $offset: Int
  ) {
    staffEmpresas(
      search: $search
      plan: $plan
      status: $status
      limit: $limit
      offset: $offset
    ) {
      total
      empresas {
        id nombreComercial slug ciudad estado pais
        plan status scoreCompletitud verified
        logoUrl createdAt updatedAt publishedAt
        tenant { id name slug }
      }
    }
  }
`

export const STAFF_EMPRESA_QUERY = gql`
  query StaffEmpresa($tenantId: ID!) {
    staffEmpresa(tenantId: $tenantId) {
      id nombreComercial slug descripcion
      ciudad estado pais
      telefono emailContacto sitioWeb whatsapp
      plan status scoreCompletitud verified
      logoUrl portadaUrl createdAt updatedAt publishedAt
      tenant { id name slug }
      categoriaPrincipal { id nombre slug }
      categorias { id nombre slug }
      subcategorias { id nombre slug categoriaId }
    }
  }
`

export const STAFF_SOLICITUDES_QUERY = gql`
  query StaffSolicitudes(
    $tenantId: ID!
    $status: String
    $limit: Int
    $offset: Int
  ) {
    staffSolicitudes(
      tenantId: $tenantId
      status: $status
      limit: $limit
      offset: $offset
    ) {
      id nombreContacto emailContacto telefono
      empresaCompradora mensaje status ocultoFree createdAt
    }
  }
`

export const STAFF_EMPLEADOS_QUERY = gql`
  query StaffEmpleados {
    staffEmpleados {
      id email displayName staffRole dateJoined
    }
  }
`

export const STAFF_BUSCAR_USUARIO_QUERY = gql`
  query StaffBuscarUsuario($email: String!) {
    staffBuscarUsuario(email: $email) {
      id email displayName staffRole dateJoined
    }
  }
`

export const STAFF_PRODUCTOS_QUERY = gql`
  query StaffProductos($tenantId: ID!) {
    staffProductos(tenantId: $tenantId) {
      id nombre descripcion precio unidad imagenUrl activo orden createdAt updatedAt
    }
  }
`

export const STAFF_EMPRESA_MODELOS_QUERY = gql`
  query StaffEmpresaModelos($tenantId: ID!) {
    staffEmpresa(tenantId: $tenantId) {
      modelosEmpresa {
        id existencia createdAt updatedAt
        modeloId marcaNombre
        modelo {
          id nombre slug status
          subcategoriaId subcategoriaNombre
          marcaId marcaNombre
        }
      }
    }
  }
`

// ─── Notificaciones ──────────────────────────────────────────────────────────

export const STAFF_NOTIFICACIONES_QUERY = gql`
  query StaffNotificaciones($soloNoLeidas: Boolean) {
    staffNotificaciones(soloNoLeidas: $soloNoLeidas) {
      id tipo referenciaId mensaje leida createdAt
    }
  }
`

export const STAFF_MARCAS_PENDIENTES_QUERY = gql`
  query StaffMarcasPendientes {
    staffMarcasPendientes {
      id nombre slug descripcion status motivoRechazo orden createdAt
      subcategoriaId subcategoriaNombre
    }
  }
`

export const STAFF_MODELOS_PENDIENTES_QUERY = gql`
  query StaffModelosPendientes {
    staffModelosPendientes {
      id nombre slug descripcion status motivoRechazo orden createdAt
      marcaId marcaNombre subcategoriaId subcategoriaNombre
    }
  }
`

export const STAFF_MARCAS_QUERY = gql`
  query StaffMarcas($subcategoriaId: ID!, $status: String) {
    staffMarcas(subcategoriaId: $subcategoriaId, status: $status) {
      id nombre slug descripcion activa status motivoRechazo orden createdAt
      subcategoriaId subcategoriaNombre
    }
  }
`

export const STAFF_MODELOS_QUERY = gql`
  query StaffModelos($marcaId: ID!, $status: String) {
    staffModelos(marcaId: $marcaId, status: $status) {
      id nombre slug descripcion activo status motivoRechazo orden createdAt
      marcaId marcaNombre subcategoriaId subcategoriaNombre
    }
  }
`

// ─── Blog ─────────────────────────────────────────────────────────────────────

const BLOG_POST_FIELDS = `
  id titulo slug extracto contenido imagenPortada
  target status autorNombre createdAt updatedAt publishedAt
`

export const STAFF_POSTS_QUERY = gql`
  query StaffPosts($target: String, $status: String, $search: String, $limit: Int, $offset: Int) {
    staffPosts(target: $target, status: $status, search: $search, limit: $limit, offset: $offset) {
      total hasMore
      posts { id titulo slug extracto imagenPortada target status autorNombre createdAt updatedAt publishedAt }
    }
  }
`

export const STAFF_POST_QUERY = gql`
  query StaffPost($postId: ID!) {
    staffPost(postId: $postId) {
      ${BLOG_POST_FIELDS}
    }
  }
`
