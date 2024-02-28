import { DestroyOptions, Op, Transaction } from 'sequelize'
import { AllowNull, BelongsTo, Column, CreatedAt, ForeignKey, IsInt, Table, UpdatedAt } from 'sequelize-typescript'
import { ResultList } from '@peertube/peertube-models'
import { MUserAccountId, MUserId } from '@server/types/models/index.js'
import { VideoModel } from '../video/video.js'
import { UserModel } from './user.js'
import { SequelizeModel } from '../shared/sequelize-type.js'
import { USER_EXPORT_MAX_ITEMS } from '@server/initializers/constants.js'
import { getSort } from '../shared/sort.js'

@Table({
  tableName: 'userVideoHistory',
  indexes: [
    {
      fields: [ 'userId', 'videoId' ],
      unique: true
    },
    {
      fields: [ 'userId' ]
    },
    {
      fields: [ 'videoId' ]
    }
  ]
})
export class UserVideoHistoryModel extends SequelizeModel<UserVideoHistoryModel> {
  @CreatedAt
  createdAt: Date

  @UpdatedAt
  updatedAt: Date

  @AllowNull(false)
  @IsInt
  @Column
  currentTime: number

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

  @ForeignKey(() => UserModel)
  @Column
  userId: number

  @BelongsTo(() => UserModel, {
    foreignKey: {
      allowNull: false
    },
    onDelete: 'CASCADE'
  })
  User: Awaited<UserModel>

  // FIXME: have to specify the result type to not break peertube typings generation
  static listForApi (user: MUserAccountId, start: number, count: number, search?: string): Promise<ResultList<VideoModel>> {
    return VideoModel.listForApi({
      start,
      count,
      search,
      sort: '-"userVideoHistory"."updatedAt"',
      nsfw: null, // All
      displayOnlyForFollower: null,
      user,
      historyOfUser: user
    })
  }

  static async listForExport (user: MUserId) {
    const rows = await UserVideoHistoryModel.findAll({
      attributes: [ 'createdAt', 'updatedAt', 'currentTime' ],
      where: {
        userId: user.id
      },
      limit: USER_EXPORT_MAX_ITEMS,
      include: [
        {
          attributes: [ 'url' ],
          model: VideoModel.unscoped(),
          required: true
        }
      ],
      order: getSort('updatedAt')
    })

    return rows.map(r => ({ createdAt: r.createdAt, updatedAt: r.updatedAt, currentTime: r.currentTime, videoUrl: r.Video.url }))
  }

  static removeUserHistoryElement (user: MUserId, videoId: number) {
    const query: DestroyOptions = {
      where: {
        userId: user.id,
        videoId
      }
    }

    return UserVideoHistoryModel.destroy(query)
  }

  static removeUserHistoryBefore (user: MUserId, beforeDate: string, t: Transaction) {
    const query: DestroyOptions = {
      where: {
        userId: user.id
      },
      transaction: t
    }

    if (beforeDate) {
      query.where['updatedAt'] = {
        [Op.lt]: beforeDate
      }
    }

    return UserVideoHistoryModel.destroy(query)
  }

  static removeOldHistory (beforeDate: string) {
    const query: DestroyOptions = {
      where: {
        updatedAt: {
          [Op.lt]: beforeDate
        }
      }
    }

    return UserVideoHistoryModel.destroy(query)
  }
}
