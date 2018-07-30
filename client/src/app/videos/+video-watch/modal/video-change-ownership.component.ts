import { Component, Input, OnInit, ViewChild } from '@angular/core'
import { NotificationsService } from 'angular2-notifications'
import { ModalDirective } from 'ngx-bootstrap/modal'
import { FormReactive, UserService } from '@app/shared'
import { VideoDetails } from '@app/shared/video/video-details.model'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { FormValidatorService } from '@app/shared/forms/form-validators/form-validator.service'
import { VideoOwnershipService } from '@app/shared/video-ownership'
import { VideoChangeOwnershipValidatorsService } from '@app/shared/forms/form-validators/video-change-ownership-validators.service'

@Component({
  selector: 'my-video-change-ownership',
  templateUrl: './video-change-ownership.component.html',
  styleUrls: ['./video-change-ownership.component.scss']
})
export class VideoChangeOwnershipComponent extends FormReactive implements OnInit {
  @Input() video: VideoDetails = null

  @ViewChild('modal') modal: ModalDirective

  usernamePropositions: string[]

  error: string = null

  constructor (
    protected formValidatorService: FormValidatorService,
    private videoChangeOwnershipValidatorsService: VideoChangeOwnershipValidatorsService,
    private videoOwnershipService: VideoOwnershipService,
    private notificationsService: NotificationsService,
    private userService: UserService,
    private i18n: I18n
  ) {
    super()
  }

  ngOnInit () {
    this.buildForm({
      username: this.videoChangeOwnershipValidatorsService.USERNAME
    })
    this.usernamePropositions = []
  }

  show () {
    this.modal.show()
  }

  hide () {
    this.modal.hide()
  }

  search (event) {
    const query = event.query
    this.userService.autocomplete(query)
      .subscribe(
        (usernames) => {
          this.usernamePropositions = usernames
        },

        err => this.notificationsService.error('Error', err.message)
      )
  }

  changeOwnership () {
    const username = this.form.value['username']

    this.videoOwnershipService
      .changeOwnership(this.video.id, username)
      .subscribe(
        () => {
          this.notificationsService.success(this.i18n('Success'), this.i18n('Ownership changed.'))
          this.hide()
        },

        err => this.notificationsService.error(this.i18n('Error'), err.message)
      )
  }
}
