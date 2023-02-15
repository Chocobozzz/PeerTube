import { mkdirSync } from 'fs'
import { join } from 'path'

const SCREENSHOTS_DIRECTORY = 'screenshots'

function createScreenshotsDirectory () {
  mkdirSync(SCREENSHOTS_DIRECTORY, { recursive: true })
}

function getScreenshotPath (filename: string) {
  return join(SCREENSHOTS_DIRECTORY, filename)
}

export {
  createScreenshotsDirectory,
  getScreenshotPath
}
