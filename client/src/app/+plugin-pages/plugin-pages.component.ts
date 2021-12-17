import { AfterViewInit, Component, ElementRef, ViewChild } from '@angular/core'
import { ActivatedRoute, Router } from '@angular/router'
import { PluginService } from '@app/core'

@Component({
  templateUrl: './plugin-pages.component.html'
})
export class PluginPagesComponent implements AfterViewInit {
  @ViewChild('root') root: ElementRef

  constructor (
    private route: ActivatedRoute,
    private router: Router,
    private pluginService: PluginService
  ) {

  }

  ngAfterViewInit () {
    this.pluginService.ensurePluginsAreLoaded('common')
      .then(() => this.loadRoute())
  }

  private loadRoute () {
    const path = '/' + this.route.snapshot.url.map(u => u.path).join('/')

    const registered = this.pluginService.getRegisteredClientRoute(path)
    if (!registered) {
      console.log('Could not find registered route %s.', path, this.pluginService.getAllRegisteredClientRoutes())

      return this.router.navigate([ '/404' ], { skipLocationChange: true })
    }

    registered.onMount({ rootEl: this.root.nativeElement })
  }
}
