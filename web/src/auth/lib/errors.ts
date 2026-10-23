/**
 * Not a failure: the account exists but the user must click the link we emailed before a session is issued.
 * Sign-up shows a friendly "check your inbox" page for this instead of an error.
 */
export class ConfirmationRequiredError extends Error {
  readonly email: string;
  constructor(email: string) {
    super("Please confirm your email address to finish creating your account.");
    this.name = "ConfirmationRequiredError";
    this.email = email;
  }
}
