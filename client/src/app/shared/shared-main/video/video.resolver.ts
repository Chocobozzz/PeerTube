import { Injectable, inject } from '@angular/core'
import { ActivatedRouteSnapshot } from '@angular/router'
import { VideoService } from './video.service'

@Injectable()
export class VideoResolver {
  private videoService = inject(VideoService)

  resolve (route: ActivatedRouteSnapshot) {
    const videoId: string = route.params['videoId']

    return this.videoService.getVideo({ videoId })
  }
}
