import { gql } from '@apollo/client'

const ME_FIELDS = `
  id email displayName role
  tenantSlug tenantName tenantId tenantColor tenantModules
  empresaPlan empresaStatus
  planLimits {
    maxCategorias maxSubcategorias
    puedeVerLeads puedeSubirPortada
    maxFotosGaleria badgeVerificado soporte
  }
`

export const REGISTER_MUTATION = gql`
  mutation Register($email: String!, $displayName: String!, $nombreEmpresa: String!) {
    register(email: $email, displayName: $displayName, nombreEmpresa: $nombreEmpresa) {
      ${ME_FIELDS}
    }
  }
`

export const RECLAMAR_EMPRESA_MUTATION = gql`
  mutation ReclamarEmpresa($token: String!) {
    reclamarEmpresa(token: $token) {
      ${ME_FIELDS}
    }
  }
`

export const CREAR_EMPRESA_MUTATION = gql`
  mutation CrearEmpresaPerfil($nombreComercial: String!, $ciudad: String!, $estado: String!) {
    crearEmpresaPerfil(nombreComercial: $nombreComercial, ciudad: $ciudad, estado: $estado) {
      id nombreComercial slug plan status scoreCompletitud
    }
  }
`

export const ACTUALIZAR_EMPRESA_MUTATION = gql`
  mutation ActualizarEmpresaPerfil(
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
    $status: String
  ) {
    actualizarEmpresaPerfil(
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
      status: $status
    ) {
      id nombreComercial slug descripcion
      ciudad estado pais telefono emailContacto sitioWeb whatsapp
      plan status scoreCompletitud verified publishedAt
      logoUrl portadaUrl
      categoriaPrincipal { id nombre slug }
      categorias { id nombre slug }
      subcategorias { id nombre slug categoriaId categoriaNombre }
    }
  }
`

export const PUBLICAR_EMPRESA_MUTATION = gql`
  mutation PublicarEmpresa {
    publicarEmpresa { id status publishedAt scoreCompletitud }
  }
`

export const CAMBIAR_PLAN_MUTATION = gql`
  mutation CambiarPlan($plan: String!) {
    cambiarPlan(plan: $plan) {
      ${ME_FIELDS}
    }
  }
`

export const MARCAR_VISTA_MUTATION = gql`
  mutation MarcarVista($id: ID!) {
    marcarSolicitudVista(id: $id) { id status }
  }
`

export const ARCHIVAR_SOLICITUD_MUTATION = gql`
  mutation ArchivarSolicitud($id: ID!) {
    archivarSolicitud(id: $id) { id status }
  }
`

export const SOLICITAR_MARCA_MUTATION = gql`
  mutation SolicitarMarca($subcategoriaId: ID!, $nombre: String!, $descripcion: String) {
    solicitarMarca(subcategoriaId: $subcategoriaId, nombre: $nombre, descripcion: $descripcion) {
      id nombre slug status subcategoriaId subcategoriaNombre
    }
  }
`

export const SOLICITAR_MODELO_MUTATION = gql`
  mutation SolicitarModelo($subcategoriaId: ID!, $marcaId: ID, $nombre: String!, $descripcion: String, $confirmarDuplicado: Boolean) {
    solicitarModelo(subcategoriaId: $subcategoriaId, marcaId: $marcaId, nombre: $nombre, descripcion: $descripcion, confirmarDuplicado: $confirmarDuplicado) {
      modelo { id nombre slug status marcaId marcaNombre subcategoriaId subcategoriaNombre }
      similares { id nombre slug marcaId marcaNombre subcategoriaId subcategoriaNombre }
    }
  }
`

export const AGREGAR_EMPRESA_MODELO_MUTATION = gql`
  mutation AgregarEmpresaModelo($subcategoriaId: ID!, $marcaId: ID, $modeloId: ID, $existencia: Boolean) {
    agregarEmpresaModelo(subcategoriaId: $subcategoriaId, marcaId: $marcaId, modeloId: $modeloId, existencia: $existencia) {
      id existencia createdAt
      subcategoriaId subcategoriaNombre
      marcaId marcaNombre
      modeloId modeloNombre
    }
  }
`

export const ACTUALIZAR_EMPRESA_MODELO_MUTATION = gql`
  mutation ActualizarEmpresaModelo($empresaModeloId: ID!, $existencia: Boolean!) {
    actualizarEmpresaModelo(empresaModeloId: $empresaModeloId, existencia: $existencia) {
      id existencia updatedAt
    }
  }
`

export const ELIMINAR_EMPRESA_MODELO_MUTATION = gql`
  mutation EliminarEmpresaModelo($empresaModeloId: ID!) {
    eliminarEmpresaModelo(empresaModeloId: $empresaModeloId)
  }
`
