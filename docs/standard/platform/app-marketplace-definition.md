---
audience: human, ai
summary: An application offered in the marketplace, before it is installed. OpenMetadata's App Marketplace Definition entity.
---

# App Marketplace Definition

An application offered in the marketplace, before it is installed. It is OpenMetadata's
[App Marketplace Definition](https://github.com/open-metadata/OpenMetadata/blob/2.1.0-rc2-release/openmetadata-spec/src/main/resources/json/schema/entity/applications/marketplace/appMarketPlaceDefinition.json) entity, adopted as it is (see the
[rules](../README.md#rules)), in [Platform](README.md).

- **Type:** `appMarketPlaceDefinition`
- **Required:** `id`, `name`, `className`, `appType`, `scheduleType`, `permission`
- **API:** `/v1/apps/marketplace`

## In MonoRail

MonoRail keeps none itself yet. The
[OpenMetadata page](../../guide/data/openmetadata.md) lists them from your own
OpenMetadata server, and
[Explore](../../guide/data/explore.md) lists the type with 0.

## Fields

<!-- standard:fields appMarketPlaceDefinition -->

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | `uuid` | Yes | Unique identifier of this application. |
| `name` | `entityName` | Yes | Name of the Application. |
| `displayName` | `string` |  | Display Name for the application. |
| `description` | `markdown` |  | Description of the Application. |
| `features` | `markdown` |  | Features of the Application. |
| `fullyQualifiedName` | `fullyQualifiedEntityName` |  | FullyQualifiedName same as `name`. |
| `owners` | `entityReferenceList` |  | Owners of this workflow. |
| `version` | `entityVersion` |  | Metadata version of the entity. |
| `updatedAt` | `timestamp` |  | Last update time corresponding to the new version of the entity in Unix epoch time milliseconds. |
| `updatedBy` | `string` |  | User who made the update. |
| `impersonatedBy` | `impersonatedBy` |  | Bot user that performed the action on behalf of the actual user. |
| `href` | `href` |  | Link to the resource corresponding to this entity. |
| `changeDescription` | `changeDescription` |  | Change that lead to this version of the entity. |
| `incrementalChangeDescription` | `changeDescription` |  | Change that lead to this version of the entity. |
| `deleted` | `boolean` |  | When `true` indicates the entity has been soft deleted. |
| `tags` | `tagLabel[]` |  | Tags associated with the entity. |
| `developer` | `string` |  | Developer For the Application. |
| `developerUrl` | `string` |  | Url for the developer |
| `privacyPolicyUrl` | `string` |  | Privacy Policy for the developer |
| `supportEmail` | `string` |  | Support Email for the application |
| `className` | `string` | Yes | Full Qualified ClassName for the the application. |
| `sourcePythonClass` | `string` |  | Fully Qualified class name for the Python source that will execute the external application. |
| `appType` | `appType` | Yes | This schema defines the type of application. |
| `agentType` | `agentType` |  | This schema defines the type of the agent. |
| `scheduleType` | `scheduleType` | Yes | This schema defines the Schedule Type of Application. |
| `permission` | `permissions` | Yes | Permission used by Native Applications. |
| `runtime` | `executionContext` |  | If app type is live, user can provide additional runtime context. |
| `allowConfiguration` | `boolean` |  | Allow users to configure the app from the UI. |
| `allowConcurrentExecution` | `boolean` |  | If true, multiple instances of this app can run concurrently. |
| `appConfiguration` | `appConfig` |  | Application Configuration object. |
| `appLogoUrl` | `string` |  | Application Logo Url. |
| `appScreenshots` | `string[]` |  | Application Screenshots. |
| `system` | `boolean` |  | A system app cannot be uninstalled or modified. |
| `enabled` | `boolean` |  | Flag to enable/disable the application. |
| `domains` | `entityReferenceList` |  | Domains the asset belongs to. |
| `supportsInterrupt` | `boolean` |  | If the app run can be interrupted as part of the execution. |
| `supportsIngestionRunner` | `boolean` |  | If the app support execution through the external runner. |
| `allowBotImpersonation` | `boolean` |  | When true, the bot created for this application will have allowImpersonation enabled, allowing it to act on behalf of users. |

<!-- /standard -->
