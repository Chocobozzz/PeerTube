import { removeVTTExt } from '@peertube/peertube-core-utils'
import { FileStorage, type FileStorageType, VideoCaption, VideoCaptionObject } from '@peertube/peertube-models'
import { buildUUID } from '@peertube/peertube-node-utils'
import { generateCaptionObjectStorageKey, generateHLSObjectStorageKey } from '@server/lib/object-storage/keys.js'
import { buildObjectStoragePublicFileUrl } from '@server/lib/object-storage/urls.js'
import { removeCaptionObjectStorage, removeHLSFileObjectStorageByFilename } from '@server/lib/object-storage/videos.js'
import { VideoPathManager } from '@server/lib/video-path-manager.js'
import {
  MVideo,
  MVideoCaption,
  MVideoCaptionFilename,
  MVideoCaptionFormattable,
  MVideoCaptionLanguageUrl,
  MVideoCaptionUrl,
  MVideoCaptionVideo,
  MVideoOwned,
  MVideoPrivacy
} from '@server/types/models/index.js'
import { remove } from 'fs-extra/esm'
import { join } from 'path'
import { Op, OrderItem, Transaction } from 'sequelize'
import {
  AllowNull,
  BeforeDestroy,
  BelongsTo,
  Column,
  CreatedAt,
  DataType,
  Default,
  ForeignKey,
  Is,
  Scopes,
  Table,
  UpdatedAt
} from 'sequelize-typescript'
import { isVideoCaptionLanguageValid } from '../../helpers/custom-validators/video-captions.js'
import { logger } from '../../helpers/logger.js'
import { CONFIG } from '../../initializers/config.js'
import { CONSTRAINTS_FIELDS, FILES_CACHE, LAZY_STATIC_PATHS, VIDEO_LANGUAGES, WEBSERVER } from '../../initializers/constants.js'
import { SequelizeModel, buildWhereIdOrUUID, doesExist, throwIfNotValid } from '../shared/index.js'
import { VideoStreamingPlaylistModel } from './video-streaming-playlist.js'
import { VideoModel } from './video.js'

export enum ScopeNames {
  CAPTION_WITH_VIDEO = 'CAPTION_WITH_VIDEO'
}

const videoAttributes = [ 'id', 'name', 'remote', 'uuid', 'url', 'state', 'privacy' ]

@Scopes(() => ({
  [ScopeNames.CAPTION_WITH_VIDEO]: {
    include: [
      {
        attributes: videoAttributes,
        model: VideoModel.unscoped(),
        required: true
      }
    ]
  }
}))
@Table({
  tableName: 'videoCaption',
  indexes: [
    {
      fields: [ 'filename' ],
      unique: true
    },
    {
      fields: [ 'videoId' ]
    },
    {
      fields: [ 'videoId', 'language' ],
      unique: true
    }
  ]
})
export class VideoCaptionModel extends SequelizeModel<VideoCaptionModel> {
  @CreatedAt
  declare createdAt: Date

  @UpdatedAt
  declare updatedAt: Date

  @AllowNull(false)
  @Is('VideoCaptionLanguage', value => throwIfNotValid(value, isVideoCaptionLanguageValid, 'language'))
  @Column
  declare language: string

  @AllowNull(false)
  @Column
  declare filename: string

  @AllowNull(true)
  @Column
  declare m3u8Filename: string

  @AllowNull(false)
  @Default(FileStorage.FILE_SYSTEM)
  @Column
  declare storage: FileStorageType

  @AllowNull(true)
  @Column(DataType.STRING(CONSTRAINTS_FIELDS.COMMONS.URL.max))
  declare fileUrl: string

  @AllowNull(true)
  @Column
  declare m3u8Url: string

  @AllowNull(false)
  @Column
  declare automaticallyGenerated: boolean

  @AllowNull(false)
  @Column
  declare cached: boolean

  @ForeignKey(() => VideoModel)
  @Column
  declare videoId: number

  @BelongsTo(() => VideoModel, {
    foreignKey: {
      allowNull: false
    },
    onDelete: 'CASCADE'
  })
  declare Video: Awaited<VideoModel>

