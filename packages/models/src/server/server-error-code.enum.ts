export const ServerErrorCode = {
  /**
   * The simplest form of payload too large: when the file size is over the
   * global file size limit
   */
  MAX_FILE_SIZE_REACHED: 'max_file_size_reached',

  /**
   * The payload is too large for the user quota set
   */
  QUOTA_REACHED: 'quota_reached',

  /**
   * Error yielded upon trying to access a video that is not federated, nor can
   * be. This may be due to:  remote videos on instances that are not followed by
   * yours, and with your instance disallowing unknown instances being accessed.
   */
  DOES_NOT_RESPECT_FOLLOW_CONSTRAINTS: 'does_not_respect_follow_constraints',

  LIVE_NOT_ENABLED: 'live_not_enabled',
  LIVE_NOT_ALLOWING_REPLAY: 'live_not_allowing_replay',
  LIVE_CONFLICTING_PERMANENT_AND_SAVE_REPLAY: 'live_conflicting_permanent_and_save_replay',
  /**
   * Pretty self-explanatory:  the set maximum number of simultaneous lives was
   * reached, and this error is typically there to inform the user trying to
   * broadcast one.
   */
  MAX_INSTANCE_LIVES_LIMIT_REACHED: 'max_instance_lives_limit_reached',
  /**
   * Pretty self-explanatory:  the set maximum number of simultaneous lives FOR
   * THIS USER was reached, and this error is typically there to inform the user
   * trying to broadcast one.
   */
  MAX_USER_LIVES_LIMIT_REACHED: 'max_user_lives_limit_reached',

  /**
   * A torrent should have at most one correct video file. Any more and we will
   * not be able to choose automatically.
   */
  INCORRECT_FILES_IN_TORRENT: 'incorrect_files_in_torrent',

  COMMENT_NOT_ASSOCIATED_TO_VIDEO: 'comment_not_associated_to_video',

  MISSING_TWO_FACTOR: 'missing_two_factor',
  INVALID_TWO_FACTOR: 'invalid_two_factor',

  ACCOUNT_WAITING_FOR_APPROVAL: 'account_waiting_for_approval',
  ACCOUNT_APPROVAL_REJECTED: 'account_approval_rejected',

  RUNNER_JOB_NOT_IN_PROCESSING_STATE: 'runner_job_not_in_processing_state',
  RUNNER_JOB_NOT_IN_PENDING_STATE: 'runner_job_not_in_pending_state',
  UNKNOWN_RUNNER_TOKEN: 'unknown_runner_token',

  VIDEO_REQUIRES_PASSWORD: 'video_requires_password',
  INCORRECT_VIDEO_PASSWORD: 'incorrect_video_password',

  VIDEO_ALREADY_BEING_TRANSCODED: 'video_already_being_transcoded',
  VIDEO_ALREADY_BEING_TRANSCRIBED: 'video_already_being_transcribed',
  VIDEO_ALREADY_HAS_CAPTIONS: 'video_already_has_captions',

  MAX_USER_VIDEO_QUOTA_EXCEEDED_FOR_USER_EXPORT: 'max_user_video_quota_exceeded_for_user_export',

  CURRENT_PASSWORD_IS_INVALID: 'current_password_is_invalid'
} as const

/**
 * oauthjs/oauth2-server error codes
 * @see https://datatracker.ietf.org/doc/html/rfc6749#section-5.2
 **/
export const OAuth2ErrorCode = {
  /**
   * The provided authorization grant (e.g., authorization code, resource owner
   * credentials) or refresh token is invalid, expired, revoked, does not match
   * the redirection URI used in the authorization request, or was issued to
   * another client.
   *
   * @see https://github.com/oauthjs/node-oauth2-server/blob/master/lib/errors/invalid-grant-error.js
   */
  INVALID_GRANT: 'invalid_grant',

  /**
   * Client authentication failed (e.g., unknown client, no client authentication
   * included, or unsupported authentication method).
   *
   * @see https://github.com/oauthjs/node-oauth2-server/blob/master/lib/errors/invalid-client-error.js
   */
  INVALID_CLIENT: 'invalid_client',

  /**
   * The access token provided is expired, revoked, malformed, or invalid for other reasons
   *
   * @see https://github.com/oauthjs/node-oauth2-server/blob/master/lib/errors/invalid-token-error.js
   */
  INVALID_TOKEN: 'invalid_token'
} as const

export type OAuth2ErrorCodeType = typeof OAuth2ErrorCode[keyof typeof OAuth2ErrorCode]
export type ServerErrorCodeType = typeof ServerErrorCode[keyof typeof ServerErrorCode]
