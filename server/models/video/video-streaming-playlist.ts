import * as memoizee from 'memoizee'
import { join } from 'path'
import { Op, QueryTypes } from 'sequelize'
import { AllowNull, BelongsTo, Column, CreatedAt, DataType, ForeignKey, HasMany, Is, Model, Table, UpdatedAt } from 'sequelize-typescript'
import { VideoFileModel } from '@server/models/video/video-file'
import { MStreamingPlaylist } from '@server/types/models'
import { VideoStreamingPlaylistType } from '../../../shared/models/videos/video-streaming-playlist.type'
import { sha1 } from '../../helpers/core-utils'
import { isActivityPubUrlValid } from '../../helpers/custom-validators/activitypub/misc'
import { isArrayOf } from '../../helpers/custom-validators/misc'
import { isVideoFileInfoHashValid } from '../../helpers/custom-validators/videos'
import { CONSTRAINTS_FIELDS, MEMOIZE_LENGTH, MEMOIZE_TTL, P2P_MEDIA_LOADER_PEER_VERSION, STATIC_PATHS } from '../../initializers/constants'
import { VideoRedundancyModel } from '../redundancy/video-redundancy'
import { throwIfNotValid } from '../utils'
import { VideoModel } from './video'
import { AttributesOnly } from '@shared/core-utils'

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
  @Is('PlaylistUrl', value => throwIfNotValid(value, isActivityPubUrlValid, 'playlist url'))
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
  @Is('VideoStreamingSegmentsSha256Url', value => throwIfNotValid(value, isActivityPubUrlValid, 'segments sha256 url'))
  @Column
  segmentsSha256Url: string

  @ForeignKey(() => VideoModel)
  @Column
  videoId: number

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
    const options = {
      type: QueryTypes.SELECT as QueryTypes.SELECT,
      bind: { infoHash },
      raw: true
    }

    return VideoModel.sequelize.query<object>(query, options)
              .then(results => results.length === 1)
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
      }
    }

    return VideoStreamingPlaylistModel.findAll(query)
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

  static loadHLSPlaylistByVideo (videoId: number) {
    const options = {
      where: {
        type: VideoStreamingPlaylistType.HLS,
        videoId
      }
    }

    return VideoStreamingPlaylistModel.findOne(options)
  }

  static getHlsPlaylistFilename (resolution: number) {
    return resolution + '.m3u8'
  }

  static getMasterHlsPlaylistFilename () {
    return 'master.m3u8'
  }

  static getHlsSha256SegmentsFilename () {
    return 'segments-sha256.json'
  }

  static getHlsMasterPlaylistStaticPath (videoUUID: string) {
    return join(STATIC_PATHS.STREAMING_PLAYLISTS.HLS, videoUUID, VideoStreamingPlaylistModel.getMasterHlsPlaylistFilename())
  }

  static getHlsPlaylistStaticPath (videoUUID: string, resolution: number) {
    return join(STATIC_PATHS.STREAMING_PLAYLISTS.HLS, videoUUID, VideoStreamingPlaylistModel.getHlsPlaylistFilename(resolution))
  }

  static getHlsSha256SegmentsStaticPath (videoUUID: string, isLive: boolean) {
    if (isLive) return join('/live', 'segments-sha256', videoUUID)

    return join(STATIC_PATHS.STREAMING_PLAYLISTS.HLS, videoUUID, VideoStreamingPlaylistModel.getHlsSha256SegmentsFilename())
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
}
