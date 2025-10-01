export class APIError extends Error {
  constructor(message?: string) {
    super(message);
    this.name = 'APIError';
  }
}

export class AuthenticationError extends APIError {
  constructor(message?: string) {
    super(message);
    this.name = 'AuthenticationError';
  }
}