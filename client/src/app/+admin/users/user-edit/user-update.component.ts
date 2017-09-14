import { Component, OnDestroy, OnInit } from '@angular/core'
import { FormBuilder, FormGroup } from '@angular/forms'
import { ActivatedRoute, Router } from '@angular/router'
import { Subscription } from 'rxjs/Subscription'

import { NotificationsService } from 'angular2-notifications'

import { UserService } from '../shared'
import { USER_EMAIL, USER_VIDEO_QUOTA } from '../../../shared'
import { UserUpdate } from '../../../../../../shared/models/users/user-update.model'
import { User } from '../../../shared/users/user.model'
import { UserEdit } from './user-edit'

@Component({
  selector: 'my-user-update',
  templateUrl: './user-edit.component.html'
})
export class UserUpdateComponent extends UserEdit implements OnInit, OnDestroy {
  error: string
  userId: number
  username: string

  form: FormGroup
  formErrors = {
    'email': '',
    'videoQuota': ''
  }
  validationMessages = {
    'email': USER_EMAIL.MESSAGES,
    'videoQuota': USER_VIDEO_QUOTA.MESSAGES
  }

  private paramsSub: Subscription

  constructor (
    private formBuilder: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private notificationsService: NotificationsService,
    private userService: UserService
  ) {
    super()
  }

  buildForm () {
    this.form = this.formBuilder.group({
      email:    [ '', USER_EMAIL.VALIDATORS ],
      videoQuota: [ '-1', USER_VIDEO_QUOTA.VALIDATORS ]
    })

    this.form.valueChanges.subscribe(data => this.onValueChanged(data))
  }

  ngOnInit () {
    this.buildForm()

    this.paramsSub = this.route.params.subscribe(routeParams => {
      const userId = routeParams['id']
      this.userService.getUser(userId).subscribe(
        user => this.onUserFetched(user),

        err => this.error = err
      )
    })
  }

  ngOnDestroy () {
    this.paramsSub.unsubscribe()
  }

  formValidated () {
    this.error = undefined

    const userUpdate: UserUpdate = this.form.value

    // A select in HTML is always mapped as a string, we convert it to number
    userUpdate.videoQuota = parseInt(this.form.value['videoQuota'], 10)

    this.userService.updateUser(this.userId, userUpdate).subscribe(
      () => {
        this.notificationsService.success('Success', `User ${this.username} updated.`)
        this.router.navigate([ '/admin/users/list' ])
      },

      err => this.error = err
    )
  }

  isCreation () {
    return false
  }

  getFormButtonTitle () {
    return 'Update user'
  }

  private onUserFetched (userJson: User) {
    this.userId = userJson.id
    this.username = userJson.username

    this.form.patchValue({
      email: userJson.email,
      videoQuota: userJson.videoQuota
    })
  }
}
