import { Injectable, inject } from '@angular/core'
import { AuthService, ServerService, UserService } from '@app/core'
import { listUserChannelsForSelect } from '@app/helpers'
import { UserVideoQuota, VideoConstant, VideoPrivacyType } from '@peertube/peertube-models'
import { forkJoin } from 'rxjs'
import { map } from 'rxjs/operators'
import { SelectChannelItem } from '../../../types'

export type VideoPublishResolverData = {
  videoChannels: SelectChannelItem[]
  userQuota: UserVideoQuota
  privacies: VideoConstant<VideoPrivacyType>[]
}

@Injectable()
export class VideoPublishResolver {
  private authService = inject(AuthService)
  private serverService = inject(ServerService)
  private userService = inject(UserService)

  resolve () {
    return forkJoin([
      listUserChannelsForSelect(this.authService, { includeCollaborations: true }),
      this.userService.getMyVideoQuotaUsed(),
      this.serverService.getVideoPrivacies()
    ]).pipe(map(([ videoChannels, userQuota, privacies ]) => ({ videoChannels, userQuota, privacies } as VideoPublishResolverData)))
  }
}
