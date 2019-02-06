import { Component, OnInit } from '@angular/core'
import { ConfigService } from '@app/+admin/config/shared/config.service'
import { ServerService } from '@app/core/server/server.service'
import { CustomConfigValidatorsService, FormReactive, UserValidatorsService } from '@app/shared'
import { Notifier } from '@app/core'
import { CustomConfig } from '../../../../../../shared/models/server/custom-config.model'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { BuildFormDefaultValues, FormValidatorService } from '@app/shared/forms/form-validators/form-validator.service'

@Component({
  selector: 'my-edit-custom-config',
  templateUrl: './edit-custom-config.component.html',
  styleUrls: [ './edit-custom-config.component.scss' ]
})
export class EditCustomConfigComponent extends FormReactive implements OnInit {
  customConfig: CustomConfig

  resolutions: string[] = []
  transcodingThreadOptions: { label: string, value: number }[] = []

  constructor (
    protected formValidatorService: FormValidatorService,
    private customConfigValidatorsService: CustomConfigValidatorsService,
    private userValidatorsService: UserValidatorsService,
    private notifier: Notifier,
    private configService: ConfigService,
    private serverService: ServerService,
    private i18n: I18n
  ) {
    super()

    this.resolutions = [
      this.i18n('240p'),
      this.i18n('360p'),
      this.i18n('480p'),
      this.i18n('720p'),
      this.i18n('1080p')
    ]

    this.transcodingThreadOptions = [
      { value: 0, label: this.i18n('Auto (via ffmpeg)') },
      { value: 1, label: '1' },
      { value: 2, label: '2' },
      { value: 4, label: '4' },
      { value: 8, label: '8' }
    ]
  }

  get videoQuotaOptions () {
    return this.configService.videoQuotaOptions
  }

  get videoQuotaDailyOptions () {
    return this.configService.videoQuotaDailyOptions
  }

  getResolutionKey (resolution: string) {
    return 'transcoding.resolutions.' + resolution
  }

  ngOnInit () {
    const formGroupData: { [key in keyof CustomConfig ]: any } = {
      instance: {
        name: this.customConfigValidatorsService.INSTANCE_NAME,
        shortDescription: this.customConfigValidatorsService.INSTANCE_SHORT_DESCRIPTION,
        description: null,
        terms: null,
        defaultClientRoute: null,
        defaultNSFWPolicy: null,
        customizations: {
          javascript: null,
          css: null
        }
      },
      services: {
        twitter: {
          username: this.customConfigValidatorsService.SERVICES_TWITTER_USERNAME,
          whitelisted: null
        }
      },
      cache: {
        previews: {
          size: this.customConfigValidatorsService.CACHE_PREVIEWS_SIZE
        },
        captions: {
          size: this.customConfigValidatorsService.CACHE_CAPTIONS_SIZE
        }
      },
      signup: {
        enabled: null,
        limit: this.customConfigValidatorsService.SIGNUP_LIMIT,
        requiresEmailVerification: null
      },
      import: {
        videos: {
          http: {
            enabled: null
          },
          torrent: {
            enabled: null
          }
        }
      },
      admin: {
        email: this.customConfigValidatorsService.ADMIN_EMAIL
      },
      contactForm: {
        enabled: null
      },
      user: {
        videoQuota: this.userValidatorsService.USER_VIDEO_QUOTA,
        videoQuotaDaily: this.userValidatorsService.USER_VIDEO_QUOTA_DAILY
      },
      transcoding: {
        enabled: null,
        threads: this.customConfigValidatorsService.TRANSCODING_THREADS,
        allowAdditionalExtensions: null,
        resolutions: {}
      }
    }

    const defaultValues = {
      transcoding: {
        resolutions: {}
      }
    }
    for (const resolution of this.resolutions) {
      defaultValues.transcoding.resolutions[resolution] = 'false'
      formGroupData.transcoding.resolutions[resolution] = null
    }

    this.buildForm(formGroupData)

    this.configService.getCustomConfig()
      .subscribe(
        res => {
          this.customConfig = res

          this.updateForm()
          // Force form validation
          this.forceCheck()
        },

        err => this.notifier.error(err.message)
      )
  }

  isTranscodingEnabled () {
    return this.form.value['transcoding']['enabled'] === true
  }

  isSignupEnabled () {
    return this.form.value['signup']['enabled'] === true
  }

  async formValidated () {
    this.configService.updateCustomConfig(this.form.value)
      .subscribe(
        res => {
          this.customConfig = res

          // Reload general configuration
          this.serverService.loadConfig()

          this.updateForm()

          this.notifier.success(this.i18n('Configuration updated.'))
        },

        err => this.notifier.error(err.message)
      )
  }

  private updateForm () {
    this.form.patchValue(this.customConfig)
  }

}