  @BeforeDestroy
  static async removeFiles (instance: VideoCaptionModel, options) {
    if (!instance.Video) {
      instance.Video = await instance.$get('Video', { transaction: options.transaction })
    }

    instance.removeAllCaptionFiles()
      .catch(err => logger.error('Cannot remove caption file ' + instance.filename, { err }))

    return undefined
  }

  static async insertOrReplaceLanguage (caption: MVideoCaption, transaction: Transaction) {
    const existing = await VideoCaptionModel.loadByVideoIdAndLanguage(caption.videoId, caption.language, transaction)

    // Delete existing file
    if (existing) await existing.destroy({ transaction })

    return caption.save({ transaction })
  }

  static async doesOwnedFileExist (filename: string, storage: FileStorageType) {
    const query = 'SELECT 1 FROM "videoCaption" ' +
      `WHERE "filename" = $filename AND "storage" = $storage LIMIT 1`

    return doesExist({ sequelize: this.sequelize, query, bind: { filename, storage } })
  }

  // ---------------------------------------------------------------------------

  static loadWithVideo (captionId: number, transaction?: Transaction): Promise<MVideoCaptionVideo> {
    const query = {
      where: { id: captionId },
      include: [
        {
          model: VideoModel.unscoped(),
          attributes: videoAttributes
        }
      ],
      transaction
    }

    return VideoCaptionModel.findOne(query)
  }

  static loadByVideoIdAndLanguage (videoId: string | number, language: string, transaction?: Transaction): Promise<MVideoCaptionVideo> {
    const videoInclude = {
      model: VideoModel.unscoped(),
      attributes: videoAttributes,
      where: buildWhereIdOrUUID(videoId)
    }

    const query = {
      where: { language },
      include: [ videoInclude ],
      transaction
    }

    return VideoCaptionModel.findOne(query)
  }

  static loadByFilename (filename: string): Promise<MVideoCaption> {
    const query = {
      where: {
        filename
      }
    }

    return VideoCaptionModel.findOne(query)
  }

  // ---------------------------------------------------------------------------

  static async hasVideoCaption (videoId: number) {
    const query = {
      where: {
        videoId
      }
    }

    const result = await VideoCaptionModel.unscoped().findOne(query)

    return !!result
  }

  static listVideoCaptions (videoId: number, transaction?: Transaction): Promise<MVideoCaptionVideo[]> {
    const query = {
      order: [ [ 'language', 'ASC' ] ] as OrderItem[],
      where: {
        videoId
      },
      transaction
    }

    return VideoCaptionModel.scope(ScopeNames.CAPTION_WITH_VIDEO).findAll(query)
  }

  static async listCaptionsOfMultipleVideos (videoIds: number[], transaction?: Transaction) {
    const query = {
      order: [ [ 'language', 'ASC' ] ] as OrderItem[],
      where: {
        videoId: {
          [Op.in]: videoIds
        }
      },
      transaction
    }

    const captions = await VideoCaptionModel.scope(ScopeNames.CAPTION_WITH_VIDEO).findAll<MVideoCaptionVideo>(query)
    const result: { [id: number]: MVideoCaptionVideo[] } = {}

    for (const id of videoIds) {
      result[id] = []
    }

    for (const caption of captions) {
      result[caption.videoId].push(caption)
    }

    return result
  }

  static listRemoteCached () {
    return this.findAll<MVideoCaption>({
      where: {
        cached: true,
        fileUrl: {
          [Op.ne]: null
        }
      }
    })
  }

  // ---------------------------------------------------------------------------

  static getLanguageLabel (language: string) {
    return VIDEO_LANGUAGES[language] || 'Unknown'
  }

  static generateCaptionName (language: string) {
    return `${buildUUID()}-${language}.vtt`
  }

  static generateM3U8Filename (vttFilename: string) {
    return removeVTTExt(vttFilename) + '.m3u8'
  }

  // ---------------------------------------------------------------------------

  toFormattedJSON (this: MVideoCaptionFormattable): VideoCaption {
    return {
      language: {
        id: this.language,
        label: VideoCaptionModel.getLanguageLabel(this.language)
      },
      automaticallyGenerated: this.automaticallyGenerated,

      // TODO: remove, deprecated in 8.0
      captionPath: this.isLocal() && this.fileUrl
        ? null // On object storage
        : this.getFileStaticPath(),

      fileUrl: this.getLocalFileUrl(),
      m3u8Url: this.getM3U8Url(this.Video),

      updatedAt: this.updatedAt.toISOString()
    }
  }

