import { Component, OnDestroy, OnInit } from '@angular/core'
import { FormBuilder, FormGroup } from '@angular/forms'
import { ActivatedRoute, Router } from '@angular/router'
import { Subscription } from 'rxjs'
import { NotificationsService } from 'angular2-notifications'
import { UserService } from '../shared'
import { User, USER_EMAIL, USER_ROLE, USER_VIDEO_QUOTA } from '../../../shared'
import { ServerService } from '../../../core'
import { UserEdit } from './user-edit'
import { UserUpdate } from '../../../../../../shared'

@Component({
  selector: 'my-user-update',
  templateUrl: './user-edit.component.html',
  styleUrls: [ './user-edit.component.scss' ]
})
export class UserUpdateComponent extends UserEdit implements OnInit, OnDestroy {
  error: string
  userId: number
  username: string

  form: FormGroup
  formErrors = {
    'email': '',
    'role': '',
    'videoQuota': ''
  }
  validationMessages = {
    'email': USER_EMAIL.MESSAGES,
    'role': USER_ROLE.MESSAGES,
    'videoQuota': USER_VIDEO_QUOTA.MESSAGES
  }

  private paramsSub: Subscription

  constructor (
    protected serverService: ServerService,
    private route: ActivatedRoute,
    private router: Router,
    private notificationsService: NotificationsService,
    private formBuilder: FormBuilder,
    private userService: UserService
  ) {
    super()
  }

  buildForm () {
    this.form = this.formBuilder.group({
      email:    [ '', USER_EMAIL.VALIDATORS ],
      role: [ '', USER_ROLE.VALIDATORS ],
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

        err => this.error = err.message
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

      err => this.error = err.message
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
      role: userJson.role,
      videoQuota: userJson.videoQuota
    })
  }
}
