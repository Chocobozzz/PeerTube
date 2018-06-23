import { Component, Input, OnInit } from '@angular/core'
import { NotificationsService } from 'angular2-notifications'
import { UserUpdateMe } from '../../../../../../shared'
import { AuthService } from '../../../core'
import { FormReactive, User, UserService } from '../../../shared'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { FormValidatorService } from '@app/shared/forms/form-validators/form-validator.service'
import { Subject } from 'rxjs'

@Component({
  selector: 'my-account-video-settings',
  templateUrl: './my-account-video-settings.component.html',
  styleUrls: [ './my-account-video-settings.component.scss' ]
})
export class MyAccountVideoSettingsComponent extends FormReactive implements OnInit {
  @Input() user: User = null
  @Input() userInformationLoaded: Subject<any>

  constructor (
    protected formValidatorService: FormValidatorService,
    private authService: AuthService,
    private notificationsService: NotificationsService,
    private userService: UserService,
    private i18n: I18n
  ) {
    super()
  }

  ngOnInit () {
    this.buildForm({
      nsfwPolicy: null,
      autoPlayVideo: null
    })

    this.userInformationLoaded.subscribe(() => {
      this.form.patchValue({
        nsfwPolicy: this.user.nsfwPolicy,
        autoPlayVideo: this.user.autoPlayVideo === true
      })
    })
  }

  updateDetails () {
    const nsfwPolicy = this.form.value['nsfwPolicy']
    const autoPlayVideo = this.form.value['autoPlayVideo']
    const details: UserUpdateMe = {
      nsfwPolicy,
      autoPlayVideo
    }

    this.userService.updateMyProfile(details).subscribe(
      () => {
        this.notificationsService.success(this.i18n('Success'), this.i18n('Information updated.'))

        this.authService.refreshUserInformation()
      },

      err => this.notificationsService.error(this.i18n('Error'), err.message)
    )
  }
}
