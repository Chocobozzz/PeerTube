import { AllowNull, BelongsTo, Column, CreatedAt, ForeignKey, Table, UpdatedAt } from 'sequelize-typescript'
import { MVideo, MVideoChapter } from '@server/types/models/index.js'
import { VideoChapter, VideoChapterObject } from '@peertube/peertube-models'
import { VideoModel } from './video.js'
import { Transaction } from 'sequelize'
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
  timecode: number

  @AllowNull(false)
  @Column
  title: string

  @ForeignKey(() => VideoModel)
  @Column
  videoId: number

  @BelongsTo(() => VideoModel, {
    foreignKey: {
      allowNull: false
    },
    onDelete: 'CASCADE'
  })
  Video: Awaited<VideoModel>

  @CreatedAt
  createdAt: Date

  @UpdatedAt
  updatedAt: Date

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

  toFormattedJSON (this: MVideoChapter): VideoChapter {
    return {
      timecode: this.timecode,
      title: this.title
    }
  }
}
