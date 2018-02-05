import { Component, OnInit } from '@angular/core'
import { FormBuilder, FormGroup, Validators } from '@angular/forms'
import { ActivatedRoute, Router } from '@angular/router'
import { USER_PASSWORD, UserService } from '@app/shared'
import { NotificationsService } from 'angular2-notifications'
import { AuthService } from '../core'
import { FormReactive } from '../shared'

@Component({
  selector: 'my-login',
  templateUrl: './reset-password.component.html',
  styleUrls: [ './reset-password.component.scss' ]
})

export class ResetPasswordComponent extends FormReactive implements OnInit {
  form: FormGroup
  formErrors = {
    'password': '',
    'password-confirm': ''
  }
  validationMessages = {
    'password': USER_PASSWORD.MESSAGES,
    'password-confirm': {
      'required': 'Confirmation of the password is required.'
    }
  }

  private userId: number
  private verificationString: string

  constructor (
    private authService: AuthService,
    private userService: UserService,
    private notificationsService: NotificationsService,
    private formBuilder: FormBuilder,
    private router: Router,
    private route: ActivatedRoute
  ) {
    super()
  }

  buildForm () {
    this.form = this.formBuilder.group({
      password: [ '', USER_PASSWORD.VALIDATORS ],
      'password-confirm': [ '', Validators.required ]
    })

    this.form.valueChanges.subscribe(data => this.onValueChanged(data))
  }

  ngOnInit () {
    this.buildForm()

    this.userId = this.route.snapshot.queryParams['userId']
    this.verificationString = this.route.snapshot.queryParams['verificationString']

    if (!this.userId || !this.verificationString) {
      this.notificationsService.error('Error', 'Unable to find user id or verification string.')
      this.router.navigate([ '/' ])
    }
  }

  resetPassword () {
    this.userService.resetPassword(this.userId, this.verificationString, this.form.value.password)
      .subscribe(
        () => {
          this.notificationsService.success('Success', 'Your password has been successfully reset!')
          this.router.navigate([ '/login' ])
        },

        err => this.notificationsService.error('Error', err.message)
      )
  }

  isConfirmedPasswordValid () {
    const values = this.form.value
    return values.password === values['password-confirm']
  }
}
