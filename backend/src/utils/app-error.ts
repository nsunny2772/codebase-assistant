export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode = 400,
    public retryable = false,
  ) {
    super(message);
  }
}
