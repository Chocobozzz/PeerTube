import { generateSwarmId } from '@peertube/peertube-core-utils'
import {
  FileStorage,
  VideoResolution,
  VideoStreamingPlaylistType,
  VideoStreamingPlaylistTypeString,
  type FileStorageType,
  type VideoStreamingPlaylistType_Type
} from '@peertube/peertube-models'
import { generateP2PMediaLoaderHash } from '@peertube/peertube-node-utils'
import { logger } from '@server/helpers/logger.js'
import { CONFIG } from '@server/initializers/config.js'
import { sequelizeTypescript } from '@server/initializers/database.js'
import {
  buildObjectStorageHLSPrivateFileUrl,
  buildObjectStoragePublicFileUrl,
  generateHLSObjectStorageKey
} from '@server/lib/object-storage/index.js'
import { generateHLSMasterPlaylistFilename, generateHlsSha256SegmentsFilename } from '@server/lib/paths.js'
import { isVideoInPrivateDirectory } from '@server/lib/video-privacy.js'
import { VideoFileModel } from '@server/models/video/video-file.js'
import {
  MStreamingPlaylist,
  MStreamingPlaylistFiles,
  MStreamingPlaylistFilesVideo,
  MStreamingPlaylistVideo,
  MVideo,
  MVideoPrivacy,
  MVideoUUID
} from '@server/types/models/index.js'
import { join } from 'path'
import { Op, Transaction } from 'sequelize'
import { AllowNull, BelongsTo, Column, CreatedAt, DataType, Default, ForeignKey, HasMany, Table, UpdatedAt } from 'sequelize-typescript'
import { CONSTRAINTS_FIELDS, P2P_MEDIA_LOADER_PEER_VERSION, STATIC_PATHS, WEBSERVER } from '../../initializers/constants.js'
import { VideoRedundancyModel } from '../redundancy/video-redundancy.js'
import { SequelizeModel, doesExist } from '../shared/index.js'
import { VideoInfohashModel } from './video-infohash.js'
import { VideoModel } from './video.js'

@Table({
  tableName: 'videoStreamingPlaylist',
  indexes: [
    {
      fields: [ 'videoId' ]
    },
    {
      fields: [ 'videoId', 'type' ],
      unique: true
    }
  ]
})
export class VideoStreamingPlaylistModel extends SequelizeModel<VideoStreamingPlaylistModel> {
  @CreatedAt
  declare createdAt: Date

  @UpdatedAt
  declare updatedAt: Date

  @AllowNull(false)
  @Column
  declare type: VideoStreamingPlaylistType_Type

  @AllowNull(false)
  @Column
  declare playlistFilename: string

  @AllowNull(true)
  @Column(DataType.STRING(CONSTRAINTS_FIELDS.VIDEOS.URL.max))
  declare playlistUrl: string

  @AllowNull(false)
  @Column
  declare p2pMediaLoaderPeerVersion: number

  @AllowNull(true)
  @Column
  declare segmentsSha256Filename: string

  @AllowNull(true)
  @Column
  declare segmentsSha256Url: string

  @ForeignKey(() => VideoModel)
  @Column
  declare videoId: number

  @AllowNull(false)
  @Default(FileStorage.FILE_SYSTEM)
  @Column
  declare storage: FileStorageType

  @BelongsTo(() => VideoModel, {
    foreignKey: {
      allowNull: false
    },
    onDelete: 'CASCADE'
  })
  declare Video: Awaited<VideoModel>

  @HasMany(() => VideoFileModel, {
    foreignKey: {
      allowNull: true
    },
    onDelete: 'CASCADE'
  })
  declare VideoFiles: Awaited<VideoFileModel>[]

  @HasMany(() => VideoRedundancyModel, {
    foreignKey: {
      allowNull: false
    },
    onDelete: 'CASCADE',
    hooks: true
  })
  declare RedundancyVideos: Awaited<VideoRedundancyModel>[]

  @HasMany(() => VideoInfohashModel, {
    foreignKey: {
      allowNull: true
    },
    onDelete: 'CASCADE'
  })
  declare InfoHashes: Awaited<VideoInfohashModel>[]

