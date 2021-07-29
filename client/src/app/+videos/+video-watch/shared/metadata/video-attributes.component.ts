import { Component, Input } from '@angular/core'
import { VideoDetails } from '@app/shared/shared-main'

@Component({
  selector: 'my-video-attributes',
  templateUrl: './video-attributes.component.html',
  styleUrls: [ './video-attributes.component.scss' ]
})
export class VideoAttributesComponent {
  @Input() video: VideoDetails

  getVideoUrl () {
    if (!this.video.url) {
      return this.video.originInstanceUrl + VideoDetails.buildWatchUrl(this.video)
    }

    return this.video.url
  }

  getVideoHost () {
    return this.video.channel.host
  }

  getVideoTags () {
    if (!this.video || Array.isArray(this.video.tags) === false) return []

    return this.video.tags
  }
}
