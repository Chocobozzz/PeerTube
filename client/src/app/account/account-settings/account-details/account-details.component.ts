import { Component, Input, OnInit } from '@angular/core'
import { FormBuilder, FormGroup } from '@angular/forms'
import { NotificationsService } from 'angular2-notifications'
import { UserUpdateMe } from '../../../../../../shared'
import { AuthService } from '../../../core'
import { FormReactive, User, UserService } from '../../../shared'

@Component({
  selector: 'my-account-details',
  templateUrl: './account-details.component.html',
  styleUrls: [ './account-details.component.scss' ]
})

export class AccountDetailsComponent extends FormReactive implements OnInit {
  @Input() user: User = null

  form: FormGroup
  formErrors = {}
  validationMessages = {}

  constructor (
    private authService: AuthService,
    private formBuilder: FormBuilder,
    private notificationsService: NotificationsService,
    private userService: UserService
  ) {
    super()
  }

  buildForm () {
    this.form = this.formBuilder.group({
      displayNSFW: [ this.user.displayNSFW ],
      autoPlayVideo: [ this.user.autoPlayVideo ]
    })

    this.form.valueChanges.subscribe(data => this.onValueChanged(data))
  }

  ngOnInit () {
    this.buildForm()
  }

  updateDetails () {
    const displayNSFW = this.form.value['displayNSFW']
    const autoPlayVideo = this.form.value['autoPlayVideo']
    const details: UserUpdateMe = {
      displayNSFW,
      autoPlayVideo
    }

    this.userService.updateMyDetails(details).subscribe(
      () => {
        this.notificationsService.success('Success', 'Information updated.')

        this.authService.refreshUserInformation()
      },

      err => this.notificationsService.error('Error', err.message)
    )
  }
}
