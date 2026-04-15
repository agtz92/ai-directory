"""Authenticated GraphQL schema — mounted at /graphql/."""

import strawberry

from directorio.queries import DirectorioQuery
from directorio.mutations import DirectorioMutation
from users.mutations import UserQuery, UserMutation


@strawberry.type
class Query(DirectorioQuery, UserQuery):
    pass


@strawberry.type
class Mutation(DirectorioMutation, UserMutation):
    pass


schema = strawberry.Schema(query=Query, mutation=Mutation)
