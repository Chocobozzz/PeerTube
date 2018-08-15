import { Component, Input, OnInit, ViewChild } from '@angular/core'
import { NotificationsService } from 'angular2-notifications'
import { FormReactive, VideoBlacklistService, VideoBlacklistValidatorsService } from '../../../shared/index'
import { VideoDetails } from '../../../shared/video/video-details.model'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { FormValidatorService } from '@app/shared/forms/form-validators/form-validator.service'
import { NgbModal } from '@ng-bootstrap/ng-bootstrap'
import { NgbModalRef } from '@ng-bootstrap/ng-bootstrap/modal/modal-ref'
import { RedirectService } from '@app/core'

@Component({
  selector: 'my-video-blacklist',
  templateUrl: './video-blacklist.component.html',
  styleUrls: [ './video-blacklist.component.scss' ]
})
export class VideoBlacklistComponent extends FormReactive implements OnInit {
  @Input() video: VideoDetails = null

  @ViewChild('modal') modal: NgbModal

  error: string = null

  private openedModal: NgbModalRef

  constructor (
    protected formValidatorService: FormValidatorService,
    private modalService: NgbModal,
    private videoBlacklistValidatorsService: VideoBlacklistValidatorsService,
    private videoBlacklistService: VideoBlacklistService,
    private notificationsService: NotificationsService,
    private redirectService: RedirectService,
    private i18n: I18n
  ) {
    super()
  }

  ngOnInit () {
    this.buildForm({
      reason: this.videoBlacklistValidatorsService.VIDEO_BLACKLIST_REASON
    })
  }

  show () {
    this.openedModal = this.modalService.open(this.modal, { keyboard: false })
  }

  hide () {
    this.openedModal.close()
    this.openedModal = null
  }

  blacklist () {
    const reason = this.form.value[ 'reason' ] || undefined

    this.videoBlacklistService.blacklistVideo(this.video.id, reason)
        .subscribe(
          () => {
            this.notificationsService.success(this.i18n('Success'), this.i18n('Video blacklisted.'))
            this.hide()
            this.redirectService.redirectToHomepage()
          },

          err => this.notificationsService.error(this.i18n('Error'), err.message)
        )
  }
}
