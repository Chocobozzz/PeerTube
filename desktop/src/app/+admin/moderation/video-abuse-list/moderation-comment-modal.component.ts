import { Component, EventEmitter, OnInit, Output, ViewChild } from '@angular/core'
import { NotificationsService } from 'angular2-notifications'
import { FormReactive, VideoAbuseService, VideoAbuseValidatorsService } from '../../../shared'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { NgbModal } from '@ng-bootstrap/ng-bootstrap'
import { NgbModalRef } from '@ng-bootstrap/ng-bootstrap/modal/modal-ref'
import { FormValidatorService } from '../../../shared/forms/form-validators/form-validator.service'
import { VideoAbuse } from '../../../../../../shared/models/videos'

@Component({
  selector: 'my-moderation-comment-modal',
  templateUrl: './moderation-comment-modal.component.html',
  styleUrls: [ './moderation-comment-modal.component.scss' ]
})
export class ModerationCommentModalComponent extends FormReactive implements OnInit {
  @ViewChild('modal') modal: NgbModal
  @Output() commentUpdated = new EventEmitter<string>()

  private abuseToComment: VideoAbuse
  private openedModal: NgbModalRef

  constructor (
    protected formValidatorService: FormValidatorService,
    private modalService: NgbModal,
    private notificationsService: NotificationsService,
    private videoAbuseService: VideoAbuseService,
    private videoAbuseValidatorsService: VideoAbuseValidatorsService,
    private i18n: I18n
  ) {
    super()
  }

  ngOnInit () {
    this.buildForm({
      moderationComment: this.videoAbuseValidatorsService.VIDEO_ABUSE_REASON
    })
  }

  openModal (abuseToComment: VideoAbuse) {
    this.abuseToComment = abuseToComment
    this.openedModal = this.modalService.open(this.modal)

    this.form.patchValue({
      moderationComment: this.abuseToComment.moderationComment
    })
  }

  hideModerationCommentModal () {
    this.abuseToComment = undefined
    this.openedModal.close()
    this.form.reset()
  }

  async banUser () {
    const moderationComment: string = this.form.value['moderationComment']

    this.videoAbuseService.updateVideoAbuse(this.abuseToComment, { moderationComment })
      .subscribe(
        () => {
          this.notificationsService.success(
            this.i18n('Success'),
            this.i18n('Comment updated.')
          )

          this.commentUpdated.emit(moderationComment)
          this.hideModerationCommentModal()
        },

          err => this.notificationsService.error(this.i18n('Error'), err.message)
      )
  }

}
