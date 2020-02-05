import { Component, EventEmitter, Input, OnInit, Output, ViewChild } from '@angular/core'
import { Notifier, RedirectService } from '@app/core'
import { VideoBlacklistService } from '../../../shared/video-blacklist'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { FormValidatorService } from '@app/shared/forms/form-validators/form-validator.service'
import { NgbModal } from '@ng-bootstrap/ng-bootstrap'
import { NgbModalRef } from '@ng-bootstrap/ng-bootstrap/modal/modal-ref'
import { FormReactive, VideoBlacklistValidatorsService } from '@app/shared/forms'
import { Video } from '@app/shared/video/video.model'

@Component({
  selector: 'my-video-blacklist',
  templateUrl: './video-blacklist.component.html',
  styleUrls: [ './video-blacklist.component.scss' ]
})
export class VideoBlacklistComponent extends FormReactive implements OnInit {
  @Input() video: Video = null

  @ViewChild('modal', { static: true }) modal: NgbModal

  @Output() videoBlacklisted = new EventEmitter()

  error: string = null

  private openedModal: NgbModalRef

  constructor (
    protected formValidatorService: FormValidatorService,
    private modalService: NgbModal,
    private videoBlacklistValidatorsService: VideoBlacklistValidatorsService,
    private videoBlacklistService: VideoBlacklistService,
    private notifier: Notifier,
    private redirectService: RedirectService,
    private i18n: I18n
  ) {
    super()
  }

  ngOnInit () {
    const defaultValues = { unfederate: 'true' }

    this.buildForm({
      reason: this.videoBlacklistValidatorsService.VIDEO_BLACKLIST_REASON,
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

  blacklist () {
    const reason = this.form.value[ 'reason' ] || undefined
    const unfederate = this.video.isLocal ? this.form.value[ 'unfederate' ] : undefined

    this.videoBlacklistService.blacklistVideo(this.video.id, reason, unfederate)
        .subscribe(
          () => {
            this.notifier.success(this.i18n('Video blacklisted.'))
            this.hide()

            this.video.blacklisted = true
            this.video.blacklistedReason = reason

            this.videoBlacklisted.emit()
          },

          err => this.notifier.error(err.message)
        )
  }
}
