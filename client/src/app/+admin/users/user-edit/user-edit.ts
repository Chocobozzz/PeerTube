import { ServerService } from '../../../core'
import { FormReactive } from '../../../shared'
import { USER_ROLE_LABELS, VideoResolution } from '../../../../../../shared'
import { EditCustomConfigComponent } from '../../../+admin/config/edit-custom-config/'

export abstract class UserEdit extends FormReactive {

  // These are used by a HTML select, so convert key into strings
  videoQuotaOptions = EditCustomConfigComponent.videoQuotaOptions
    .map(q => ({ value: q.value.toString(), label: q.label }))
  videoQuotaDailyOptions = EditCustomConfigComponent.videoQuotaDailyOptions
    .map(q => ({ value: q.value.toString(), label: q.label }))

  roles = Object.keys(USER_ROLE_LABELS).map(key => ({ value: key.toString(), label: USER_ROLE_LABELS[key] }))

  protected abstract serverService: ServerService
  abstract isCreation (): boolean
  abstract getFormButtonTitle (): string

  isTranscodingInformationDisplayed () {
    const formVideoQuota = parseInt(this.form.value['videoQuota'], 10)

    return this.serverService.getConfig().transcoding.enabledResolutions.length !== 0 &&
           formVideoQuota > 0
  }

  computeQuotaWithTranscoding () {
    const resolutions = this.serverService.getConfig().transcoding.enabledResolutions
    const higherResolution = VideoResolution.H_1080P
    let multiplier = 0

    for (const resolution of resolutions) {
      multiplier += resolution / higherResolution
    }

    return multiplier * parseInt(this.form.value['videoQuota'], 10)
  }
}
