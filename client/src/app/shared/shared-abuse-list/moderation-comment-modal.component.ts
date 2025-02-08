import { Component, EventEmitter, OnInit, Output, ViewChild } from '@angular/core'
import { Notifier } from '@app/core'
import { FormReactive } from '@app/shared/shared-forms/form-reactive'
import { FormReactiveService } from '@app/shared/shared-forms/form-reactive.service'
import { NgbModal } from '@ng-bootstrap/ng-bootstrap'
import { NgbModalRef } from '@ng-bootstrap/ng-bootstrap/modal/modal-ref'
import { AdminAbuse } from '@peertube/peertube-models'
import { ABUSE_MODERATION_COMMENT_VALIDATOR } from '../form-validators/abuse-validators'
import { NgClass, NgIf } from '@angular/common'
import { FormsModule, ReactiveFormsModule } from '@angular/forms'
import { GlobalIconComponent } from '../shared-icons/global-icon.component'
import { AbuseService } from '../shared-moderation/abuse.service'

@Component({
  selector: 'my-moderation-comment-modal',
  templateUrl: './moderation-comment-modal.component.html',
  styleUrls: [ './moderation-comment-modal.component.scss' ],
  imports: [ GlobalIconComponent, FormsModule, ReactiveFormsModule, NgClass, NgIf ]
})
export class ModerationCommentModalComponent extends FormReactive implements OnInit {
  @ViewChild('modal', { static: true }) modal: NgbModal
  @Output() commentUpdated = new EventEmitter<string>()

  private abuseToComment: AdminAbuse
  private openedModal: NgbModalRef

  constructor (
    protected formReactiveService: FormReactiveService,
    private modalService: NgbModal,
    private notifier: Notifier,
    private abuseService: AbuseService
  ) {
    super()
  }

  ngOnInit () {
    this.buildForm({
      moderationComment: ABUSE_MODERATION_COMMENT_VALIDATOR
    })
  }

  openModal (abuseToComment: AdminAbuse) {
    this.abuseToComment = abuseToComment
    this.openedModal = this.modalService.open(this.modal, { centered: true })

    this.form.patchValue({
      moderationComment: this.abuseToComment.moderationComment
    })
  }

  hide () {
    this.abuseToComment = undefined
    this.openedModal.close()
    this.form.reset()
  }

  banUser () {
    const moderationComment: string = this.form.value['moderationComment']

    this.abuseService.updateAbuse(this.abuseToComment, { moderationComment })
        .subscribe({
          next: () => {
            this.notifier.success($localize`Comment updated.`)

            this.commentUpdated.emit(moderationComment)
            this.hide()
          },

          error: err => this.notifier.error(err.message)
        })
  }

}
