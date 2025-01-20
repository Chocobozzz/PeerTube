export function parallelTests () {
  return process.env.MOCHA_PARALLEL === 'true'
}

export function isGithubCI () {
  return !!process.env.GITHUB_WORKSPACE
}

export function areHttpImportTestsDisabled () {
  const disabled = process.env.DISABLE_HTTP_IMPORT_TESTS === 'true'

  if (disabled) console.log('DISABLE_HTTP_IMPORT_TESTS env set to "true" so import tests are disabled')

  return disabled
}

export function areYoutubeImportTestsDisabled () {
  const disabled = process.env.DISABLE_HTTP_YOUTUBE_IMPORT_TESTS === 'true'

  if (disabled) console.log('DISABLE_HTTP_YOUTUBE_IMPORT_TESTS env set to "true" so youtube import tests are disabled')

  return disabled
}

export function areMockObjectStorageTestsDisabled () {
  const disabled = process.env.ENABLE_OBJECT_STORAGE_TESTS !== 'true'

  if (disabled) console.log('ENABLE_OBJECT_STORAGE_TESTS env is not set to "true" so object storage tests are disabled')

  return disabled
}

export function areScalewayObjectStorageTestsDisabled () {
  if (areMockObjectStorageTestsDisabled()) return true

  const enabled = process.env.OBJECT_STORAGE_SCALEWAY_KEY_ID && process.env.OBJECT_STORAGE_SCALEWAY_ACCESS_KEY
  if (!enabled) {
    console.log(
      'OBJECT_STORAGE_SCALEWAY_KEY_ID and/or OBJECT_STORAGE_SCALEWAY_ACCESS_KEY are not set, so scaleway object storage tests are disabled'
    )

    return true
  }

  return false
}

export function isTestInstance () {
  return process.env.NODE_ENV === 'test'
}

export function isDevInstance () {
  return process.env.NODE_ENV === 'dev'
}

export function isTestOrDevInstance () {
  return isTestInstance() || isDevInstance()
}

export function isProdInstance () {
  return process.env.NODE_ENV === 'production'
}

export function getAppNumber () {
  return process.env.NODE_APP_INSTANCE || ''
}
