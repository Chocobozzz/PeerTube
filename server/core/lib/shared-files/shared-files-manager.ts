import { createLogger } from '@server/helpers/logger.js'
import { registerConfigChangedHandler } from '@server/initializers/config.js'
import { isSecondaryProcess } from '@server/initializers/process-role.js'
import {
  getNotSharedStorageDirectories,
  getStorageDirectorySettingName,
  SHAREABLE_STORAGE_DIRECTORIES,
  ShareableStorageDirectory
} from '@server/initializers/storage-ownership.js'
import { Redis } from '../redis/index.js'
import { SharedFilesChange } from '../redis/shared-files.js'
import {
  computeSharedFilesSectionStatus,
  sharedFilesSections,
  SharedFilesSectionStatus,
  SharedFilesSectionType,
  sharedFilesSectionTypes
} from './sections.js'

const logger = createLogger('shared-files')

// Wait for other changes (storage moves...) before checking again
const CHECK_DELAY_MS = 1000

// While this process cannot manage files, check again and log the problems periodically
const CHECK_INTERVAL_WITH_PROBLEMS_MS = 60000

/**
 * Secondary processes manage files (avatars, thumbnails, captions, video files...), so they must reach the files of the primary process
 *
 * For each kind of file, either:
 *  - the secondary is on the same host as the primary, and adopted its storage directories at boot
 *  - or every local file is in object storage, and new ones will be stored there too
 *
 * The files stored on the file system are detected in database
 *
 * A secondary on another host refuses to start if it cannot reach them.
 * Then it checks again when files are moved by the primary or when the configuration changes, and logs errors until the problems are fixed
 */
export class SharedFilesManager {
  private static instance: SharedFilesManager

  // Secondary process only, when it does not share the storage directories of the primary
  private problems: string[] = []
  private checkTimeout: NodeJS.Timeout
  private problemsInterval: NodeJS.Timeout

  private constructor () {}

  async init () {
    if (!isSecondaryProcess()) return

    return this.initSecondary()
  }

  // Primary process: files have been moved from a storage to another
  notifyFilesMoved (change: Extract<SharedFilesChange, 'moved-to-object-storage' | 'moved-to-file-system'>) {
    Redis.Instance.publishSharedFilesChanged(change)
      .catch(err => logger.error('Cannot notify secondary processes that files have been moved.', { err }))
  }

  async getSectionsStatus () {
    const sections = {} as { [id in SharedFilesSectionType]: SharedFilesSectionStatus }

    for (const type of sharedFilesSectionTypes) {
      sections[type] = await computeSharedFilesSectionStatus(type)
    }

    return sections
  }

  // ---------------------------------------------------------------------------
  // Secondary
  // ---------------------------------------------------------------------------

  private async initSecondary () {
    // Adopted every shareable storage directory of the primary at boot: every file is reachable, nothing to check
    if (getNotSharedStorageDirectories(SHAREABLE_STORAGE_DIRECTORIES).length === 0) {
      logger.info('This secondary process shares the storage directories of the primary process.')

      return
    }

    this.problems = await this.findProblems()

    if (this.problems.length !== 0) {
      throw new Error(
        'This secondary process cannot reach the files of the primary process (avatars, thumbnails, video files...):\n' +
          this.problems.join('\n')
      )
    }

    await Redis.Instance.subscribeToSharedFilesChanges(change => {
      // Only check the changes that can update the result
      if (change === 'moved-to-object-storage' && this.problems.length === 0) return
      if (change === 'moved-to-file-system' && this.problems.length !== 0) return

      this.scheduleCheck()
    })

    // User exports can be enabled at runtime
    registerConfigChangedHandler(() => this.scheduleCheck())
  }

  private scheduleCheck () {
    if (this.checkTimeout) return

    this.checkTimeout = setTimeout(() => {
      this.checkTimeout = undefined

      this.check()
        .catch(err => logger.error('Cannot check whether this process can reach the files of the primary process.', { err }))
    }, CHECK_DELAY_MS)
  }

  private async check () {
    const hadProblems = this.problems.length !== 0

    this.problems = await this.findProblems()

    if (this.problems.length === 0) {
      if (hadProblems) logger.info('This secondary process can reach the files of the primary process again.')

      clearInterval(this.problemsInterval)
      this.problemsInterval = undefined

      return
    }

    logger.error(
      'This secondary process cannot reach the files of the primary process anymore: the endpoints writing files may fail ' +
        'or write them in the wrong place. Fix these problems or stop this process:\n' + this.problems.join('\n')
    )

    if (!this.problemsInterval) {
      this.problemsInterval = setInterval(() => this.scheduleCheck(), CHECK_INTERVAL_WITH_PROBLEMS_MS)
    }
  }

  // For each kind of file whose storage directories are not all shared with the primary, every local file must be in object storage
  private async findProblems () {
    const problems: string[] = []

    for (const type of sharedFilesSectionTypes) {
      const notShared = getNotSharedStorageDirectories(sharedFilesSections[type].shareableStorageDirectories)
      // Every storage directory this kind of file needs is shared with the primary: its files are reachable, nothing to check
      if (notShared.length === 0) continue

      const sectionStatus = await computeSharedFilesSectionStatus(type)
      if (sectionStatus.inObjectStorage) continue

      problems.push(buildSectionProblem(type, sectionStatus, notShared))
    }

    return problems
  }

  static get Instance () {
    return this.instance || (this.instance = new this())
  }
}

// ---------------------------------------------------------------------------
// Private
// ---------------------------------------------------------------------------

function buildSectionProblem (
  type: SharedFilesSectionType,
  sectionStatus: SharedFilesSectionStatus,
  notShared: ShareableStorageDirectory[]
) {
  const { label } = sharedFilesSections[type]

  const settingNames = notShared.map(getStorageDirectorySettingName).join(', ')

  return ` - ${label}: ${sectionStatus.reasons.join(', ')}; and ${settingNames} is not shared with the primary process`
}
