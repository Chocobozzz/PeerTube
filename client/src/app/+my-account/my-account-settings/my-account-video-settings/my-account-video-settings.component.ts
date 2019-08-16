import { Component, Input, OnInit } from '@angular/core'
import { Notifier, ServerService } from '@app/core'
import { UserUpdateMe } from '../../../../../../shared'
import { AuthService } from '../../../core'
import { FormReactive, User, UserService } from '../../../shared'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { FormValidatorService } from '@app/shared/forms/form-validators/form-validator.service'
import { Subject } from 'rxjs'
import { SelectItem } from 'primeng/api'
import { switchMap } from 'rxjs/operators'

@Component({
  selector: 'my-account-video-settings',
  templateUrl: './my-account-video-settings.component.html',
  styleUrls: [ './my-account-video-settings.component.scss' ]
})
export class MyAccountVideoSettingsComponent extends FormReactive implements OnInit {
  @Input() user: User = null
  @Input() userInformationLoaded: Subject<any>

  languageItems: SelectItem[] = []

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
    this.buildForm({
      nsfwPolicy: null,
      webTorrentEnabled: null,
      autoPlayVideo: null,
      videoLanguages: null
    })

    this.serverService.videoLanguagesLoaded
        .pipe(switchMap(() => this.userInformationLoaded))
        .subscribe(() => {
          const languages = this.serverService.getVideoLanguages()

          this.languageItems = [ { label: this.i18n('Unknown language'), value: '_unknown' } ]
          this.languageItems = this.languageItems
                                   .concat(languages.map(l => ({ label: l.label, value: l.id })))

          const videoLanguages = this.user.videoLanguages
            ? this.user.videoLanguages
            : this.languageItems.map(l => l.value)

          this.form.patchValue({
            nsfwPolicy: this.user.nsfwPolicy,
            webTorrentEnabled: this.user.webTorrentEnabled,
            autoPlayVideo: this.user.autoPlayVideo === true,
            videoLanguages
          })
        })
  }

  updateDetails () {
    const nsfwPolicy = this.form.value['nsfwPolicy']
    const webTorrentEnabled = this.form.value['webTorrentEnabled']
    const autoPlayVideo = this.form.value['autoPlayVideo']

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

    const details: UserUpdateMe = {
      nsfwPolicy,
      webTorrentEnabled,
      autoPlayVideo,
      videoLanguages
    }

    this.userService.updateMyProfile(details).subscribe(
      () => {
        this.notifier.success(this.i18n('Video settings updated.'))

        this.authService.refreshUserInformation()
      },

      err => this.notifier.error(err.message)
    )
  }

  getDefaultVideoLanguageLabel () {
    return this.i18n('No language')
  }

  getSelectedVideoLanguageLabel () {
    return this.i18n('{{\'{0} languages selected')
  }
}
