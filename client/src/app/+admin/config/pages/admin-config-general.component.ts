import { CommonModule } from '@angular/common'
import { Component, OnDestroy, OnInit, inject } from '@angular/core'
import { FormArray, FormControl, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms'
import { ActivatedRoute, RouterLink } from '@angular/router'
import { getVideoQuotaDailyOptions, getVideoQuotaOptions } from '@app/+admin/shared/user-quota-options'
import { CanComponentDeactivate, ServerService } from '@app/core'
import { URL_VALIDATOR } from '@app/shared/form-validators/common-validators'
import {
  CONCURRENCY_VALIDATOR,
  EXPORT_EXPIRATION_VALIDATOR,
  EXPORT_MAX_USER_VIDEO_QUOTA_VALIDATOR,
  MAX_SYNC_PER_USER,
  MAX_VIDEO_CHANNELS_PER_USER_VALIDATOR,
  SIGNUP_LIMIT_VALIDATOR,
  SIGNUP_MINIMUM_AGE_VALIDATOR
} from '@app/shared/form-validators/custom-config-validators'
import {
  BuildFormArgumentTyped,
  FormDefaultTyped,
  FormReactiveErrorsTyped,
  FormReactiveMessagesTyped
} from '@app/shared/form-validators/form-validator.model'
import { USER_VIDEO_QUOTA_DAILY_VALIDATOR, USER_VIDEO_QUOTA_VALIDATOR } from '@app/shared/form-validators/user-validators'
import { FormReactiveService } from '@app/shared/shared-forms/form-reactive.service'
import { AlertComponent } from '@app/shared/shared-main/common/alert.component'
import { VideoService } from '@app/shared/shared-main/video/video.service'
import { BroadcastMessageLevel, CustomConfig, VideoCommentPolicyType, VideoConstant, VideoPrivacyType } from '@peertube/peertube-models'
import { Subscription } from 'rxjs'
import { pairwise } from 'rxjs/operators'
import { SelectOptionsItem } from 'src/types/select-options-item.model'
import { AdminConfigService } from '../../../shared/shared-admin/admin-config.service'
import { MarkdownTextareaComponent } from '../../../shared/shared-forms/markdown-textarea.component'
import { PeertubeCheckboxComponent } from '../../../shared/shared-forms/peertube-checkbox.component'
import { SelectCustomValueComponent } from '../../../shared/shared-forms/select/select-custom-value.component'
import { SelectOptionsComponent } from '../../../shared/shared-forms/select/select-options.component'
import { SelectVideosScopeComponent } from '../../../shared/shared-forms/select/select-videos-scope.component'
import { SelectVideosSortComponent } from '../../../shared/shared-forms/select/select-videos-sort.component'
import { HelpComponent } from '../../../shared/shared-main/buttons/help.component'
import { UserRealQuotaInfoComponent } from '../../shared/user-real-quota-info.component'
import { AdminSaveBarComponent } from '../shared/admin-save-bar.component'

type Form = {
  instance: FormGroup<{
    defaultClientRoute: FormControl<string>
  }>

  client: FormGroup<{
    browseVideos: FormGroup<{
      defaultSort: FormControl<string>
      defaultScope: FormControl<string>
    }>

    menu: FormGroup<{
      login: FormGroup<{
        redirectOnSingleExternalAuth: FormControl<boolean>
      }>
    }>
  }>

  signup: FormGroup<{
    enabled: FormControl<boolean>
    limit: FormControl<number>
    requiresApproval: FormControl<boolean>
    requiresEmailVerification: FormControl<boolean>
    minimumAge: FormControl<number>
  }>

  import: FormGroup<{
    videos: FormGroup<{
      concurrency: FormControl<number>

      http: FormGroup<{
        enabled: FormControl<boolean>
      }>

      torrent: FormGroup<{
        enabled: FormControl<boolean>
      }>
    }>
    videoChannelSynchronization: FormGroup<{
      enabled: FormControl<boolean>
      maxPerUser: FormControl<number>
    }>
    users: FormGroup<{
      enabled: FormControl<boolean>
    }>
  }>

  export: FormGroup<{
    users: FormGroup<{
      enabled: FormControl<boolean>
      maxUserVideoQuota: FormControl<number>
      exportExpiration: FormControl<number>
    }>
  }>

  trending: FormGroup<{
    videos: FormGroup<{
      algorithms: FormGroup<{
        enabled: FormArray<FormControl<string>>
        default: FormControl<string>
      }>
    }>
  }>

  user: FormGroup<{
    history: FormGroup<{
      videos: FormGroup<{
        enabled: FormControl<boolean>
      }>
    }>
    videoQuota: FormControl<number>
    videoQuotaDaily: FormControl<number>
  }>

  videoChannels: FormGroup<{
    maxPerUser: FormControl<number>
  }>

  videoTranscription: FormGroup<{
    enabled: FormControl<boolean>
    remoteRunners: FormGroup<{
      enabled: FormControl<boolean>
    }>
  }>

  videoFile: FormGroup<{
    update: FormGroup<{
      enabled: FormControl<boolean>
    }>
  }>

  autoBlacklist: FormGroup<{
    videos: FormGroup<{
      ofUsers: FormGroup<{
        enabled: FormControl<boolean>
      }>
    }>
  }>

  followers: FormGroup<{
    instance: FormGroup<{
      enabled: FormControl<boolean>
      manualApproval: FormControl<boolean>
    }>
    channels: FormGroup<{
      enabled: FormControl<boolean>
    }>
  }>

  followings: FormGroup<{
    instance: FormGroup<{
      autoFollowBack: FormGroup<{
        enabled: FormControl<boolean>
      }>
      autoFollowIndex: FormGroup<{
        enabled: FormControl<boolean>
        indexUrl: FormControl<string>
      }>
    }>
  }>

  broadcastMessage: FormGroup<{
    enabled: FormControl<boolean>
    level: FormControl<BroadcastMessageLevel>
    dismissable: FormControl<boolean>
    message: FormControl<string>
  }>

  search: FormGroup<{
    remoteUri: FormGroup<{
      users: FormControl<boolean>
      anonymous: FormControl<boolean>
    }>
    searchIndex: FormGroup<{
      enabled: FormControl<boolean>
      url: FormControl<string>
      disableLocalSearch: FormControl<boolean>
      isDefaultSearch: FormControl<boolean>
    }>
  }>

  storyboards: FormGroup<{
    enabled: FormControl<boolean>

    remoteRunners: FormGroup<{
      enabled: FormControl<boolean>
    }>
  }>

  defaults: FormGroup<{
    publish: FormGroup<{
      commentsPolicy: FormControl<VideoCommentPolicyType>
      privacy: FormControl<VideoPrivacyType>
      licence: FormControl<number>
    }>

    p2p: FormGroup<{
      webapp: FormGroup<{
        enabled: FormControl<boolean>
      }>

      embed: FormGroup<{
        enabled: FormControl<boolean>
      }>
    }>

    player: FormGroup<{
      autoPlay: FormControl<boolean>
    }>
  }>

  videoComments: FormGroup<{
    acceptRemoteComments: FormControl<boolean>
  }>
}

@Component({
  selector: 'my-admin-config-general',
  templateUrl: './admin-config-general.component.html',
  styleUrls: [ './admin-config-common.scss' ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterLink,
    SelectCustomValueComponent,
    PeertubeCheckboxComponent,
    HelpComponent,
    MarkdownTextareaComponent,
    UserRealQuotaInfoComponent,
    SelectOptionsComponent,
    AlertComponent,
    AdminSaveBarComponent,
    SelectVideosSortComponent,
    SelectVideosScopeComponent
  ]
})
export class AdminConfigGeneralComponent implements OnInit, OnDestroy, CanComponentDeactivate {
  private server = inject(ServerService)
  private route = inject(ActivatedRoute)
  private formReactiveService = inject(FormReactiveService)
  private adminConfigService = inject(AdminConfigService)
  private videoService = inject(VideoService)

  form: FormGroup<Form>
  formErrors: FormReactiveErrorsTyped<Form> = {}
  validationMessages: FormReactiveMessagesTyped<Form> = {}

  signupAlertMessage: string
  defaultLandingPageOptions: SelectOptionsItem[] = []

  exportExpirationOptions: SelectOptionsItem[] = []
  exportMaxUserVideoQuotaOptions: SelectOptionsItem[] = []

  privacyOptions: SelectOptionsItem[] = []
  commentPoliciesOptions: SelectOptionsItem[] = []
  licenceOptions: SelectOptionsItem[] = []

  private customConfig: CustomConfig
  private customConfigSub: Subscription

  ngOnInit () {
    this.customConfig = this.route.parent.snapshot.data['customConfig']

    const data = this.route.snapshot.data as {
      licences: VideoConstant<number>[]
      privacies: VideoConstant<VideoPrivacyType>[]
      commentPolicies: VideoConstant<VideoCommentPolicyType>[]
    }

    this.privacyOptions = this.videoService.explainedPrivacyLabels(data.privacies).videoPrivacies
    this.licenceOptions = data.licences

    this.commentPoliciesOptions = data.commentPolicies

    this.buildLandingPageOptions()

    this.exportExpirationOptions = [
      { id: 1000 * 3600 * 24, label: $localize`1 day` },
      { id: 1000 * 3600 * 24 * 2, label: $localize`2 days` },
      { id: 1000 * 3600 * 24 * 7, label: $localize`7 days` },
      { id: 1000 * 3600 * 24 * 30, label: $localize`30 days` }
    ]

    this.exportMaxUserVideoQuotaOptions = this.getVideoQuotaOptions().filter(o => o.id >= 1)

    this.buildForm()

    this.subscribeToSignupChanges()
    this.subscribeToImportSyncChanges()

    this.customConfigSub = this.adminConfigService.getCustomConfigReloadedObs()
      .subscribe(customConfig => {
        this.customConfig = customConfig

        this.form.patchValue(this.customConfig)
      })
  }

  ngOnDestroy () {
    if (this.customConfigSub) this.customConfigSub.unsubscribe()
  }

  private buildForm () {
    const obj: BuildFormArgumentTyped<Form> = {
      instance: {
        defaultClientRoute: null
      },
      client: {
        browseVideos: {
          defaultSort: null,
          defaultScope: null
        },
        menu: {
          login: {
            redirectOnSingleExternalAuth: null
          }
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
        },
        channels: {
          enabled: null
        }
      },
      followings: {
        instance: {
          autoFollowBack: {
            enabled: null
          },
          autoFollowIndex: {
            enabled: null,
            indexUrl: URL_VALIDATOR
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
          url: URL_VALIDATOR,
          disableLocalSearch: null,
          isDefaultSearch: null
        }
      },
      storyboards: {
        enabled: null,
        remoteRunners: {
          enabled: null
        }
      },
      defaults: {
        publish: {
          commentsPolicy: null,
          privacy: null,
          licence: null
        },
        p2p: {
          webapp: {
            enabled: null
          },
          embed: {
            enabled: null
          }
        },
        player: {
          autoPlay: null
        }
      },
      videoComments: {
        acceptRemoteComments: null
      }
    }

    const defaultValues: FormDefaultTyped<Form> = this.customConfig

    const {
      form,
      formErrors,
      validationMessages
    } = this.formReactiveService.buildForm<Form>(obj, defaultValues)

    this.form = form
    this.formErrors = formErrors
    this.validationMessages = validationMessages
  }

  canDeactivate () {
    return { canDeactivate: !this.form.dirty }
  }

  countExternalAuth () {
    return this.server.getHTMLConfig().plugin.registeredExternalAuths.length
  }

  getVideoQuotaOptions () {
    return getVideoQuotaOptions()
  }

  getVideoQuotaDailyOptions () {
    return getVideoQuotaDailyOptions()
  }

  doesTrendingVideosAlgorithmsEnabledInclude (algorithm: string) {
    const enabled = this.form.value.trending.videos.algorithms.enabled
    if (!Array.isArray(enabled)) return false

    return !!enabled.find((e: string) => e === algorithm)
  }

  getUserVideoQuota () {
    return this.form.value.user.videoQuota
  }

  isExportUsersEnabled () {
    return this.form.value.export.users.enabled === true
  }

  getDisabledExportUsersClass () {
    return { 'disabled-checkbox-extra': !this.isExportUsersEnabled() }
  }

  isSignupEnabled () {
    return this.form.value.signup.enabled === true
  }

  getDisabledSignupClass () {
    return { 'disabled-checkbox-extra': !this.isSignupEnabled() }
  }

  isImportVideosHttpEnabled (): boolean {
    return this.form.value.import.videos.http.enabled === true
  }

  importSynchronizationChecked () {
    return this.isImportVideosHttpEnabled() && this.form.value.import.videoChannelSynchronization.enabled
  }

  hasUnlimitedSignup () {
    return this.form.value.signup.limit === -1
  }

  isSearchIndexEnabled () {
    return this.form.value.search.searchIndex.enabled === true
  }

  getDisabledSearchIndexClass () {
    return { 'disabled-checkbox-extra': !this.isSearchIndexEnabled() }
  }

  // ---------------------------------------------------------------------------

  isTranscriptionEnabled () {
    return this.form.value.videoTranscription.enabled === true
  }

  getTranscriptionRunnerDisabledClass () {
    return { 'disabled-checkbox-extra': !this.isTranscriptionEnabled() }
  }

  // ---------------------------------------------------------------------------

  isStoryboardEnabled () {
    return this.form.value.storyboards.enabled === true
  }

  getStoryboardRunnerDisabledClass () {
    return { 'disabled-checkbox-extra': !this.isStoryboardEnabled() }
  }

  // ---------------------------------------------------------------------------

  isAutoFollowIndexEnabled () {
    return this.form.value.followings.instance.autoFollowIndex.enabled === true
  }

  buildLandingPageOptions () {
    let links: { label: string, path: string }[] = []

    if (this.server.getHTMLConfig().homepage.enabled) {
      links.push({ label: $localize`Home`, path: '/home' })
    }

    links = links.concat([
      { label: $localize`Discover`, path: '/videos/overview' },
      { label: $localize`Browse all videos`, path: '/videos/browse' },
      { label: $localize`Browse local videos`, path: '/videos/browse?scope=local' }
    ])

    this.defaultLandingPageOptions = links.map(o => ({
      id: o.path,
      label: o.label,
      description: o.path
    }))
  }

  private subscribeToImportSyncChanges () {
    const controls = this.form.controls

    const importSyncControl = controls.import.controls.videoChannelSynchronization.controls.enabled
    const importVideosHttpControl = controls.import.controls.videos.controls.http.controls.enabled

    importVideosHttpControl.valueChanges
      .subscribe(httpImportEnabled => {
        importSyncControl.setValue(httpImportEnabled && importSyncControl.value)

        if (httpImportEnabled) importSyncControl.enable()
        else importSyncControl.disable()
      })
  }

  private subscribeToSignupChanges () {
    const signupControl = this.form.controls.signup.controls.enabled

    signupControl.valueChanges
      .pipe(pairwise())
      .subscribe(([ oldValue, newValue ]) => {
        if (oldValue === false && newValue === true) {
          this.signupAlertMessage =
            // eslint-disable-next-line max-len
            $localize`You enabled signup: we automatically enabled the "Block new videos automatically" checkbox of the "Videos" section just below.`

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

    signupControl.updateValueAndValidity()
  }

  save () {
    this.adminConfigService.saveAndUpdateCurrent({
      currentConfig: this.customConfig,
      form: this.form,
      formConfig: this.form.value,
      success: $localize`General configuration updated.`
    })
  }
}
