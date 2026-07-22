import { HttpStatusCode, ServerErrorCode } from '@peertube/peertube-models'

export class MissingTwoFactorError extends Error {
  code = HttpStatusCode.UNAUTHORIZED_401
  name = ServerErrorCode.MISSING_TWO_FACTOR
}

export class TooLongPasswordError extends Error {
  code = HttpStatusCode.BAD_REQUEST_400
  name = ServerErrorCode.TOO_LONG_PASSWORD
}

export class AccountBlockedError extends Error {
  code = HttpStatusCode.BAD_REQUEST_400
  name = ServerErrorCode.ACCOUNT_BLOCKED
}

export class EmailNotVerifiedError extends Error {
  code = HttpStatusCode.BAD_REQUEST_400
  name = ServerErrorCode.EMAIL_NOT_VERIFIED
}

export class InvalidTwoFactorError extends Error {
  code = HttpStatusCode.BAD_REQUEST_400
  name = ServerErrorCode.INVALID_TWO_FACTOR
}

export class RegistrationWaitingForApproval extends Error {
  code = HttpStatusCode.BAD_REQUEST_400
  name = ServerErrorCode.ACCOUNT_WAITING_FOR_APPROVAL
}

export class RegistrationApprovalRejected extends Error {
  code = HttpStatusCode.BAD_REQUEST_400
  name = ServerErrorCode.ACCOUNT_APPROVAL_REJECTED
}
