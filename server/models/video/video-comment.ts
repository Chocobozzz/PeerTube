import * as Sequelize from 'sequelize'
import {
  AfterDestroy, AllowNull, BelongsTo, Column, CreatedAt, DataType, ForeignKey, IFindOptions, Is, Model, Scopes, Table,
  UpdatedAt
} from 'sequelize-typescript'
import { VideoComment } from '../../../shared/models/videos/video-comment.model'
import { isActivityPubUrlValid } from '../../helpers/custom-validators/activitypub'
import { CONSTRAINTS_FIELDS } from '../../initializers'
import { AccountModel } from '../account/account'
import { getSort, throwIfNotValid } from '../utils'
import { VideoModel } from './video'

enum ScopeNames {
  WITH_ACCOUNT = 'WITH_ACCOUNT'
}

@Scopes({
  [ScopeNames.WITH_ACCOUNT]: {
    include: [
      () => AccountModel
    ]
  }
})
@Table({
  tableName: 'videoComment',
  indexes: [
    {
      fields: [ 'videoId' ]
    },
    {
      fields: [ 'videoId', 'originCommentId' ]
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

  @ForeignKey(() => AccountModel)
  @Column
  accountId: number

  @BelongsTo(() => AccountModel, {
    foreignKey: {
      allowNull: false
    },
    onDelete: 'CASCADE'
  })
  Account: AccountModel

  @AfterDestroy
  static sendDeleteIfOwned (instance: VideoCommentModel) {
    // TODO
    return undefined
  }

  static loadById (id: number, t?: Sequelize.Transaction) {
    const query: IFindOptions<VideoCommentModel> = {
      where: {
        id
      }
    }

    if (t !== undefined) query.transaction = t

    return VideoCommentModel.findOne(query)
  }

  static loadByUrl (url: string, t?: Sequelize.Transaction) {
    const query: IFindOptions<VideoCommentModel> = {
      where: {
        url
      }
    }

    if (t !== undefined) query.transaction = t

    return VideoCommentModel.findOne(query)
  }

  static listThreadsForApi (videoId: number, start: number, count: number, sort: string) {
    const query = {
      offset: start,
      limit: count,
      order: [ getSort(sort) ],
      where: {
        videoId,
        inReplyToCommentId: null
      }
    }

    return VideoCommentModel
      .scope([ ScopeNames.WITH_ACCOUNT ])
      .findAndCountAll(query)
      .then(({ rows, count }) => {
        return { total: count, data: rows }
      })
  }

  static listThreadCommentsForApi (videoId: number, threadId: number) {
    const query = {
      order: [ [ 'id', 'ASC' ] ],
      where: {
        videoId,
        [ Sequelize.Op.or ]: [
          { id: threadId },
          { originCommentId: threadId }
        ]
      }
    }

    return VideoCommentModel
      .scope([ ScopeNames.WITH_ACCOUNT ])
      .findAndCountAll(query)
      .then(({ rows, count }) => {
        return { total: count, data: rows }
      })
  }

  toFormattedJSON () {
    return {
      id: this.id,
      url: this.url,
      text: this.text,
      threadId: this.originCommentId || this.id,
      inReplyToCommentId: this.inReplyToCommentId,
      videoId: this.videoId,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      account: {
        name: this.Account.name
      }
    } as VideoComment
  }
}
