import { catchError, map, of, tap } from 'rxjs'
import { HttpClient } from '@angular/common/http'
import { Injectable, inject } from '@angular/core'
import { AuthService, RestExtractor } from '@app/core'
import { VideoToken } from '@peertube/peertube-models'
import { VideoService } from './video.service'
import { VideoPasswordService } from './video-password.service'

@Injectable()
export class VideoFileTokenService {
  private authHttp = inject(HttpClient)
  private restExtractor = inject(RestExtractor)
  private auth = inject(AuthService)

  // Tokens belong to the logged in user
  private readonly store = new Map<string, { token: string, expires: Date }>()
  private storeGeneration = 0

  constructor () {
    this.auth.loginChangedSource.subscribe(() => {
      this.storeGeneration++
      this.store.clear()
    })
  }

  getVideoFileToken ({ videoUUID, videoPassword }: { videoUUID: string, videoPassword?: string }) {
    const existing = this.store.get(videoUUID)
    if (existing) return of(existing)

    const generation = this.storeGeneration

    return this.createVideoFileToken(videoUUID, videoPassword)
      .pipe(tap(result => {
        if (generation === this.storeGeneration) this.store.set(videoUUID, { token: result.token, expires: new Date(result.expires) })
      }))
  }

  private createVideoFileToken (videoUUID: string, videoPassword?: string) {
    const headers = VideoPasswordService.buildVideoPasswordHeader(videoPassword)

    return this.authHttp.post<VideoToken>(`${VideoService.BASE_VIDEO_URL}/${videoUUID}/token`, {}, { headers })
      .pipe(
        map(({ files }) => files),
        catchError(err => this.restExtractor.handleError(err))
      )
  }
}
