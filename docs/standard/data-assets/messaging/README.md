---
audience: human, ai
folder: Messaging
summary: Messaging services such as Kafka, and their topics.
---

# Messaging

Messaging services such as Kafka, and their topics. This category of the [MonoRail standard](../../README.md)
is OpenMetadata's own: every entity type keeps OpenMetadata's name, fields
and meanings, copied from OpenMetadata 2.1 (see the
[rules](../../README.md#rules)). OpenMetadata documents it in its [API reference](https://docs.open-metadata.org/v2.1.x-SNAPSHOT/api-reference/data-assets/messaging-services).

## Entity types

<!-- standard:entities messaging -->

| Entity | Type | What it is | Base path |
| --- | --- | --- | --- |
| [Messaging Service](messaging-service.md) | `messagingService` | A service such as Kafka, Pulsar or Kinesis that carries event streams. | `/v1/services/messagingServices` |
| [Topic](topic.md) | `topic` | A feed or event stream in a messaging service that producers write to and consumers read. | `/v1/topics` |

<!-- /standard -->

## In MonoRail

MonoRail keeps none of these itself yet. The
[OpenMetadata page](../../../guide/openmetadata.md) shows them from your own
OpenMetadata server, and [Explore](../../../guide/explore.md) lists each type
with 0 until a source inside MonoRail has some.
