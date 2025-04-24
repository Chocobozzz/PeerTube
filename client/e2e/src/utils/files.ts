import { mkdir, rm } from 'fs/promises'
import { join } from 'path'

const SCREENSHOTS_DIRECTORY = 'screenshots'

export async function createScreenshotsDirectory () {
  await rm(SCREENSHOTS_DIRECTORY, { recursive: true, force: true })
  await mkdir(SCREENSHOTS_DIRECTORY, { recursive: true })
}

export function getScreenshotPath (filename: string) {
  return join(SCREENSHOTS_DIRECTORY, filename)
}
