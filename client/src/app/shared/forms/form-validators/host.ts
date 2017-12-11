export function validateHost (value: string) {
  // Thanks to http://stackoverflow.com/a/106223
  const HOST_REGEXP = new RegExp(
    '^(([a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9\-]*[a-zA-Z0-9])\.)*([A-Za-z0-9]|[A-Za-z0-9][A-Za-z0-9\-]*[A-Za-z0-9])$'
  )

  return HOST_REGEXP.test(value)
}
