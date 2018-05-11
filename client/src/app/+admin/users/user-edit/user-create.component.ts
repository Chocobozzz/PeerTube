import { Component, OnInit } from '@angular/core'
import { FormBuilder, FormGroup } from '@angular/forms'
import { Router } from '@angular/router'

import { NotificationsService } from 'angular2-notifications'

import { UserService } from '../shared'
import {
  USER_USERNAME,
  USER_EMAIL,
  USER_PASSWORD,
  USER_VIDEO_QUOTA,
  USER_ROLE
} from '../../../shared'
import { ServerService } from '../../../core'
import { UserCreate, UserRole } from '../../../../../../shared'
import { UserEdit } from './user-edit'

@Component({
  selector: 'my-user-create',
  templateUrl: './user-edit.component.html',
  styleUrls: [ './user-edit.component.scss' ]
})
export class UserCreateComponent extends UserEdit implements OnInit {
  error: string

  form: FormGroup
  formErrors = {
    'username': '',
    'email': '',
    'password': '',
    'role': '',
    'videoQuota': ''
  }
  validationMessages = {
    'username': USER_USERNAME.MESSAGES,
    'email': USER_EMAIL.MESSAGES,
    'password': USER_PASSWORD.MESSAGES,
    'role': USER_ROLE.MESSAGES,
    'videoQuota': USER_VIDEO_QUOTA.MESSAGES
  }

  constructor (
    protected serverService: ServerService,
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
      password: [ '', USER_PASSWORD.VALIDATORS ],
      role: [ UserRole.USER, USER_ROLE.VALIDATORS ],
      videoQuota: [ '-1', USER_VIDEO_QUOTA.VALIDATORS ]
    })

    this.form.valueChanges.subscribe(data => this.onValueChanged(data))
  }

  ngOnInit () {
    this.buildForm()
  }

  formValidated () {
    this.error = undefined

    const userCreate: UserCreate = this.form.value

    // A select in HTML is always mapped as a string, we convert it to number
    userCreate.videoQuota = parseInt(this.form.value['videoQuota'], 10)

    this.userService.addUser(userCreate).subscribe(
      () => {
        this.notificationsService.success('Success', `User ${userCreate.username} created.`)
        this.router.navigate([ '/admin/users/list' ])
      },

      err => this.error = err.message
    )
  }

  isCreation () {
    return true
  }

  getFormButtonTitle () {
    return 'Create user'
  }
}
