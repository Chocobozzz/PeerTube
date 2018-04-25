import { Component, OnInit } from '@angular/core'
import { ActivatedRoute } from '@angular/router'
import { VideoChannel } from '@app/shared/video-channel/video-channel.model'
import { VideoChannelService } from '@app/shared/video-channel/video-channel.service'

@Component({
  templateUrl: './video-channels.component.html',
  styleUrls: [ './video-channels.component.scss' ]
})
export class VideoChannelsComponent implements OnInit {
  videoChannel: VideoChannel

  constructor (
    private route: ActivatedRoute,
    private videoChannelService: VideoChannelService
  ) {}

  ngOnInit () {
    const videoChannelId = this.route.snapshot.params['videoChannelId']

    this.videoChannelService.getVideoChannel(videoChannelId)
        .subscribe(videoChannel => this.videoChannel = videoChannel)
  }
}
