import { Injectable } from '@angular/core'
import { generateNaiveHash } from '@peertube/peertube-core-utils'
import { VideoState, VideoStateType } from '@peertube/peertube-models'

type WarnMessageResult = {
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

type ErrMessageResult = {
  title: string
  main: string
}

@Injectable()
export class VideoStateMessageService {
  private warnCacheKey: string
  private warnCacheResult: WarnMessageResult

  private errCacheKey: string
  private errCacheResult: ErrMessageResult

  buildWarn (options: {
    videoId: number
    state: VideoStateType
  }): WarnMessageResult {
    const { videoId, state } = options

    const key = `${videoId}-${state}`
    if (this.warnCacheKey === key && this.warnCacheResult) return this.warnCacheResult

    this.warnCacheResult = this._buildWarn(options)
    this.warnCacheKey = key

    return this.warnCacheResult
  }

  private _buildWarn (options: {
    videoId: number
    state: VideoStateType
  }): WarnMessageResult {
    const { videoId, state } = options

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

  // ---------------------------------------------------------------------------

  buildErr (options: {
    videoId: number
    blacklisted: boolean
    blacklistedReason: string
  }): ErrMessageResult {
    const { videoId, blacklisted, blacklistedReason } = options

    const key = `${videoId}-${blacklisted}-${generateNaiveHash(blacklistedReason)}`
    if (this.errCacheKey === key && this.errCacheResult) return this.errCacheResult

    this.errCacheResult = this._buildErr(options)
    this.errCacheKey = key

    return this.errCacheResult
  }

  private _buildErr (options: {
    blacklisted: boolean
    blacklistedReason: string
  }): ErrMessageResult {
    const { blacklisted, blacklistedReason } = options

    if (!blacklisted) return undefined

    return {
      title: $localize`Blocked video`,
      main: blacklistedReason || $localize`Your video has been blocked by the platform`
    }
  }
}
