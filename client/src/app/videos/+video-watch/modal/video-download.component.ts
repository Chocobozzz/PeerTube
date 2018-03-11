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
  resolution: number | string = -1

  constructor () {
    // empty
  }

  ngOnInit () {
    this.resolution = this.video.files[0].resolution
  }

  show () {
    this.modal.show()
  }

  hide () {
    this.modal.hide()
  }

  download () {
    // HTML select send us a string, so convert it to a number
    this.resolution = parseInt(this.resolution.toString(), 10)

    const file = this.video.files.find(f => f.resolution === this.resolution)
    if (!file) {
      console.error('Could not find file with resolution %d.', this.resolution)
      return
    }

    const link = this.downloadType === 'direct' ? file.fileUrl : file.torrentUrl
    window.open(link)
  }
}
