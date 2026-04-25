export class ApiAuthError extends Error {
  status: number;
  reason: string;

  constructor(message: string, status: number, reason: string) {
    super(message);
    this.name = "ApiAuthError";
    this.status = status;
    this.reason = reason;
  }
}
