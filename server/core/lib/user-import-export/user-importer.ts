import { MUserDefault, MUserImport } from '@server/types/models/index.js'
import { logger, loggerTagsFactory } from '@server/helpers/logger.js'
import { UserImportResultSummary, UserImportState } from '@peertube/peertube-models'
import { saveInTransactionWithRetries } from '@server/helpers/database-utils.js'
import { getFSUserImportFilePath } from '../paths.js'
import { remove } from 'fs-extra/esm'
import { unzip } from '@server/helpers/unzip.js'
import { getFilenameWithoutExt } from '@peertube/peertube-node-utils'
import { VideosImporter } from './importers/videos-importer.js'
import { UserModel } from '@server/models/user/user.js'
import { dirname, join } from 'path'
import { AccountImporter } from './importers/account-importer.js'
import { UserSettingsImporter } from './importers/user-settings-importer.js'
import { ChannelsImporter } from './importers/channels-importer.js'
import { BlocklistImporter } from './importers/account-blocklist-importer.js'
import { FollowingImporter } from './importers/following-importer.js'
import { LikesImporter } from './importers/likes-importer.js'
import { DislikesImporter } from './importers/dislikes-importer.js'
import { VideoPlaylistsImporter } from './importers/video-playlists-importer.js'
import { UserVideoHistoryImporter } from './importers/user-video-history-importer.js'

const lTags = loggerTagsFactory('user-import')

export class UserImporter {
  private extractedDirectory: string

  async import (importModel: MUserImport) {
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
        userVideoHistory: this.buildSummary()
      }
    }

    try {
      importModel.state = UserImportState.PROCESSING
      await saveInTransactionWithRetries(importModel)

      const inputZip = getFSUserImportFilePath(importModel)
      this.extractedDirectory = join(dirname(inputZip), getFilenameWithoutExt(inputZip))

      await unzip(inputZip, this.extractedDirectory)

      const user = await UserModel.loadByIdFull(importModel.userId)

      for (const { name, importer } of this.buildImporters(user)) {
        try {
          const { duplicates, errors, success } = await importer.import()

          resultSummary.stats[name].duplicates += duplicates
          resultSummary.stats[name].errors += errors
          resultSummary.stats[name].success += success
        } catch (err) {
          logger.error(`Cannot import ${importer.getJSONFilePath()} from ${inputZip}`, { err, ...lTags() })

          resultSummary.stats[name].errors++
        }
      }

      importModel.state = UserImportState.COMPLETED
      importModel.resultSummary = resultSummary
      await saveInTransactionWithRetries(importModel)
    } catch (err) {
      logger.error('Cannot import user archive', { toto: 'coucou', err, ...lTags() })

      try {
        importModel.state = UserImportState.ERRORED
        importModel.error = err.message

        await saveInTransactionWithRetries(importModel)
      } catch (innerErr) {
        logger.error('Cannot set import error state', { err: innerErr, ...lTags() })
      }

      throw err
    } finally {
      try {
        await remove(getFSUserImportFilePath(importModel))
        await remove(this.extractedDirectory)
      } catch (innerErr) {
        logger.error('Cannot remove import archive and directory after failure', { err: innerErr, ...lTags() })
      }
    }
  }

  private buildImporters (user: MUserDefault) {
    // Keep consistency in import order (don't import videos before channels for example)
    return [
      {
        name: 'account' as 'account',
        importer: new AccountImporter(this.buildImporterOptions(user, 'account.json'))
      },
      {
        name: 'userSettings' as 'userSettings',
        importer: new UserSettingsImporter(this.buildImporterOptions(user, 'user-settings.json'))
      },
      {
        name: 'channels' as 'channels',
        importer: new ChannelsImporter(this.buildImporterOptions(user, 'channels.json'))
      },
      {
        name: 'blocklist' as 'blocklist',
        importer: new BlocklistImporter(this.buildImporterOptions(user, 'blocklist.json'))
      },
      {
        name: 'following' as 'following',
        importer: new FollowingImporter(this.buildImporterOptions(user, 'following.json'))
      },
      {
        name: 'videos' as 'videos',
        importer: new VideosImporter(this.buildImporterOptions(user, 'videos.json'))
      },
      {
        name: 'likes' as 'likes',
        importer: new LikesImporter(this.buildImporterOptions(user, 'likes.json'))
      },
      {
        name: 'dislikes' as 'dislikes',
        importer: new DislikesImporter(this.buildImporterOptions(user, 'dislikes.json'))
      },
      {
        name: 'videoPlaylists' as 'videoPlaylists',
        importer: new VideoPlaylistsImporter(this.buildImporterOptions(user, 'video-playlists.json'))
      },
      {
        name: 'userVideoHistory' as 'userVideoHistory',
        importer: new UserVideoHistoryImporter(this.buildImporterOptions(user, 'video-history.json'))
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
