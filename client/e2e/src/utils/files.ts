import { mkdirSync, rmSync } from 'fs'
import { join } from 'path'

const SCREENSHOTS_DIRECTORY = 'screenshots'

export function createScreenshotsDirectory () {
  rmSync(SCREENSHOTS_DIRECTORY, { recursive: true, force: true })
  mkdirSync(SCREENSHOTS_DIRECTORY, { recursive: true })
}

export function getScreenshotPath (filename: string) {
  return join(SCREENSHOTS_DIRECTORY, filename)
}
