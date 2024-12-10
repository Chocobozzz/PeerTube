import { NgFor, NgIf } from '@angular/common'
import { Component, OnInit } from '@angular/core'
import { FormsModule, ReactiveFormsModule } from '@angular/forms'
import { ActivatedRoute, Router } from '@angular/router'
import { ConfigService } from '@app/+admin/config/shared/config.service'
import { Notifier } from '@app/core'
import { ServerService } from '@app/core/server/server.service'
import {
  ADMIN_EMAIL_VALIDATOR,
  CACHE_SIZE_VALIDATOR,
  CONCURRENCY_VALIDATOR,
  EXPORT_EXPIRATION_VALIDATOR,
  EXPORT_MAX_USER_VIDEO_QUOTA_VALIDATOR,
  INDEX_URL_VALIDATOR,
  INSTANCE_NAME_VALIDATOR,
  INSTANCE_SHORT_DESCRIPTION_VALIDATOR,
  MAX_INSTANCE_LIVES_VALIDATOR,
  MAX_LIVE_DURATION_VALIDATOR,
  MAX_SYNC_PER_USER,
  MAX_USER_LIVES_VALIDATOR,
  MAX_VIDEO_CHANNELS_PER_USER_VALIDATOR,
  SEARCH_INDEX_URL_VALIDATOR,
  SERVICES_TWITTER_USERNAME_VALIDATOR,
  SIGNUP_LIMIT_VALIDATOR,
  SIGNUP_MINIMUM_AGE_VALIDATOR,
  TRANSCODING_MAX_FPS_VALIDATOR,
  TRANSCODING_THREADS_VALIDATOR
} from '@app/shared/form-validators/custom-config-validators'
import { USER_VIDEO_QUOTA_DAILY_VALIDATOR, USER_VIDEO_QUOTA_VALIDATOR } from '@app/shared/form-validators/user-validators'
import { FormReactive } from '@app/shared/shared-forms/form-reactive'
import { FormReactiveService } from '@app/shared/shared-forms/form-reactive.service'
import { AlertComponent } from '@app/shared/shared-main/common/alert.component'
import { CustomPageService } from '@app/shared/shared-main/custom-page/custom-page.service'
import { NgbNav, NgbNavContent, NgbNavItem, NgbNavLink, NgbNavLinkBase, NgbNavOutlet } from '@ng-bootstrap/ng-bootstrap'
import { CustomConfig, CustomPage, HTMLServerConfig } from '@peertube/peertube-models'
import merge from 'lodash-es/merge'
import omit from 'lodash-es/omit'
import { forkJoin } from 'rxjs'
import { SelectOptionsItem } from 'src/types/select-options-item.model'
import { EditAdvancedConfigurationComponent } from './edit-advanced-configuration.component'
import { EditBasicConfigurationComponent } from './edit-basic-configuration.component'
import { EditConfigurationService } from './edit-configuration.service'
import { EditHomepageComponent } from './edit-homepage.component'
import { EditInstanceInformationComponent } from './edit-instance-information.component'
import { EditLiveConfigurationComponent } from './edit-live-configuration.component'
import { EditVODTranscodingComponent } from './edit-vod-transcoding.component'

type ComponentCustomConfig = CustomConfig & {
  instanceCustomHomepage: CustomPage
}

@Component({
  selector: 'my-edit-custom-config',
  templateUrl: './edit-custom-config.component.html',
  styleUrls: [ './edit-custom-config.component.scss' ],
  standalone: true,
  imports: [
    NgIf,
    FormsModule,
    ReactiveFormsModule,
    NgbNav,
    NgbNavItem,
    NgbNavLink,
    NgbNavLinkBase,
    NgbNavContent,
    EditHomepageComponent,
    EditInstanceInformationComponent,
    EditBasicConfigurationComponent,
    EditVODTranscodingComponent,
    EditLiveConfigurationComponent,
    EditAdvancedConfigurationComponent,
    NgbNavOutlet,
    NgFor,
    AlertComponent
  ]
})
export class EditCustomConfigComponent extends FormReactive implements OnInit {
  activeNav: string

  customConfig: ComponentCustomConfig
  serverConfig: HTMLServerConfig

  homepage: CustomPage

  languageItems: SelectOptionsItem[] = []
  categoryItems: SelectOptionsItem[] = []

  constructor (
    protected formReactiveService: FormReactiveService,
    private router: Router,
    private route: ActivatedRoute,
    private notifier: Notifier,
    private configService: ConfigService,
    private customPage: CustomPageService,
    private serverService: ServerService,
    private editConfigurationService: EditConfigurationService
  ) {
    super()
  }

