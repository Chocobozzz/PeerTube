import { SelectChannelItem } from 'src/types/select-options-item.model'
import { Component, ElementRef, EventEmitter, OnInit, Output, ViewChild } from '@angular/core'
import { AuthService, Notifier } from '@app/core'
import { listUserChannelsForSelect } from '@app/helpers'
import { OWNERSHIP_CHANGE_CHANNEL_VALIDATOR } from '@app/shared/form-validators/video-ownership-change-validators'
import { FormReactive } from '@app/shared/shared-forms/form-reactive'
import { FormReactiveService } from '@app/shared/shared-forms/form-reactive.service'
import { NgbModal } from '@ng-bootstrap/ng-bootstrap'
import { VideoChangeOwnership } from '@peertube/peertube-models'
import { NgIf } from '@angular/common'
import { SelectChannelComponent } from '../../../shared/shared-forms/select/select-channel.component'
import { FormsModule, ReactiveFormsModule } from '@angular/forms'
import { GlobalIconComponent } from '../../../shared/shared-icons/global-icon.component'
import { VideoOwnershipService } from '@app/shared/shared-main/video/video-ownership.service'

@Component({
  selector: 'my-accept-ownership',
  templateUrl: './my-accept-ownership.component.html',
  styleUrls: [ './my-accept-ownership.component.scss' ],
  imports: [ GlobalIconComponent, FormsModule, ReactiveFormsModule, SelectChannelComponent, NgIf ]
})
export class MyAcceptOwnershipComponent extends FormReactive implements OnInit {
  @Output() accepted = new EventEmitter<void>()

  @ViewChild('modal', { static: true }) modal: ElementRef

  videoChangeOwnership: VideoChangeOwnership | undefined = undefined
  videoChannels: SelectChannelItem[]

  error: string = null

  constructor (
    protected formReactiveService: FormReactiveService,
    private videoOwnershipService: VideoOwnershipService,
    private notifier: Notifier,
    private authService: AuthService,
    private modalService: NgbModal
  ) {
    super()
  }

  ngOnInit () {
    this.videoChannels = []

    listUserChannelsForSelect(this.authService)
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
      .catch(() => {
        this.videoChangeOwnership = undefined
      })
  }

  acceptOwnership () {
    const channel = this.form.value['channel']

    const videoChangeOwnership = this.videoChangeOwnership
    this.videoOwnershipService
      .acceptOwnership(videoChangeOwnership.id, { channelId: channel })
      .subscribe({
        next: () => {
          this.notifier.success($localize`Ownership accepted`)
          if (this.accepted) this.accepted.emit()
          this.videoChangeOwnership = undefined
        },

        error: err => this.notifier.error(err.message)
      })
  }
}
