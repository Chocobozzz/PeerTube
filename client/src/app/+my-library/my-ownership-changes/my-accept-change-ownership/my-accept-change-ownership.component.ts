import { Component, ElementRef, OnInit, inject, output, viewChild } from '@angular/core'
import { FormsModule, ReactiveFormsModule } from '@angular/forms'
import { AuthService, Notifier } from '@app/core'
import { formatICU, listUserChannelsForSelect } from '@app/helpers'
import { OWNERSHIP_CHANGE_CHANNEL_VALIDATOR } from '@app/shared/form-validators/video-ownership-change-validators'
import { FormReactive } from '@app/shared/shared-forms/form-reactive'
import { FormReactiveService } from '@app/shared/shared-forms/form-reactive.service'
import { ChangeOwnershipService } from '@app/shared/shared-main/video/change-ownership.service'
import { NgbModal } from '@ng-bootstrap/ng-bootstrap'
import { ChangeOwnership } from '@peertube/peertube-models'
import { SelectChannelItem } from '@pt-types'
import { SelectChannelComponent } from '../../../shared/shared-forms/select/select-channel.component'
import { GlobalIconComponent } from '../../../shared/shared-icons/global-icon.component'

@Component({
  selector: 'my-accept-change-ownership',
  templateUrl: './my-accept-change-ownership.component.html',
  styleUrls: [ './my-accept-change-ownership.component.scss' ],
  imports: [ GlobalIconComponent, FormsModule, ReactiveFormsModule, SelectChannelComponent ]
})
export class MyAcceptChangeOwnershipComponent extends FormReactive implements OnInit {
  protected formReactiveService = inject(FormReactiveService)
  private changeOwnershipService = inject(ChangeOwnershipService)
  private notifier = inject(Notifier)
  private authService = inject(AuthService)
  private modalService = inject(NgbModal)

  readonly accepted = output()

  readonly modal = viewChild<ElementRef>('modal')

  ownershipChanges: ChangeOwnership[] = []

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

  show (entries: ChangeOwnership[]) {
    // Select the first available channel by default
    this.form.patchValue({ channel: this.videoChannels[0].id })

    this.ownershipChanges = entries

    this.modalService
      .open(this.modal(), { centered: true })
      .result
      .then(() => this.acceptOwnership())
      .catch(() => {
        this.ownershipChanges = []
      })
  }

  acceptOwnership () {
    const channel = this.form.value['channel']

    this.changeOwnershipService
      .acceptVideo(this.ownershipChanges.map(change => change.id), { channelId: channel })
      .subscribe({
        next: () => {
          const count = this.ownershipChanges.length

          const message = formatICU($localize`{count, plural, =1 {Video {videoName} accepted} other {{count} videos accepted}}`, {
            count,
            videoName: this.ownershipChanges[0].video.name
          })

          this.notifier.success(message)

          if (this.accepted) this.accepted.emit()
        },

        error: err => this.notifier.handleError(err)
      })
  }

  getModalTitle () {
    const count = this.ownershipChanges.length

    return formatICU($localize`{count, plural, =1 {Accept video} other {Accept {count} videos}}`, { count })
  }
}
