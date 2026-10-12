# Changelog

## [Render all JSON Resume sections] - {PR_MERGE_DATE}
- Resumes now show the Projects, Volunteer, Awards, Certificates, Publications, Interests and References sections when present
- The website (`basics.url`) and education score (`education[].score`) from the JSON Resume schema are now displayed
- Added "Copy as Markdown" and "Copy JSON" actions to the resume view
- The "Convert Text to JSON Resume" AI tool now uses your default AI model, and its confirmation shows the output file path or that the clipboard will be replaced

## [Initial Version] - 2025-11-11
- Initial public release
- Added JSON Resume parsing and validation utilities
- Included UI components to open and search resumes (`open-resume.tsx`, `search-resumes.tsx`)
- Utilities: `src/utils/storage.ts`, `src/utils/validateResume.ts`
