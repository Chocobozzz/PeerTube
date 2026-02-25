import { NgClass } from '@angular/common'
import { Component, OnInit, inject, output, viewChild } from '@angular/core'
import { FormsModule, ReactiveFormsModule } from '@angular/forms'
import { Notifier } from '@app/core'
import { FormReactive } from '@app/shared/shared-forms/form-reactive'
import { FormReactiveService } from '@app/shared/shared-forms/form-reactive.service'
import { NgbModal, NgbModalRef } from '@ng-bootstrap/ng-bootstrap'
import { AdminAbuse } from '@peertube/peertube-models'
import { ABUSE_MODERATION_COMMENT_VALIDATOR } from '../form-validators/abuse-validators'
import { GlobalIconComponent } from '../shared-icons/global-icon.component'
import { AbuseService } from '../shared-moderation/abuse.service'

@Component({
  selector: 'my-moderation-comment-modal',
  templateUrl: './moderation-comment-modal.component.html',
  styleUrls: [ './moderation-comment-modal.component.scss' ],
  imports: [ GlobalIconComponent, FormsModule, ReactiveFormsModule, NgClass ]
})
export class ModerationCommentModalComponent extends FormReactive implements OnInit {
  protected formReactiveService = inject(FormReactiveService)
  private modalService = inject(NgbModal)
  private notifier = inject(Notifier)
  private abuseService = inject(AbuseService)

  readonly modal = viewChild<NgbModal>('modal')
  readonly commentUpdated = output<string>()

  private abuseToComment: AdminAbuse
  private openedModal: NgbModalRef

  ngOnInit () {
    this.buildForm({
      moderationComment: ABUSE_MODERATION_COMMENT_VALIDATOR
    })
  }

  openModal (abuseToComment: AdminAbuse) {
    this.abuseToComment = abuseToComment
    this.openedModal = this.modalService.open(this.modal(), { centered: true })

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

        error: err => this.notifier.handleError(err)
      })
  }
}
