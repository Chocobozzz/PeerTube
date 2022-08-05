import memoizee from 'memoizee'
import { join } from 'path'
import { Op, Transaction } from 'sequelize'
import {
  AllowNull,
  BelongsTo,
  Column,
  CreatedAt,
  DataType,
  Default,
  ForeignKey,
  HasMany,
  Is,
  Model,
  Table,
  UpdatedAt
} from 'sequelize-typescript'
import { getHLSPublicFileUrl } from '@server/lib/object-storage'
import { generateHLSMasterPlaylistFilename, generateHlsSha256SegmentsFilename } from '@server/lib/paths'
import { VideoFileModel } from '@server/models/video/video-file'
import { MStreamingPlaylist, MStreamingPlaylistFilesVideo, MVideo } from '@server/types/models'
import { sha1 } from '@shared/extra-utils'
import { VideoStorage } from '@shared/models'
import { AttributesOnly } from '@shared/typescript-utils'
import { VideoStreamingPlaylistType } from '../../../shared/models/videos/video-streaming-playlist.type'
import { isActivityPubUrlValid } from '../../helpers/custom-validators/activitypub/misc'
import { isArrayOf } from '../../helpers/custom-validators/misc'
import { isVideoFileInfoHashValid } from '../../helpers/custom-validators/videos'
import {
  CONSTRAINTS_FIELDS,
  MEMOIZE_LENGTH,
  MEMOIZE_TTL,
  P2P_MEDIA_LOADER_PEER_VERSION,
  STATIC_PATHS,
  WEBSERVER
} from '../../initializers/constants'
import { VideoRedundancyModel } from '../redundancy/video-redundancy'
import { doesExist } from '../shared'
import { throwIfNotValid } from '../utils'
import { VideoModel } from './video'

@Table({
  tableName: 'videoStreamingPlaylist',
  indexes: [
    {
      fields: [ 'videoId' ]
    },
    {
      fields: [ 'videoId', 'type' ],
      unique: true
    },
    {
      fields: [ 'p2pMediaLoaderInfohashes' ],
      using: 'gin'
    }
  ]
})
export class VideoStreamingPlaylistModel extends Model<Partial<AttributesOnly<VideoStreamingPlaylistModel>>> {
  @CreatedAt
  createdAt: Date

  @UpdatedAt
  updatedAt: Date

  @AllowNull(false)
  @Column
  type: VideoStreamingPlaylistType

  @AllowNull(false)
  @Column
  playlistFilename: string

  @AllowNull(true)
  @Is('PlaylistUrl', value => throwIfNotValid(value, isActivityPubUrlValid, 'playlist url', true))
  @Column(DataType.STRING(CONSTRAINTS_FIELDS.VIDEOS.URL.max))
  playlistUrl: string

  @AllowNull(false)
  @Is('VideoStreamingPlaylistInfoHashes', value => throwIfNotValid(value, v => isArrayOf(v, isVideoFileInfoHashValid), 'info hashes'))
  @Column(DataType.ARRAY(DataType.STRING))
  p2pMediaLoaderInfohashes: string[]

  @AllowNull(false)
  @Column
  p2pMediaLoaderPeerVersion: number

  @AllowNull(false)
  @Column
  segmentsSha256Filename: string

  @AllowNull(true)
  @Is('VideoStreamingSegmentsSha256Url', value => throwIfNotValid(value, isActivityPubUrlValid, 'segments sha256 url', true))
  @Column
  segmentsSha256Url: string

  @ForeignKey(() => VideoModel)
  @Column
  videoId: number

  @AllowNull(false)
  @Default(VideoStorage.FILE_SYSTEM)
  @Column
  storage: VideoStorage

  @BelongsTo(() => VideoModel, {
    foreignKey: {
      allowNull: false
    },
    onDelete: 'CASCADE'
  })
  Video: VideoModel

  @HasMany(() => VideoFileModel, {
    foreignKey: {
      allowNull: true
    },
    onDelete: 'CASCADE'
  })
  VideoFiles: VideoFileModel[]

  @HasMany(() => VideoRedundancyModel, {
    foreignKey: {
      allowNull: false
    },
    onDelete: 'CASCADE',
    hooks: true
  })
  RedundancyVideos: VideoRedundancyModel[]

  static doesInfohashExistCached = memoizee(VideoStreamingPlaylistModel.doesInfohashExist, {
    promise: true,
    max: MEMOIZE_LENGTH.INFO_HASH_EXISTS,
    maxAge: MEMOIZE_TTL.INFO_HASH_EXISTS
  })

