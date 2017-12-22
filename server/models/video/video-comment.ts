import * as Sequelize from 'sequelize'
import {
  AllowNull, BelongsTo, Column, CreatedAt, DataType, Default, ForeignKey, IFindOptions, Is, IsUUID, Model, Table,
  UpdatedAt
} from 'sequelize-typescript'
import { isActivityPubUrlValid } from '../../helpers/custom-validators/activitypub'
import { CONSTRAINTS_FIELDS } from '../../initializers'
import { ActorModel } from '../activitypub/actor'
import { throwIfNotValid } from '../utils'
import { VideoModel } from './video'

@Table({
  tableName: 'videoComment',
  indexes: [
    {
      fields: [ 'videoId' ]
    }
  ]
})
export class VideoCommentModel extends Model<VideoCommentModel> {
  @CreatedAt
  createdAt: Date

  @UpdatedAt
  updatedAt: Date

  @AllowNull(false)
  @Is('VideoCommentUrl', value => throwIfNotValid(value, isActivityPubUrlValid, 'url'))
  @Column(DataType.STRING(CONSTRAINTS_FIELDS.VIDEOS.URL.max))
  url: string

  @AllowNull(false)
  @Column(DataType.TEXT)
  text: string

  @ForeignKey(() => VideoCommentModel)
  @Column
  originCommentId: number

  @BelongsTo(() => VideoCommentModel, {
    foreignKey: {
      allowNull: true
    },
    onDelete: 'CASCADE'
  })
  OriginVideoComment: VideoCommentModel

  @ForeignKey(() => VideoCommentModel)
  @Column
  inReplyToCommentId: number

  @BelongsTo(() => VideoCommentModel, {
    foreignKey: {
      allowNull: true
    },
    onDelete: 'CASCADE'
  })
  InReplyToVideoComment: VideoCommentModel

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

  @ForeignKey(() => ActorModel)
  @Column
  actorId: number

  @BelongsTo(() => ActorModel, {
    foreignKey: {
      allowNull: false
    },
    onDelete: 'CASCADE'
  })
  Actor: ActorModel

  static loadByUrl (url: string, t?: Sequelize.Transaction) {
    const query: IFindOptions<VideoCommentModel> = {
      where: {
        url
      }
    }

    if (t !== undefined) query.transaction = t

    return VideoCommentModel.findOne(query)
  }
}
