
import { forkJoin } from 'rxjs'
import { SelectOptionsItem } from 'src/types/select-options-item.model'
import { Component, OnInit } from '@angular/core'
import { ActivatedRoute, Router } from '@angular/router'
import { ConfigService } from '@app/+admin/config/shared/config.service'
import { Notifier } from '@app/core'
import { ServerService } from '@app/core/server/server.service'
import {
  ADMIN_EMAIL_VALIDATOR,
  CACHE_CAPTIONS_SIZE_VALIDATOR,
  CACHE_PREVIEWS_SIZE_VALIDATOR,
  CONCURRENCY_VALIDATOR,
  INDEX_URL_VALIDATOR,
  INSTANCE_NAME_VALIDATOR,
  INSTANCE_SHORT_DESCRIPTION_VALIDATOR,
  MAX_INSTANCE_LIVES_VALIDATOR,
  MAX_LIVE_DURATION_VALIDATOR,
  MAX_USER_LIVES_VALIDATOR,
  SEARCH_INDEX_URL_VALIDATOR,
  SERVICES_TWITTER_USERNAME_VALIDATOR,
  SIGNUP_LIMIT_VALIDATOR,
  TRANSCODING_THREADS_VALIDATOR
} from '@app/shared/form-validators/custom-config-validators'
import { USER_VIDEO_QUOTA_DAILY_VALIDATOR, USER_VIDEO_QUOTA_VALIDATOR } from '@app/shared/form-validators/user-validators'
import { FormReactive, FormValidatorService } from '@app/shared/shared-forms'
import { CustomConfig, ServerConfig } from '@shared/models'
import { EditConfigurationService } from './edit-configuration.service'

@Component({
  selector: 'my-edit-custom-config',
  templateUrl: './edit-custom-config.component.html',
  styleUrls: [ './edit-custom-config.component.scss' ]
})
export class EditCustomConfigComponent extends FormReactive implements OnInit {
  activeNav: string

  customConfig: CustomConfig
  serverConfig: ServerConfig

  languageItems: SelectOptionsItem[] = []
  categoryItems: SelectOptionsItem[] = []

  constructor (
    private router: Router,
    private route: ActivatedRoute,
    protected formValidatorService: FormValidatorService,
    private notifier: Notifier,
    private configService: ConfigService,
    private serverService: ServerService,
    private editConfigurationService: EditConfigurationService
  ) {
    super()
  }

