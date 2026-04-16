import { gql } from '@apollo/client'

const EMPRESA_FIELDS = `
  id nombreComercial slug descripcion
  ciudad estado pais
  telefono emailContacto sitioWeb whatsapp
  plan status scoreCompletitud verified
  logoUrl portadaUrl publishedAt
  categoriaPrincipal { id nombre slug }
  categorias { id nombre slug }
  subcategorias { id nombre slug categoriaId }
`

export const STAFF_ACTUALIZAR_EMPRESA_MUTATION = gql`
  mutation StaffActualizarEmpresa(
    $tenantId: ID!
    $nombreComercial: String
    $descripcion: String
    $ciudad: String
    $estado: String
    $pais: String
    $telefono: String
    $emailContacto: String
    $sitioWeb: String
    $whatsapp: String
    $categoriaPrincipalId: ID
    $categoriaIds: [ID!]
    $subcategoriaIds: [ID!]
  ) {
    staffActualizarEmpresa(
      tenantId: $tenantId
      nombreComercial: $nombreComercial
      descripcion: $descripcion
      ciudad: $ciudad
      estado: $estado
      pais: $pais
      telefono: $telefono
      emailContacto: $emailContacto
      sitioWeb: $sitioWeb
      whatsapp: $whatsapp
      categoriaPrincipalId: $categoriaPrincipalId
      categoriaIds: $categoriaIds
      subcategoriaIds: $subcategoriaIds
    ) {
      ${EMPRESA_FIELDS}
    }
  }
`

export const STAFF_CAMBIAR_PLAN_MUTATION = gql`
  mutation StaffCambiarPlan($tenantId: ID!, $plan: String!) {
    staffCambiarPlan(tenantId: $tenantId, plan: $plan) {
      ${EMPRESA_FIELDS}
    }
  }
`

export const STAFF_PUBLICAR_EMPRESA_MUTATION = gql`
  mutation StaffPublicarEmpresa($tenantId: ID!) {
    staffPublicarEmpresa(tenantId: $tenantId) {
      id status publishedAt
    }
  }
`

export const STAFF_ARCHIVAR_EMPRESA_MUTATION = gql`
  mutation StaffArchivarEmpresa($tenantId: ID!) {
    staffArchivarEmpresa(tenantId: $tenantId) {
      id status
    }
  }
`

export const STAFF_DESPUBLICAR_EMPRESA_MUTATION = gql`
  mutation StaffDespublicarEmpresa($tenantId: ID!) {
    staffDespublicarEmpresa(tenantId: $tenantId) {
      id status
    }
  }
`

export const STAFF_MARCAR_SOLICITUD_MUTATION = gql`
  mutation StaffMarcarSolicitud($tenantId: ID!, $solicitudId: ID!, $status: String!) {
    staffMarcarSolicitud(tenantId: $tenantId, solicitudId: $solicitudId, status: $status) {
      id status
    }
  }
`

export const STAFF_ASIGNAR_ROL_MUTATION = gql`
  mutation StaffAsignarRol($userId: ID!, $role: String!) {
    staffAsignarRol(userId: $userId, role: $role) {
      id email displayName staffRole dateJoined
    }
  }
`

// ─── Productos ───────────────────────────────────────────────────────────────

const PRODUCTO_FIELDS = `
  id nombre descripcion precio unidad imagenUrl activo orden createdAt updatedAt
`

export const STAFF_CREAR_PRODUCTO_MUTATION = gql`
  mutation StaffCrearProducto(
    $tenantId: ID!
    $nombre: String!
    $descripcion: String
    $precio: Float
    $unidad: String
    $activo: Boolean
    $orden: Int
  ) {
    staffCrearProducto(
      tenantId: $tenantId
      nombre: $nombre
      descripcion: $descripcion
      precio: $precio
      unidad: $unidad
      activo: $activo
      orden: $orden
    ) { ${PRODUCTO_FIELDS} }
  }
`

export const STAFF_ACTUALIZAR_PRODUCTO_MUTATION = gql`
  mutation StaffActualizarProducto(
    $productoId: ID!
    $nombre: String
    $descripcion: String
    $precio: Float
    $unidad: String
    $activo: Boolean
    $orden: Int
  ) {
    staffActualizarProducto(
      productoId: $productoId
      nombre: $nombre
      descripcion: $descripcion
      precio: $precio
      unidad: $unidad
      activo: $activo
      orden: $orden
    ) { ${PRODUCTO_FIELDS} }
  }
`

export const STAFF_ELIMINAR_PRODUCTO_MUTATION = gql`
  mutation StaffEliminarProducto($productoId: ID!) {
    staffEliminarProducto(productoId: $productoId)
  }
`

// ─── Aprobación de marcas y modelos ──────────────────────────────────────────

