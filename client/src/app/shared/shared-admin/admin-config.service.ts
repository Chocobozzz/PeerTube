import { HttpClient } from '@angular/common/http'
import { Injectable, inject } from '@angular/core'
import { FormControl, FormGroup } from '@angular/forms'
import { Notifier, RestExtractor, ServerService } from '@app/core'
import { formatICU } from '@app/helpers'
import { BuildFormValidator } from '@app/shared/form-validators/form-validator.model'
import { CustomConfig } from '@peertube/peertube-models'
import { DeepPartial } from '@peertube/peertube-typescript-utils'
import mergeWith from 'lodash-es/mergeWith'
import { catchError, map, switchMap } from 'rxjs/operators'
import { environment } from '../../../environments/environment'
import { SelectOptionsItem } from '../../../types/select-options-item.model'

export type FormResolutions = {
  '0p': FormControl<boolean>
  '144p': FormControl<boolean>
  '240p': FormControl<boolean>
  '360p': FormControl<boolean>
  '480p': FormControl<boolean>
  '720p': FormControl<boolean>
  '1080p': FormControl<boolean>
  '1440p': FormControl<boolean>
  '2160p': FormControl<boolean>
}

export type ResolutionOption = { id: keyof FormResolutions, label: string, description?: string }

@Injectable()
export class AdminConfigService {
  private authHttp = inject(HttpClient)
  private restExtractor = inject(RestExtractor)
  private notifier = inject(Notifier)
  private serverService = inject(ServerService)

  private static BASE_APPLICATION_URL = environment.apiUrl + '/api/v1/config'

  transcodingThreadOptions: SelectOptionsItem[] = []

  constructor () {
    this.transcodingThreadOptions = [
      { id: 0, label: $localize`Auto (via ffmpeg)` },
      { id: 1, label: '1' },
      { id: 2, label: '2' },
      { id: 4, label: '4' },
      { id: 8, label: '8' },
      { id: 12, label: '12' },
      { id: 16, label: '16' },
      { id: 32, label: '32' }
    ]
  }

  // ---------------------------------------------------------------------------

  getTranscodingOptions (type: 'live' | 'vod'): ResolutionOption[] {
    return [
      {
        id: '0p',
        label: $localize`Audio-only`,
        description: type === 'vod'
          ? $localize`"Split audio and video" must be enabled for the PeerTube player to propose an "Audio only" resolution to users`
          : undefined
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

  // ---------------------------------------------------------------------------

  getCustomConfig () {
    return this.authHttp.get<CustomConfig>(AdminConfigService.BASE_APPLICATION_URL + '/custom')
      .pipe(catchError(res => this.restExtractor.handleError(res)))
  }

  updateCustomConfig (partialConfig: DeepPartial<CustomConfig>) {
    return this.getCustomConfig()
      .pipe(
        switchMap(customConfig => {
          const newConfig = mergeWith(customConfig, partialConfig, (objValue, srcValue) => {
            // We want to replace arrays, not merge them
            if (Array.isArray(srcValue)) return srcValue

            return undefined
          })

          return this.authHttp.put<CustomConfig>(AdminConfigService.BASE_APPLICATION_URL + '/custom', newConfig)
            .pipe(map(() => newConfig))
        }),
        catchError(res => this.restExtractor.handleError(res))
      )
  }

  getCustomConfigReloadedObs () {
    return this.serverService.configReloaded
      .pipe(switchMap(() => this.getCustomConfig()))
  }

  saveAndUpdateCurrent (options: {
    currentConfig: CustomConfig
    form: FormGroup
    formConfig: DeepPartial<CustomConfig>
    success: string
  }) {
    const { currentConfig, form, formConfig, success } = options

    this.updateCustomConfig(formConfig)
      .subscribe({
        next: newConfig => {
          this.serverService.resetConfig()

          Object.assign(currentConfig, newConfig)

          form.markAsPristine()

          this.notifier.success(success)
        },

        error: err => this.notifier.error(err.message)
      })
  }

  // ---------------------------------------------------------------------------

  buildFormResolutions (type: 'live' | 'vod') {
    const formResolutions = {} as Record<keyof FormResolutions, BuildFormValidator>

    for (const resolution of this.getTranscodingOptions(type)) {
      formResolutions[resolution.id] = null
    }

    return formResolutions
  }

  buildTranscodingProfiles (profiles: string[]) {
    return profiles.map(p => {
      if (p === 'default') {
        return { id: p, label: $localize`Default`, description: $localize`x264, targeting maximum device compatibility` }
      }

      return { id: p, label: p }
    })
  }

  getTotalTranscodingThreads (options: {
    transcoding: {
      enabled: boolean
      threads: number
    }
    live: {
      transcoding: {
        enabled: boolean
        threads: number
      }
    }
  }) {
    const transcodingEnabled = options.transcoding.enabled
    const transcodingThreads = options.transcoding.threads
    const liveTranscodingEnabled = options.live.transcoding.enabled
    const liveTranscodingThreads = options.live.transcoding.threads

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

  checkTranscodingConsistentOptions (options: {
    transcoding: {
      enabled: boolean
    }
    live: {
      enabled: boolean
      allowReplay: boolean
    }
  }) {
    if (
      options.transcoding.enabled === false &&
      options.live.enabled === true && options.live.allowReplay === true
    ) {
      return $localize`You cannot allow live replay if you don't enable transcoding.`
    }

    return undefined
  }
}
