import { AfterViewInit, Component, ElementRef, OnDestroy, inject, viewChild } from '@angular/core'
import { ActivatedRoute, Router } from '@angular/router'
import { MetaService, PluginService } from '@app/core'
import { logger } from '@root-helpers/logger'
import { Subscription } from 'rxjs/internal/Subscription'

@Component({
  templateUrl: './plugin-pages.component.html',
  standalone: true
})
export class PluginPagesComponent implements OnDestroy, AfterViewInit {
  private metaService = inject(MetaService)
  private route = inject(ActivatedRoute)
  private router = inject(Router)
  private pluginService = inject(PluginService)

  readonly root = viewChild<ElementRef>('root')

  private urlSub: Subscription

  ngAfterViewInit () {
    this.urlSub = this.route.url.subscribe(() => {
      this.loadRoute()
    })
  }

  ngOnDestroy () {
    if (this.urlSub) this.urlSub.unsubscribe()
  }

  onRootClick (event: Event) {
    const target = event.target as HTMLElement
    if (!target) return

    const a = target.closest('a')
    if (!a) return

    // Get the href attribute set by the dev, not the one calculated by JS to detect if it's a relative/external link
    const href = a.getAttribute('href') || ''

    if (!a.target && href.startsWith('/')) {
      event.preventDefault()
      event.stopPropagation()

      this.router.navigateByUrl(href)
    }
  }

  private async loadRoute () {
    await this.pluginService.ensurePluginsAreLoaded(this.route.snapshot.data.pluginScope || 'common')

    if (!this.route.snapshot.data.parentRoute) {
      logger.error('Missing "parentRoute" URL data to load plugin route ' + this.route.snapshot.url)
      return
    }

    const path = '/' + this.route.snapshot.url.map(u => u.path).join('/')

    const registered = this.pluginService.getRegisteredClientRoute(path, this.route.snapshot.data.parentRoute)
    if (!registered) {
      logger.info(`Could not find registered route ${path}`, { routes: this.pluginService.getAllRegisteredClientRoutes() })

      return this.router.navigate([ '/404' ], { skipLocationChange: true })
    }

    if (registered.title) {
      this.metaService.setTitle(registered.title)
    }

    registered.onMount({ rootEl: this.root().nativeElement })
  }
}
