import { Component } from '@angular/core'
import { AuthService, Notifier, RedirectService, ServerService } from '@app/core'
import { UserService, UserValidatorsService } from '@app/shared'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { UserRegister } from '@shared/models/users/user-register.model'
import { FormGroup } from '@angular/forms'

@Component({
  selector: 'my-register',
  templateUrl: './register.component.html',
  styleUrls: [ './register.component.scss' ]
})
export class RegisterComponent {
  info: string = null
  error: string = null
  success: string = null
  signupDone = false

  formStepUser: FormGroup
  formStepChannel: FormGroup

  constructor (
    private authService: AuthService,
    private userValidatorsService: UserValidatorsService,
    private notifier: Notifier,
    private userService: UserService,
    private serverService: ServerService,
    private redirectService: RedirectService,
    private i18n: I18n
  ) {
  }

  get requiresEmailVerification () {
    return this.serverService.getConfig().signup.requiresEmailVerification
  }

  hasSameChannelAndAccountNames () {
    return this.getUsername() === this.getChannelName()
  }

  getUsername () {
    if (!this.formStepUser) return undefined

    return this.formStepUser.value['username']
  }

  getChannelName () {
    if (!this.formStepChannel) return undefined

    return this.formStepChannel.value['name']
  }

  onUserFormBuilt (form: FormGroup) {
    this.formStepUser = form
  }

  onChannelFormBuilt (form: FormGroup) {
    this.formStepChannel = form
  }

  signup () {
    this.error = null

    const body: UserRegister = Object.assign(this.formStepUser.value, { channel: this.formStepChannel.value })

    this.userService.signup(body).subscribe(
      () => {
        this.signupDone = true

        if (this.requiresEmailVerification) {
          this.info = this.i18n('Now please check your emails to verify your account and complete signup.')
          return
        }

        // Auto login
        this.authService.login(body.username, body.password)
            .subscribe(
              () => {
                this.success = this.i18n('You are now logged in as {{username}}!', { username: body.username })
              },

              err => this.error = err.message
            )
      },

      err => this.error = err.message
    )
  }
}
