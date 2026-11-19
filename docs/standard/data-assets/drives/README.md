---
audience: human, ai
folder: Drives
summary: Drive services such as Google Drive: directories, files, spreadsheets and worksheets.
---

# Drives

Drive services such as Google Drive: directories, files, spreadsheets and worksheets. This category of the [MonoRail standard](../../README.md)
is OpenMetadata's own: every entity type keeps OpenMetadata's name, fields
and meanings, copied from OpenMetadata 2.1 (see the
[rules](../../README.md#rules)).

## Entity types

<!-- standard:entities drives -->

| Entity | Type | What it is | Base path |
| --- | --- | --- | --- |
| [Drive Service](drive-service.md) | `driveService` | A service such as Google Drive or SharePoint that stores documents. | `/v1/services/driveServices` |
| [Directory](directory.md) | `directory` | A folder in a drive service that holds files, spreadsheets and other directories. | `/v1/drives/directories` |
| [File](file.md) | `file` | A document or other file stored in a drive service. | `/v1/drives/files` |
| [Spreadsheet](spreadsheet.md) | `spreadsheet` | A file of worksheets, such as a Google Sheets or Excel file. | `/v1/drives/spreadsheets` |
| [Worksheet](worksheet.md) | `worksheet` | One tab of a spreadsheet, with its columns. | `/v1/drives/worksheets` |

<!-- /standard -->

## In MonoRail

MonoRail keeps none of these itself yet. The
[OpenMetadata page](../../../guide/data/openmetadata.md) shows them from your own
OpenMetadata server, and [Explore](../../../guide/data/explore.md) lists each type
with 0 until a source inside MonoRail has some.
