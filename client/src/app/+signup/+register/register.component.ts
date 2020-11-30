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

  formStepUser: FormGroup
  formStepChannel: FormGroup

  aboutHtml = {
    codeOfConduct: ''
  }

  instanceInformationPanels = {
    codeOfConduct: true,
    terms: true
  }

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

  onTermsClick (instanceInformationElement: HTMLElement) {
    if (this.accordion) {
      this.accordion.expand('terms')
      // make sure scroll position is near to the expanded panel especially on mobile screens
      instanceInformationElement.scrollIntoView({ behavior: 'smooth' })
      return
    }
  }

  onCodeOfConductClick (instanceInformationElement: HTMLElement) {
    if (this.accordion) {
      this.accordion.expand('code-of-conduct')
      // make sure scroll position is near to the expanded panel especially on mobile screens
      instanceInformationElement.scrollIntoView({ behavior: 'smooth' })
      return
    }
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
