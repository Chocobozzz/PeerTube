import { environment } from 'src/environments/environment'
import { AfterViewInit, Component, ElementRef, OnInit, ViewChild } from '@angular/core'
import { ActivatedRoute } from '@angular/router'
import { AuthService, Notifier, RedirectService, UserService } from '@app/core'
import { HooksService } from '@app/core/plugins/hooks.service'
import { InstanceAboutAccordionComponent } from '@app/shared/shared-instance'
import { LOGIN_PASSWORD_VALIDATOR, LOGIN_USERNAME_VALIDATOR } from '@app/shared/form-validators/login-validators'
import { FormReactive, FormValidatorService } from '@app/shared/shared-forms'
import { NgbAccordion, NgbModal, NgbModalRef } from '@ng-bootstrap/ng-bootstrap'
import { RegisteredExternalAuthConfig, ServerConfig } from '@shared/models'

@Component({
  selector: 'my-login',
  templateUrl: './login.component.html',
  styleUrls: [ './login.component.scss' ]
})

export class LoginComponent extends FormReactive implements OnInit, AfterViewInit {
  @ViewChild('usernameInput', { static: false }) usernameInput: ElementRef
  @ViewChild('forgotPasswordModal', { static: true }) forgotPasswordModal: ElementRef

  accordion: NgbAccordion
  error: string = null
  forgotPasswordEmail = ''

  isAuthenticatedWithExternalAuth = false
  externalAuthError = false
  externalLogins: string[] = []

  instanceInformationPanels = {
    terms: true,
    administrators: false,
    features: false,
    moderation: false,
    codeOfConduct: false
  }

  private openedForgotPasswordModal: NgbModalRef
  private serverConfig: ServerConfig

  constructor (
    protected formValidatorService: FormValidatorService,
    private route: ActivatedRoute,
    private modalService: NgbModal,
    private authService: AuthService,
    private userService: UserService,
    private redirectService: RedirectService,
    private notifier: Notifier,
    private hooks: HooksService
    ) {
    super()
  }

  get signupAllowed () {
    return this.serverConfig.signup.allowed === true
  }

  onTermsClick (event: Event, instanceInformation: HTMLElement) {
    event.preventDefault()

    if (this.accordion) {
      this.accordion.expand('terms')
      instanceInformation.scrollIntoView({ behavior: 'smooth' })
    }
  }

  isEmailDisabled () {
    return this.serverConfig.email.enabled === false
  }

  ngOnInit () {
    const snapshot = this.route.snapshot

    // Avoid undefined errors when accessing form error properties
    this.buildForm({
      username: LOGIN_USERNAME_VALIDATOR,
      password: LOGIN_PASSWORD_VALIDATOR
    })

    this.serverConfig = snapshot.data.serverConfig

    if (snapshot.queryParams.externalAuthToken) {
      this.loadExternalAuthToken(snapshot.queryParams.username, snapshot.queryParams.externalAuthToken)
      return
    }

    if (snapshot.queryParams.externalAuthError) {
      this.externalAuthError = true
      return
    }
  }

  ngAfterViewInit () {
    if (this.usernameInput) {
      this.usernameInput.nativeElement.focus()
    }

    this.hooks.runAction('action:login.init', 'login')
  }

  getExternalLogins () {
    return this.serverConfig.plugin.registeredExternalAuths
  }

  getAuthHref (auth: RegisteredExternalAuthConfig) {
    return environment.apiUrl + `/plugins/${auth.name}/${auth.version}/auth/${auth.authName}`
  }

  login () {
    this.error = null

    const { username, password } = this.form.value

    this.authService.login(username, password)
      .subscribe(
        () => this.redirectService.redirectToPreviousRoute(),

        err => this.handleError(err)
      )
  }

  askResetPassword () {
    this.userService.askResetPassword(this.forgotPasswordEmail)
      .subscribe(
        () => {
          const message = $localize`An email with the reset password instructions will be sent to ${this.forgotPasswordEmail}.
The link will expire within 1 hour.`

          this.notifier.success(message)
          this.hideForgotPasswordModal()
        },

        err => this.notifier.error(err.message)
      )
  }

  openForgotPasswordModal () {
    this.openedForgotPasswordModal = this.modalService.open(this.forgotPasswordModal)
  }

  hideForgotPasswordModal () {
    this.openedForgotPasswordModal.close()
  }

  onInstanceAboutAccordionInit (instanceAboutAccordion: InstanceAboutAccordionComponent) {
    this.accordion = instanceAboutAccordion.accordion
  }

  private loadExternalAuthToken (username: string, token: string) {
    this.isAuthenticatedWithExternalAuth = true

    this.authService.login(username, null, token)
    .subscribe(
      () => this.redirectService.redirectToPreviousRoute(),

      err => {
        this.handleError(err)
        this.isAuthenticatedWithExternalAuth = false
      }
    )
  }

  private handleError (err: any) {
    if (err.message.indexOf('credentials are invalid') !== -1) this.error = $localize`Incorrect username or password.`
    else if (err.message.indexOf('blocked') !== -1) this.error = $localize`Your account is blocked.`
    else this.error = err.message
  }
}
