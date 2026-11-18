---
audience: human, ai
folder: Platform
summary: How OpenMetadata itself runs: ingestion pipelines, apps, alerts, types and more.
---

# Platform

How OpenMetadata itself runs: ingestion pipelines, apps, alerts, types and more. This category of the [MonoRail standard](../README.md)
is OpenMetadata's own: every entity type keeps OpenMetadata's name, fields
and meanings, copied from OpenMetadata 2.1 (see the
[rules](../README.md#rules)).

## Entity types

<!-- standard:entities platform -->

| Entity | Type | What it is | Base path |
| --- | --- | --- | --- |
| [Ingestion Pipeline](ingestion-pipeline.md) | `ingestionPipeline` | A scheduled job that reads metadata, usage, lineage or quality results from a service. | `/v1/services/ingestionPipelines` |
| [Workflow](workflow.md) | `workflow` | An automation run by the server, such as testing a service connection. | `/v1/automations/workflows` |
| [Application](application.md) | `app` | An installed OpenMetadata application, such as search indexing or data insights. | `/v1/apps` |
| [App Marketplace Definition](app-marketplace-definition.md) | `appMarketPlaceDefinition` | An application offered in the marketplace, before it is installed. | `/v1/apps/marketplace` |
| [Event Subscription](event-subscription.md) | `eventsubscription` | An alert: which changes trigger it, its filters and where it sends notifications. | `/v1/events/subscriptions` |
| [Notification Template](notification-template.md) | `notificationTemplate` | How notifications about one entity type are worded. | `/v1/notificationTemplates` |
| [Type](type.md) | `type` | A property or entity type; custom properties are defined on these. | `/v1/metadata/types` |
| [Test Connection Definition](test-connection-definition.md) | `testConnectionDefinition` | The steps for testing a connection to one kind of service. | `/v1/services/testConnectionDefinitions` |
| [Document](document.md) | `document` | A generic stored JSON document, used for things like email templates. | `/v1/docStore` |
| [Metadata Service](metadata-service.md) | `metadataService` | Another metadata catalog, such as Amundsen or Atlas, read as a source. | `/v1/services/metadataServices` |
| [Security Service](security-service.md) | `securityService` | A security service such as Apache Ranger. | `/v1/services/securityServices` |

<!-- /standard -->

## In MonoRail

MonoRail keeps none of these itself yet. The
[OpenMetadata page](../../guide/openmetadata.md) shows them from your own
OpenMetadata server, and [Explore](../../guide/explore.md) lists each type
with 0 until a source inside MonoRail has some.
