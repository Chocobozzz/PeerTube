import { ViewportScroller } from '@angular/common'
import { AfterViewChecked, Component, ElementRef, OnInit, ViewChild } from '@angular/core'
import { ActivatedRoute } from '@angular/router'
import { Notifier, ServerService } from '@app/core'
import { InstanceService } from '@app/shared/shared-instance'
import { copyToClipboard } from '@root-helpers/utils'
import { HTMLServerConfig } from '@shared/models/server'
import { ResolverData } from './about-instance.resolver'
import { ContactAdminModalComponent } from './contact-admin-modal.component'

@Component({
  selector: 'my-about-instance',
  templateUrl: './about-instance.component.html',
  styleUrls: [ './about-instance.component.scss' ]
})
export class AboutInstanceComponent implements OnInit, AfterViewChecked {
  @ViewChild('descriptionWrapper') descriptionWrapper: ElementRef<HTMLInputElement>
  @ViewChild('contactAdminModal', { static: true }) contactAdminModal: ContactAdminModalComponent

  shortDescription = ''
  descriptionContent: string

  html = {
    terms: '',
    codeOfConduct: '',
    moderationInformation: '',
    administrator: '',
    creationReason: '',
    maintenanceLifetime: '',
    businessModel: '',
    hardwareInformation: ''
  }

  languages: string[] = []
  categories: string[] = []

  initialized = false

  private serverConfig: HTMLServerConfig

  private lastScrollHash: string

  constructor (
    private viewportScroller: ViewportScroller,
    private route: ActivatedRoute,
    private notifier: Notifier,
    private serverService: ServerService,
    private instanceService: InstanceService
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

  async ngOnInit () {
    const { about, languages, categories }: ResolverData = this.route.snapshot.data.instanceData

    this.serverConfig = this.serverService.getHTMLConfig()

    this.route.data.subscribe(data => {
      if (!data?.isContact) return

      const prefill = this.route.snapshot.queryParams

      this.contactAdminModal.show(prefill)
    })

    this.languages = languages
    this.categories = categories

    this.shortDescription = about.instance.shortDescription
    this.descriptionContent = about.instance.description

    this.html = await this.instanceService.buildHtml(about)

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
    this.notifier.success(link, $localize `Link copied`)
  }
}
