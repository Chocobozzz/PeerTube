import { type VideoPrivacyType } from '@peertube/peertube-models'
import { isVideoPrivacyValid } from '@server/helpers/custom-validators/videos.js'
import { MLiveReplaySetting } from '@server/types/models/video/video-live-replay-setting.js'
import { Transaction } from 'sequelize'
import { AllowNull, Column, CreatedAt, Is, Table, UpdatedAt } from 'sequelize-typescript'
import { throwIfNotValid } from '../shared/sequelize-helpers.js'
import { SequelizeModel } from '../shared/index.js'

@Table({
  tableName: 'videoLiveReplaySetting'
})
export class VideoLiveReplaySettingModel extends SequelizeModel<VideoLiveReplaySettingModel> {
  @CreatedAt
  declare createdAt: Date

  @UpdatedAt
  declare updatedAt: Date

  @AllowNull(false)
  @Is('VideoPrivacy', value => throwIfNotValid(value, isVideoPrivacyValid, 'privacy'))
  @Column
  declare privacy: VideoPrivacyType

  static load (id: number, transaction?: Transaction): Promise<MLiveReplaySetting> {
    return VideoLiveReplaySettingModel.findOne({
      where: { id },
      transaction
    })
  }

  static removeSettings (id: number, transaction?: Transaction) {
    return VideoLiveReplaySettingModel.destroy({
      where: { id },
      transaction
    })
  }

  toFormattedJSON () {
    return {
      privacy: this.privacy
    }
  }
}
