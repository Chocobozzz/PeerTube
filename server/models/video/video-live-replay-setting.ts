import { isVideoPrivacyValid } from '@server/helpers/custom-validators/videos'
import { MLiveReplaySetting } from '@server/types/models/video/video-live-replay-setting'
import { VideoPrivacy } from '@shared/models/videos/video-privacy.enum'
import { Transaction } from 'sequelize'
import { AllowNull, Column, CreatedAt, Is, Model, Table, UpdatedAt } from 'sequelize-typescript'
import { throwIfNotValid } from '../shared/sequelize-helpers'

@Table({
  tableName: 'videoLiveReplaySetting'
})
export class VideoLiveReplaySettingModel extends Model<VideoLiveReplaySettingModel> {

  @CreatedAt
  createdAt: Date

  @UpdatedAt
  updatedAt: Date

  @AllowNull(false)
  @Is('VideoPrivacy', value => throwIfNotValid(value, isVideoPrivacyValid, 'privacy'))
  @Column
  privacy: VideoPrivacy

  static load (id: number, transaction?: Transaction): Promise<MLiveReplaySetting> {
    return VideoLiveReplaySettingModel.findOne({
      where: { id },
      transaction
    })
  }

  static removeSettings (id: number) {
    return VideoLiveReplaySettingModel.destroy({
      where: { id }
    })
  }

  toFormattedJSON () {
    return {
      privacy: this.privacy
    }
  }
}
