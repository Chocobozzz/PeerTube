import { Component, ElementRef, OnInit, ViewChild } from '@angular/core'
import { FormBuilder, FormGroup, Validators } from '@angular/forms'
import { Router } from '@angular/router'
import { RedirectService, ServerService } from '@app/core'
import { UserService } from '@app/shared'
import { NotificationsService } from 'angular2-notifications'
import { ModalDirective } from 'ngx-bootstrap/modal'
import { AuthService } from '../core'
import { FormReactive } from '../shared'

@Component({
  selector: 'my-login',
  templateUrl: './login.component.html',
  styleUrls: [ './login.component.scss' ]
})

export class LoginComponent extends FormReactive implements OnInit {
  @ViewChild('forgotPasswordModal') forgotPasswordModal: ModalDirective
  @ViewChild('forgotPasswordEmailInput') forgotPasswordEmailInput: ElementRef

  error: string = null

  form: FormGroup
  formErrors = {
    'username': '',
    'password': ''
  }
  validationMessages = {
    'username': {
      'required': 'Username is required.'
    },
    'password': {
      'required': 'Password is required.'
    }
  }
  forgotPasswordEmail = ''

  constructor (private authService: AuthService,
               private userService: UserService,
               private serverService: ServerService,
               private redirectService: RedirectService,
               private notificationsService: NotificationsService,
               private formBuilder: FormBuilder) {
    super()
  }

  get signupAllowed () {
    return this.serverService.getConfig().signup.allowed === true
  }

  buildForm () {
    this.form = this.formBuilder.group({
      username: [ '', Validators.required ],
      password: [ '', Validators.required ]
    })

    this.form.valueChanges.subscribe(data => this.onValueChanged(data))
  }

  ngOnInit () {
    this.buildForm()
  }

  login () {
    this.error = null

    const { username, password } = this.form.value

    this.authService.login(username, password)
      .subscribe(
        () => this.redirectService.redirectToHomepage(),

        err => this.error = err.message
      )
  }

  askResetPassword () {
    this.userService.askResetPassword(this.forgotPasswordEmail)
      .subscribe(
        res => {
          const message = `An email with the reset password instructions will be sent to ${this.forgotPasswordEmail}.`
          this.notificationsService.success('Success', message)
          this.hideForgotPasswordModal()
        },

        err => this.notificationsService.error('Error', err.message)
      )
  }

  onForgotPasswordModalShown () {
    this.forgotPasswordEmailInput.nativeElement.focus()
  }

  openForgotPasswordModal () {
    this.forgotPasswordModal.show()
  }

  hideForgotPasswordModal () {
    this.forgotPasswordModal.hide()
  }
}
