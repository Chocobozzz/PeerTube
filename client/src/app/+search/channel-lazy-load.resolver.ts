import { map } from 'rxjs/operators'
import { Injectable } from '@angular/core'
import { ActivatedRouteSnapshot, Resolve, Router } from '@angular/router'
import { SearchService } from '@app/shared/shared-search'

@Injectable()
export class ChannelLazyLoadResolver implements Resolve<any> {
  constructor (
    private router: Router,
    private searchService: SearchService
  ) { }

  resolve (route: ActivatedRouteSnapshot) {
    const url = route.params.url

    if (!url) {
      console.error('Could not find url param.', { params: route.params })
      return this.router.navigateByUrl('/404')
    }

    return this.searchService.searchVideoChannels({ search: url })
      .pipe(
        map(result => {
          if (result.data.length !== 1) {
            console.error('Cannot find result for this URL')
            return this.router.navigateByUrl('/404')
          }

          const channel = result.data[0]

          return this.router.navigateByUrl('/video-channels/' + channel.nameWithHost)
        })
      )
  }
}
