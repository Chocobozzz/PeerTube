function parallelTests () {
  return process.env.MOCHA_PARALLEL === 'true'
}

function isGithubCI () {
  return !!process.env.GITHUB_WORKSPACE
}

function areHttpImportTestsDisabled () {
  const disabled = process.env.DISABLE_HTTP_IMPORT_TESTS === 'true'

  if (disabled) console.log('DISABLE_HTTP_IMPORT_TESTS env set to "true" so import tests are disabled')

  return disabled
}

function areMockObjectStorageTestsDisabled () {
  const disabled = process.env.ENABLE_OBJECT_STORAGE_TESTS !== 'true'

  if (disabled) console.log('ENABLE_OBJECT_STORAGE_TESTS env is not set to "true" so object storage tests are disabled')

  return disabled
}

function areScalewayObjectStorageTestsDisabled () {
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

export {
  parallelTests,
  isGithubCI,
  areHttpImportTestsDisabled,
  areMockObjectStorageTestsDisabled,
  areScalewayObjectStorageTestsDisabled
}
