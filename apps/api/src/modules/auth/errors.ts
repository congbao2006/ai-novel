export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}

export class AuthValidationError extends AuthError {
  constructor(message: string) {
    super(message);
    this.name = "AuthValidationError";
  }
}

export class AuthConflictError extends AuthError {
  constructor(message = "A user with this email already exists.") {
    super(message);
    this.name = "AuthConflictError";
  }
}

export class InvalidCredentialsError extends AuthError {
  constructor() {
    super("Invalid email or password.");
    this.name = "InvalidCredentialsError";
  }
}

export class UnauthenticatedError extends AuthError {
  constructor() {
    super("Authentication is required.");
    this.name = "UnauthenticatedError";
  }
}

export class AuthUnavailableError extends AuthError {
  constructor() {
    super("Authentication service is unavailable.");
    this.name = "AuthUnavailableError";
  }
}
