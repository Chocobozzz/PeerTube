import { NgIf } from '@angular/common'
import { Component, OnInit } from '@angular/core'
import { ActivatedRoute, Router } from '@angular/router'
import { VideoChannel } from '@app/shared/shared-main/channel/video-channel.model'
import { AlertComponent } from '@app/shared/shared-main/common/alert.component'
import { Video } from '@app/shared/shared-main/video/video.model'
import { SearchService } from '@app/shared/shared-search/search.service'
import { forkJoin } from 'rxjs'

@Component({
  selector: 'my-remote-interaction',
  templateUrl: './remote-interaction.component.html',
  imports: [ NgIf, AlertComponent ]
})
export class RemoteInteractionComponent implements OnInit {
  error = ''

  constructor (
    private route: ActivatedRoute,
    private router: Router,
    private search: SearchService
  ) { }

  ngOnInit () {
    const uri = this.route.snapshot.queryParams['uri']

    if (!uri) {
      this.error = $localize`URL parameter is missing in URL parameters`
      return
    }

    this.loadUrl(uri)
  }

  private loadUrl (uri: string) {
    forkJoin([
      this.search.searchVideos({ search: uri }),
      this.search.searchVideoChannels({ search: uri })
    ]).subscribe(([ videoResult, channelResult ]) => {
      let redirectUrl: string

      if (videoResult.data.length !== 0) {
        const video = videoResult.data[0]

        redirectUrl = Video.buildWatchUrl(video)
      } else if (channelResult.data.length !== 0) {
        const channel = new VideoChannel(channelResult.data[0])

        redirectUrl = '/c/' + channel.nameWithHost
      } else {
        this.error = $localize`Cannot access to the remote resource`
        return
      }

      this.router.navigateByUrl(redirectUrl)
    })
  }

}
