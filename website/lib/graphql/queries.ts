export const SUBCATEGORIAS_SEARCH_QUERY = `
  query SubcategoriasSearch($search: String!, $limit: Int) {
    subcategorias(search: $search, limit: $limit) {
      id nombre slug categoriaId categoriaNombre
    }
  }
`

export const DIRECTORIO_SEARCH_QUERY = `
  query DirectorioSearch($search: String!, $limit: Int) {
    directorio(search: $search, limit: $limit) {
      empresas { id nombreComercial slug ciudad estado }
    }
  }
`

export const BLOG_POSTS_QUERY = `
  query BlogPosts($limit: Int, $offset: Int) {
    blogPosts(limit: $limit, offset: $offset) {
      total hasMore
      posts { id titulo slug extracto imagenPortada autorNombre publishedAt }
    }
  }
`

export const BLOG_POST_QUERY = `
  query BlogPost($slug: String!) {
    blogPost(slug: $slug) {
      id titulo slug extracto contenido imagenPortada autorNombre publishedAt
    }
  }
`

export const FORO_POSTS_QUERY = `
  query ForoPosts($subcategoriaSlug: String, $limit: Int, $offset: Int) {
    foroPosts(subcategoriaSlug: $subcategoriaSlug, limit: $limit, offset: $offset) {
      total hasMore
      posts {
        id titulo autorNombre empresaNombre empresaSlug
        subcategorias { id nombre slug }
        subcategoriaNombre subcategoriaSlug
        respuestasCount createdAt
      }
    }
  }
`

export const FORO_POST_QUERY = `
  query ForoPost($id: Int!) {
    foroPost(id: $id) {
      id titulo contenido autorNombre empresaNombre empresaSlug
      subcategorias { id nombre slug }
      subcategoriaNombre subcategoriaSlug createdAt
      respuestas {
        id contenido autorNombre empresaNombre empresaSlug createdAt
      }
    }
  }
`

export const CREAR_FORO_POST_MUTATION = `
  mutation CrearForoPost(
    $subcategoriaSlugs: [String!]!
    $titulo: String!
    $contenido: String!
    $autorNombre: String!
    $autorEmail: String
  ) {
    crearForoPost(
      subcategoriaSlugs: $subcategoriaSlugs
      titulo: $titulo
      contenido: $contenido
      autorNombre: $autorNombre
      autorEmail: $autorEmail
    ) {
      id titulo subcategoriaSlug
    }
  }
`

export const CREAR_FORO_RESPUESTA_MUTATION = `
  mutation CrearForoRespuesta(
    $postId: Int!
    $contenido: String!
    $autorNombre: String!
    $autorEmail: String
  ) {
    crearForoRespuesta(
      postId: $postId
      contenido: $contenido
      autorNombre: $autorNombre
      autorEmail: $autorEmail
    ) {
      id contenido autorNombre createdAt
    }
  }
`
