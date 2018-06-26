import { Component, OnDestroy, OnInit } from '@angular/core'
import { ActivatedRoute } from '@angular/router'
import { VideoChannel } from '@app/shared/video-channel/video-channel.model'
import { VideoChannelService } from '@app/shared/video-channel/video-channel.service'
import { RestExtractor } from '@app/shared'
import { catchError, distinctUntilChanged, map, switchMap } from 'rxjs/operators'
import { Subscription } from 'rxjs'

@Component({
  templateUrl: './video-channels.component.html',
  styleUrls: [ './video-channels.component.scss' ]
})
export class VideoChannelsComponent implements OnInit, OnDestroy {
  videoChannel: VideoChannel

  private routeSub: Subscription

  constructor (
    private route: ActivatedRoute,
    private videoChannelService: VideoChannelService,
    private restExtractor: RestExtractor
  ) { }

  ngOnInit () {
    this.routeSub = this.route.params
                        .pipe(
                          map(params => params[ 'videoChannelId' ]),
                          distinctUntilChanged(),
                          switchMap(videoChannelId => this.videoChannelService.getVideoChannel(videoChannelId)),
                          catchError(err => this.restExtractor.redirectTo404IfNotFound(err, [ 400, 404 ]))
                        )
                        .subscribe(videoChannel => this.videoChannel = videoChannel)

  }

  ngOnDestroy () {
    if (this.routeSub) this.routeSub.unsubscribe()
  }
}
