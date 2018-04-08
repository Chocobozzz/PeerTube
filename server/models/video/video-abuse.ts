import { AfterCreate, AllowNull, BelongsTo, Column, CreatedAt, ForeignKey, Is, Model, Table, UpdatedAt } from 'sequelize-typescript'
import { VideoAbuseObject } from '../../../shared/models/activitypub/objects'
import { VideoAbuse } from '../../../shared/models/videos'
import { isVideoAbuseReasonValid } from '../../helpers/custom-validators/videos'
import { Emailer } from '../../lib/emailer'
import { AccountModel } from '../account/account'
import { getSort, throwIfNotValid } from '../utils'
import { VideoModel } from './video'

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
  @Is('VideoAbuseReason', value => throwIfNotValid(value, isVideoAbuseReasonValid, 'reason'))
  @Column
  reason: string

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

  @AfterCreate
  static sendEmailNotification (instance: VideoAbuseModel) {
    return Emailer.Instance.addVideoAbuseReport(instance.videoId)
  }

  static listForApi (start: number, count: number, sort: string) {
    const query = {
      offset: start,
      limit: count,
      order: getSort(sort),
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

  toFormattedJSON (): VideoAbuse {
    return {
      id: this.id,
      reason: this.reason,
      reporterAccount: this.Account.toFormattedJSON(),
      video: {
        id: this.Video.id,
        uuid: this.Video.uuid,
        url: this.Video.url,
        name: this.Video.name
      },
      createdAt: this.createdAt
    }
  }

  toActivityPubObject (): VideoAbuseObject {
    return {
      type: 'Flag' as 'Flag',
      content: this.reason,
      object: this.Video.url
    }
  }
}
