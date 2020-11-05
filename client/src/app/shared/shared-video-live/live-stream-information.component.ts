import { Component, ElementRef, ViewChild } from '@angular/core'
import { Video } from '@app/shared/shared-main'
import { NgbModal } from '@ng-bootstrap/ng-bootstrap'
import { LiveVideoService } from './live-video.service'

@Component({
  selector: 'my-live-stream-information',
  templateUrl: './live-stream-information.component.html',
  styleUrls: [ './live-stream-information.component.scss' ]
})
export class LiveStreamInformationComponent {
  @ViewChild('modal', { static: true }) modal: ElementRef

  video: Video
  rtmpUrl = ''
  streamKey = ''

  constructor (
    private modalService: NgbModal,
    private liveVideoService: LiveVideoService
  ) { }

  show (video: Video) {
    this.video = video
    this.rtmpUrl = ''
    this.streamKey = ''

    this.loadLiveInfo(video)

    this.modalService
      .open(this.modal, { centered: true })
  }

  private loadLiveInfo (video: Video) {
    this.liveVideoService.getVideoLive(video.id)
      .subscribe(live => {
        this.rtmpUrl = live.rtmpUrl
        this.streamKey = live.streamKey
      })
  }
}
