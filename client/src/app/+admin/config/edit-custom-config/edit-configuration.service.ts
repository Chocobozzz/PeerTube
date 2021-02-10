import { Injectable } from '@angular/core'
import { FormGroup } from '@angular/forms'

export type ResolutionOption = {
  id: string
  label: string
  description?: string
}

@Injectable()
export class EditConfigurationService {

  getVODResolutions () {
    return [
      {
        id: '0p',
        label: $localize`Audio-only`,
        description: $localize`A <code>.mp4</code> that keeps the original audio track, with no video`
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

  getLiveResolutions () {
    return this.getVODResolutions().filter(r => r.id !== '0p')
  }

  isTranscodingEnabled (form: FormGroup) {
    return form.value['transcoding']['enabled'] === true
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
      unit: value > 1
        ? $localize`threads`
        : $localize`thread`
    }
  }
}
