import { AllowNull, BelongsTo, Column, CreatedAt, DataType, Default, ForeignKey, Is, Model, Table, UpdatedAt } from 'sequelize-typescript'
import { VideoAbuseObject } from '../../../shared/models/activitypub/objects'
import { VideoAbuse } from '../../../shared/models/videos'
import {
  isVideoAbuseModerationCommentValid,
  isVideoAbuseReasonValid,
  isVideoAbuseStateValid
} from '../../helpers/custom-validators/video-abuses'
import { AccountModel } from '../account/account'
import { buildBlockedAccountSQL, getSort, throwIfNotValid } from '../utils'
import { VideoModel } from './video'
import { VideoAbuseState } from '../../../shared'
import { CONSTRAINTS_FIELDS, VIDEO_ABUSE_STATES } from '../../initializers/constants'
import { MUserAccountId, MVideoAbuse, MVideoAbuseFormattable, MVideoAbuseVideo } from '../../typings/models'
import * as Bluebird from 'bluebird'
import { literal, Op } from 'sequelize'

@Table({
  tableName: 'videoAbuse',
  indexes: [
    {
      fields: [ 'videoId' ]
    },
    {
      fields: [ 'reporterAccountId' ]
    }
  ]
})
export class VideoAbuseModel extends Model<VideoAbuseModel> {

  @AllowNull(false)
  @Default(null)
  @Is('VideoAbuseReason', value => throwIfNotValid(value, isVideoAbuseReasonValid, 'reason'))
  @Column(DataType.STRING(CONSTRAINTS_FIELDS.VIDEO_ABUSES.REASON.max))
  reason: string

  @AllowNull(false)
  @Default(null)
  @Is('VideoAbuseState', value => throwIfNotValid(value, isVideoAbuseStateValid, 'state'))
  @Column
  state: VideoAbuseState

  @AllowNull(true)
  @Default(null)
  @Is('VideoAbuseModerationComment', value => throwIfNotValid(value, isVideoAbuseModerationCommentValid, 'moderationComment', true))
  @Column(DataType.STRING(CONSTRAINTS_FIELDS.VIDEO_ABUSES.MODERATION_COMMENT.max))
  moderationComment: string

  @CreatedAt
  createdAt: Date

  @UpdatedAt
  updatedAt: Date

  @ForeignKey(() => AccountModel)
  @Column
  reporterAccountId: number

  @BelongsTo(() => AccountModel, {
    foreignKey: {
      allowNull: false
    },
    onDelete: 'cascade'
  })
  Account: AccountModel

  @ForeignKey(() => VideoModel)
  @Column
  videoId: number

  @BelongsTo(() => VideoModel, {
    foreignKey: {
      allowNull: false
    },
    onDelete: 'cascade'
  })
  Video: VideoModel

  static loadByIdAndVideoId (id: number, videoId: number): Bluebird<MVideoAbuse> {
    const query = {
      where: {
        id,
        videoId
      }
    }
    return VideoAbuseModel.findOne(query)
  }

  static listForApi (parameters: {
    start: number
    count: number
    sort: string
    serverAccountId: number
    user?: MUserAccountId
  }) {
    const { start, count, sort, user, serverAccountId } = parameters
    const userAccountId = user ? user.Account.id : undefined

    const query = {
      offset: start,
      limit: count,
      order: getSort(sort),
      where: {
        reporterAccountId: {
          [Op.notIn]: literal('(' + buildBlockedAccountSQL(serverAccountId, userAccountId) + ')')
        }
      },
      include: [
        {
          model: AccountModel,
          required: true
        },
        {
          model: VideoModel,
          required: true
        }
      ]
    }

    return VideoAbuseModel.findAndCountAll(query)
      .then(({ rows, count }) => {
        return { total: count, data: rows }
      })
  }

  toFormattedJSON (this: MVideoAbuseFormattable): VideoAbuse {
    return {
      id: this.id,
      reason: this.reason,
      reporterAccount: this.Account.toFormattedJSON(),
      state: {
        id: this.state,
        label: VideoAbuseModel.getStateLabel(this.state)
      },
      moderationComment: this.moderationComment,
      video: {
        id: this.Video.id,
        uuid: this.Video.uuid,
        name: this.Video.name
      },
      createdAt: this.createdAt
    }
  }

  toActivityPubObject (this: MVideoAbuseVideo): VideoAbuseObject {
    return {
      type: 'Flag' as 'Flag',
      content: this.reason,
      object: this.Video.url
    }
  }

  private static getStateLabel (id: number) {
    return VIDEO_ABUSE_STATES[id] || 'Unknown'
  }
}
