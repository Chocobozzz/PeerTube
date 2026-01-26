import { Injectable } from '@angular/core'
import { VideoState, VideoStateType } from '@peertube/peertube-models'

type WarnResult = {
  title: string
  manageMain: string
  manageSecondary: string
  watchMain: string
  watchSecondary: string

  routerLink?: {
    text: string
    link: string[]
    queryParams?: { [key: string]: any }
  }
}

@Injectable()
export class VideoStateMessageService {
  private cacheKey: string
  private cacheResult: WarnResult

  buildWarn (videoId: number, state: VideoStateType): WarnResult {
    const key = `${videoId}-${state}`
    if (this.cacheKey === key && this.cacheResult) return this.cacheResult

    this.cacheResult = this._buildWarn(videoId, state)
    this.cacheKey = key

    return this.cacheResult
  }

  private _buildWarn (videoId: number, state: VideoStateType): WarnResult {
    const manageProcessed = $localize`Your video file is being processed.`
    const manageFeaturesDisabled = $localize`This can take a while and some features may not be available until it is complete.`
    const manageContactAdmin = $localize`Contact your administrator to fix it.`
    const watchNotPlayable = $localize`Your web browser may not be able to play it.`

    switch (state) {
      case VideoState.PUBLISHED:
      case VideoState.LIVE_ENDED:
      case VideoState.WAITING_FOR_LIVE:
        return undefined

      case VideoState.TO_TRANSCODE:
        return {
          title: $localize`Transcoding in progress`,
          manageMain: manageProcessed,
          manageSecondary: manageFeaturesDisabled,
          watchMain: watchNotPlayable,
          watchSecondary: ''
        }

      case VideoState.TO_IMPORT:
        return {
          title: $localize`Import in progress`,
          manageMain: $localize`Your remote video is being imported.`,
          manageSecondary: manageFeaturesDisabled,
          watchMain: $localize`The remote video is being imported, it will be available when the import is complete.`,
          watchSecondary: '',
          routerLink: {
            text: $localize`Review your import`,
            link: [ '/my-library/video-imports' ],
            queryParams: { search: `videoId:${videoId}` }
          }
        }

      case VideoState.TO_IMPORT_FAILED: {
        const details = $localize`The remote video failed to import, it will not be available.`

        return {
          title: $localize`Import failed`,
          manageMain: $localize`Your remote video failed to import.`,
          manageSecondary: '',
          watchMain: details,
          watchSecondary: '',
          routerLink: {
            text: $localize`Review your import`,
            link: [ '/my-library/video-imports' ],
            queryParams: { search: `videoId:${videoId}` }
          }
        }
      }

      case VideoState.TO_MOVE_TO_FILE_SYSTEM:
        return {
          title: $localize`Moving video files`,
          manageMain: manageProcessed,
          manageSecondary: manageFeaturesDisabled,
          watchMain: watchNotPlayable,
          watchSecondary: $localize`The video is being moved to the file system.`
        }

      case VideoState.TO_MOVE_TO_FILE_SYSTEM_FAILED: {
        const details = $localize`Failed to move video files to the platform file system.`

        return {
          title: $localize`Failed to move video files`,
          manageMain: details,
          manageSecondary: manageContactAdmin,
          watchMain: watchNotPlayable,
          watchSecondary: details
        }
      }

      case VideoState.TO_MOVE_TO_EXTERNAL_STORAGE:
        return {
          title: $localize`Moving video files`,
          manageMain: manageProcessed,
          manageSecondary: manageFeaturesDisabled,
          watchMain: watchNotPlayable,
          watchSecondary: $localize`The video is being moved to an external storage.`
        }

      case VideoState.TO_MOVE_TO_EXTERNAL_STORAGE_FAILED: {
        const details = $localize`Failed to move video files to an external storage.`

        return {
          title: $localize`Failed to move video files`,
          manageMain: details,
          manageSecondary: manageContactAdmin,
          watchMain: watchNotPlayable,
          watchSecondary: details
        }
      }

      case VideoState.TO_EDIT:
        return {
          title: $localize`Studio edition in progress`,
          manageMain: manageProcessed,
          manageSecondary: manageFeaturesDisabled,
          watchMain: watchNotPlayable,
          watchSecondary: ''
        }

      case VideoState.TRANSCODING_FAILED:
        return {
          title: $localize`Transcoding failed`,
          manageMain: $localize`Failure during transcoding of your video files`,
          manageSecondary: manageContactAdmin,
          watchMain: watchNotPlayable,
          watchSecondary: ''
        }

      default:
        return state satisfies never
    }
  }
}
