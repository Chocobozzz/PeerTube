import { DestroyOptions, Op, Transaction } from 'sequelize'
import { AllowNull, BelongsTo, Column, CreatedAt, ForeignKey, IsInt, Model, Table, UpdatedAt } from 'sequelize-typescript'
import { MUserAccountId, MUserId } from '@server/types/models'
import { AttributesOnly } from '@shared/core-utils'
import { VideoModel } from '../video/video'
import { UserModel } from './user'

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
export class UserVideoHistoryModel extends Model<Partial<AttributesOnly<UserVideoHistoryModel>>> {
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
  Video: VideoModel

  @ForeignKey(() => UserModel)
  @Column
  userId: number

  @BelongsTo(() => UserModel, {
    foreignKey: {
      allowNull: false
    },
    onDelete: 'CASCADE'
  })
  User: UserModel

  static listForApi (user: MUserAccountId, start: number, count: number, search?: string) {
    return VideoModel.listForApi({
      start,
      count,
      search,
      sort: '-"userVideoHistory"."updatedAt"',
      nsfw: null, // All
      includeLocalVideos: true,
      withFiles: false,
      user,
      historyOfUser: user
    })
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
