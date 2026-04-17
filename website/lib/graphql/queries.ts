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
