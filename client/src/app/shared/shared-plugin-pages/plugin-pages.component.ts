import { AfterViewInit, Component, ElementRef, ViewChild } from '@angular/core'
import { ActivatedRoute, Router } from '@angular/router'
import { MetaService, PluginService } from '@app/core'
import { logger } from '@root-helpers/logger'
import { Subscription } from 'rxjs/internal/Subscription'

@Component({
  templateUrl: './plugin-pages.component.html',
  standalone: true
})
export class SharedPluginPagesComponent implements AfterViewInit {
  @ViewChild('root') root: ElementRef

  private urlSub: Subscription

  constructor (
    private metaService: MetaService,
    private route: ActivatedRoute,
    private router: Router,
    private pluginService: PluginService
  ) {

  }

  async ngAfterViewInit () {
    await this.pluginService.ensurePluginsAreLoaded(this.route.snapshot.data.pluginScope || 'common')

    this.urlSub = this.route.url.subscribe(() => {
      this.loadRoute()
    })
  }

  ngOnDestroy () {
    if (this.urlSub) this.urlSub.unsubscribe()
  }

  private loadRoute () {
    const path = '/' + this.route.snapshot.url.map(u => u.path).join('/')

    const registered = this.pluginService.getRegisteredClientRoute(path, this.route.snapshot.data.parentRoute)
    if (!registered) {
      logger.info(`Could not find registered route ${path}`, this.pluginService.getAllRegisteredClientRoutes())

      return this.router.navigate([ '/404' ], { skipLocationChange: true })
    }

    if (registered.title) {
      this.metaService.setTitle(registered.title)
    }

    registered.onMount({ rootEl: this.root.nativeElement })
  }
}
