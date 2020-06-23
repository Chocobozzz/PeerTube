import { forkJoin } from 'rxjs'
import { map, switchMap } from 'rxjs/operators'
import { Injectable } from '@angular/core'
import { ActivatedRouteSnapshot, Resolve } from '@angular/router'
import { VideoCaptionService, VideoChannelService, VideoService } from '@app/shared/shared-main'

@Injectable()
export class VideoUpdateResolver implements Resolve<any> {
  constructor (
    private videoService: VideoService,
    private videoChannelService: VideoChannelService,
    private videoCaptionService: VideoCaptionService
  ) {
  }

  resolve (route: ActivatedRouteSnapshot) {
    const uuid: string = route.params[ 'uuid' ]

    return this.videoService.getVideo({ videoId: uuid })
               .pipe(
                 switchMap(video => {
                   return forkJoin([
                     this.videoService
                         .loadCompleteDescription(video.descriptionPath)
                         .pipe(map(description => Object.assign(video, { description }))),

                     this.videoChannelService
                         .listAccountVideoChannels(video.account)
                         .pipe(
                           map(result => result.data),
                           map(videoChannels => videoChannels.map(c => ({ id: c.id, label: c.displayName, support: c.support })))
                         ),

                     this.videoCaptionService
                         .listCaptions(video.id)
                         .pipe(
                           map(result => result.data)
                         )
                   ])
                 }),
                 map(([ video, videoChannels, videoCaptions ]) => ({ video, videoChannels, videoCaptions }))
               )
  }
}