  static doesInfohashExist (infoHash: string) {
    const query = 'SELECT 1 FROM "videoStreamingPlaylist" WHERE $infoHash = ANY("p2pMediaLoaderInfohashes") LIMIT 1'

    return doesExist(query, { infoHash })
  }

  static buildP2PMediaLoaderInfoHashes (playlistUrl: string, files: unknown[]) {
    const hashes: string[] = []

    // https://github.com/Novage/p2p-media-loader/blob/master/p2p-media-loader-core/lib/p2p-media-manager.ts#L115
    for (let i = 0; i < files.length; i++) {
      hashes.push(sha1(`${P2P_MEDIA_LOADER_PEER_VERSION}${playlistUrl}+V${i}`))
    }

    return hashes
  }

  static listByIncorrectPeerVersion () {
    const query = {
      where: {
        p2pMediaLoaderPeerVersion: {
          [Op.ne]: P2P_MEDIA_LOADER_PEER_VERSION
        }
      },
      include: [
        {
          model: VideoModel.unscoped(),
          required: true
        }
      ]
    }

    return VideoStreamingPlaylistModel.findAll(query)
  }

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

  static loadWithVideo (id: number) {
    const options = {
      include: [
        {
          model: VideoModel.unscoped(),
          required: true
        }
      ]
    }

    return VideoStreamingPlaylistModel.findByPk(id, options)
  }

  static loadHLSPlaylistByVideo (videoId: number, transaction?: Transaction): Promise<MStreamingPlaylist> {
    const options = {
      where: {
        type: VideoStreamingPlaylistType.HLS,
        videoId
      },
      transaction
    }

    return VideoStreamingPlaylistModel.findOne(options)
  }

  static async loadOrGenerate (video: MVideo, transaction?: Transaction) {
    let playlist = await VideoStreamingPlaylistModel.loadHLSPlaylistByVideo(video.id, transaction)

    if (!playlist) {
      playlist = new VideoStreamingPlaylistModel({
        p2pMediaLoaderPeerVersion: P2P_MEDIA_LOADER_PEER_VERSION,
        type: VideoStreamingPlaylistType.HLS,
        storage: VideoStorage.FILE_SYSTEM,
        p2pMediaLoaderInfohashes: [],
        playlistFilename: generateHLSMasterPlaylistFilename(video.isLive),
        segmentsSha256Filename: generateHlsSha256SegmentsFilename(video.isLive),
        videoId: video.id
      })

      await playlist.save({ transaction })
    }

    return Object.assign(playlist, { Video: video })
  }

  static doesOwnedHLSPlaylistExist (videoUUID: string) {
    const query = `SELECT 1 FROM "videoStreamingPlaylist" ` +
      `INNER JOIN "video" ON "video"."id" = "videoStreamingPlaylist"."videoId" ` +
      `AND "video"."remote" IS FALSE AND "video"."uuid" = $videoUUID ` +
      `AND "storage" = ${VideoStorage.FILE_SYSTEM} LIMIT 1`

    return doesExist(query, { videoUUID })
  }

  assignP2PMediaLoaderInfoHashes (video: MVideo, files: unknown[]) {
    const masterPlaylistUrl = this.getMasterPlaylistUrl(video)

    this.p2pMediaLoaderInfohashes = VideoStreamingPlaylistModel.buildP2PMediaLoaderInfoHashes(masterPlaylistUrl, files)
  }

  getMasterPlaylistUrl (video: MVideo) {
    if (this.storage === VideoStorage.OBJECT_STORAGE) {
      return getHLSPublicFileUrl(this.playlistUrl)
    }

    if (video.isOwned()) return WEBSERVER.URL + this.getMasterPlaylistStaticPath(video.uuid)

    return this.playlistUrl
  }

  getSha256SegmentsUrl (video: MVideo) {
    if (this.storage === VideoStorage.OBJECT_STORAGE) {
      return getHLSPublicFileUrl(this.segmentsSha256Url)
    }

    if (video.isOwned()) return WEBSERVER.URL + this.getSha256SegmentsStaticPath(video.uuid, video.isLive)

    return this.segmentsSha256Url
  }

  getStringType () {
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

  private getMasterPlaylistStaticPath (videoUUID: string) {
    return join(STATIC_PATHS.STREAMING_PLAYLISTS.HLS, videoUUID, this.playlistFilename)
  }

  private getSha256SegmentsStaticPath (videoUUID: string, isLive: boolean) {
    if (isLive) return join('/live', 'segments-sha256', videoUUID)

    return join(STATIC_PATHS.STREAMING_PLAYLISTS.HLS, videoUUID, this.segmentsSha256Filename)
  }
}
