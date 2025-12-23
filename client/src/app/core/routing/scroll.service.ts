import { ViewportScroller } from '@angular/common'
import { Injectable, inject } from '@angular/core'
import { Scroll } from '@angular/router'
import { logger } from '@root-helpers/logger'
import debug from 'debug'
import { pairwise } from 'rxjs'
import { RouterSetting } from '../'
import { PeerTubeRouterService } from './peertube-router.service'

const debugLogger = debug('peertube:main:ScrollService')

@Injectable()
export class ScrollService {
  private viewportScroller = inject(ViewportScroller)
  private peertubeRouter = inject(PeerTubeRouterService)

  private resetScroll = true

  enableScrollRestoration () {
    // We'll manage scroll restoration ourselves
    this.viewportScroller.setHistoryScrollRestoration('manual')

    this.consumeScroll()
    this.produceScroll()
  }

  private produceScroll () {
    // When we add the a-state parameter, we don't want to alter the scroll
    this.peertubeRouter.getNavigationEndEvents().pipe(pairwise())
      .subscribe(([ e1, e2 ]) => {
        try {
          this.resetScroll = false

          const previousUrl = new URL(window.location.origin + e1.urlAfterRedirects)
          const nextUrl = new URL(window.location.origin + e2.urlAfterRedirects)

          if (previousUrl.pathname !== nextUrl.pathname) {
            debugLogger('Schedule reset scroll after pathname change', { previousUrl, nextUrl })

            this.resetScroll = true
            return
          }

          if (this.peertubeRouter.hasRouteSetting(RouterSetting.DISABLE_SCROLL_RESTORE)) {
            debugLogger('Do not reset scroll after because router state disabled scroll restore')

            this.resetScroll = false
            return
          }

          // Remove route settings from the comparison
          const nextSearchParams = nextUrl.searchParams
          const previousSearchParams = previousUrl.searchParams

          nextSearchParams.sort()
          previousSearchParams.sort()

          if (nextSearchParams.toString() !== previousSearchParams.toString()) {
            debugLogger('Schedule reset scroll after search params change', { previousUrl, nextUrl })

            this.resetScroll = true
          }
        } catch (err) {
          logger.error('Cannot parse URL to check next scroll.', err)
          this.resetScroll = true
        }
      })
  }

  private consumeScroll () {
    let unhandledScrollEvent: Scroll | undefined

    // Handle anchors/restore position
    this.peertubeRouter.getScrollEvents().subscribe(e => {
      unhandledScrollEvent = undefined

      // scrollToAnchor first to preserve anchor position when using history navigation
      if (e.anchor) {
        debugLogger('Scroll to anchor.', { e, resetScroll: this.resetScroll })

        setTimeout(() => this.viewportScroller.scrollToAnchor(e.anchor))

        return
      }

      if (e.position) {
        debugLogger('Scroll to position.', { e, resetScroll: this.resetScroll })

        this.viewportScroller.scrollToPosition(e.position)

        if (e.position[1] > document.documentElement.scrollHeight) {
          debugLogger('Could not scroll to position, marking scroll event as unhandled')
          unhandledScrollEvent = e
        }

        return
      }

      if (this.resetScroll) {
        debugLogger('Reset scroll.', { e, resetScroll: this.resetScroll })

        return this.viewportScroller.scrollToPosition([ 0, 0 ])
      }
    })

    new ResizeObserver(() => {
      if (!unhandledScrollEvent) return
      if (unhandledScrollEvent.position[1] > document.documentElement.scrollHeight) return

      debugLogger('Can now scroll to position, handling previous scroll event')

      this.viewportScroller.scrollToPosition(unhandledScrollEvent.position)
      unhandledScrollEvent = undefined
    }).observe(document.documentElement)
  }
}
