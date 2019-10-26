import { Component, OnInit } from '@angular/core'
import { ConfigService } from '@app/+admin/config/shared/config.service'
import { ServerService } from '@app/core/server/server.service'
import { CustomConfigValidatorsService, FormReactive, UserValidatorsService } from '@app/shared'
import { Notifier } from '@app/core'
import { CustomConfig } from '../../../../../../shared/models/server/custom-config.model'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { FormValidatorService } from '@app/shared/forms/form-validators/form-validator.service'
import { SelectItem } from 'primeng/api'
import { forkJoin } from 'rxjs'
import { first } from 'rxjs/operators'

@Component({
  selector: 'my-edit-custom-config',
  templateUrl: './edit-custom-config.component.html',
  styleUrls: [ './edit-custom-config.component.scss' ]
})
export class EditCustomConfigComponent extends FormReactive implements OnInit {
  customConfig: CustomConfig

  resolutions: { id: string, label: string }[] = []
  transcodingThreadOptions: { label: string, value: number }[] = []

  languageItems: SelectItem[] = []
  categoryItems: SelectItem[] = []

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
      {
        id: '240p',
        label: this.i18n('240p')
      },
      {
        id: '360p',
        label: this.i18n('360p')
      },
      {
        id: '480p',
        label: this.i18n('480p')
      },
      {
        id: '720p',
        label: this.i18n('720p')
      },
      {
        id: '1080p',
        label: this.i18n('1080p')
      },
      {
        id: '2160p',
        label: this.i18n('2160p')
      }
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

  get availableThemes () {
    return this.serverService.getConfig().theme.registered
      .map(t => t.name)
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

        isNSFW: false,
        defaultNSFWPolicy: null,

        terms: null,
        codeOfConduct: null,

        creationReason: null,
        moderationInformation: null,
        administrator: null,
        maintenanceLifetime: null,
        businessModel: null,

        hardwareInformation: null,

        categories: null,
        languages: null,

        defaultClientRoute: null,

        customizations: {
          javascript: null,
          css: null
        }
      },
      theme: {
        default: null
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
        allowAudioFiles: null,
        resolutions: {}
      },
      autoBlacklist: {
        videos: {
          ofUsers: {
            enabled: null
          }
        }
      },
      followers: {
        instance: {
          enabled: null,
          manualApproval: null
        }
      },
      followings: {
        instance: {
          autoFollowBack: {
            enabled: null
          },
          autoFollowIndex: {
            enabled: null,
            indexUrl: this.customConfigValidatorsService.INDEX_URL
          }
        }
      }
    }

    const defaultValues = {
      transcoding: {
        resolutions: {}
      }
    }
    for (const resolution of this.resolutions) {
      defaultValues.transcoding.resolutions[resolution.id] = 'false'
      formGroupData.transcoding.resolutions[resolution.id] = null
    }

    this.buildForm(formGroupData)

    forkJoin([
      this.configService.getCustomConfig(),
      this.serverService.videoLanguagesLoaded.pipe(first()), // First so the observable completes
      this.serverService.videoCategoriesLoaded.pipe(first())
    ]).subscribe(
      ([ config ]) => {
        this.customConfig = config

        const languages = this.serverService.getVideoLanguages()
        this.languageItems = languages.map(l => ({ label: l.label, value: l.id }))

        const categories = this.serverService.getVideoCategories()
        this.categoryItems = categories.map(l => ({ label: l.label, value: l.id }))

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

  getSelectedLanguageLabel () {
    return this.i18n('{{\'{0} languages selected')
  }

  getDefaultLanguageLabel () {
    return this.i18n('No language')
  }

  getSelectedCategoryLabel () {
    return this.i18n('{{\'{0} categories selected')
  }

  getDefaultCategoryLabel () {
    return this.i18n('No category')
  }

  private updateForm () {
    this.form.patchValue(this.customConfig)
  }
}
