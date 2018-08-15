import { Component, Input, OnInit, ViewChild } from '@angular/core'
import { NotificationsService } from 'angular2-notifications'
import { FormReactive, VideoAbuseService } from '../../../shared/index'
import { VideoDetails } from '../../../shared/video/video-details.model'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { FormValidatorService } from '@app/shared/forms/form-validators/form-validator.service'
import { VideoAbuseValidatorsService } from '@app/shared/forms/form-validators/video-abuse-validators.service'
import { NgbModal } from '@ng-bootstrap/ng-bootstrap'
import { NgbModalRef } from '@ng-bootstrap/ng-bootstrap/modal/modal-ref'

@Component({
  selector: 'my-video-report',
  templateUrl: './video-report.component.html',
  styleUrls: [ './video-report.component.scss' ]
})
export class VideoReportComponent extends FormReactive implements OnInit {
  @Input() video: VideoDetails = null

  @ViewChild('modal') modal: NgbModal

  error: string = null

  private openedModal: NgbModalRef

  constructor (
    protected formValidatorService: FormValidatorService,
    private modalService: NgbModal,
    private videoAbuseValidatorsService: VideoAbuseValidatorsService,
    private videoAbuseService: VideoAbuseService,
    private notificationsService: NotificationsService,
    private i18n: I18n
  ) {
    super()
  }

  ngOnInit () {
    this.buildForm({
      reason: this.videoAbuseValidatorsService.VIDEO_ABUSE_REASON
    })
  }

  show () {
    this.openedModal = this.modalService.open(this.modal, { keyboard: false })
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
                              this.notificationsService.success(this.i18n('Success'), this.i18n('Video reported.'))
                              this.hide()
                            },

                            err => this.notificationsService.error(this.i18n('Error'), err.message)
                           )
  }
}
