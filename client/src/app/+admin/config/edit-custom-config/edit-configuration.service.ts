import { Injectable } from '@angular/core'
import { FormGroup } from '@angular/forms'
import { formatICU } from '@app/helpers'

export type ResolutionOption = {
  id: string
  label: string
  description?: string
}

@Injectable()
export class EditConfigurationService {

  getTranscodingResolutions () {
    return [
      {
        id: '0p',
        label: $localize`Audio-only`,
        // eslint-disable-next-line max-len
        description: $localize`"Split audio and video" must be enabled for the PeerTube player to propose an "Audio only" resolution to users`
      },
      {
        id: '144p',
        label: $localize`144p`
      },
      {
        id: '240p',
        label: $localize`240p`
      },
      {
        id: '360p',
        label: $localize`360p`
      },
      {
        id: '480p',
        label: $localize`480p`
      },
      {
        id: '720p',
        label: $localize`720p`
      },
      {
        id: '1080p',
        label: $localize`1080p`
      },
      {
        id: '1440p',
        label: $localize`1440p`
      },
      {
        id: '2160p',
        label: $localize`2160p`
      }
    ]
  }

  isTranscodingEnabled (form: FormGroup) {
    return form.value['transcoding']['enabled'] === true
  }

  isHLSEnabled (form: FormGroup) {
    return form.value['transcoding']['hls']['enabled'] === true
  }

  isRemoteRunnerVODEnabled (form: FormGroup) {
    return form.value['transcoding']['remoteRunners']['enabled'] === true
  }

  isRemoteRunnerLiveEnabled (form: FormGroup) {
    return form.value['live']['transcoding']['remoteRunners']['enabled'] === true
  }

  isStudioEnabled (form: FormGroup) {
    return form.value['videoStudio']['enabled'] === true
  }

  isLiveEnabled (form: FormGroup) {
    return form.value['live']['enabled'] === true
  }

  isLiveTranscodingEnabled (form: FormGroup) {
    return form.value['live']['transcoding']['enabled'] === true
  }

  getTotalTranscodingThreads (form: FormGroup) {
    const transcodingEnabled = form.value['transcoding']['enabled']
    const transcodingThreads = form.value['transcoding']['threads']
    const liveTranscodingEnabled = form.value['live']['transcoding']['enabled']
    const liveTranscodingThreads = form.value['live']['transcoding']['threads']

    // checks whether all enabled method are on fixed values and not on auto (= 0)
    let noneOnAuto = !transcodingEnabled || +transcodingThreads > 0
    noneOnAuto &&= !liveTranscodingEnabled || +liveTranscodingThreads > 0

    // count total of fixed value, repalcing auto by a single thread (knowing it will display "at least")
    let value = 0
    if (transcodingEnabled) value += +transcodingThreads || 1
    if (liveTranscodingEnabled) value += +liveTranscodingThreads || 1

    return {
      value,
      atMost: noneOnAuto, // auto switches everything to a least estimation since ffmpeg will take as many threads as possible
      unit: formatICU($localize`{value, plural, =1 {thread} other {threads}}`, { value })
    }
  }
}
