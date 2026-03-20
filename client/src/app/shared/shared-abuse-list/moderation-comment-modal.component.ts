import { NgClass } from '@angular/common'
import { Component, OnInit, inject, output, viewChild } from '@angular/core'
import { FormsModule, ReactiveFormsModule } from '@angular/forms'
import { formatICU } from '@app/helpers'
import { Notifier } from '@app/core'
import { FormReactive } from '@app/shared/shared-forms/form-reactive'
import { FormReactiveService } from '@app/shared/shared-forms/form-reactive.service'
import { NgbModal, NgbModalRef } from '@ng-bootstrap/ng-bootstrap'
import { arrayify } from '@peertube/peertube-core-utils'
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

  abusesToComment: AdminAbuse[] = []
  private openedModal: NgbModalRef

  ngOnInit () {
    this.buildForm({
      moderationComment: ABUSE_MODERATION_COMMENT_VALIDATOR
    })
  }

  openModal (abuseToCommentArg: AdminAbuse | AdminAbuse[]) {
    this.abusesToComment = arrayify(abuseToCommentArg)
    this.openedModal = this.modalService.open(this.modal(), { centered: true })

    this.form.patchValue({
      moderationComment: this.abusesToComment.length === 1
        ? this.abusesToComment[0].moderationComment
        : ''
    })
  }

  hide () {
    this.abusesToComment = []
    this.openedModal.close()
    this.form.reset()
  }

  hasMultipleAbuses () {
    return this.abusesToComment.length > 1
  }

  getSubmitLabel () {
    return formatICU(
      $localize`{count, plural, =1 {Update this comment} other {Update all comments}}`,
      { count: this.abusesToComment.length }
    )
  }

  getModalTitle () {
    return formatICU(
      $localize`{count, plural, =1 {Moderation comment} other {Moderation comments}}`,
      { count: this.abusesToComment.length }
    )
  }

  banUser () {
    const moderationComment: string = this.form.value['moderationComment']

    this.abuseService.updateAbuse(this.abusesToComment, { moderationComment })
      .subscribe({
        next: () => {
          this.notifier.success(
            formatICU(
              $localize`{count, plural, =1 {Comment updated.} other {{count} comments updated.}}`,
              { count: this.abusesToComment.length }
            )
          )

          this.commentUpdated.emit(moderationComment)
          this.hide()
        },

        error: err => this.notifier.handleError(err)
      })
  }
}
