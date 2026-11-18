// An error we throw on purpose, carrying the HTTP status and a safe message for the client.
class AppError extends Error {
  constructor(statusCode, message, extra = {}) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.extra = extra;
  }
}
module.exports = AppError;
