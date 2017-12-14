import { AllowNull, BelongsTo, Column, CreatedAt, ForeignKey, Is, Model, Table, UpdatedAt } from 'sequelize-typescript'
import { VideoAbuseObject } from '../../../shared/models/activitypub/objects'
import { isVideoAbuseReasonValid } from '../../helpers/custom-validators/videos'
import { CONFIG } from '../../initializers'
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

  static listForApi (start: number, count: number, sort: string) {
    const query = {
      offset: start,
      limit: count,
      order: [ getSort(sort) ],
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

  toFormattedJSON () {
    let reporterServerHost

    if (this.Account.Actor.Server) {
      reporterServerHost = this.Account.Actor.Server.host
    } else {
      // It means it's our video
      reporterServerHost = CONFIG.WEBSERVER.HOST
    }

    return {
      id: this.id,
      reason: this.reason,
      reporterUsername: this.Account.name,
      reporterServerHost,
      videoId: this.Video.id,
      videoUUID: this.Video.uuid,
      videoName: this.Video.name,
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
