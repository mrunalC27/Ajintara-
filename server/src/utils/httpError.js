// Throw this from anywhere to send a clear error to the user.
// Example: throw new HttpError(404, 'Property not found')
export class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}
