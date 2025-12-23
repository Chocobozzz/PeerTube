import { CommonModule } from '@angular/common'
import { booleanAttribute, Component, OnChanges, OnDestroy, OnInit, inject, input } from '@angular/core'
import { ActivatedRoute, NavigationEnd, Router, RouterModule } from '@angular/router'
import { GlobalIconComponent, GlobalIconName } from '@app/shared/shared-icons/global-icon.component'
import { logger } from '@root-helpers/logger'
import { filter, Subscription } from 'rxjs'
import { PluginSelectorDirective } from '../plugins/plugin-selector.directive'
import { ListOverflowComponent } from './list-overflow.component'
import { NgbModal } from '@ng-bootstrap/ng-bootstrap'
import { HorizontalMenuService } from './horizontal-menu.service'

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
  imports: [
    CommonModule,
    RouterModule,
    ListOverflowComponent,
    GlobalIconComponent,
    PluginSelectorDirective
  ]
})
export class HorizontalMenuComponent implements OnInit, OnChanges, OnDestroy {
  private horizontalMenuService = inject(HorizontalMenuService)
  private router = inject(Router)
  private route = inject(ActivatedRoute)
  private modal = inject(NgbModal)

  readonly menuEntries = input<HorizontalMenuEntry[]>([])

  readonly h1 = input<string>(undefined)
  readonly h1Icon = input<GlobalIconName>(undefined)

  readonly areChildren = input(false, { transform: booleanAttribute })
  readonly withMarginBottom = input(true, { transform: booleanAttribute })

  activeParent: HorizontalMenuEntry
  children: HorizontalMenuEntry[] = []

  private routerSub: Subscription

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

  isHidden () {
    return this.horizontalMenuService.isMenuHidden()
  }

  private buildChildren () {
    this.children = []
    this.activeParent = undefined

    const currentUrl = window.location.pathname
    const currentComponentPath = this.route.snapshot.pathFromRoot.reduce((a, c) => {
      if (c.url.length === 0) return a

      return a + '/' + c.url[0].path
    }, '')

    const entry = this.menuEntries().find(parent => {
      if (currentUrl.startsWith(parent.routerLink)) return true
      if (!parent.routerLink.startsWith('/') && `${currentComponentPath}/${parent.routerLink}` === currentUrl) return true

      if (parent.children) return parent.children.some(child => currentUrl.startsWith(child.routerLink))

      return false
    })

    if (!entry) {
      const menuEntries = this.menuEntries()
      if (menuEntries.length !== 0 && currentUrl !== '/') {
        logger.info(`Unable to find entry for ${currentUrl} or ${currentComponentPath}`, { menuEntries })
      }

      return
    }

    this.children = entry.children
    this.activeParent = entry
  }
}
