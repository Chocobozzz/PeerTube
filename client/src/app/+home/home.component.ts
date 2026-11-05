import { Component, ElementRef, inject, OnDestroy, OnInit, viewChild, ChangeDetectionStrategy } from '@angular/core'
import { DisableForReuseHook, PeerTubeRouterService, ServerService } from '@app/core'
import { CustomPageService } from '@app/shared/shared-main/custom-page/custom-page.service'
import { debounceTime, fromEvent, Subscription } from 'rxjs'
import { CustomMarkupContainerComponent } from '../shared/shared-custom-markup/custom-markup-container.component'

@Component({
  templateUrl: './home.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [ CustomMarkupContainerComponent ]
})
export class HomeComponent implements OnInit, OnDestroy, DisableForReuseHook {
  private customPageService = inject(CustomPageService)
  private sub: Subscription
  private peertubeRouter = inject(PeerTubeRouterService)
  private server = inject(ServerService)
  private disabled = false

  readonly contentWrapper = viewChild<ElementRef<HTMLInputElement>>('contentWrapper')

  homepageContent: string
  instanceName = this.server.getHTMLConfig().instance.name

  ngOnInit () {
    this.customPageService.getInstanceHomepage()
      .subscribe(({ content }) => this.homepageContent = content)

    // If this has been a redirection from the homepage,
    // replace the URL on scroll to correctly restore scroll position on web browser back button
    if (window.location.pathname === '/') {
      this.sub = fromEvent(window, 'scroll')
        .pipe(debounceTime(250))
        .subscribe(() => {
          if (this.disabled) return

          if (window.pageYOffset > 300) {
            this.peertubeRouter.silentNavigate([], {})
            this.sub.unsubscribe()
            this.sub = undefined
          }
        })
    }
  }

  ngOnDestroy () {
    if (this.sub) this.sub.unsubscribe()
  }

  disableForReuse () {
    this.disabled = true
  }

  enabledForReuse () {
    this.disabled = true
  }
}
