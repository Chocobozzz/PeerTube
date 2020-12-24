import { forkJoin } from 'rxjs'
import { ViewportScroller } from '@angular/common'
import { AfterViewChecked, Component, OnInit, ViewChild } from '@angular/core'
import { ConfigService } from '@app/+admin/config/shared/config.service'
import { Notifier } from '@app/core'
import { ServerService } from '@app/core/server/server.service'
import {
  ADMIN_EMAIL_VALIDATOR,
  CACHE_CAPTIONS_SIZE_VALIDATOR,
  CACHE_PREVIEWS_SIZE_VALIDATOR,
  INDEX_URL_VALIDATOR,
  INSTANCE_NAME_VALIDATOR,
  INSTANCE_SHORT_DESCRIPTION_VALIDATOR,
  SEARCH_INDEX_URL_VALIDATOR,
  SERVICES_TWITTER_USERNAME_VALIDATOR,
  SIGNUP_LIMIT_VALIDATOR,
  TRANSCODING_THREADS_VALIDATOR
} from '@app/shared/form-validators/custom-config-validators'
import { USER_VIDEO_QUOTA_DAILY_VALIDATOR, USER_VIDEO_QUOTA_VALIDATOR } from '@app/shared/form-validators/user-validators'
import { FormReactive, FormValidatorService, SelectOptionsItem } from '@app/shared/shared-forms'
import { NgbNav } from '@ng-bootstrap/ng-bootstrap'
import { CustomConfig, ServerConfig } from '@shared/models'
import { pairwise } from 'rxjs/operators'

@Component({
  selector: 'my-edit-custom-config',
  templateUrl: './edit-custom-config.component.html',
  styleUrls: [ './edit-custom-config.component.scss' ]
})
export class EditCustomConfigComponent extends FormReactive implements OnInit, AfterViewChecked {
  // FIXME: use built-in router
  @ViewChild('nav') nav: NgbNav

  initDone = false
  customConfig: CustomConfig

  resolutions: { id: string, label: string, description?: string }[] = []
  liveResolutions: { id: string, label: string, description?: string }[] = []
  transcodingThreadOptions: { label: string, value: number }[] = []
  liveMaxDurationOptions: { label: string, value: number }[] = []

  languageItems: SelectOptionsItem[] = []
  categoryItems: SelectOptionsItem[] = []

  signupAlertMessage: string

  private serverConfig: ServerConfig