  toActivityPubObject (this: MVideoCaptionLanguageUrl, video: MVideo): VideoCaptionObject {
    return {
      identifier: this.language,
      name: VideoCaptionModel.getLanguageLabel(this.language),
      automaticallyGenerated: this.automaticallyGenerated,

      url: [
        {
          type: 'Link',
          mediaType: 'text/vtt',
          href: this.getLocalFileUrl()
        },
        {
          type: 'Link',
          mediaType: 'application/x-mpegURL',
          href: this.getM3U8Url(video)
        }
      ]
    }
  }

  // ---------------------------------------------------------------------------

  isLocal () {
    return !this.fileUrl
  }

  // ---------------------------------------------------------------------------

  getFileStaticPath (this: MVideoCaptionFilename) {
    return join(LAZY_STATIC_PATHS.VIDEO_CAPTIONS, this.filename)
  }

  getM3U8StaticPath (this: MVideoCaptionFilename, video: MVideoPrivacy) {
    if (!this.m3u8Filename) return null

    return VideoStreamingPlaylistModel.getPlaylistFileStaticPath(video, this.m3u8Filename)
  }

  // ---------------------------------------------------------------------------

  getFSFilePath () {
    return join(CONFIG.STORAGE.CAPTIONS_DIR, this.filename)
  }

  getFSFileCachedPath () {
    return join(FILES_CACHE.VIDEO_CAPTIONS.DIRECTORY, this.filename)
  }

  getFSM3U8Path (video: MVideoPrivacy) {
    if (!this.m3u8Filename) return null

    return VideoPathManager.Instance.getFSHLSOutputPath(video, this.m3u8Filename)
  }

  async removeAllCaptionFiles (this: MVideoCaptionVideo) {
    logger.info('Removing caption files of video ' + this.Video.uuid)

    await this.removeCaptionFile()
    await this.removeCaptionPlaylist()
  }

  async removeCaptionFile (this: MVideoCaption) {
    if (this.cached) {
      await remove(this.getFSFileCachedPath())
    } else if (this.storage === FileStorage.OBJECT_STORAGE) {
      await removeCaptionObjectStorage(this)
    } else {
      await remove(this.getFSFilePath())
    }
  }

  async removeCaptionPlaylist (this: MVideoCaptionVideo) {
    if (!this.m3u8Filename) return

    const hls = await VideoStreamingPlaylistModel.loadHLSByVideoWithVideo(this.videoId)
    if (!hls) return

    // M3U8 is proxified by our our instance, not cached

    if (this.storage === FileStorage.OBJECT_STORAGE) {
      await removeHLSFileObjectStorageByFilename(hls.Video, this.m3u8Filename)
    } else {
      await remove(this.getFSM3U8Path(this.Video))
    }

    this.m3u8Filename = null
  }

  // ---------------------------------------------------------------------------

  getLocalFileUrl (this: MVideoCaptionUrl) {
    if (this.isLocal() && this.storage === FileStorage.OBJECT_STORAGE) {
      return buildObjectStoragePublicFileUrl({
        bucket: CONFIG.OBJECT_STORAGE.CAPTIONS,
        key: generateCaptionObjectStorageKey(this.filename)
      })
    }

    // Captions are cached by our instance
    return WEBSERVER.URL + this.getFileStaticPath()
  }

  // ---------------------------------------------------------------------------

  getM3U8Url (this: MVideoCaptionUrl, video: MVideoOwned & MVideoPrivacy) {
    if (!this.m3u8Filename) return null
    if (!this.isLocal()) return this.m3u8Url

    if (this.storage === FileStorage.OBJECT_STORAGE) {
      return buildObjectStoragePublicFileUrl({
        bucket: CONFIG.OBJECT_STORAGE.STREAMING_PLAYLISTS, // M3U8 caption file is in the streaming playlists bucket
        key: generateHLSObjectStorageKey(video, this.m3u8Filename)
      })
    }

    return WEBSERVER.URL + this.getM3U8StaticPath(video)
  }

  // ---------------------------------------------------------------------------

  isEqual (this: MVideoCaption, other: MVideoCaption) {
    if (this.fileUrl) return this.fileUrl === other.fileUrl

    return this.filename === other.filename
  }
}
