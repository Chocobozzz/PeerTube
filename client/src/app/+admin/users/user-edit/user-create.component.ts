import { Component, OnInit } from '@angular/core'
import { Router } from '@angular/router'
import { NotificationsService } from 'angular2-notifications'
import { UserService } from '../shared'
import { USER_EMAIL, USER_PASSWORD, USER_ROLE, USER_USERNAME, USER_VIDEO_QUOTA } from '../../../shared'
import { ServerService } from '../../../core'
import { UserCreate, UserRole } from '../../../../../../shared'
import { UserEdit } from './user-edit'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { FormValidatorService } from '@app/shared/forms/form-validators/form-validator.service'

@Component({
  selector: 'my-user-create',
  templateUrl: './user-edit.component.html',
  styleUrls: [ './user-edit.component.scss' ]
})
export class UserCreateComponent extends UserEdit implements OnInit {
  error: string

  constructor (
    protected serverService: ServerService,
    protected formValidatorService: FormValidatorService,
    private router: Router,
    private notificationsService: NotificationsService,
    private userService: UserService,
    private i18n: I18n
  ) {
    super()
  }

  ngOnInit () {
    const defaultValues = {
      role: UserRole.USER.toString(),
      videoQuota: '-1'
    }

    this.buildForm({
      username: USER_USERNAME,
      email: USER_EMAIL,
      password: USER_PASSWORD,
      role: USER_ROLE,
      videoQuota: USER_VIDEO_QUOTA
    }, defaultValues)
  }

  formValidated () {
    this.error = undefined

    const userCreate: UserCreate = this.form.value

    // A select in HTML is always mapped as a string, we convert it to number
    userCreate.videoQuota = parseInt(this.form.value['videoQuota'], 10)

    this.userService.addUser(userCreate).subscribe(
      () => {
        this.notificationsService.success(
          this.i18n('Success'),
          this.i18n('User {{username}} created.', { username: userCreate.username })
        )
        this.router.navigate([ '/admin/users/list' ])
      },

      err => this.error = err.message
    )
  }

  isCreation () {
    return true
  }

  getFormButtonTitle () {
    return this.i18n('Create user')
  }
}
