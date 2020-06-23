import { SelectItem } from 'primeng/api'
import { forkJoin } from 'rxjs'
import { ViewportScroller } from '@angular/common'
import { AfterViewChecked, Component, OnInit, ViewChild } from '@angular/core'
import { ConfigService } from '@app/+admin/config/shared/config.service'
import { Notifier } from '@app/core'
import { ServerService } from '@app/core/server/server.service'
import { CustomConfigValidatorsService, FormReactive, FormValidatorService, UserValidatorsService } from '@app/shared/shared-forms'
import { NgbNav } from '@ng-bootstrap/ng-bootstrap'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { CustomConfig, ServerConfig } from '@shared/models'

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
  transcodingThreadOptions: { label: string, value: number }[] = []

  languageItems: SelectItem[] = []
  categoryItems: SelectItem[] = []

  private serverConfig: ServerConfig

  constructor (
    private viewportScroller: ViewportScroller,
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
        id: '0p',
        label: this.i18n('Audio-only'),
        description: this.i18n('A <code>.mp4</code> that keeps the original audio track, with no video')
      },
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
    return this.serverConfig.theme.registered
      .map(t => t.name)
  }

  getResolutionKey (resolution: string) {
    return 'transcoding.resolutions.' + resolution
  }

  ngOnInit () {
    this.serverConfig = this.serverService.getTmpConfig()
    this.serverService.getConfig()
        .subscribe(config => this.serverConfig = config)

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
        resolutions: {},
        hls: {
          enabled: null
        },
        webtorrent: {
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
            indexUrl: this.customConfigValidatorsService.INDEX_URL
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
          url: this.customConfigValidatorsService.SEARCH_INDEX_URL,
          disableLocalSearch: null,
          isDefaultSearch: null
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
    this.loadForm()
    this.checkTranscodingFields()
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
    this.configService.updateCustomConfig(this.form.getRawValue())
      .subscribe(
        res => {
          this.customConfig = res

          // Reload general configuration
          this.serverService.resetConfig()

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

        this.languageItems = languages.map(l => ({ label: l.label, value: l.id }))
        this.categoryItems = categories.map(l => ({ label: l.label, value: l.id }))

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
}