  static buildP2PMediaLoaderInfoHashes (videoUUID: string, files: { resolution: number }[]) {
    const hashes: string[] = []

    const version = P2P_MEDIA_LOADER_PEER_VERSION

    for (const file of files) {
      hashes.push(generateP2PMediaLoaderHash(generateSwarmId({
        peerProtocolVersion: `v${version}`,
        streamType: 'main',
        videoUUID,
        resolution: file.resolution
      })))
    }

    // Audio only stream
    if (files.some(f => f.resolution === 0)) {
      hashes.push(generateP2PMediaLoaderHash(generateSwarmId({
        peerProtocolVersion: `v${version}`,
        streamType: 'secondary',
        videoUUID,
        resolution: 0
      })))
    }

    logger.debug('Assigned P2P Media Loader info hashes', { videoUUID, hashes })

    return hashes
  }

  static async listIdsByIncorrectPeerVersion () {
    const rows = await VideoStreamingPlaylistModel.unscoped().findAll({
      raw: true,
      attributes: [ 'id' ],
      where: {
        p2pMediaLoaderPeerVersion: {
          [Op.ne]: P2P_MEDIA_LOADER_PEER_VERSION
        }
      }
    })

    return rows.map(r => r.id)
  }

  static async listIdsLocals () {
    const rows = await VideoStreamingPlaylistModel.unscoped().findAll({
      raw: true,
      attributes: [ 'id' ],
      include: [
        {
          model: VideoModel.unscoped(),
          required: true,
          where: {
            remote: false
          }
        }
      ]
    })

    return rows.map(r => r.id)
  }

  // ---------------------------------------------------------------------------

  static loadWithVideoAndFiles (id: number) {
    const options = {
      include: [
        {
          model: VideoModel.unscoped(),
          required: true
        },
        {
          model: VideoFileModel.unscoped()
        }
      ]
    }

    return VideoStreamingPlaylistModel.findByPk<MStreamingPlaylistFilesVideo>(id, options)
  }

  static loadWithVideo (id: number, transaction?: Transaction) {
    const options = {
      include: [
        {
          model: VideoModel.unscoped(),
          required: true
        }
      ],
      transaction
    }

    return VideoStreamingPlaylistModel.findByPk(id, options)
  }

  static loadHLSByVideo (videoId: number, transaction?: Transaction): Promise<MStreamingPlaylist> {
    const options = {
      where: {
        type: VideoStreamingPlaylistType.HLS,
        videoId
      },
      transaction
    }

    return VideoStreamingPlaylistModel.findOne(options)
  }

  static loadHLSByVideoWithVideo (videoId: number, transaction?: Transaction): Promise<MStreamingPlaylistVideo> {
    const options = {
      where: {
        type: VideoStreamingPlaylistType.HLS,
        videoId
      },
      include: [
        {
          model: VideoModel.unscoped(),
          required: true
        }
      ],
      transaction
    }

    return VideoStreamingPlaylistModel.findOne(options)
  }

  static async loadOrGenerate (video: MVideo, transaction?: Transaction) {
    let playlist = await VideoStreamingPlaylistModel.loadHLSByVideo(video.id, transaction)
    let generated = false

    if (!playlist) {
      generated = true

      playlist = new VideoStreamingPlaylistModel({
        p2pMediaLoaderPeerVersion: P2P_MEDIA_LOADER_PEER_VERSION,
        type: VideoStreamingPlaylistType.HLS,
        storage: FileStorage.FILE_SYSTEM,
        playlistFilename: generateHLSMasterPlaylistFilename(video.isLive),
        segmentsSha256Filename: generateHlsSha256SegmentsFilename(video.isLive),
        videoId: video.id
      })

      await playlist.save({ transaction })
    }

    return { generated, playlist: Object.assign(playlist, { Video: video }) }
  }

  static doesOwnedVideoUUIDExist (videoUUID: string, storage: FileStorageType) {
    const query = `SELECT 1 FROM "videoStreamingPlaylist" ` +
      `INNER JOIN "video" ON "video"."id" = "videoStreamingPlaylist"."videoId" ` +
      `AND "video"."remote" IS FALSE AND "video"."uuid" = $videoUUID ` +
      `AND "storage" = $storage LIMIT 1`

    return doesExist({ sequelize: this.sequelize, query, bind: { videoUUID, storage } })
  }

  buildAndSetInfoHashes (video: MVideoUUID, files: { resolution: number }[], transaction?: Transaction) {
    const hashes = VideoStreamingPlaylistModel.buildP2PMediaLoaderInfoHashes(video.uuid, files)

    return this.setInfoHashes(hashes, transaction)
  }

