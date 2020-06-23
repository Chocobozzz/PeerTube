import { Component, ElementRef, EventEmitter, OnInit, Output, ViewChild } from '@angular/core'
import { AuthService, Notifier } from '@app/core'
import { FormReactive, FormValidatorService, VideoAcceptOwnershipValidatorsService } from '@app/shared/shared-forms'
import { VideoChannelService, VideoOwnershipService } from '@app/shared/shared-main'
import { NgbModal } from '@ng-bootstrap/ng-bootstrap'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { VideoChangeOwnership, VideoChannel } from '@shared/models'

@Component({
  selector: 'my-account-accept-ownership',
  templateUrl: './my-account-accept-ownership.component.html',
  styleUrls: [ './my-account-accept-ownership.component.scss' ]
})
export class MyAccountAcceptOwnershipComponent extends FormReactive implements OnInit {
  @Output() accepted = new EventEmitter<void>()

  @ViewChild('modal', { static: true }) modal: ElementRef

  videoChangeOwnership: VideoChangeOwnership | undefined = undefined

  videoChannels: VideoChannel[]

  error: string = null

  constructor (
    protected formValidatorService: FormValidatorService,
    private videoChangeOwnershipValidatorsService: VideoAcceptOwnershipValidatorsService,
    private videoOwnershipService: VideoOwnershipService,
    private notifier: Notifier,
    private authService: AuthService,
    private videoChannelService: VideoChannelService,
    private modalService: NgbModal,
    private i18n: I18n
  ) {
    super()
  }

  ngOnInit () {
    this.videoChannels = []

    this.videoChannelService.listAccountVideoChannels(this.authService.getUser().account)
      .subscribe(videoChannels => this.videoChannels = videoChannels.data)

    this.buildForm({
      channel: this.videoChangeOwnershipValidatorsService.CHANNEL
    })
  }

  show (videoChangeOwnership: VideoChangeOwnership) {
    this.videoChangeOwnership = videoChangeOwnership
    this.modalService
      .open(this.modal, { centered: true })
      .result
      .then(() => this.acceptOwnership())
      .catch(() => this.videoChangeOwnership = undefined)
  }

  acceptOwnership () {
    const channel = this.form.value['channel']

    const videoChangeOwnership = this.videoChangeOwnership
    this.videoOwnershipService
      .acceptOwnership(videoChangeOwnership.id, { channelId: channel })
      .subscribe(
        () => {
          this.notifier.success(this.i18n('Ownership accepted'))
          if (this.accepted) this.accepted.emit()
          this.videoChangeOwnership = undefined
        },

        err => this.notifier.error(err.message)
      )
  }
}
