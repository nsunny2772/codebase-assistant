export const repositoryStrings = {
  INVALID_URL: "Enter a public GitHub repository URL.",
  INVALID_URL_FORMAT:
    "Use https://github.com/owner/repository without credentials or extra paths.",
  ONLY_PUBLIC: "Only public repositories are supported.",
  TOO_LARGE: "Repository is too large for this pilot.",
  NOT_FOUND: "Repository not found.",
  NO_LONGER_AVAILABLE: "Repository no longer available.",
  INDEXING_NOT_COMPLETED: "Repository indexing has not completed.",
  NO_SUPPORTED_FILES:
    "No supported JavaScript, TypeScript, or Markdown files were found.",
  CAPACITY:
    "Indexing would exceed the configured graph capacity. Delete older repositories or increase the database capacity.",
  DELETION_IN_PROGRESS: "Repository deletion is in progress.",
  EXCEEDS_ARCHIVE_BYTES: "Compressed repository exceeds the byte limit.",
  EXCEEDS_EXPANDED_BYTES: "Expanded repository exceeds the byte limit.",
  TOO_MANY_ARCHIVE_ENTRIES: "Too many archive entries.",
  UNSAFE_PATH: "Repository archive contains an unsafe path.",
  UNSUPPORTED_ENTRY: "Unsupported archive entry.",
  TOO_MANY_FILES: "Too many supported source files.",
  DUPLICATE_PATH: "Duplicate archive path.",
  FILE_TOO_LARGE: "File exceeds the byte limit.",
  ARCHIVE_FILE_LIMIT: "Too many archive entries.",
  GITHUB_NO_DATA: "GitHub returned no data.",
  GITHUB_METADATA_LIMIT: "GitHub metadata exceeded the response limit.",
  GITHUB_REQUEST_FAILED:
    "GitHub request failed. Retry the job when connectivity returns.",
  GITHUB_INVALID_REDIRECT: "GitHub returned an invalid redirect.",
  GITHUB_REDIRECT_DENIED: "GitHub redirect destination is not permitted.",
  GITHUB_REDIRECT_LIMIT: "Too many GitHub redirects.",
  GITHUB_READ_FAILED:
    "Public repository could not be read. Check the URL or GitHub rate limits.",
  GITHUB_COMMIT_FAILED: "Repository commit could not be resolved.",
  GITHUB_INVALID_COMMIT_RESPONSE: "Invalid commit response.",
  INVALID_COMMIT: "Invalid commit.",
  GITHUB_DOWNLOAD_FAILED: "Repository download failed.",
  SYMBOLIC_LINKS_SKIPPED: "Symbolic links were skipped.",
} as const;