const MARCA_FIELDS = `
  id nombre slug descripcion activa status motivoRechazo orden createdAt
  subcategoriaId subcategoriaNombre
`

const MODELO_FIELDS = `
  id nombre slug descripcion activo status motivoRechazo orden createdAt
  marcaId marcaNombre subcategoriaId subcategoriaNombre
`

export const STAFF_APROBAR_MARCA_MUTATION = gql`
  mutation StaffAprobarMarca($marcaId: ID!) {
    staffAprobarMarca(marcaId: $marcaId) { ${MARCA_FIELDS} }
  }
`

export const STAFF_RECHAZAR_MARCA_MUTATION = gql`
  mutation StaffRechazarMarca($marcaId: ID!, $motivo: String) {
    staffRechazarMarca(marcaId: $marcaId, motivo: $motivo) { ${MARCA_FIELDS} }
  }
`

export const STAFF_APROBAR_MODELO_MUTATION = gql`
  mutation StaffAprobarModelo($modeloId: ID!) {
    staffAprobarModelo(modeloId: $modeloId) { ${MODELO_FIELDS} }
  }
`

export const STAFF_RECHAZAR_MODELO_MUTATION = gql`
  mutation StaffRechazarModelo($modeloId: ID!, $motivo: String) {
    staffRechazarModelo(modeloId: $modeloId, motivo: $motivo) { ${MODELO_FIELDS} }
  }
`

export const STAFF_MARCAR_NOTIFICACION_LEIDA_MUTATION = gql`
  mutation StaffMarcarNotificacionLeida($notificacionId: ID!) {
    staffMarcarNotificacionLeida(notificacionId: $notificacionId) {
      id leida
    }
  }
`

export const STAFF_MARCAR_TODAS_LEIDAS_MUTATION = gql`
  mutation StaffMarcarTodasLeidas {
    staffMarcarTodasLeidas
  }
`

// ─── CRUD Marca/Modelo (staff directo) ───────────────────────────────────────

export const STAFF_CREAR_MARCA_MUTATION = gql`
  mutation StaffCrearMarca($subcategoriaId: ID!, $nombre: String!, $descripcion: String) {
    staffCrearMarca(subcategoriaId: $subcategoriaId, nombre: $nombre, descripcion: $descripcion) {
      ${MARCA_FIELDS}
    }
  }
`

export const STAFF_ACTUALIZAR_MARCA_MUTATION = gql`
  mutation StaffActualizarMarca(
    $marcaId: ID!
    $nombre: String
    $descripcion: String
    $status: String
    $orden: Int
  ) {
    staffActualizarMarca(
      marcaId: $marcaId
      nombre: $nombre
      descripcion: $descripcion
      status: $status
      orden: $orden
    ) { ${MARCA_FIELDS} }
  }
`

export const STAFF_ELIMINAR_MARCA_MUTATION = gql`
  mutation StaffEliminarMarca($marcaId: ID!) {
    staffEliminarMarca(marcaId: $marcaId)
  }
`

export const STAFF_CREAR_MODELO_MUTATION = gql`
  mutation StaffCrearModelo($marcaId: ID!, $nombre: String!, $descripcion: String) {
    staffCrearModelo(marcaId: $marcaId, nombre: $nombre, descripcion: $descripcion) {
      ${MODELO_FIELDS}
    }
  }
`

export const STAFF_ACTUALIZAR_MODELO_MUTATION = gql`
  mutation StaffActualizarModelo(
    $modeloId: ID!
    $nombre: String
    $descripcion: String
    $status: String
    $orden: Int
  ) {
    staffActualizarModelo(
      modeloId: $modeloId
      nombre: $nombre
      descripcion: $descripcion
      status: $status
      orden: $orden
    ) { ${MODELO_FIELDS} }
  }
`

export const STAFF_ELIMINAR_MODELO_MUTATION = gql`
  mutation StaffEliminarModelo($modeloId: ID!) {
    staffEliminarModelo(modeloId: $modeloId)
  }
`

// ─── EmpresaModelo management ─────────────────────────────────────────────────

export const STAFF_ACTUALIZAR_EMPRESA_MODELO_MUTATION = gql`
  mutation StaffActualizarEmpresaModelo($empresaModeloId: ID!, $existencia: Boolean!) {
    staffActualizarEmpresaModelo(empresaModeloId: $empresaModeloId, existencia: $existencia) {
      id existencia updatedAt
    }
  }
`

export const STAFF_ELIMINAR_EMPRESA_MODELO_MUTATION = gql`
  mutation StaffEliminarEmpresaModelo($empresaModeloId: ID!) {
    staffEliminarEmpresaModelo(empresaModeloId: $empresaModeloId)
  }
`
