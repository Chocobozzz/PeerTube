import { FileStorage, UserExportState } from '@peertube/peertube-models'
import { getFileSize } from '@peertube/peertube-node-utils'
import { activityPubContextify } from '@server/helpers/activity-pub-utils.js'
import { saveInTransactionWithRetries } from '@server/helpers/database-utils.js'
import { logger, loggerTagsFactory } from '@server/helpers/logger.js'
import { UserModel } from '@server/models/user/user.js'
import { MUserDefault, MUserExport } from '@server/types/models/index.js'
import archiver, { Archiver } from 'archiver'
import { createWriteStream } from 'fs'
import { remove } from 'fs-extra/esm'
import { join, parse } from 'path'
import { PassThrough, Readable, Writable } from 'stream'
import { activityPubCollection } from '../activitypub/collection.js'
import { getContextFilter } from '../activitypub/context.js'
import { getUserExportFileObjectStorageSize, removeUserExportObjectStorage, storeUserExportFile } from '../object-storage/user-export.js'
import { getFSUserExportFilePath } from '../paths.js'
import {
  AbstractUserExporter,
  AccountExporter,
  AutoTagPoliciesExporter,
  BlocklistExporter,
  ChannelsExporter,
  CommentsExporter,
  DislikesExporter,
  ExportResult,
  FollowersExporter,
  FollowingExporter,
  LikesExporter,
  UserSettingsExporter,
  UserVideoHistoryExporter,
  VideoPlaylistsExporter,
  VideosExporter,
  WatchedWordsListsExporter
} from './exporters/index.js'

const lTags = loggerTagsFactory('user-export')

export class UserExporter {

  private archive: Archiver

  async export (exportModel: MUserExport) {
    try {
      exportModel.state = UserExportState.PROCESSING
      await saveInTransactionWithRetries(exportModel)

      const user = await UserModel.loadByIdFull(exportModel.userId)

      let endPromise: Promise<any>
      let output: Writable

      if (exportModel.storage === FileStorage.FILE_SYSTEM) {
        output = createWriteStream(getFSUserExportFilePath(exportModel))
        endPromise = new Promise<string>(res => output.on('close', () => res('')))
      } else {
        output = new PassThrough()
        endPromise = storeUserExportFile(output as PassThrough, exportModel)
      }

      await this.createZip({ exportModel, user, output })

      const fileUrl = await endPromise

      if (exportModel.storage === FileStorage.OBJECT_STORAGE) {
        exportModel.fileUrl = fileUrl
        exportModel.size = await getUserExportFileObjectStorageSize(exportModel)
      } else if (exportModel.storage === FileStorage.FILE_SYSTEM) {
        exportModel.size = await getFileSize(getFSUserExportFilePath(exportModel))
      }

      exportModel.state = UserExportState.COMPLETED

      await saveInTransactionWithRetries(exportModel)
    } catch (err) {
      logger.error('Cannot generate an export', { err, ...lTags() })

      try {
        exportModel.state = UserExportState.ERRORED
        exportModel.error = err.message

        await saveInTransactionWithRetries(exportModel)
      } catch (innerErr) {
        logger.error('Cannot set export error state', { err: innerErr, ...lTags() })
      }

      try {
        if (exportModel.storage === FileStorage.FILE_SYSTEM) {
          await remove(getFSUserExportFilePath(exportModel))
        } else {
          await removeUserExportObjectStorage(exportModel)
        }
      } catch (innerErr) {
        logger.error('Cannot remove archive path after failure', { err: innerErr, ...lTags() })
      }

      throw err
    }
  }

