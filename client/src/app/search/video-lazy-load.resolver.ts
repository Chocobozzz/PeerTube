import { map } from 'rxjs/operators'
import { Injectable } from '@angular/core'
import { ActivatedRouteSnapshot, Resolve, Router } from '@angular/router'
import { SearchService } from './search.service'

@Injectable()
export class VideoLazyLoadResolver implements Resolve<any> {
  constructor (
    private router: Router,
    private searchService: SearchService
  ) { }

  resolve (route: ActivatedRouteSnapshot) {
    const url = route.params.url
    const externalRedirect = route.params.externalRedirect
    const fromPath = route.params.fromPath

    if (!url) {
      console.error('Could not find url param.', { params: route.params })
      return this.router.navigateByUrl('/404')
    }

    if (externalRedirect === 'true') {
      window.open(url)
      this.router.navigateByUrl(fromPath)
      return
    }

    return this.searchService.searchVideos({ search: url })
      .pipe(
        map(result => {
          if (result.data.length !== 1) {
            console.error('Cannot find result for this URL')
            return this.router.navigateByUrl('/404')
          }

          const video = result.data[0]

          return this.router.navigateByUrl('/videos/watch/' + video.uuid)
        })
      )
  }
}