  ngOnInit () {
    this.serverConfig = this.serverService.getHTMLConfig()

    const formGroupData: { [key in keyof ComponentCustomConfig ]: any } = {
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
          username: SERVICES_TWITTER_USERNAME_VALIDATOR
        }
      },
      client: {
        videos: {
          miniature: {
            preferAuthorDisplayName: null
          }
        },
        menu: {
          login: {
            redirectOnSingleExternalAuth: null
          }
        }
      },
      cache: {
        previews: {
          size: CACHE_SIZE_VALIDATOR
        },
        captions: {
          size: CACHE_SIZE_VALIDATOR
        },
        torrents: {
          size: CACHE_SIZE_VALIDATOR
        },
        storyboards: {
          size: CACHE_SIZE_VALIDATOR
        }
      },
      signup: {
        enabled: null,
        limit: SIGNUP_LIMIT_VALIDATOR,
        requiresApproval: null,
        requiresEmailVerification: null,
        minimumAge: SIGNUP_MINIMUM_AGE_VALIDATOR
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
        },
        videoChannelSynchronization: {
          enabled: null,
          maxPerUser: MAX_SYNC_PER_USER

        },
        users: {
          enabled: null
        }
      },
      export: {
        users: {
          enabled: null,
          maxUserVideoQuota: EXPORT_MAX_USER_VIDEO_QUOTA_VALIDATOR,
          exportExpiration: EXPORT_EXPIRATION_VALIDATOR
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
        history: {
          videos: {
            enabled: null
          }
        },
        videoQuota: USER_VIDEO_QUOTA_VALIDATOR,
        videoQuotaDaily: USER_VIDEO_QUOTA_DAILY_VALIDATOR
      },
      videoChannels: {
        maxPerUser: MAX_VIDEO_CHANNELS_PER_USER_VALIDATOR
      },
      transcoding: {
        enabled: null,
        threads: TRANSCODING_THREADS_VALIDATOR,
        allowAdditionalExtensions: null,
        allowAudioFiles: null,
        profile: null,
        concurrency: CONCURRENCY_VALIDATOR,
        resolutions: {},
        alwaysTranscodeOriginalResolution: null,
        originalFile: {
          keep: null
        },
        hls: {
          enabled: null,
          splitAudioAndVideo: null
        },
        webVideos: {
          enabled: null
        },
        remoteRunners: {
          enabled: null
        },
        fps: {
          max: TRANSCODING_MAX_FPS_VALIDATOR
        }
      },
      live: {
        enabled: null,

        maxDuration: MAX_LIVE_DURATION_VALIDATOR,
        maxInstanceLives: MAX_INSTANCE_LIVES_VALIDATOR,
        maxUserLives: MAX_USER_LIVES_VALIDATOR,
        allowReplay: null,
        latencySetting: {
          enabled: null
        },

        transcoding: {
          enabled: null,
          threads: TRANSCODING_THREADS_VALIDATOR,
          profile: null,
          resolutions: {},
          alwaysTranscodeOriginalResolution: null,
          remoteRunners: {
            enabled: null
          },
          fps: {
            max: TRANSCODING_MAX_FPS_VALIDATOR
          }
        }
      },
      videoStudio: {
        enabled: null,
        remoteRunners: {
          enabled: null
        }
      },
      videoTranscription: {
        enabled: null,
        remoteRunners: {
          enabled: null
        }
      },
      videoFile: {
        update: {
          enabled: null
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
      },

      instanceCustomHomepage: {
        content: null
      },

      storyboards: {
        enabled: null
      }
    }

    const defaultValues = {
      transcoding: {
        resolutions: {} as { [id: string]: string }
      },
      live: {
        transcoding: {
          resolutions: {} as { [id: string]: string }
        }
      }
    }

    for (const resolution of this.editConfigurationService.getTranscodingResolutions()) {
      defaultValues.transcoding.resolutions[resolution.id] = 'false'
      formGroupData.transcoding.resolutions[resolution.id] = null

      defaultValues.live.transcoding.resolutions[resolution.id] = 'false'
      formGroupData.live.transcoding.resolutions[resolution.id] = null
    }

    this.buildForm(formGroupData)

    if (this.route.snapshot.fragment) {
      this.onNavChange(this.route.snapshot.fragment)
    }

    this.loadConfigAndUpdateForm()
    this.loadCategoriesAndLanguages()

    if (!this.isUpdateAllowed()) {
      this.form.disable()
    }
  }

  formValidated () {
    this.forceCheck()
    if (!this.form.valid) return

    const value: ComponentCustomConfig = merge(this.customConfig, this.form.getRawValue())

    forkJoin([
      this.configService.updateCustomConfig(omit(value, 'instanceCustomHomepage')),
      this.customPage.updateInstanceHomepage(value.instanceCustomHomepage.content)
    ])
      .subscribe({
        next: ([ resConfig ]) => {
          const instanceCustomHomepage = { content: value.instanceCustomHomepage.content }

          this.customConfig = { ...resConfig, instanceCustomHomepage }

          // Reload general configuration
          this.serverService.resetConfig()
            .subscribe(config => {
              this.serverConfig = config
            })

          this.updateForm()

          this.notifier.success($localize`Configuration updated.`)
        },

        error: err => this.notifier.error(err.message)
      })
  }

  isUpdateAllowed () {
    return this.serverConfig.webadmin.configuration.edition.allowed === true
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
    forkJoin([
      this.configService.getCustomConfig(),
      this.customPage.getInstanceHomepage()
    ]).subscribe({
      next: ([ config, homepage ]) => {
        this.customConfig = { ...config, instanceCustomHomepage: homepage }

        this.updateForm()
        this.markAllAsDirty()
      },

      error: err => this.notifier.error(err.message)
    })
  }

  private loadCategoriesAndLanguages () {
    forkJoin([
      this.serverService.getVideoLanguages(),
      this.serverService.getVideoCategories()
    ]).subscribe({
      next: ([ languages, categories ]) => {
        this.languageItems = languages.map(l => ({ label: l.label, id: l.id }))
        this.categoryItems = categories.map(l => ({ label: l.label, id: l.id }))
      },

      error: err => this.notifier.error(err.message)
    })
  }
}
