export class HttpError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export const errors = {
  unauthorized: () => new HttpError(401, "UNAUTHORIZED", "Please sign in to continue."),
  forbidden: () => new HttpError(403, "FORBIDDEN", "You do not have access to this resource."),
  notFound: (entity = "Resource") => new HttpError(404, "NOT_FOUND", `${entity} was not found.`),
  conflict: (message: string) => new HttpError(409, "CONFLICT", message),
  badRequest: (message: string) => new HttpError(400, "BAD_REQUEST", message),
  invalidCredentials: () => new HttpError(401, "INVALID_CREDENTIALS", "Email or password is incorrect."),
};
