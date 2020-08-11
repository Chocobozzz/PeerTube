import { pick } from 'lodash-es'
import { forkJoin, Subject, Subscription } from 'rxjs'
import { first } from 'rxjs/operators'
import { Component, Input, OnDestroy, OnInit } from '@angular/core'
import { AuthService, Notifier, ServerService, User, UserService } from '@app/core'
import { FormReactive, FormValidatorService, ItemSelectCheckboxValue, SelectOptionsItem } from '@app/shared/shared-forms'
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

  languageItems: SelectOptionsItem[] = []
  defaultNSFWPolicy: NSFWPolicyType
  formValuesWatcher: Subscription

  private allLanguagesGroup: string

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
    this.allLanguagesGroup = this.i18n('All languages')

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
      const group = this.allLanguagesGroup

      this.languageItems = [ { label: this.i18n('Unknown language'), id: '_unknown', group } ]
      this.languageItems = this.languageItems
                               .concat(languages.map(l => ({ label: l.label, id: l.id, group })))

      const videoLanguages: ItemSelectCheckboxValue[] = this.user.videoLanguages
        ? this.user.videoLanguages.map(l => ({ id: l }))
        : [ { group } ]

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

          this.updateDetails([ updatedKey ])
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
      if (videoLanguages.length > 20) {
        this.notifier.error(this.i18n('Too many languages are enabled. Please enable them all or stay below 20 enabled languages.'))
        return
      }

      if (videoLanguages.length === 0) {
        this.notifier.error(this.i18n('You need to enable at least 1 video language.'))
        return
      }

      if (
        videoLanguages.length === this.languageItems.length ||
        (videoLanguages.length === 1 && videoLanguages[0] === this.allLanguagesGroup)
      ) {
        videoLanguages = null // null means "All"
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
