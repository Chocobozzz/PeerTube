import { CommonModule } from '@angular/common'
import { booleanAttribute, Component, Input, OnChanges, OnDestroy, OnInit } from '@angular/core'
import { ActivatedRoute, NavigationEnd, Router, RouterModule } from '@angular/router'
import { GlobalIconComponent, GlobalIconName } from '@app/shared/shared-icons/global-icon.component'
import { logger } from '@root-helpers/logger'
import { filter, Subscription } from 'rxjs'
import { PluginSelectorDirective } from '../plugins/plugin-selector.directive'
import { ListOverflowComponent } from './list-overflow.component'
import { NgbModal } from '@ng-bootstrap/ng-bootstrap'

export type HorizontalMenuEntry = {
  label: string
  iconName?: GlobalIconName

  routerLink: string
  queryParams?: Record<string, any>

  isDisplayed?: () => boolean // Default: () => true
  pluginSelectorId?: string // Default: () => true

  children?: {
    label: string

    routerLink: string
    queryParams?: Record<string, any>

    isDisplayed?: () => boolean // Default: () => true
  }[]
}

@Component({
  selector: 'my-horizontal-menu',
  templateUrl: './horizontal-menu.component.html',
  styleUrls: [ './horizontal-menu.component.scss' ],
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    ListOverflowComponent,
    GlobalIconComponent,
    PluginSelectorDirective
  ]
})
export class HorizontalMenuComponent implements OnInit, OnChanges, OnDestroy {
  @Input() menuEntries: HorizontalMenuEntry[] = []

  @Input() h1: string
  @Input() h1Icon: GlobalIconName

  @Input({ transform: booleanAttribute }) areChildren = false
  @Input({ transform: booleanAttribute }) withMarginBottom = true

  activeParent: HorizontalMenuEntry
  children: HorizontalMenuEntry[] = []

  private routerSub: Subscription

  constructor (
    private router: Router,
    private route: ActivatedRoute,
    private modal: NgbModal
  ) {

  }

  ngOnInit () {
    this.routerSub = this.router.events.pipe(
      filter((event: any) => event instanceof NavigationEnd)
    ).subscribe(() => this.buildChildren())
  }

  ngOnChanges () {
    this.buildChildren()
  }

  ngOnDestroy () {
    if (this.routerSub) this.routerSub.unsubscribe()
  }

  onLinkClick (modal: boolean) {
    if (modal) {
      this.modal.dismissAll()
    }
  }

  private buildChildren () {
    this.children = []
    this.activeParent = undefined

    const currentUrl = window.location.pathname
    const currentComponentPath = this.route.snapshot.pathFromRoot.reduce((a, c) => {
      if (c.url.length === 0) return a

      return a + '/' + c.url[0].path
    }, '')

    const entry = this.menuEntries.find(parent => {
      if (currentUrl.startsWith(parent.routerLink)) return true
      if (!parent.routerLink.startsWith('/') && `${currentComponentPath}/${parent.routerLink}` === currentUrl) return true

      if (parent.children) return parent.children.some(child => currentUrl.startsWith(child.routerLink))

      return false
    })

    if (!entry) {
      if (this.menuEntries.length !== 0 && currentUrl !== '/') {
        logger.info(`Unable to find entry for ${currentUrl} or ${currentComponentPath}`, { menuEntries: this.menuEntries })
      }

      return
    }

    this.children = entry.children
    this.activeParent = entry
  }
}