  constructor (
    private viewportScroller: ViewportScroller,
    protected formValidatorService: FormValidatorService,
    private notifier: Notifier,
    private configService: ConfigService,
    private serverService: ServerService
  ) {
    super()

    this.resolutions = [
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

    this.liveResolutions = this.resolutions.filter(r => r.id !== '0p')

    this.transcodingThreadOptions = [
      { value: 0, label: $localize`Auto (via ffmpeg)` },
      { value: 1, label: '1' },
      { value: 2, label: '2' },
      { value: 4, label: '4' },
      { value: 8, label: '8' }
    ]

    this.liveMaxDurationOptions = [
      { value: -1, label: $localize`No limit` },
      { value: 1000 * 3600, label: $localize`1 hour` },
      { value: 1000 * 3600 * 3, label: $localize`3 hours` },
      { value: 1000 * 3600 * 5, label: $localize`5 hours` },
      { value: 1000 * 3600 * 10, label: $localize`10 hours` }
    ]
  }

  get videoQuotaOptions () {
    return this.configService.videoQuotaOptions
  }

  get videoQuotaDailyOptions () {
    return this.configService.videoQuotaDailyOptions
  }

  get availableThemes () {
    return this.serverConfig.theme.registered
      .map(t => t.name)
  }

  get liveRTMPPort () {
    return this.serverConfig.live.rtmp.port
  }

  getTotalTranscodingThreads () {
    const transcodingEnabled = this.form.value['transcoding']['enabled']
    const transcodingThreads = this.form.value['transcoding']['threads']
    const liveTranscodingEnabled = this.form.value['live']['transcoding']['enabled']
    const liveTranscodingThreads = this.form.value['live']['transcoding']['threads']

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

  getResolutionKey (resolution: string) {
    return 'transcoding.resolutions.' + resolution
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
          http: {
            enabled: null
          },
          torrent: {
            enabled: null
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

        maxDuration: null,
        maxInstanceLives: null,
        maxUserLives: null,
        allowReplay: null,

        transcoding: {
          enabled: null,
          threads: TRANSCODING_THREADS_VALIDATOR,
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

    for (const resolution of this.resolutions) {
      defaultValues.transcoding.resolutions[resolution.id] = 'false'
      formGroupData.transcoding.resolutions[resolution.id] = null
    }

    for (const resolution of this.liveResolutions) {
      defaultValues.live.transcoding.resolutions[resolution.id] = 'false'
      formGroupData.live.transcoding.resolutions[resolution.id] = null
    }

    this.buildForm(formGroupData)
    this.loadForm()

    this.checkTranscodingFields()
    this.checkSignupField()
  }

  ngAfterViewChecked () {
    if (!this.initDone) {
      this.initDone = true
      this.gotoAnchor()
    }
  }

  isTranscodingEnabled () {
    return this.form.value['transcoding']['enabled'] === true
  }

  isLiveEnabled () {
    return this.form.value['live']['enabled'] === true
  }

  isLiveTranscodingEnabled () {
    return this.form.value['live']['transcoding']['enabled'] === true
  }

  isSignupEnabled () {
    return this.form.value['signup']['enabled'] === true
  }

  isSearchIndexEnabled () {
    return this.form.value['search']['searchIndex']['enabled'] === true
  }

  isAutoFollowIndexEnabled () {
    return this.form.value['followings']['instance']['autoFollowIndex']['enabled'] === true
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

  gotoAnchor () {
    const hashToNav = {
      'customizations': 'advanced-configuration'
    }
    const hash = window.location.hash.replace('#', '')

    if (hash && Object.keys(hashToNav).includes(hash)) {
      this.nav.select(hashToNav[hash])
      setTimeout(() => this.viewportScroller.scrollToAnchor(hash), 100)
    }
  }

  hasConsistentOptions () {
    if (this.hasLiveAllowReplayConsistentOptions()) return true

    return false
  }

  hasLiveAllowReplayConsistentOptions () {
    if (this.isTranscodingEnabled() === false && this.isLiveEnabled() && this.form.value['live']['allowReplay'] === true) {
      return false
    }

    return true
  }

  private updateForm () {
    this.form.patchValue(this.customConfig)
  }

  private loadForm () {
    forkJoin([
      this.configService.getCustomConfig(),
      this.serverService.getVideoLanguages(),
      this.serverService.getVideoCategories()
    ]).subscribe(
      ([ config, languages, categories ]) => {
        this.customConfig = config

        this.languageItems = languages.map(l => ({ label: l.label, id: l.id }))
        this.categoryItems = categories.map(l => ({ label: l.label, id: l.id + '' }))

        this.updateForm()
        // Force form validation
        this.forceCheck()
      },

      err => this.notifier.error(err.message)
    )
  }

  private checkTranscodingFields () {
    const hlsControl = this.form.get('transcoding.hls.enabled')
    const webtorrentControl = this.form.get('transcoding.webtorrent.enabled')

    webtorrentControl.valueChanges
                     .subscribe(newValue => {
                       if (newValue === false && !hlsControl.disabled) {
                         hlsControl.disable()
                       }

                       if (newValue === true && !hlsControl.enabled) {
                         hlsControl.enable()
                       }
                     })

    hlsControl.valueChanges
              .subscribe(newValue => {
                if (newValue === false && !webtorrentControl.disabled) {
                  webtorrentControl.disable()
                }

                if (newValue === true && !webtorrentControl.enabled) {
                  webtorrentControl.enable()
                }
              })
  }

  private checkSignupField () {
    const signupControl = this.form.get('signup.enabled')

    signupControl.valueChanges
      .pipe(pairwise())
      .subscribe(([ oldValue, newValue ]) => {
        if (oldValue !== true && newValue === true) {
          // tslint:disable:max-line-length
          this.signupAlertMessage = $localize`You enabled signup: we automatically enabled the "Block new videos automatically" checkbox of the "Videos" section just below.`

          this.form.patchValue({
            autoBlacklist: {
              videos: {
                ofUsers: {
                  enabled: true
                }
              }
            }
          })
        }
      })
  }
}
