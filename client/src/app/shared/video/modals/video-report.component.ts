import { Component, Input, OnInit, ViewChild } from '@angular/core'
import { Notifier } from '@app/core'
import { FormReactive } from '../../../shared/forms'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { FormValidatorService } from '@app/shared/forms/form-validators/form-validator.service'
import { VideoAbuseValidatorsService } from '@app/shared/forms/form-validators/video-abuse-validators.service'
import { NgbModal } from '@ng-bootstrap/ng-bootstrap'
import { NgbModalRef } from '@ng-bootstrap/ng-bootstrap/modal/modal-ref'
import { VideoAbuseService } from '@app/shared/video-abuse'
import { Video } from '@app/shared/video/video.model'

@Component({
  selector: 'my-video-report',
  templateUrl: './video-report.component.html',
  styleUrls: [ './video-report.component.scss' ]
})
export class VideoReportComponent extends FormReactive implements OnInit {
  @Input() video: Video = null

  @ViewChild('modal', { static: true }) modal: NgbModal

  error: string = null

  private openedModal: NgbModalRef

  constructor (
    protected formValidatorService: FormValidatorService,
    private modalService: NgbModal,
    private videoAbuseValidatorsService: VideoAbuseValidatorsService,
    private videoAbuseService: VideoAbuseService,
    private notifier: Notifier,
    private i18n: I18n
  ) {
    super()
  }

  get currentHost () {
    return window.location.host
  }

  get originHost () {
    if (this.isRemoteVideo()) {
      return this.video.account.host
    }

    return ''
  }

  ngOnInit () {
    this.buildForm({
      reason: this.videoAbuseValidatorsService.VIDEO_ABUSE_REASON
    })
  }

  show () {
    this.openedModal = this.modalService.open(this.modal, { centered: true, keyboard: false })
  }

  hide () {
    this.openedModal.close()
    this.openedModal = null
  }

  report () {
    const reason = this.form.value['reason']

    this.videoAbuseService.reportVideo(this.video.id, reason)
                          .subscribe(
                            () => {
                              this.notifier.success(this.i18n('Video reported.'))
                              this.hide()
                            },

                            err => this.notifier.error(err.message)
                           )
  }

  isRemoteVideo () {
    return !this.video.isLocal
  }
}
