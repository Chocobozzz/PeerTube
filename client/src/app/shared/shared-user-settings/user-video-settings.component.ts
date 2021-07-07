import { pick } from 'lodash-es'
import { forkJoin, Subject, Subscription } from 'rxjs'
import { first } from 'rxjs/operators'
import { Component, Input, OnDestroy, OnInit } from '@angular/core'
import { AuthService, Notifier, ServerService, User, UserService } from '@app/core'
import { FormReactive, FormValidatorService, ItemSelectCheckboxValue } from '@app/shared/shared-forms'
import { UserUpdateMe } from '@shared/models'
import { NSFWPolicyType } from '@shared/models/videos/nsfw-policy.type'
import { SelectOptionsItem } from '../../../types/select-options-item.model'

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
    private serverService: ServerService
  ) {
    super()
  }

  ngOnInit () {
    this.allLanguagesGroup = $localize`All languages`

    this.buildForm({
      nsfwPolicy: null,
      webTorrentEnabled: null,
      autoPlayVideo: null,
      autoPlayNextVideo: null,
      videoLanguages: null
    })

    forkJoin([
      this.serverService.getVideoLanguages(),
      this.userInformationLoaded.pipe(first())
    ]).subscribe(([ languages ]) => {
      const group = this.allLanguagesGroup

      this.languageItems = [ { label: $localize`Unknown language`, id: '_unknown', group } ]
      this.languageItems = this.languageItems
                               .concat(languages.map(l => ({ label: l.label, id: l.id, group })))

      const videoLanguages: ItemSelectCheckboxValue[] = this.user.videoLanguages
        ? this.user.videoLanguages.map(l => ({ id: l }))
        : [ { group } ]

      const serverConfig = this.serverService.getHTMLConfig()
      this.defaultNSFWPolicy = serverConfig.instance.defaultNSFWPolicy

      this.form.patchValue({
        nsfwPolicy: this.user.nsfwPolicy || this.defaultNSFWPolicy,
        webTorrentEnabled: this.user.webTorrentEnabled,
        autoPlayVideo: this.user.autoPlayVideo === true,
        autoPlayNextVideo: this.user.autoPlayNextVideo,
        videoLanguages
      })

      if (this.reactiveUpdate) this.handleReactiveUpdate()
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

    let videoLanguagesForm = this.form.value['videoLanguages']

    if (Array.isArray(videoLanguagesForm)) {
      if (videoLanguagesForm.length > 20) {
        this.notifier.error($localize`Too many languages are enabled. Please enable them all or stay below 20 enabled languages.`)
        return
      }

      // Automatically use "All languages" if the user did not select any language
      if (videoLanguagesForm.length === 0) {
        videoLanguagesForm = [ this.allLanguagesGroup ]
        this.form.patchValue({ videoLanguages: [ { group: this.allLanguagesGroup } ] })
      }
    }

    const videoLanguages = this.buildLanguagesFromForm(videoLanguagesForm)

    let details: UserUpdateMe = {
      nsfwPolicy,
      webTorrentEnabled,
      autoPlayVideo,
      autoPlayNextVideo,
      videoLanguages
    }

    if (videoLanguages) {
      details = Object.assign(details, videoLanguages)
    }

    if (onlyKeys) details = pick(details, onlyKeys)

    if (this.authService.isLoggedIn()) {
      return this.updateLoggedProfile(details)
    }

    return this.updateAnonymousProfile(details)
  }

  private buildLanguagesFromForm (videoLanguages: ItemSelectCheckboxValue[]) {
    if (!Array.isArray(videoLanguages)) return undefined

    // null means "All"
    if (videoLanguages.length === this.languageItems.length) return null

    if (videoLanguages.length === 1) {
      const videoLanguage = videoLanguages[0]

      if (typeof videoLanguage === 'string') {
        if (videoLanguage === this.allLanguagesGroup) return null
      } else {
        if (videoLanguage.group === this.allLanguagesGroup) return null
      }
    }

    return videoLanguages.map(l => {
      if (typeof l === 'string') return l

      if (l.group) return l.group

      return l.id + ''
    })
  }

  private handleReactiveUpdate () {
    let oldForm = { ...this.form.value }

    this.formValuesWatcher = this.form.valueChanges.subscribe((formValue: any) => {
      const updatedKey = Object.keys(formValue)
                               .find(k => formValue[k] !== oldForm[k])

      oldForm = { ...this.form.value }

      this.updateDetails([ updatedKey ])
    })
  }

  private updateLoggedProfile (details: UserUpdateMe) {
    this.userService.updateMyProfile(details).subscribe(
      () => {
        this.authService.refreshUserInformation()

        if (this.notifyOnUpdate) this.notifier.success($localize`Video settings updated.`)
      },

      err => this.notifier.error(err.message)
    )
  }

  private updateAnonymousProfile (details: UserUpdateMe) {
    this.userService.updateMyAnonymousProfile(details)
    if (this.notifyOnUpdate) this.notifier.success($localize`Display/Video settings updated.`)
  }
}
