import { Component, EventEmitter, OnInit, Output, ViewChild } from '@angular/core'
import { Notifier } from '@app/core'
import { formatICU } from '@app/helpers'
import { FormReactive } from '@app/shared/shared-forms/form-reactive'
import { FormReactiveService } from '@app/shared/shared-forms/form-reactive.service'
import { Video } from '@app/shared/shared-main/video/video.model'
import { NgbModal } from '@ng-bootstrap/ng-bootstrap'
import { NgbModalRef } from '@ng-bootstrap/ng-bootstrap/modal/modal-ref'
import { VIDEO_BLOCK_REASON_VALIDATOR } from '../form-validators/video-block-validators'
import { VideoBlockService } from './video-block.service'
import { PeertubeCheckboxComponent } from '../shared-forms/peertube-checkbox.component'
import { FormsModule, ReactiveFormsModule } from '@angular/forms'
import { GlobalIconComponent } from '../shared-icons/global-icon.component'
import { NgIf, NgClass } from '@angular/common'

@Component({
  selector: 'my-video-block',
  templateUrl: './video-block.component.html',
  styleUrls: [ './video-block.component.scss' ],
  imports: [ NgIf, GlobalIconComponent, FormsModule, ReactiveFormsModule, NgClass, PeertubeCheckboxComponent ]
})
export class VideoBlockComponent extends FormReactive implements OnInit {
  @ViewChild('modal', { static: true }) modal: NgbModal

  @Output() videoBlocked = new EventEmitter()

  videos: Video[]

  error: string = null

  private openedModal: NgbModalRef

  constructor (
    protected formReactiveService: FormReactiveService,
    private modalService: NgbModal,
    private videoBlocklistService: VideoBlockService,
    private notifier: Notifier
  ) {
    super()
  }

  ngOnInit () {
    const defaultValues = { unfederate: 'true' }

    this.buildForm({
      reason: VIDEO_BLOCK_REASON_VALIDATOR,
      unfederate: null
    }, defaultValues)
  }

  isMultiple () {
    return this.videos.length > 1
  }

  getSingleVideo () {
    return this.videos[0]
  }

  hasLive () {
    return this.videos.some(v => v.isLive)
  }

  hasLocal () {
    return this.videos.some(v => v.isLocal)
  }

  show (videos: Video[]) {
    this.videos = videos

    this.openedModal = this.modalService.open(this.modal, { centered: true, keyboard: false })
  }

  hide () {
    this.openedModal.close()
    this.openedModal = null
  }

  block () {
    const options = this.videos.map(v => ({
      videoId: v.id,
      reason: this.form.value['reason'] || undefined,
      unfederate: v.isLocal
        ? this.form.value['unfederate']
        : undefined
    }))

    this.videoBlocklistService.blockVideo(options)
        .subscribe({
          next: () => {
            const message = formatICU(
              $localize`{count, plural, =1 {Blocked {videoName}.} other {Blocked {count} videos.}}`,
              { count: this.videos.length, videoName: this.getSingleVideo().name }
            )

            this.notifier.success(message)
            this.hide()

            for (const o of options) {
              const video = this.videos.find(v => v.id === o.videoId)

              video.blacklisted = true
              video.blacklistedReason = o.reason
            }

            this.videoBlocked.emit()
          },

          error: err => this.notifier.error(err.message)
        })
  }
}
