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

function areObjectStorageTestsDisabled () {
  const disabled = process.env.ENABLE_OBJECT_STORAGE_TESTS !== 'true'

  if (disabled) console.log('ENABLE_OBJECT_STORAGE_TESTS env is not set to "true" so object storage tests are disabled')

  return disabled
}

export {
  parallelTests,
  isGithubCI,
  areHttpImportTestsDisabled,
  areObjectStorageTestsDisabled
}
