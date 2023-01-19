import { CdkStep } from '@angular/cdk/stepper'
import { Component, OnInit, ViewChild } from '@angular/core'
import { FormGroup } from '@angular/forms'
import { ActivatedRoute } from '@angular/router'
import { AuthService } from '@app/core'
import { HooksService } from '@app/core/plugins/hooks.service'
import { InstanceAboutAccordionComponent } from '@app/shared/shared-instance'
import { NgbAccordion } from '@ng-bootstrap/ng-bootstrap'
import { UserRegister } from '@shared/models'
import { ServerConfig } from '@shared/models/server'
import { SignupService } from '../shared/signup.service'

@Component({
  selector: 'my-register',
  templateUrl: './register.component.html',
  styleUrls: [ './register.component.scss' ]
})
export class RegisterComponent implements OnInit {
  @ViewChild('lastStep') lastStep: CdkStep

  accordion: NgbAccordion

  signupError: string
  signupSuccess = false

  videoUploadDisabled: boolean
  videoQuota: number

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

  defaultPreviousStepButtonLabel = $localize`Go to the previous step`
  defaultNextStepButtonLabel = $localize`Go to the next step`
  stepUserButtonLabel = this.defaultNextStepButtonLabel

  signupDisabled = false

  private serverConfig: ServerConfig

  constructor (
    private route: ActivatedRoute,
    private authService: AuthService,
    private signupService: SignupService,
    private hooks: HooksService
  ) { }

  get requiresEmailVerification () {
    return this.serverConfig.signup.requiresEmailVerification
  }

  get requiresApproval () {
    return this.serverConfig.signup.requiresApproval
  }

  get minimumAge () {
    return this.serverConfig.signup.minimumAge
  }

  get instanceName () {
    return this.serverConfig.instance.name
  }

  ngOnInit () {
    this.serverConfig = this.route.snapshot.data.serverConfig

    if (this.serverConfig.signup.allowed === false || this.serverConfig.signup.allowedForCurrentIP === false) {
      this.signupDisabled = true
      return
    }

    this.videoQuota = this.serverConfig.user.videoQuota
    this.videoUploadDisabled = this.videoQuota === 0

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

  skipChannelCreation () {
    this.formStepChannel.reset()
    this.lastStep.select()

    this.signup()
  }

  async signup () {
    this.signupError = undefined

    const termsForm = this.formStepTerms.value
    const userForm = this.formStepUser.value
    const channelForm = this.formStepChannel?.value

    const channel = this.formStepChannel?.value?.name
      ? { name: channelForm?.name, displayName: channelForm?.displayName }
      : undefined

    const body = await this.hooks.wrapObject(
      {
        username: userForm.username,
        password: userForm.password,
        email: userForm.email,
        displayName: userForm.displayName,

        registrationReason: termsForm.registrationReason,

        channel
      },
      'signup',
      'filter:api.signup.registration.create.params'
    )

    const obs = this.requiresApproval
      ? this.signupService.requestSignup(body)
      : this.signupService.directSignup(body)

    obs.subscribe({
      next: () => {
        if (this.requiresEmailVerification || this.requiresApproval) {
          this.signupSuccess = true
          return
        }

        // Auto login
        this.autoLogin(body)
      },

      error: err => {
        this.signupError = err.message
      }
    })
  }

  private autoLogin (body: UserRegister) {
    this.authService.login({ username: body.username, password: body.password })
      .subscribe({
        next: () => {
          this.signupSuccess = true
        },

        error: err => {
          this.signupError = err.message
        }
      })
  }
}
