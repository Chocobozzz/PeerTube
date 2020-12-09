import { Component, OnInit } from '@angular/core'
import { FormGroup } from '@angular/forms'
import { ActivatedRoute } from '@angular/router'
import { AuthService, UserService } from '@app/core'
import { HooksService } from '@app/core/plugins/hooks.service'
import { NgbAccordion } from '@ng-bootstrap/ng-bootstrap'
import { UserRegister } from '@shared/models'
import { ServerConfig } from '@shared/models/server'
import { InstanceAboutAccordionComponent } from '@app/shared/shared-instance'

@Component({
  selector: 'my-register',
  templateUrl: './register.component.html',
  styleUrls: [ './register.component.scss' ]
})
export class RegisterComponent implements OnInit {
  accordion: NgbAccordion
  info: string = null
  error: string = null
  success: string = null
  signupDone = false

  videoUploadDisabled: boolean

  formStepTerms: FormGroup
  formStepUser: FormGroup
  formStepChannel: FormGroup

  aboutHtml = {
    codeOfConduct: ''
  }

  instanceInformationPanels = {
    codeOfConduct: true,
    terms: true,
    administrators: false,
    features: false,
    moderation: false
  }

  defaultPreviousStepButtonLabel = $localize`:Button on the registration form to go to the previous step:Back`
  defaultNextStepButtonLabel = $localize`:Button on the registration form to go to the previous step:Next`
  stepUserButtonLabel = this.defaultNextStepButtonLabel

  private serverConfig: ServerConfig

  constructor (
    private route: ActivatedRoute,
    private authService: AuthService,
    private userService: UserService,
    private hooks: HooksService
    ) {
  }

  get requiresEmailVerification () {
    return this.serverConfig.signup.requiresEmailVerification
  }

  ngOnInit (): void {
    this.serverConfig = this.route.snapshot.data.serverConfig

    this.videoUploadDisabled = this.serverConfig.user.videoQuota === 0
    this.stepUserButtonLabel = this.videoUploadDisabled
      ? $localize`:Button on the registration form to finalize the account and channel creation:Signup`
      : this.defaultNextStepButtonLabel

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

  onTermsFormBuilt (form: FormGroup) {
    this.formStepTerms = form
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

  onInstanceAboutAccordionInit (instanceAboutAccordion: InstanceAboutAccordionComponent) {
    this.accordion = instanceAboutAccordion.accordion
    this.aboutHtml = instanceAboutAccordion.aboutHtml
  }

  async signup () {
    this.error = null

    const body: UserRegister = await this.hooks.wrapObject(
      Object.assign(this.formStepUser.value, { channel: this.videoUploadDisabled ? undefined : this.formStepChannel.value }),
      'signup',
      'filter:api.signup.registration.create.params'
    )

    this.userService.signup(body).subscribe(
      () => {
        this.signupDone = true

        if (this.requiresEmailVerification) {
          this.info = $localize`Now please check your emails to verify your account and complete signup.`
          return
        }

        // Auto login
        this.authService.login(body.username, body.password)
            .subscribe(
              () => {
                this.success = $localize`You are now logged in as ${body.username}!`
              },

              err => this.error = err.message
            )
      },

      err => this.error = err.message
    )
  }
}
