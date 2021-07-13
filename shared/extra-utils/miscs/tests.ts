import { stat } from 'fs-extra'
import { basename, isAbsolute, join, resolve } from 'path'

function parallelTests () {
  return process.env.MOCHA_PARALLEL === 'true'
}

function isGithubCI () {
  return !!process.env.GITHUB_WORKSPACE
}

function areHttpImportTestsDisabled () {
  const disabled = process.env.DISABLE_HTTP_IMPORT_TESTS === 'true'

  if (disabled) console.log('Import tests are disabled')

  return disabled
}

function buildAbsoluteFixturePath (path: string, customCIPath = false) {
  if (isAbsolute(path)) return path

  if (customCIPath && process.env.GITHUB_WORKSPACE) {
    return join(process.env.GITHUB_WORKSPACE, 'fixtures', path)
  }

  return join(root(), 'server', 'tests', 'fixtures', path)
}

function root () {
  // We are in /miscs
  let root = join(__dirname, '..', '..', '..')

  if (basename(root) === 'dist') root = resolve(root, '..')

  return root
}

function wait (milliseconds: number) {
  return new Promise(resolve => setTimeout(resolve, milliseconds))
}

async function getFileSize (path: string) {
  const stats = await stat(path)

  return stats.size
}

function buildRequestStub (): any {
  return { }
}

export {
  parallelTests,
  isGithubCI,
  areHttpImportTestsDisabled,
  buildAbsoluteFixturePath,
  getFileSize,
  buildRequestStub,
  wait,
  root
}
