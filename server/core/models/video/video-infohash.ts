import { logger } from '@server/helpers/logger.js'
import { MInfohash } from '@server/types/models/video/video-infohash.js'
import memoizee from 'memoizee'
import { Op, Transaction } from 'sequelize'
import { AllowNull, Column, DataType, ForeignKey, Table } from 'sequelize-typescript'
import { MEMOIZE_LENGTH, MEMOIZE_TTL } from '../../initializers/constants.js'
import { SequelizeModel, doesExist } from '../shared/index.js'
import { VideoFileModel } from './video-file.js'
import { VideoStreamingPlaylistModel } from './video-streaming-playlist.js'

@Table({
  tableName: 'videoInfohash',
  timestamps: false,
  indexes: [
    {
      fields: [ 'infohash' ]
    },
    {
      fields: [ 'videoStreamingPlaylistId' ],
      where: {
        videoStreamingPlaylistId: {
          [Op.ne]: null
        }
      }
    },
    {
      fields: [ 'videoFileId' ],
      unique: true,
      where: {
        videoFileId: {
          [Op.ne]: null
        }
      }
    }
  ]
})
export class VideoInfohashModel extends SequelizeModel<VideoInfohashModel> {
  @AllowNull(false)
  @Column(DataType.BLOB)
  declare infohash: Buffer

  @ForeignKey(() => VideoStreamingPlaylistModel)
  @AllowNull(true)
  @Column
  declare videoStreamingPlaylistId: number

  @ForeignKey(() => VideoFileModel)
  @AllowNull(true)
  @Column
  declare videoFileId: number

  // The 20 ASCII characters p2p-media-loader announces for this row
  toP2PMediaLoaderInfohash () {
    return this.infohash.toString('binary')
  }

  // The 40 char hex classic BitTorrent clients announce for this row
  toHexInfohash () {
    return this.infohash.toString('hex')
  }

  static doesInfohashExistCached = memoizee(VideoInfohashModel.doesInfohashHexExist.bind(VideoInfohashModel), {
    promise: true,
    max: MEMOIZE_LENGTH.INFO_HASH_EXISTS,
    maxAge: MEMOIZE_TTL.INFO_HASH_EXISTS
  })

  // infohashHex is the hex representation announced on the wire (40 chars for a 20 byte infohash)
  static doesInfohashHexExist (infohashHex: string) {
    const query = 'SELECT 1 FROM "videoInfohash" WHERE "infohash" = $infohash LIMIT 1'

    return doesExist({ sequelize: this.sequelize, query, bind: { infohash: Buffer.from(infohashHex, 'hex') } })
  }

  // ---------------------------------------------------------------------------

  // p2p-media-loader infohashes are 20 ASCII characters (base64), announced as those 20 bytes
  static replacePlaylistInfohashes (playlistId: number, hashes: string[], transaction?: Transaction) {
    if (!playlistId) throw new Error('playlistId is required')

    logger.debug('Replacing infohash for streaming playlist %d', playlistId, { hashes })

    return this.replaceInfohashes({
      where: { videoStreamingPlaylistId: playlistId },
      rows: hashes.map(h => ({ infohash: Buffer.from(h, 'binary'), videoStreamingPlaylistId: playlistId })),
      transaction
    })
  }

  // Classic BitTorrent infohash stored as its 40 char hex on the video file
  static async replaceFileInfohash (fileId: number, infohashHex: string | null, transaction?: Transaction) {
    if (!fileId) throw new Error('fileId is required')

    logger.debug('Replacing infohash for file %d', fileId, { infohashHex })

    const results = await this.replaceInfohashes({
      where: { videoFileId: fileId },
      rows: infohashHex
        ? [ { infohash: Buffer.from(infohashHex, 'hex'), videoFileId: fileId } ]
        : [],
      transaction
    })

    if (results.length === 0) return undefined

    return results[0]
  }

  private static async replaceInfohashes (options: {
    where: { videoStreamingPlaylistId: number } | { videoFileId: number }
    rows: { infohash: Buffer, videoStreamingPlaylistId?: number, videoFileId?: number }[]
    transaction?: Transaction
  }): Promise<MInfohash[]> {
    const { where, rows, transaction } = options

    await VideoInfohashModel.destroy({ where, transaction })

    if (rows.length === 0) return []

    return VideoInfohashModel.bulkCreate(rows, { transaction })
  }
}
