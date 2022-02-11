
import { Injectable } from '@angular/core'
import { ActivatedRouteSnapshot, Resolve } from '@angular/router'
import { VideoService } from '@app/shared/shared-main'

@Injectable()
export class VideoEditorEditResolver implements Resolve<any> {
  constructor (
    private videoService: VideoService
  ) {
  }

  resolve (route: ActivatedRouteSnapshot) {
    const videoId: string = route.params['videoId']

    return this.videoService.getVideo({ videoId })
  }
}
