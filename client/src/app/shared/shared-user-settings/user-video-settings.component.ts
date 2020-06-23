import { pick } from 'lodash-es'
import { SelectItem } from 'primeng/api'
import { forkJoin, Subject, Subscription } from 'rxjs'
import { first } from 'rxjs/operators'
import { Component, Input, OnDestroy, OnInit } from '@angular/core'
import { AuthService, Notifier, ServerService, User, UserService } from '@app/core'
import { FormReactive, FormValidatorService } from '@app/shared/shared-forms'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { UserUpdateMe } from '@shared/models'
import { NSFWPolicyType } from '@shared/models/videos/nsfw-policy.type'

@Component({
  selector: 'my-user-video-settings',
  templateUrl: './user-video-settings.component.html',
  styleUrls: [ './user-video-settings.component.scss' ]
})
export class UserVideoSettingsComponent extends FormReactive implements OnInit, OnDestroy {
  @Input() user: User = null
  @Input() reactiveUpdate = false
  @Input() notifyOnUpdate = true
  @Input() userInformationLoaded: Subject<any>

  languageItems: SelectItem[] = []
  defaultNSFWPolicy: NSFWPolicyType
  formValuesWatcher: Subscription

  constructor (
    protected formValidatorService: FormValidatorService,
    private authService: AuthService,
    private notifier: Notifier,
    private userService: UserService,
    private serverService: ServerService,
    private i18n: I18n
  ) {
    super()
  }

  ngOnInit () {
    let oldForm: any

    this.buildForm({
      nsfwPolicy: null,
      webTorrentEnabled: null,
      autoPlayVideo: null,
      autoPlayNextVideo: null,
      videoLanguages: null
    })

    forkJoin([
      this.serverService.getVideoLanguages(),
      this.serverService.getConfig(),
      this.userInformationLoaded.pipe(first())
    ]).subscribe(([ languages, config ]) => {
      this.languageItems = [ { label: this.i18n('Unknown language'), value: '_unknown' } ]
      this.languageItems = this.languageItems
                               .concat(languages.map(l => ({ label: l.label, value: l.id })))

      const videoLanguages = this.user.videoLanguages
        ? this.user.videoLanguages
        : this.languageItems.map(l => l.value)

      this.defaultNSFWPolicy = config.instance.defaultNSFWPolicy

      this.form.patchValue({
        nsfwPolicy: this.user.nsfwPolicy || this.defaultNSFWPolicy,
        webTorrentEnabled: this.user.webTorrentEnabled,
        autoPlayVideo: this.user.autoPlayVideo === true,
        autoPlayNextVideo: this.user.autoPlayNextVideo,
        videoLanguages
      })

      if (this.reactiveUpdate) {
        oldForm = { ...this.form.value }
        this.formValuesWatcher = this.form.valueChanges.subscribe((formValue: any) => {
          const updatedKey = Object.keys(formValue).find(k => formValue[k] !== oldForm[k])
          oldForm = { ...this.form.value }
          this.updateDetails([updatedKey])
        })
      }
    })
  }

  ngOnDestroy () {
    this.formValuesWatcher?.unsubscribe()
  }

  updateDetails (onlyKeys?: string[]) {
    const nsfwPolicy = this.form.value[ 'nsfwPolicy' ]
    const webTorrentEnabled = this.form.value['webTorrentEnabled']
    const autoPlayVideo = this.form.value['autoPlayVideo']
    const autoPlayNextVideo = this.form.value['autoPlayNextVideo']

    let videoLanguages: string[] = this.form.value['videoLanguages']
    if (Array.isArray(videoLanguages)) {
      if (videoLanguages.length === this.languageItems.length) {
        videoLanguages = null // null means "All"
      } else if (videoLanguages.length > 20) {
        this.notifier.error('Too many languages are enabled. Please enable them all or stay below 20 enabled languages.')
        return
      } else if (videoLanguages.length === 0) {
        this.notifier.error('You need to enabled at least 1 video language.')
        return
      }
    }

    let details: UserUpdateMe = {
      nsfwPolicy,
      webTorrentEnabled,
      autoPlayVideo,
      autoPlayNextVideo,
      videoLanguages
    }

    if (onlyKeys) details = pick(details, onlyKeys)

    if (this.authService.isLoggedIn()) {
      this.userService.updateMyProfile(details).subscribe(
        () => {
          this.authService.refreshUserInformation()

          if (this.notifyOnUpdate) this.notifier.success(this.i18n('Video settings updated.'))
        },

        err => this.notifier.error(err.message)
      )
    } else {
      this.userService.updateMyAnonymousProfile(details)
      if (this.notifyOnUpdate) this.notifier.success(this.i18n('Display/Video settings updated.'))
    }
  }

  getDefaultVideoLanguageLabel () {
    return this.i18n('No language')
  }

  getSelectedVideoLanguageLabel () {
    return this.i18n('{{\'{0} languages selected')
  }
}
