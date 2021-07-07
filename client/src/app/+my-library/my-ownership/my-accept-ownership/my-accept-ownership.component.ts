import { SelectChannelItem } from 'src/types/select-options-item.model'
import { Component, ElementRef, EventEmitter, OnInit, Output, ViewChild } from '@angular/core'
import { AuthService, Notifier } from '@app/core'
import { listUserChannels } from '@app/helpers'
import { OWNERSHIP_CHANGE_CHANNEL_VALIDATOR } from '@app/shared/form-validators/video-ownership-change-validators'
import { FormReactive, FormValidatorService } from '@app/shared/shared-forms'
import { VideoOwnershipService } from '@app/shared/shared-main'
import { NgbModal } from '@ng-bootstrap/ng-bootstrap'
import { VideoChangeOwnership } from '@shared/models'

@Component({
  selector: 'my-accept-ownership',
  templateUrl: './my-accept-ownership.component.html',
  styleUrls: [ './my-accept-ownership.component.scss' ]
})
export class MyAcceptOwnershipComponent extends FormReactive implements OnInit {
  @Output() accepted = new EventEmitter<void>()

  @ViewChild('modal', { static: true }) modal: ElementRef

  videoChangeOwnership: VideoChangeOwnership | undefined = undefined
  videoChannels: SelectChannelItem[]

  error: string = null

  constructor (
    protected formValidatorService: FormValidatorService,
    private videoOwnershipService: VideoOwnershipService,
    private notifier: Notifier,
    private authService: AuthService,
    private modalService: NgbModal
    ) {
    super()
  }

  ngOnInit () {
    this.videoChannels = []

    listUserChannels(this.authService)
      .subscribe(channels => this.videoChannels = channels)

    this.buildForm({
      channel: OWNERSHIP_CHANGE_CHANNEL_VALIDATOR
    })
  }

  show (videoChangeOwnership: VideoChangeOwnership) {
    // Select the first available channel by default
    this.form.patchValue({
      channel: this.videoChannels[0].id
    })

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
          this.notifier.success($localize`Ownership accepted`)
          if (this.accepted) this.accepted.emit()
          this.videoChangeOwnership = undefined
        },

        err => this.notifier.error(err.message)
      )
  }
}
