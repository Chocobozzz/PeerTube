import { inject } from '@angular/core'
import { ActivatedRouteSnapshot, ResolveFn, Router, RouterStateSnapshot, Routes } from '@angular/router'
import { VideoChannelCreateComponent } from '@app/+my-library/+my-video-channels/video-channel-create.component'
import { VideoChannelManageComponent } from '@app/+my-library/+my-video-channels/video-channel-manage.component'
import { CanDeactivateGuard } from '@app/core'
import { VideoChannel } from '@app/shared/shared-main/channel/video-channel.model'
import { VideoChannelService } from '@app/shared/shared-main/channel/video-channel.service'
import { PlayerSettingsService } from '@app/shared/shared-video/player-settings.service'
import { PlayerChannelSettings, VideoChannelCollaborator } from '@peertube/peertube-models'
import { logger } from '@root-helpers/logger'
import { catchError, forkJoin, map, throwError } from 'rxjs'
import { VideoChannelEditControllerService } from './edit/video-channel-edit-controller.service'
import { videoChannelEditRoutes } from './edit/video-channel-edit.routes'
import { MyVideoChannelsComponent } from './my-video-channels.component'

export type ChannelManageResolverData = {
  videoChannel: VideoChannel
  collaborators: VideoChannelCollaborator[]
  rawPlayerSettings: PlayerChannelSettings
}

export const channelManageResolver: ResolveFn<ChannelManageResolverData> = (
  route: ActivatedRouteSnapshot,
  _state: RouterStateSnapshot
) => {
  const videoChannelName = route.params['videoChannelName']

  const videoChannelService = inject(VideoChannelService)
  const router = inject(Router)

  return forkJoin([
    videoChannelService.get(videoChannelName),
    videoChannelService.listCollaborators(videoChannelName).pipe(map(({ data }) => data)),
    inject(PlayerSettingsService).getChannelSettings({ channelHandle: videoChannelName, raw: true })
  ]).pipe(
    map(([ videoChannel, collaborators, rawPlayerSettings ]) => ({ videoChannel, collaborators, rawPlayerSettings })),
    catchError(err => {
      logger.error('Cannot fetch channel information', err)

      router.navigate([ '/401' ], { state: { obj: err }, skipLocationChange: true })

      return throwError(() => err)
    })
  )
}

export default [
  {
    path: '',
    component: MyVideoChannelsComponent,
    data: {
      meta: {
        title: $localize`My video channels`
      }
    }
  },
  {
    path: 'create',
    component: VideoChannelCreateComponent,
    data: {
      meta: {
        title: $localize`Create a new video channel`
      }
    },
    canDeactivate: [ CanDeactivateGuard ],
    providers: [ PlayerSettingsService, VideoChannelEditControllerService ],
    children: videoChannelEditRoutes
  },
  {
    path: 'update/:videoChannelName',
    redirectTo: 'manage/:videoChannelName'
  },
  {
    path: 'manage/:videoChannelName',
    canDeactivate: [ CanDeactivateGuard ],
    component: VideoChannelManageComponent,
    data: {
      meta: {
        title: $localize`Manage video channel`
      }
    },
    resolve: {
      data: channelManageResolver
    },
    providers: [ PlayerSettingsService, VideoChannelEditControllerService ],
    children: videoChannelEditRoutes
  }
] satisfies Routes
