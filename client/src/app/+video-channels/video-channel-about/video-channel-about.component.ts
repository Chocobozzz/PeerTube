import { Component, OnInit } from '@angular/core'
import { ActivatedRoute } from '@angular/router'
import { VideoChannelService } from '@app/shared/video-channel/video-channel.service'
import { VideoChannel } from '@app/shared/video-channel/video-channel.model'

@Component({
  selector: 'my-video-channel-about',
  templateUrl: './video-channel-about.component.html',
  styleUrls: [ './video-channel-about.component.scss' ]
})
export class VideoChannelAboutComponent implements OnInit {
  videoChannel: VideoChannel

  constructor (
    protected route: ActivatedRoute,
    private videoChannelService: VideoChannelService
  ) { }

  ngOnInit () {
    // Parent get the video channel for us
    this.videoChannelService.videoChannelLoaded
      .subscribe(videoChannel => this.videoChannel = videoChannel)
  }

  getVideoChannelDescription () {
    if (this.videoChannel.description) return this.videoChannel.description

    return 'No description'
  }
}
