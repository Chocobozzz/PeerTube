import { Component, OnInit } from '@angular/core'
import { FormBuilder, FormGroup } from '@angular/forms'
import { Router } from '@angular/router'
import { ServerService } from '@app/core/server'

import { NotificationsService } from 'angular2-notifications'
import { UserCreate } from '../../../../shared'
import { FormReactive, USER_EMAIL, USER_PASSWORD, USER_USERNAME, UserService } from '../shared'

@Component({
  selector: 'my-signup',
  templateUrl: './signup.component.html',
  styleUrls: [ './signup.component.scss' ]
})
export class SignupComponent extends FormReactive implements OnInit {
  error: string = null
  quotaHelpIndication = ''

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

  private static getApproximateTime (seconds: number) {
    const hours = Math.floor(seconds / 3600)
    let pluralSuffix = ''
    if (hours > 1) pluralSuffix = 's'
    if (hours > 0) return `~ ${hours} hour${pluralSuffix}`

    const minutes = Math.floor(seconds % 3600 / 60)
    if (minutes > 1) pluralSuffix = 's'

    return `~ ${minutes} minute${pluralSuffix}`
  }

  constructor (
    private formBuilder: FormBuilder,
    private router: Router,
    private notificationsService: NotificationsService,
    private userService: UserService,
    private serverService: ServerService
  ) {
    super()
  }

  get initialUserVideoQuota () {
    return this.serverService.getConfig().user.videoQuota
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

    this.serverService.configLoaded
      .subscribe(() => this.buildQuotaHelpIndication())
  }

  signup () {
    this.error = null

    const userCreate: UserCreate = this.form.value

    this.userService.signup(userCreate).subscribe(
      () => {
        this.notificationsService.success('Success', `Registration for ${userCreate.username} complete.`)
        this.router.navigate([ '/videos/list' ])
      },

      err => this.error = err.message
    )
  }

  private buildQuotaHelpIndication () {
    if (this.initialUserVideoQuota === -1) return

    const initialUserVideoQuotaBit = this.initialUserVideoQuota * 8

    // 1080p: ~ 6Mbps
    // 720p: ~ 4Mbps
    // 360p: ~ 1.5Mbps
    const fullHdSeconds = initialUserVideoQuotaBit / (6 * 1000 * 1000)
    const hdSeconds = initialUserVideoQuotaBit / (4 * 1000 * 1000)
    const normalSeconds = initialUserVideoQuotaBit / (1.5 * 1000 * 1000)

    const lines = [
      SignupComponent.getApproximateTime(fullHdSeconds) + ' of full HD videos',
      SignupComponent.getApproximateTime(hdSeconds) + ' of HD videos',
      SignupComponent.getApproximateTime(normalSeconds) + ' of average quality videos'
    ]

    this.quotaHelpIndication = lines.join('<br />')
  }
}
