import { Component, ElementRef, OnInit, ViewChild } from '@angular/core'
import { Notifier, UserService } from '@app/core'
import { OWNERSHIP_CHANGE_USERNAME_VALIDATOR } from '@app/shared/form-validators/video-ownership-change-validators'
import { FormReactive } from '@app/shared/shared-forms/form-reactive'
import { FormReactiveService } from '@app/shared/shared-forms/form-reactive.service'
import { NgbModal } from '@ng-bootstrap/ng-bootstrap'
import { NgIf } from '@angular/common'
import { AutoCompleteModule } from 'primeng/autocomplete'
import { FormsModule, ReactiveFormsModule } from '@angular/forms'
import { GlobalIconComponent } from '../../../shared/shared-icons/global-icon.component'
import { VideoOwnershipService } from '@app/shared/shared-main/video/video-ownership.service'
import { Video } from '@app/shared/shared-main/video/video.model'

@Component({
  selector: 'my-video-change-ownership',
  templateUrl: './video-change-ownership.component.html',
  styleUrls: [ './video-change-ownership.component.scss' ],
  imports: [ GlobalIconComponent, FormsModule, ReactiveFormsModule, AutoCompleteModule, NgIf ]
})
export class VideoChangeOwnershipComponent extends FormReactive implements OnInit {
  @ViewChild('modal', { static: true }) modal: ElementRef

  usernamePropositions: string[]

  error: string = null

  private video: Video | undefined = undefined

  constructor (
    protected formReactiveService: FormReactiveService,
    private videoOwnershipService: VideoOwnershipService,
    private notifier: Notifier,
    private userService: UserService,
    private modalService: NgbModal
  ) {
    super()
  }

  ngOnInit () {
    this.buildForm({
      username: OWNERSHIP_CHANGE_USERNAME_VALIDATOR
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
      .subscribe({
        next: usernames => {
          this.usernamePropositions = usernames
        },

        error: err => this.notifier.error(err.message)
      })
  }

  changeOwnership () {
    const username = this.form.value['username']

    this.videoOwnershipService
      .changeOwnership(this.video.id, username)
      .subscribe({
        next: () => this.notifier.success($localize`Ownership change request sent.`),

        error: err => this.notifier.error(err.message)
      })
  }
}
