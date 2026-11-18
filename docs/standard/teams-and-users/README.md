---
audience: human, ai
folder: Teams & users
summary: Users, teams, roles, personas, access policies and bots.
---

# Teams & users

Users, teams, roles, personas, access policies and bots. This category of the [MonoRail standard](../README.md)
is OpenMetadata's own: every entity type keeps OpenMetadata's name, fields
and meanings, copied from OpenMetadata 2.1 (see the
[rules](../README.md#rules)). OpenMetadata documents it in its [API reference](https://docs.open-metadata.org/v2.1.x-SNAPSHOT/api-reference/teams-and-users).

## Entity types

<!-- standard:entities teamsAndUsers -->

| Entity | Type | What it is | Base path |
| --- | --- | --- | --- |
| [User](user.md) | `user` | A person who uses the catalog, in zero or more teams. | `/v1/users` |
| [Team](team.md) | `team` | A group of users and other teams that can own data assets. | `/v1/teams` |
| [Role](role.md) | `role` | A set of policies that grants access; given to users and teams. | `/v1/roles` |
| [Persona](persona.md) | `persona` | A job function such as Data Engineer, which shapes what a user sees. | `/v1/personas` |
| [Policy](policy.md) | `policy` | Access rules applied across data assets and other entities. | `/v1/policies` |
| [Bot](bot.md) | `bot` | An automation account, such as the ingestion bot, that acts with its own user. | `/v1/bots` |

<!-- /standard -->

## In MonoRail

MonoRail keeps none of these itself yet. The
[OpenMetadata page](../../guide/openmetadata.md) shows them from your own
OpenMetadata server, and [Explore](../../guide/explore.md) lists each type
with 0 until a source inside MonoRail has some.
