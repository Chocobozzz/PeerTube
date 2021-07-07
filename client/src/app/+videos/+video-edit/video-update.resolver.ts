import { forkJoin, of } from 'rxjs'
import { map, switchMap } from 'rxjs/operators'
import { Injectable } from '@angular/core'
import { ActivatedRouteSnapshot, Resolve } from '@angular/router'
import { AuthService } from '@app/core'
import { listUserChannels } from '@app/helpers'
import { VideoCaptionService, VideoDetails, VideoService } from '@app/shared/shared-main'
import { LiveVideoService } from '@app/shared/shared-video-live'

@Injectable()
export class VideoUpdateResolver implements Resolve<any> {
  constructor (
    private videoService: VideoService,
    private liveVideoService: LiveVideoService,
    private authService: AuthService,
    private videoCaptionService: VideoCaptionService
  ) {
  }

  resolve (route: ActivatedRouteSnapshot) {
    const uuid: string = route.params[ 'uuid' ]

    return this.videoService.getVideo({ videoId: uuid })
               .pipe(
                 switchMap(video => forkJoin(this.buildVideoObservables(video))),
                 map(([ video, videoChannels, videoCaptions, liveVideo ]) => ({ video, videoChannels, videoCaptions, liveVideo }))
               )
  }

  private buildVideoObservables (video: VideoDetails) {
    return [
      this.videoService
        .loadCompleteDescription(video.descriptionPath)
        .pipe(map(description => Object.assign(video, { description }))),

      listUserChannels(this.authService),

      this.videoCaptionService
        .listCaptions(video.id)
        .pipe(
          map(result => result.data)
        ),

      video.isLive
          ? this.liveVideoService.getVideoLive(video.id)
          : of(undefined)
    ]
  }
}
