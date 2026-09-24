import { UserImportResultSummary, UserImportState } from '@peertube/peertube-models'
import { getFilenameWithoutExt, getFileSize, parseBytes } from '@peertube/peertube-node-utils'
import { saveInTransactionWithRetries } from '@server/helpers/database-utils.js'
import { createLogger } from '@server/helpers/logger.js'
import { unzip } from '@server/helpers/unzip.js'
import { CONFIG } from '@server/initializers/config.js'
import { UserModel } from '@server/models/user/user.js'
import { MUserDefault, MUserImport } from '@server/types/models/index.js'
import { pathExists, remove } from 'fs-extra/esm'
import { dirname, join } from 'path'
import { downloadStagingObject, removeStagingObject } from '../object-storage/staging.js'
import { getFSUserImportFilePath } from '../paths.js'
import { BlocklistImporter } from './importers/account-blocklist-importer.js'
import { AccountImporter } from './importers/account-importer.js'
import { ChannelsImporter } from './importers/channels-importer.js'
import { DislikesImporter } from './importers/dislikes-importer.js'
import { FollowingImporter } from './importers/following-importer.js'
import { LikesImporter } from './importers/likes-importer.js'
import { ReviewCommentsTagPoliciesImporter } from './importers/review-comments-tag-policies-importer.js'
import { UserSettingsImporter } from './importers/user-settings-importer.js'
import { UserVideoHistoryImporter } from './importers/user-video-history-importer.js'
import { VideoPlaylistsImporter } from './importers/video-playlists-importer.js'
import { VideosImporter } from './importers/videos-importer.js'
import { WatchedWordsListsImporter } from './importers/watched-words-lists-importer.js'

const logger = createLogger('user-import')

export class UserImporter {
  private inputZip: string
  private extractedDirectory: string

  async import (importModel: MUserImport, options: {
    stagingKey?: string // The archive is in object storage staging
  } = {}) {
    const { stagingKey } = options

    const resultSummary: UserImportResultSummary = {
      stats: {
        blocklist: this.buildSummary(),
        channels: this.buildSummary(),
        likes: this.buildSummary(),
        dislikes: this.buildSummary(),
        following: this.buildSummary(),
        videoPlaylists: this.buildSummary(),
        videos: this.buildSummary(),
        account: this.buildSummary(),
        userSettings: this.buildSummary(),
        userVideoHistory: this.buildSummary(),
        watchedWordsLists: this.buildSummary(),
        commentAutoTagPolicies: this.buildSummary()
      }
    }

    // Set before anything can fail, so the archive is always removed
    this.inputZip = stagingKey
      ? join(CONFIG.STORAGE.TMP_DIR, importModel.filename)
      : getFSUserImportFilePath(importModel)

    try {
      importModel.state = UserImportState.PROCESSING
      await saveInTransactionWithRetries(importModel)

      const inputZip = this.inputZip

      this.extractedDirectory = join(dirname(inputZip), getFilenameWithoutExt(inputZip))

      if (stagingKey) {
        await downloadStagingObject({ key: stagingKey, destination: inputZip })
      } else if (!await pathExists(inputZip)) {
        throw new Error(
          `Archive ${inputZip} of user import ${importModel.id} does not exist on this host. ` +
            'It was probably uploaded before object storage staging was enabled, and is processed by a secondary process of another host.'
        )
      }

      await unzip({
        source: inputZip,
        destination: this.extractedDirectory,
        // Videos that take a lot of space don't have a good compression ratio
        // Keep a minimum of 1GB if the archive doesn't contain video files
        maxSize: Math.max(await getFileSize(inputZip) * 2, parseBytes('1GB')),
        maxFiles: 10000
      })

      const user = await UserModel.loadByIdFull(importModel.userId)

      await logger.withContext([ user.username ], async () => {
        for (const { name, importer } of this.buildImporters(user)) {
          try {
            const { duplicates, errors, success } = await importer.import()

            resultSummary.stats[name].duplicates += duplicates
            resultSummary.stats[name].errors += errors
            resultSummary.stats[name].success += success
          } catch (err) {
            logger.error(`Cannot import ${importer.getJSONFilePath()} from ${inputZip}`, { err })

            resultSummary.stats[name].errors++
          }
        }

        importModel.state = UserImportState.COMPLETED
        importModel.resultSummary = resultSummary
        await saveInTransactionWithRetries(importModel)
      })
    } catch (err) {
      logger.error('Cannot import user archive', { err })

      try {
        importModel.state = UserImportState.ERRORED
        importModel.error = err.message

        await saveInTransactionWithRetries(importModel)
      } catch (innerErr) {
        logger.error('Cannot set import error state', { err: innerErr })
      }

      throw err
    } finally {
      await this.safeRemove(this.inputZip, () => remove(this.inputZip))

      if (this.extractedDirectory) await this.safeRemove(this.extractedDirectory, () => remove(this.extractedDirectory))
      if (stagingKey) await this.safeRemove(stagingKey, () => removeStagingObject(stagingKey))
    }
  }

  // A failed removal must not prevent the other ones
  private async safeRemove (name: string, remover: () => Promise<any>) {
    try {
      await remover()
    } catch (err) {
      logger.error(`Cannot remove ${name} after the user import`, { err })
    }
  }

  private buildImporters (user: MUserDefault) {
    // Keep consistency in import order (don't import videos before channels for example)
    return [
      {
        name: 'account' as const,
        importer: new AccountImporter(this.buildImporterOptions(user, 'account.json'))
      },
      {
        name: 'userSettings' as const,
        importer: new UserSettingsImporter(this.buildImporterOptions(user, 'user-settings.json'))
      },
      {
        name: 'channels' as const,
        importer: new ChannelsImporter(this.buildImporterOptions(user, 'channels.json'))
      },
      {
        name: 'blocklist' as const,
        importer: new BlocklistImporter(this.buildImporterOptions(user, 'blocklist.json'))
      },
      {
        name: 'following' as const,
        importer: new FollowingImporter(this.buildImporterOptions(user, 'following.json'))
      },
      {
        name: 'videos' as const,
        importer: new VideosImporter(this.buildImporterOptions(user, 'videos.json'))
      },
      {
        name: 'likes' as const,
        importer: new LikesImporter(this.buildImporterOptions(user, 'likes.json'))
      },
      {
        name: 'dislikes' as const,
        importer: new DislikesImporter(this.buildImporterOptions(user, 'dislikes.json'))
      },
      {
        name: 'videoPlaylists' as const,
        importer: new VideoPlaylistsImporter(this.buildImporterOptions(user, 'video-playlists.json'))
      },
      {
        name: 'userVideoHistory' as const,
        importer: new UserVideoHistoryImporter(this.buildImporterOptions(user, 'video-history.json'))
      },
      {
        name: 'watchedWordsLists' as const,
        importer: new WatchedWordsListsImporter(this.buildImporterOptions(user, 'watched-words-lists.json'))
      },
      {
        name: 'commentAutoTagPolicies' as const,
        importer: new ReviewCommentsTagPoliciesImporter(this.buildImporterOptions(user, 'automatic-tag-policies.json'))
      }
    ]
  }

  private buildImporterOptions (user: MUserDefault, jsonFilename: string) {
    return {
      extractedDirectory: this.extractedDirectory,
      user,
      jsonFilePath: join(this.extractedDirectory, 'peertube', jsonFilename)
    }
  }

  private buildSummary () {
    return { success: 0, duplicates: 0, errors: 0 }
  }
}
