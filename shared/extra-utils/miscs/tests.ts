import { stat } from 'fs-extra'
import { basename, isAbsolute, join, resolve } from 'path'

const FIXTURE_URLS = {
  peertube_long: 'https://peertube2.cpy.re/videos/watch/122d093a-1ede-43bd-bd34-59d2931ffc5e',
  peertube_short: 'https://peertube2.cpy.re/w/3fbif9S3WmtTP8gGsC5HBd',

  youtube: 'https://www.youtube.com/watch?v=msX3jv1XdvM',

  /**
   * The video is used to check format-selection correctness wrt. HDR,
   * which brings its own set of oddities outside of a MediaSource.
   * FIXME: refactor once HDR is supported at playback
   *
   * The video needs to have the following format_ids:
   * (which you can check by using `youtube-dl <url> -F`):
   * - 303 (1080p webm vp9)
   * - 299 (1080p mp4 avc1)
   * - 335 (1080p webm vp9.2 HDR)
   *
   * 15 jan. 2021: TEST VIDEO NOT CURRENTLY PROVIDING
   * - 400 (1080p mp4 av01)
   * - 315 (2160p webm vp9 HDR)
   * - 337 (2160p webm vp9.2 HDR)
   * - 401 (2160p mp4 av01 HDR)
   */
  youtubeHDR: 'https://www.youtube.com/watch?v=qR5vOXbZsI4',

  // eslint-disable-next-line max-len
  magnet: 'magnet:?xs=https%3A%2F%2Fpeertube2.cpy.re%2Fstatic%2Ftorrents%2Fb209ca00-c8bb-4b2b-b421-1ede169f3dbc-720.torrent&xt=urn:btih:0f498834733e8057ed5c6f2ee2b4efd8d84a76ee&dn=super+peertube2+video&tr=wss%3A%2F%2Fpeertube2.cpy.re%3A443%2Ftracker%2Fsocket&tr=https%3A%2F%2Fpeertube2.cpy.re%2Ftracker%2Fannounce&ws=https%3A%2F%2Fpeertube2.cpy.re%2Fstatic%2Fwebseed%2Fb209ca00-c8bb-4b2b-b421-1ede169f3dbc-720.mp4',

  badVideo: 'https://download.cpy.re/peertube/bad_video.mp4',
  goodVideo: 'https://download.cpy.re/peertube/good_video.mp4',
  goodVideo720: 'https://download.cpy.re/peertube/good_video_720.mp4',

  file4K: 'https://download.cpy.re/peertube/4k_file.txt'
}

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
  FIXTURE_URLS,

  parallelTests,
  isGithubCI,
  areHttpImportTestsDisabled,
  buildAbsoluteFixturePath,
  getFileSize,
  buildRequestStub,
  areObjectStorageTestsDisabled,
  wait,
  root
}
