import { Component, EventEmitter, OnInit, Output, ViewChild } from '@angular/core'
import { Notifier } from '@app/core'
import { FormReactive, FormValidatorService, VideoAbuseValidatorsService } from '@app/shared/shared-forms'
import { VideoAbuseService } from '@app/shared/shared-moderation'
import { NgbModal } from '@ng-bootstrap/ng-bootstrap'
import { NgbModalRef } from '@ng-bootstrap/ng-bootstrap/modal/modal-ref'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { VideoAbuse } from '@shared/models'

@Component({
  selector: 'my-moderation-comment-modal',
  templateUrl: './moderation-comment-modal.component.html',
  styleUrls: [ './moderation-comment-modal.component.scss' ]
})
export class ModerationCommentModalComponent extends FormReactive implements OnInit {
  @ViewChild('modal', { static: true }) modal: NgbModal
  @Output() commentUpdated = new EventEmitter<string>()

  private abuseToComment: VideoAbuse
  private openedModal: NgbModalRef

  constructor (
    protected formValidatorService: FormValidatorService,
    private modalService: NgbModal,
    private notifier: Notifier,
    private videoAbuseService: VideoAbuseService,
    private videoAbuseValidatorsService: VideoAbuseValidatorsService,
    private i18n: I18n
  ) {
    super()
  }

  ngOnInit () {
    this.buildForm({
      moderationComment: this.videoAbuseValidatorsService.VIDEO_ABUSE_MODERATION_COMMENT
    })
  }

  openModal (abuseToComment: VideoAbuse) {
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

  async banUser () {
    const moderationComment: string = this.form.value[ 'moderationComment' ]

    this.videoAbuseService.updateVideoAbuse(this.abuseToComment, { moderationComment })
        .subscribe(
          () => {
            this.notifier.success(this.i18n('Comment updated.'))

            this.commentUpdated.emit(moderationComment)
            this.hide()
          },

          err => this.notifier.error(err.message)
        )
  }

}