  ngOnInit () {
    this.serverConfig = this.serverService.getTmpConfig()
    this.serverService.getConfig()
        .subscribe(config => {
          this.serverConfig = config
        })

    const formGroupData: { [key in keyof CustomConfig ]: any } = {
      instance: {
        name: INSTANCE_NAME_VALIDATOR,
        shortDescription: INSTANCE_SHORT_DESCRIPTION_VALIDATOR,
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
          username: SERVICES_TWITTER_USERNAME_VALIDATOR,
          whitelisted: null
        }
      },
      cache: {
        previews: {
          size: CACHE_PREVIEWS_SIZE_VALIDATOR
        },
        captions: {
          size: CACHE_CAPTIONS_SIZE_VALIDATOR
        }
      },
      signup: {
        enabled: null,
        limit: SIGNUP_LIMIT_VALIDATOR,
        requiresEmailVerification: null
      },
      import: {
        videos: {
          concurrency: CONCURRENCY_VALIDATOR,
          http: {
            enabled: null
          },
          torrent: {
            enabled: null
          }
        }
      },
      trending: {
        videos: {
          algorithms: {
            enabled: null,
            default: null
          }
        }
      },
      admin: {
        email: ADMIN_EMAIL_VALIDATOR
      },
      contactForm: {
        enabled: null
      },
      user: {
        videoQuota: USER_VIDEO_QUOTA_VALIDATOR,
        videoQuotaDaily: USER_VIDEO_QUOTA_DAILY_VALIDATOR
      },
      transcoding: {
        enabled: null,
        threads: TRANSCODING_THREADS_VALIDATOR,
        allowAdditionalExtensions: null,
        allowAudioFiles: null,
        profile: null,
        concurrency: CONCURRENCY_VALIDATOR,
        resolutions: {},
        hls: {
          enabled: null
        },
        webtorrent: {
          enabled: null
        }
      },
      live: {
        enabled: null,

        maxDuration: MAX_LIVE_DURATION_VALIDATOR,
        maxInstanceLives: MAX_INSTANCE_LIVES_VALIDATOR,
        maxUserLives: MAX_USER_LIVES_VALIDATOR,
        allowReplay: null,

        transcoding: {
          enabled: null,
          threads: TRANSCODING_THREADS_VALIDATOR,
          profile: null,
          resolutions: {}
        }
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
            indexUrl: INDEX_URL_VALIDATOR
          }
        }
      },
      broadcastMessage: {
        enabled: null,
        level: null,
        dismissable: null,
        message: null
      },
      search: {
        remoteUri: {
          users: null,
          anonymous: null
        },
        searchIndex: {
          enabled: null,
          url: SEARCH_INDEX_URL_VALIDATOR,
          disableLocalSearch: null,
          isDefaultSearch: null
        }
      }
    }

    const defaultValues = {
      transcoding: {
        resolutions: {}
      },
      live: {
        transcoding: {
          resolutions: {}
        }
      }
    }

    for (const resolution of this.editConfigurationService.getVODResolutions()) {
      defaultValues.transcoding.resolutions[resolution.id] = 'false'
      formGroupData.transcoding.resolutions[resolution.id] = null
    }

    for (const resolution of this.editConfigurationService.getLiveResolutions()) {
      defaultValues.live.transcoding.resolutions[resolution.id] = 'false'
      formGroupData.live.transcoding.resolutions[resolution.id] = null
    }

    this.buildForm(formGroupData)

    if (this.route.snapshot.fragment) {
      this.onNavChange(this.route.snapshot.fragment)
    }

    this.loadConfigAndUpdateForm()
    this.loadCategoriesAndLanguages()
  }

  async formValidated () {
    const value: CustomConfig = this.form.getRawValue()

    this.configService.updateCustomConfig(value)
      .subscribe(
        res => {
          this.customConfig = res

          // Reload general configuration
          this.serverService.resetConfig()

          this.updateForm()

          this.notifier.success($localize`Configuration updated.`)
        },

        err => this.notifier.error(err.message)
      )
  }

  hasConsistentOptions () {
    if (this.hasLiveAllowReplayConsistentOptions()) return true

    return false
  }

  hasLiveAllowReplayConsistentOptions () {
    if (
      this.editConfigurationService.isTranscodingEnabled(this.form) === false &&
      this.editConfigurationService.isLiveEnabled(this.form) &&
      this.form.value['live']['allowReplay'] === true
    ) {
      return false
    }

    return true
  }

  onNavChange (newActiveNav: string) {
    this.activeNav = newActiveNav

    this.router.navigate([], { fragment: this.activeNav })
  }

  grabAllErrors (errorObjectArg?: any) {
    const errorObject = errorObjectArg || this.formErrors

    let acc: string[] = []

    for (const key of Object.keys(errorObject)) {
      const value = errorObject[key]
      if (!value) continue

      if (typeof value === 'string') {
        acc.push(value)
      } else {
        acc = acc.concat(this.grabAllErrors(value))
      }
    }

    return acc
  }

  private updateForm () {
    this.form.patchValue(this.customConfig)
  }

  private loadConfigAndUpdateForm () {
    this.configService.getCustomConfig()
      .subscribe(config => {
        this.customConfig = config

        this.updateForm()
        // Force form validation
        this.forceCheck()
      },

      err => this.notifier.error(err.message)
    )
  }

  private loadCategoriesAndLanguages () {
    forkJoin([
      this.serverService.getVideoLanguages(),
      this.serverService.getVideoCategories()
    ]).subscribe(
      ([ languages, categories ]) => {
        this.languageItems = languages.map(l => ({ label: l.label, id: l.id }))
        this.categoryItems = categories.map(l => ({ label: l.label, id: l.id + '' }))
      },

      err => this.notifier.error(err.message)
    )
  }
}
