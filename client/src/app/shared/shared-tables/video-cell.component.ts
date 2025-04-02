import { CommonModule } from '@angular/common'
import { booleanAttribute, Component, inject, input, OnInit } from '@angular/core'
import { RouterLink } from '@angular/router'
import { ScreenService } from '@app/core'
import { VideoChannel } from '../shared-main/channel/video-channel.model'
import { Video } from '../shared-main/video/video.model'
import { VideoThumbnailComponent } from '../shared-thumbnail/video-thumbnail.component'

@Component({
  selector: 'my-video-cell',
  styleUrls: [ 'video-cell.component.scss' ],
  templateUrl: 'video-cell.component.html',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    VideoThumbnailComponent
  ]
})
export class VideoCellComponent implements OnInit {
  private readonly screenService = inject(ScreenService)

  readonly video = input.required<Video>()
  readonly size = input<'small' | 'normal'>('normal')
  readonly thumbnail = input<boolean, boolean | string>(true, { transform: booleanAttribute })
  readonly title = input<boolean, boolean | string>(true, { transform: booleanAttribute })
  readonly hostInfo = input<boolean, boolean | string>(true, { transform: booleanAttribute })

  ellipsis: boolean

  ngOnInit () {
    this.ellipsis = !this.screenService.isInMobileView()
  }

  getVideoUrl () {
    return Video.buildWatchUrl(this.video())
  }

  getChannelUrl () {
    return VideoChannel.buildPublicUrl(this.video().channel)
  }
}
