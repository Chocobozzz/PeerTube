import { NgFor, NgIf, ViewportScroller } from '@angular/common'
import { AfterViewChecked, Component, ElementRef, OnInit, ViewChild } from '@angular/core'
import { ActivatedRoute, RouterLink } from '@angular/router'
import { Notifier, ServerService } from '@app/core'
import { AboutHTML } from '@app/shared/shared-main/instance/instance.service'
import { maxBy } from '@peertube/peertube-core-utils'
import { HTMLServerConfig, ServerStats } from '@peertube/peertube-models'
import { copyToClipboard } from '@root-helpers/utils'
import { CustomMarkupContainerComponent } from '../../shared/shared-custom-markup/custom-markup-container.component'
import { InstanceFeaturesTableComponent } from '../../shared/shared-instance/instance-features-table.component'
import { PluginSelectorDirective } from '../../shared/shared-main/plugins/plugin-selector.directive'
import { ResolverData } from './about-instance.resolver'
import { ContactAdminModalComponent } from './contact-admin-modal.component'
import { InstanceStatisticsComponent } from './instance-statistics.component'

@Component({
  selector: 'my-about-instance',
  templateUrl: './about-instance.component.html',
  styleUrls: [ './about-instance.component.scss' ],
  standalone: true,
  imports: [
    NgIf,
    RouterLink,
    NgFor,
    CustomMarkupContainerComponent,
    PluginSelectorDirective,
    InstanceFeaturesTableComponent,
    InstanceStatisticsComponent,
    ContactAdminModalComponent
  ]
})
export class AboutInstanceComponent implements OnInit, AfterViewChecked {
  @ViewChild('descriptionWrapper') descriptionWrapper: ElementRef<HTMLInputElement>
  @ViewChild('contactAdminModal', { static: true }) contactAdminModal: ContactAdminModalComponent

  aboutHTML: AboutHTML
  descriptionElement: HTMLDivElement

  instanceBannerUrl: string

  languages: string[] = []
  categories: string[] = []
  shortDescription = ''

  initialized = false

  serverStats: ServerStats

  private serverConfig: HTMLServerConfig

  private lastScrollHash: string

  constructor (
    private viewportScroller: ViewportScroller,
    private route: ActivatedRoute,
    private notifier: Notifier,
    private serverService: ServerService
  ) {}

  get instanceName () {
    return this.serverConfig.instance.name
  }

  get isContactFormEnabled () {
    return this.serverConfig.email.enabled && this.serverConfig.contactForm.enabled
  }

  get isNSFW () {
    return this.serverConfig.instance.isNSFW
  }

  ngOnInit () {
    const { about, languages, categories, aboutHTML, descriptionElement, serverStats }: ResolverData = this.route.snapshot.data.instanceData

    this.serverStats = serverStats

    this.aboutHTML = aboutHTML
    this.descriptionElement = descriptionElement

    this.languages = languages
    this.categories = categories

    this.shortDescription = about.instance.shortDescription

    this.instanceBannerUrl = about.instance.banners.length !== 0
      ? maxBy(about.instance.banners, 'width').path
      : undefined

    this.serverConfig = this.serverService.getHTMLConfig()

    this.route.data.subscribe(data => {
      if (!data?.isContact) return

      const prefill = this.route.snapshot.queryParams

      this.contactAdminModal.show(prefill)
    })

    this.initialized = true
  }

  ngAfterViewChecked () {
    if (this.initialized && window.location.hash && window.location.hash !== this.lastScrollHash) {
      this.viewportScroller.scrollToAnchor(window.location.hash.replace('#', ''))

      this.lastScrollHash = window.location.hash
    }
  }

  onClickCopyLink (anchor: HTMLAnchorElement) {
    const link = anchor.href
    copyToClipboard(link)
    this.notifier.success(link, $localize`Link copied`)
  }
}
