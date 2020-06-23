import { Component, EventEmitter, Input, OnInit, Output, ViewChild } from '@angular/core'
import { Notifier } from '@app/core'
import { FormReactive, FormValidatorService, VideoBlockValidatorsService } from '@app/shared/shared-forms'
import { Video } from '@app/shared/shared-main'
import { NgbModal } from '@ng-bootstrap/ng-bootstrap'
import { NgbModalRef } from '@ng-bootstrap/ng-bootstrap/modal/modal-ref'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { VideoBlockService } from './video-block.service'

@Component({
  selector: 'my-video-block',
  templateUrl: './video-block.component.html',
  styleUrls: [ './video-block.component.scss' ]
})
export class VideoBlockComponent extends FormReactive implements OnInit {
  @Input() video: Video = null

  @ViewChild('modal', { static: true }) modal: NgbModal

  @Output() videoBlocked = new EventEmitter()

  error: string = null

  private openedModal: NgbModalRef

  constructor (
    protected formValidatorService: FormValidatorService,
    private modalService: NgbModal,
    private videoBlockValidatorsService: VideoBlockValidatorsService,
    private videoBlocklistService: VideoBlockService,
    private notifier: Notifier,
    private i18n: I18n
  ) {
    super()
  }

  ngOnInit () {
    const defaultValues = { unfederate: 'true' }

    this.buildForm({
      reason: this.videoBlockValidatorsService.VIDEO_BLOCK_REASON,
      unfederate: null
    }, defaultValues)
  }

  show () {
    this.openedModal = this.modalService.open(this.modal, { centered: true, keyboard: false })
  }

  hide () {
    this.openedModal.close()
    this.openedModal = null
  }

  block () {
    const reason = this.form.value[ 'reason' ] || undefined
    const unfederate = this.video.isLocal ? this.form.value[ 'unfederate' ] : undefined

    this.videoBlocklistService.blockVideo(this.video.id, reason, unfederate)
        .subscribe(
          () => {
            this.notifier.success(this.i18n('Video blocked.'))
            this.hide()

            this.video.blacklisted = true
            this.video.blockedReason = reason

            this.videoBlocked.emit()
          },

          err => this.notifier.error(err.message)
        )
  }
}
