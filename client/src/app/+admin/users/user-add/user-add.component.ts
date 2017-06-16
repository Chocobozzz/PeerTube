import { Component, OnInit } from '@angular/core'
import { FormBuilder, FormGroup } from '@angular/forms'
import { Router } from '@angular/router'

import { NotificationsService } from 'angular2-notifications'

import { UserService } from '../shared'
import {
  FormReactive,
  USER_USERNAME,
  USER_EMAIL,
  USER_PASSWORD
} from '../../../shared'

@Component({
  selector: 'my-user-add',
  templateUrl: './user-add.component.html'
})
export class UserAddComponent extends FormReactive implements OnInit {
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

  addUser () {
    this.error = null

    const { username, password, email } = this.form.value

    this.userService.addUser(username, password, email).subscribe(
      () => {
        this.notificationsService.success('Success', `User ${username} created.`)
        this.router.navigate([ '/admin/users/list' ])
      },

      err => this.error = err.text
    )
  }
}
