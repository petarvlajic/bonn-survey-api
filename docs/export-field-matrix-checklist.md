# Export Field Matrix Checklist

This checklist tracks the "all relevant fields exportable/filterable" requirement for survey response CSV export.

## Scope

- Export format: CSV (`/api/responses/export/csv`)
- Includes: base response fields + dynamic `Q_<questionId>` columns
- Includes free-text values
- Excludes raw image binaries/base64 payloads

## Automated Coverage

- `test/responseExport.test.ts`
  - dynamic columns are created for all present question ids
  - all filtered patient rows are exported with complete field matrix
  - free-text CSV escaping is validated (quotes/newlines)
  - raw image payload is not leaked in CSV values
- `test/responses.integration.test.ts`
  - filtered export includes only matching patients
  - export supports `workflowStatus`, `pid`, and `search` filters

## Manual Verification Steps

1. Create at least 3 patients with different combinations of:
   - demographics (name/email/birthDate)
   - consent free-text fields
   - echo free-text and photo entries
   - different workflow statuses
2. Apply filters that return a subset (e.g. 3 out of N).
3. Export CSV from API/web.
4. Verify for exported subset:
   - one row per patient
   - key static columns present (`PID`, interviewee fields, status, timestamps)
   - all relevant dynamic `Q_...` columns present across selected patients
   - free-text content present and readable
   - no raw base64 image data appears

## Remaining Gap (non-automation)

- Device/UI-level acceptance sign-off for each real questionnaire field is still a UAT activity.
