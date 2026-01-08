import { Component, ElementRef, OnInit, inject, output, viewChild } from '@angular/core'
import { FormsModule, ReactiveFormsModule } from '@angular/forms'
import { AuthService, Notifier } from '@app/core'
import { listUserChannelsForSelect } from '@app/helpers'
import { OWNERSHIP_CHANGE_CHANNEL_VALIDATOR } from '@app/shared/form-validators/video-ownership-change-validators'
import { FormReactive } from '@app/shared/shared-forms/form-reactive'
import { FormReactiveService } from '@app/shared/shared-forms/form-reactive.service'
import { VideoOwnershipService } from '@app/shared/shared-main/video/video-ownership.service'
import { NgbModal } from '@ng-bootstrap/ng-bootstrap'
import { VideoChangeOwnership } from '@peertube/peertube-models'
import { SelectChannelItem } from 'src/types/select-options-item.model'
import { SelectChannelComponent } from '../../../shared/shared-forms/select/select-channel.component'
import { GlobalIconComponent } from '../../../shared/shared-icons/global-icon.component'

@Component({
  selector: 'my-accept-ownership',
  templateUrl: './my-accept-ownership.component.html',
  styleUrls: [ './my-accept-ownership.component.scss' ],
  imports: [ GlobalIconComponent, FormsModule, ReactiveFormsModule, SelectChannelComponent ]
})
export class MyAcceptOwnershipComponent extends FormReactive implements OnInit {
  protected formReactiveService = inject(FormReactiveService)
  private videoOwnershipService = inject(VideoOwnershipService)
  private notifier = inject(Notifier)
  private authService = inject(AuthService)
  private modalService = inject(NgbModal)

  readonly accepted = output()

  readonly modal = viewChild<ElementRef>('modal')

  videoChangeOwnership: VideoChangeOwnership | undefined = undefined
  videoChannels: SelectChannelItem[]

  error: string = null

  ngOnInit () {
    this.videoChannels = []

    listUserChannelsForSelect(this.authService, { includeCollaborations: false })
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
      .open(this.modal(), { centered: true })
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

        error: err => this.notifier.handleError(err)
      })
  }
}
