import { Injectable } from '@angular/core'
import { VideoService } from '@app/shared/video/video.service'
import { ActivatedRouteSnapshot, Resolve } from '@angular/router'
import { map, switchMap } from 'rxjs/operators'
import { VideoChannelService } from '@app/shared/video-channel/video-channel.service'
import { VideoCaptionService } from '@app/shared/video-caption'
import { forkJoin } from 'rxjs'

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
