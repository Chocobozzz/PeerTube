import { Component, Input, OnInit, ViewChild } from '@angular/core'
import { ModalDirective } from 'ngx-bootstrap/modal'
import { VideoDetails } from '../../../shared/video/video-details.model'

@Component({
  selector: 'my-video-download',
  templateUrl: './video-download.component.html',
  styleUrls: [ './video-download.component.scss' ]
})
export class VideoDownloadComponent implements OnInit {
  @Input() video: VideoDetails = null

  @ViewChild('modal') modal: ModalDirective

  downloadType: 'direct' | 'torrent' = 'torrent'
  resolutionId: number | string = -1

  constructor () {
    // empty
  }

  ngOnInit () {
    this.resolutionId = this.video.files[0].resolution.id
  }

  show () {
    this.modal.show()
  }

  hide () {
    this.modal.hide()
  }

  download () {
    // HTML select send us a string, so convert it to a number
    this.resolutionId = parseInt(this.resolutionId.toString(), 10)

    const file = this.video.files.find(f => f.resolution.id === this.resolutionId)
    if (!file) {
      console.error('Could not find file with resolution %d.', this.resolutionId)
      return
    }

    const link = this.downloadType === 'direct' ? file.fileDownloadUrl : file.torrentDownloadUrl
    window.location.assign(link)
  }
}
