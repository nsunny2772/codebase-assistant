export const commonStrings = {
  APP_TITLE: "AI Codebase Assistant",
  COMMON: {
    UNAVAILABLE: "Unavailable",
    UNKNOWN: "Unknown",
    UNKNOWN_FILE: "Unknown file",
    REQUEST_FAILED: "Request failed.",
    REQUEST_TIMED_OUT: "Request timed out. Please try again.",
    SERVER_UNAVAILABLE: "Unable to reach the server. Please try again.",
    CANCELLED: "Cancelled",
    DISMISS: "Dismiss",
    HTTP_FAILURE: (status: number) => `Request failed (${status})`,
  },
  NAVIGATION: {
    WORKSPACE: "WORKSPACE",
    CLOSE: "Close",
    DASHBOARD: "Dashboard",
    MY_REPOSITORIES: "My Repos",
    BACK_TO_HOME: "Back to Home",
    PAGE_NOT_FOUND: "Page not found",
    REQUESTED_PAGE_UNAVAILABLE: "The requested page is unavailable.",
  },
  ERRORS: {
    INPUT_OUTSIDE_FORM: "Input must be inside Form.",
    DROPDOWN_OUTSIDE_FORM: "Dropdown with a name must be inside Form.",
  },
} as const;