  private createZip (options: {
    exportModel: MUserExport
    user: MUserDefault
    output: Writable
  }) {
    const { output, exportModel, user } = options

    let activityPubOutboxStore: ExportResult<any>['activityPubOutbox'] = []

    this.archive = archiver('zip', {
      zlib: {
        level: 9
      }
    })

    return new Promise<void>(async (res, rej) => {
      this.archive.on('warning', err => {
        logger.warn('Warning to archive a file in ' + exportModel.filename, { err })
      })

      this.archive.on('error', err => {
        rej(err)
      })

      this.archive.pipe(output)

      try {
        for (const { exporter, jsonFilename } of this.buildExporters(exportModel, user)) {
          const { json, staticFiles, activityPub, activityPubOutbox } = await exporter.export()

          logger.debug('Adding JSON file ' + jsonFilename + ' in archive ' + exportModel.filename)
          this.appendJSON(json, join('peertube', jsonFilename))

          if (activityPub) {
            const activityPubFilename = exporter.getActivityPubFilename()
            if (!activityPubFilename) throw new Error('ActivityPub filename is required for exporter that export activity pub data')

            this.appendJSON(activityPub, join('activity-pub', activityPubFilename))
          }

          if (activityPubOutbox) {
            activityPubOutboxStore = activityPubOutboxStore.concat(activityPubOutbox)
          }

          for (const file of staticFiles) {
            const archivePath = join('files', parse(jsonFilename).name, file.archivePath)

            logger.debug(`Adding static file ${archivePath} in archive`)

            try {
              await this.addToArchiveAndWait(await file.createrReadStream(), archivePath)
            } catch (err) {
              logger.error(`Cannot add ${archivePath} in archive`, { err })
            }
          }
        }

        this.appendJSON(
          await activityPubContextify(activityPubCollection('outbox.json', activityPubOutboxStore), 'Video', getContextFilter()),
          join('activity-pub', 'outbox.json')
        )

        await this.archive.finalize()

        res()
      } catch (err) {
        this.archive.abort()

        rej(err)
      }
    })
  }

  private buildExporters (exportModel: MUserExport, user: MUserDefault) {
    const options = {
      user,
      activityPubFilenames: {
        dislikes: 'dislikes.json',
        likes: 'likes.json',
        outbox: 'outbox.json',
        following: 'following.json',
        account: 'actor.json'
      }
    }

    return [
      {
        jsonFilename: 'videos.json',

        exporter: new VideosExporter({
          ...options,

          relativeStaticDirPath: '../files/videos',
          withVideoFiles: exportModel.withVideoFiles
        })
      },
      {
        jsonFilename: 'channels.json',
        exporter: new ChannelsExporter({
          ...options,

          relativeStaticDirPath: '../files/channels'
        })
      },
      {
        jsonFilename: 'account.json',
        exporter: new AccountExporter({
          ...options,

          relativeStaticDirPath: '../files/account'
        })
      },
      {
        jsonFilename: 'blocklist.json',
        exporter: new BlocklistExporter(options)
      },
      {
        jsonFilename: 'likes.json',
        exporter: new LikesExporter(options)
      },
      {
        jsonFilename: 'dislikes.json',
        exporter: new DislikesExporter(options)
      },
      {
        jsonFilename: 'follower.json',
        exporter: new FollowersExporter(options)
      },
      {
        jsonFilename: 'following.json',
        exporter: new FollowingExporter(options)
      },
      {
        jsonFilename: 'user-settings.json',
        exporter: new UserSettingsExporter(options)
      },
      {
        jsonFilename: 'comments.json',
        exporter: new CommentsExporter(options)
      },
      {
        jsonFilename: 'video-playlists.json',
        exporter: new VideoPlaylistsExporter({
          ...options,

          relativeStaticDirPath: '../files/video-playlists'
        })
      },
      {
        jsonFilename: 'video-history.json',
        exporter: new UserVideoHistoryExporter(options)
      },
      {
        jsonFilename: 'watched-words-lists.json',
        exporter: new WatchedWordsListsExporter(options)
      },
      {
        jsonFilename: 'automatic-tag-policies.json',
        exporter: new AutoTagPoliciesExporter(options)
      }
    ] as { jsonFilename: string, exporter: AbstractUserExporter<any> }[]
  }

  private addToArchiveAndWait (stream: Readable, archivePath: string) {
    let errored = false

    return new Promise<void>((res, rej) => {
      const self = this

      function cleanup () {
        self.archive.off('entry', entryListener)
      }

      function entryListener ({ name }) {
        if (name !== archivePath) return

        cleanup()

        return res()
      }

      stream.once('error', err => {
        cleanup()

        errored = true
        return rej(err)
      })

      this.archive.on('entry', entryListener)

      // Prevent sending a stream that has an error on open resulting in a stucked archiving process
      stream.once('readable', () => {
        if (errored) return

        this.archive.append(stream, { name: archivePath })
      })
    })
  }

  private appendJSON (json: any, name: string) {
    this.archive.append(JSON.stringify(json, undefined, 2), { name })
  }
}
