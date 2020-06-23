import { Component, OnInit, ViewChild } from '@angular/core'
import { FormGroup } from '@angular/forms'
import { ActivatedRoute } from '@angular/router'
import { AuthService, Notifier, UserService } from '@app/core'
import { HooksService } from '@app/core/plugins/hooks.service'
import { InstanceService } from '@app/shared/shared-instance'
import { NgbAccordion } from '@ng-bootstrap/ng-bootstrap'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { UserRegister } from '@shared/models'
import { About, ServerConfig } from '@shared/models/server'

@Component({
  selector: 'my-register',
  templateUrl: './register.component.html',
  styleUrls: [ './register.component.scss' ]
})
export class RegisterComponent implements OnInit {
  @ViewChild('accordion', { static: true }) accordion: NgbAccordion

  info: string = null
  error: string = null
  success: string = null
  signupDone = false

  about: About
  aboutHtml = {
    description: '',
    terms: '',
    codeOfConduct: '',
    moderationInformation: '',
    administrator: ''
  }

  formStepUser: FormGroup
  formStepChannel: FormGroup

  private serverConfig: ServerConfig

  constructor (
    private route: ActivatedRoute,
    private authService: AuthService,
    private notifier: Notifier,
    private userService: UserService,
    private instanceService: InstanceService,
    private hooks: HooksService,
    private i18n: I18n
  ) {
  }

  get requiresEmailVerification () {
    return this.serverConfig.signup.requiresEmailVerification
  }

  ngOnInit (): void {
    this.serverConfig = this.route.snapshot.data.serverConfig

    this.instanceService.getAbout()
      .subscribe(
        async about => {
          this.about = about

          this.aboutHtml = await this.instanceService.buildHtml(about)
        },

        err => this.notifier.error(err.message)
      )

    this.hooks.runAction('action:signup.register.init', 'signup')
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

  onTermsClick () {
    if (this.accordion) this.accordion.toggle('terms')
  }

  onCodeOfConductClick () {
    if (this.accordion) this.accordion.toggle('code-of-conduct')
  }

  async signup () {
    this.error = null

    const body: UserRegister = await this.hooks.wrapObject(
      Object.assign(this.formStepUser.value, { channel: this.formStepChannel.value }),
      'signup',
      'filter:api.signup.registration.create.params'
    )

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