  async setInfoHashes (hashes: string[], transaction?: Transaction) {
    const replace = (t: Transaction) => VideoInfohashModel.replacePlaylistInfohashes(this.id, hashes, t)

    // Keep the delete + insert atomic even when the caller has no transaction
    const infoHashes = transaction
      ? await replace(transaction)
      : await sequelizeTypescript.transaction(replace)

    this.InfoHashes = infoHashes
  }

  // ---------------------------------------------------------------------------

  getMasterPlaylistUrl (video: MVideo) {
    if (video.isLocal()) {
      if (this.storage === FileStorage.OBJECT_STORAGE) {
        return this.getMasterPlaylistObjectStorageUrl(video)
      }

      return WEBSERVER.URL + this.getMasterPlaylistStaticPath(video)
    }

    return this.playlistUrl
  }

  private getMasterPlaylistObjectStorageUrl (video: MVideo) {
    if (video.hasPrivateStaticPath() && CONFIG.OBJECT_STORAGE.PROXY.PROXIFY_PRIVATE_FILES === true) {
      return buildObjectStorageHLSPrivateFileUrl(video, this.playlistFilename)
    }

    return buildObjectStoragePublicFileUrl({
      bucket: CONFIG.OBJECT_STORAGE.STREAMING_PLAYLISTS,
      key: generateHLSObjectStorageKey(video, this.playlistFilename)
    })
  }

  // ---------------------------------------------------------------------------

  getSha256SegmentsUrl (video: MVideo) {
    if (video.isLocal()) {
      if (!this.segmentsSha256Filename) return null

      if (this.storage === FileStorage.OBJECT_STORAGE) {
        return this.getSha256SegmentsObjectStorageUrl(video)
      }

      return WEBSERVER.URL + this.getSha256SegmentsStaticPath(video)
    }

    return this.segmentsSha256Url
  }

  private getSha256SegmentsObjectStorageUrl (video: MVideo) {
    if (video.hasPrivateStaticPath() && CONFIG.OBJECT_STORAGE.PROXY.PROXIFY_PRIVATE_FILES === true) {
      return buildObjectStorageHLSPrivateFileUrl(video, this.segmentsSha256Filename)
    }

    return buildObjectStoragePublicFileUrl({
      bucket: CONFIG.OBJECT_STORAGE.STREAMING_PLAYLISTS,
      key: generateHLSObjectStorageKey(video, this.segmentsSha256Filename)
    })
  }

  // ---------------------------------------------------------------------------

  hasAudioAndVideoSplitted (this: MStreamingPlaylistFiles) {
    // We need at least 2 files to have audio and video splitted
    if (this.VideoFiles.length === 1) return false

    let hasAudio = false
    let hasVideo = false

    for (const file of this.VideoFiles) {
      // File contains both streams: audio and video is not splitted
      if (file.hasAudio() && file.hasVideo()) return false

      if (file.resolution === VideoResolution.H_NOVIDEO) hasAudio = true
      else if (file.hasVideo()) hasVideo = true

      if (hasVideo && hasAudio) return true
    }

    return false
  }

  getStringType (): VideoStreamingPlaylistTypeString {
    if (this.type === VideoStreamingPlaylistType.HLS) return 'hls'

    return 'unknown'
  }

  getTrackerUrls (baseUrlHttp: string, baseUrlWs: string) {
    return [ baseUrlWs + '/tracker/socket', baseUrlHttp + '/tracker/announce' ]
  }

  hasSameUniqueKeysThan (other: MStreamingPlaylist) {
    return this.type === other.type &&
      this.videoId === other.videoId
  }

  withVideo (video: MVideo) {
    return Object.assign(this, { Video: video })
  }

  // ---------------------------------------------------------------------------

  static getPlaylistFileStaticPath (video: MVideoPrivacy, filename: string) {
    if (isVideoInPrivateDirectory(video.privacy)) {
      return join(STATIC_PATHS.STREAMING_PLAYLISTS.PRIVATE_HLS, video.uuid, filename)
    }

    return join(STATIC_PATHS.STREAMING_PLAYLISTS.HLS, video.uuid, filename)
  }

  private getMasterPlaylistStaticPath (video: MVideoPrivacy) {
    return VideoStreamingPlaylistModel.getPlaylistFileStaticPath(video, this.playlistFilename)
  }

  private getSha256SegmentsStaticPath (video: MVideoPrivacy) {
    return VideoStreamingPlaylistModel.getPlaylistFileStaticPath(video, this.segmentsSha256Filename)
  }
}
