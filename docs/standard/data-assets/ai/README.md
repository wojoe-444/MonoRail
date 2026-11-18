---
audience: human, ai
folder: AI assets
summary: LLM services and models, AI applications, MCP servers, prompt templates and AI governance.
---

# AI assets

LLM services and models, AI applications, MCP servers, prompt templates and AI governance. This category of the [MonoRail standard](../../README.md)
is OpenMetadata's own: every entity type keeps OpenMetadata's name, fields
and meanings, copied from OpenMetadata 2.1 (see the
[rules](../../README.md#rules)).

## Entity types

<!-- standard:entities ai -->

| Entity | Type | What it is | Base path |
| --- | --- | --- | --- |
| [LLM Service](llm-service.md) | `llmService` | A provider of large language models, such as Anthropic, OpenAI or AWS Bedrock. | `/v1/services/llmServices` |
| [LLM Model](llm-model.md) | `llmModel` | A registered large language model: a base model, deployment or fine-tune. | `/v1/llmModels` |
| [AI Application](ai-application.md) | `aiApplication` | A running AI system such as a chatbot, agent or copilot, with the models and tools it uses. | `/v1/aiApplications` |
| [MCP Service](mcp-service.md) | `mcpService` | A service that finds and manages MCP (Model Context Protocol) servers. | `/v1/services/mcpServices` |
| [MCP Server](mcp-server.md) | `mcpServer` | An MCP server deployment and the tools, resources and prompts it offers. | `/v1/mcpServers` |
| [Prompt Template](prompt-template.md) | `promptTemplate` | A reusable prompt for AI agents, with variables, a system prompt and examples. | `/v1/promptTemplates` |
| [AI Governance Framework](ai-governance-framework.md) | `aiGovernanceFramework` | A library of controls, such as the EU AI Act, that drives compliance assessments. | `/v1/aiGovernanceFrameworks` |
| [AI Framework Control](ai-framework-control.md) | `aiFrameworkControl` | One control within an AI governance framework. | `/v1/aiFrameworkControls` |
| [AI Governance Policy](ai-governance-policy.md) | `aiGovernancePolicy` | An organizational rule for AI and LLM usage, compliance and risk. | `/v1/aiGovernancePolicies` |
| [Audit Report](audit-report.md) | `auditReport` | A generated evidence pack for a framework, domain or AI asset. | `/v1/auditReports` |

<!-- /standard -->

## In MonoRail

MonoRail keeps none of these itself yet. The
[OpenMetadata page](../../../guide/openmetadata.md) shows them from your own
OpenMetadata server, and [Explore](../../../guide/explore.md) lists each type
with 0 until a source inside MonoRail has some.
