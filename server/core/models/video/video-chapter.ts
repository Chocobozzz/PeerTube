import { AllowNull, BelongsTo, Column, CreatedAt, ForeignKey, Table, UpdatedAt } from 'sequelize-typescript'
import { MVideo, MVideoChapter } from '@server/types/models/index.js'
import { PodcastChapter, VideoChapter, VideoChapterObject } from '@peertube/peertube-models'
import { VideoModel } from './video.js'
import { Op, Transaction } from 'sequelize'
import { getSort } from '../shared/sort.js'
import { SequelizeModel } from '../shared/sequelize-type.js'

@Table({
  tableName: 'videoChapter',
  indexes: [
    {
      fields: [ 'videoId', 'timecode' ],
      unique: true
    }
  ]
})
export class VideoChapterModel extends SequelizeModel<VideoChapterModel> {
  @AllowNull(false)
  @Column
  declare timecode: number

  @AllowNull(false)
  @Column
  declare title: string

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

  @CreatedAt
  declare createdAt: Date

  @UpdatedAt
  declare updatedAt: Date

  static deleteChapters (videoId: number, transaction: Transaction) {
    const query = {
      where: {
        videoId
      },
      transaction
    }

    return VideoChapterModel.destroy(query)
  }

  static listChaptersOfVideo (videoId: number, transaction?: Transaction) {
    const query = {
      where: {
        videoId
      },
      order: getSort('timecode'),
      transaction
    }

    return VideoChapterModel.findAll<MVideoChapter>(query)
  }

  static async listVideoIdsWithChapters (videoIds: number[]): Promise<Set<number>> {
    if (videoIds.length === 0) return new Set()

    const rows = await VideoChapterModel.findAll<MVideoChapter>({
      attributes: [ 'videoId' ],
      group: [ 'videoId' ],
      where: {
        videoId: {
          [Op.in]: videoIds
        }
      },
      raw: true
    })

    return new Set(rows.map(r => r.videoId))
  }

  static hasVideoChapters (videoId: number, transaction: Transaction) {
    return VideoChapterModel.findOne({
      where: { videoId },
      transaction
    }).then(c => !!c)
  }

  toActivityPubJSON (this: MVideoChapter, options: {
    video: MVideo
    nextChapter: MVideoChapter
  }): VideoChapterObject {
    return {
      name: this.title,
      startOffset: this.timecode,
      endOffset: options.nextChapter
        ? options.nextChapter.timecode
        : options.video.duration
    }
  }

  toPodcastJSON (this: MVideoChapter): PodcastChapter {
    return {
      startTime: this.timecode,
      title: this.title
    }
  }

  toFormattedJSON (this: MVideoChapter): VideoChapter {
    return {
      timecode: this.timecode,
      title: this.title
    }
  }
}
