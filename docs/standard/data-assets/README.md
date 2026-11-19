---
audience: human, ai
folder: Data assets
summary: What a data catalog describes, by kind of service: databases, messaging, dashboards, pipelines, ML models, storage, search, APIs, drives, metrics and AI assets.
---

# Data assets

The data assets of the [MonoRail standard](../README.md): everything a data
catalog describes, from a warehouse table to an AI model. They are
OpenMetadata's own entity types, grouped the way OpenMetadata's
[API reference](https://docs.open-metadata.org/v2.1.x-SNAPSHOT/api-reference/data-assets)
groups them: each kind of service, and the assets that live in it. Every
type's fields are copied from OpenMetadata 2.1 (see the
[rules](../README.md#rules)).

<!-- standard:categories data-assets -->

| Category | What it covers | Entity types |
| --- | --- | --- |
| [Databases](databases/README.md) | Database services, databases, schemas, tables, stored procedures and queries. | Database Service, Database, Database Schema, Table, Stored Procedure, Query |
| [Messaging](messaging/README.md) | Messaging services such as Kafka, and their topics. | Messaging Service, Topic |
| [Dashboards](dashboards/README.md) | Dashboard services, dashboards, charts, data models and reports. | Dashboard Service, Dashboard, Chart, Dashboard Data Model, Report |
| [Pipelines](pipelines/README.md) | Pipeline services such as Airflow, and their pipelines. | Pipeline Service, Pipeline |
| [ML models](ml-models/README.md) | Machine learning model services and models. | ML Model Service, ML Model |
| [Storage](storage/README.md) | Storage services such as S3, and their containers. | Storage Service, Container |
| [Search](search/README.md) | Search services such as OpenSearch, and their indexes. | Search Service, Search Index |
| [APIs](apis/README.md) | API services, collections and endpoints. | API Service, API Collection, API Endpoint |
| [Drives](drives/README.md) | Drive services such as Google Drive: directories, files, spreadsheets and worksheets. | Drive Service, Directory, File, Spreadsheet, Worksheet |
| [Metrics](metrics/README.md) | Business metrics and the groups that organize them. | Metric, Metric Group |
| [AI assets](ai/README.md) | LLM services and models, AI applications, MCP servers, prompt templates and AI governance. | LLM Service, LLM Model, AI Application, MCP Service, MCP Server, Prompt Template, AI Governance Framework, AI Framework Control, AI Governance Policy, Audit Report |

<!-- /standard -->

[Databases](databases/README.md) is the one MonoRail fills today, from your
[semantic project](../../semantic.md). The
[OpenMetadata page](../../guide/data/openmetadata.md) shows every kind from your
own OpenMetadata server.
