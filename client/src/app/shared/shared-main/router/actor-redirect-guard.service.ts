import { forkJoin, of } from 'rxjs'
import { catchError, map } from 'rxjs/operators'
import { Injectable, inject } from '@angular/core'
import { ActivatedRouteSnapshot, Router } from '@angular/router'
import { AccountService } from '../account/account.service'
import { VideoChannelService } from '../channel/video-channel.service'

@Injectable()
export class ActorRedirectGuard {
  private router = inject(Router)
  private accountService = inject(AccountService)
  private channelService = inject(VideoChannelService)

  canActivate (route: ActivatedRouteSnapshot) {
    const actorName = route.params.actorName

    return forkJoin([
      this.accountService.getAccount(actorName).pipe(this.orUndefined()),
      this.channelService.get(actorName).pipe(this.orUndefined())
    ]).pipe(
      map(([ account, channel ]) => {
        if (account) {
          return this.router.parseUrl(`/a/${actorName}`)
        }

        if (channel) {
          return this.router.parseUrl(`/c/${actorName}`)
        }

        return this.router.parseUrl('/404')
      })
    )
  }

  private orUndefined () {
    return catchError(() => of(undefined))
  }
}
