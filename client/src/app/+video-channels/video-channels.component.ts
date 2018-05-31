import { Component, OnInit } from '@angular/core'
import { ActivatedRoute } from '@angular/router'
import { VideoChannel } from '@app/shared/video-channel/video-channel.model'
import { VideoChannelService } from '@app/shared/video-channel/video-channel.service'
import { RestExtractor } from '@app/shared'
import { catchError } from 'rxjs/operators'

@Component({
  templateUrl: './video-channels.component.html',
  styleUrls: [ './video-channels.component.scss' ]
})
export class VideoChannelsComponent implements OnInit {
  videoChannel: VideoChannel

  constructor (
    private route: ActivatedRoute,
    private videoChannelService: VideoChannelService,
    private restExtractor: RestExtractor
  ) {}

  ngOnInit () {
    const videoChannelId = this.route.snapshot.params['videoChannelId']

    this.videoChannelService.getVideoChannel(videoChannelId)
        .pipe(catchError(err => this.restExtractor.redirectTo404IfNotFound(err, [ 400, 404 ])))
        .subscribe(videoChannel => this.videoChannel = videoChannel)
  }
}
