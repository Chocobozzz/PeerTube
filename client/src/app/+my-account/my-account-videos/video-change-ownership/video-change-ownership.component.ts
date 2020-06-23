import { Component, ElementRef, OnInit, ViewChild } from '@angular/core'
import { Notifier, UserService } from '@app/core'
import { FormReactive, FormValidatorService, VideoChangeOwnershipValidatorsService } from '@app/shared/shared-forms'
import { Video, VideoOwnershipService } from '@app/shared/shared-main'
import { NgbModal } from '@ng-bootstrap/ng-bootstrap'
import { I18n } from '@ngx-translate/i18n-polyfill'

@Component({
  selector: 'my-video-change-ownership',
  templateUrl: './video-change-ownership.component.html',
  styleUrls: [ './video-change-ownership.component.scss' ]
})
export class VideoChangeOwnershipComponent extends FormReactive implements OnInit {
  @ViewChild('modal', { static: true }) modal: ElementRef

  usernamePropositions: string[]

  error: string = null

  private video: Video | undefined = undefined

  constructor (
    protected formValidatorService: FormValidatorService,
    private videoChangeOwnershipValidatorsService: VideoChangeOwnershipValidatorsService,
    private videoOwnershipService: VideoOwnershipService,
    private notifier: Notifier,
    private userService: UserService,
    private modalService: NgbModal,
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

  show (video: Video) {
    this.video = video
    this.modalService
      .open(this.modal, { centered: true })
      .result
      .then(() => this.changeOwnership())
      .catch((_) => _) // Called when closing (cancel) the modal without validating, do nothing
  }

  search (event: { query: string }) {
    const query = event.query
    this.userService.autocomplete(query)
      .subscribe(
        usernames => this.usernamePropositions = usernames,

        err => this.notifier.error(err.message)
      )
  }

  changeOwnership () {
    const username = this.form.value['username']

    this.videoOwnershipService
      .changeOwnership(this.video.id, username)
      .subscribe(
        () => this.notifier.success(this.i18n('Ownership change request sent.')),

        err => this.notifier.error(err.message)
      )
  }
}
