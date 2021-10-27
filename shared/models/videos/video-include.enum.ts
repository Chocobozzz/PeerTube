export const enum VideoInclude {
  NONE = 0,
  NOT_PUBLISHED_STATE = 1 << 0,
  HIDDEN_PRIVACY = 1 << 1,
  BLACKLISTED = 1 << 2,
  BLOCKED_OWNER = 1 << 3
}
