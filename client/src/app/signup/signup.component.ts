import { Component, OnInit } from '@angular/core'
import { FormBuilder, FormGroup, Validators } from '@angular/forms'
import { Router } from '@angular/router'

import { NotificationsService } from 'angular2-notifications'

import { AuthService } from '../core'
import {
  FormReactive,
  UserService,
  USER_USERNAME,
  USER_EMAIL,
  USER_PASSWORD
} from '../shared'
import { UserCreate } from '../../../../shared'

@Component({
  selector: 'my-signup',
  templateUrl: './signup.component.html'
})
export class SignupComponent extends FormReactive implements OnInit {
  error: string = null

  form: FormGroup
  formErrors = {
    'username': '',
    'email': '',
    'password': ''
  }
  validationMessages = {
    'username': USER_USERNAME.MESSAGES,
    'email': USER_EMAIL.MESSAGES,
    'password': USER_PASSWORD.MESSAGES
  }

  constructor (
    private formBuilder: FormBuilder,
    private router: Router,
    private notificationsService: NotificationsService,
    private userService: UserService
  ) {
    super()
  }

  buildForm () {
    this.form = this.formBuilder.group({
      username: [ '', USER_USERNAME.VALIDATORS ],
      email:    [ '', USER_EMAIL.VALIDATORS ],
      password: [ '', USER_PASSWORD.VALIDATORS ]
    })

    this.form.valueChanges.subscribe(data => this.onValueChanged(data))
  }

  ngOnInit () {
    this.buildForm()
  }

  signup () {
    this.error = null

    const userCreate: UserCreate = this.form.value

    this.userService.signup(userCreate).subscribe(
      () => {
        this.notificationsService.success('Success', `Registration for ${userCreate.username} complete.`)
        this.router.navigate([ '/videos/list' ])
      },

      err => this.error = err
    )
  }
}
