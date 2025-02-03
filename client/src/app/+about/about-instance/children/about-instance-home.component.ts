import { NgFor, NgIf } from '@angular/common'
import { Component, OnInit, ViewChild } from '@angular/core'
import { ActivatedRoute, Router } from '@angular/router'
import { ServerService } from '@app/core'
import { AboutHTML } from '@app/shared/shared-main/instance/instance.service'
import { SupportModalComponent } from '@app/shared/shared-support-modal/support-modal.component'
import { HTMLServerConfig } from '@peertube/peertube-models'
import { CustomMarkupContainerComponent } from '../../../shared/shared-custom-markup/custom-markup-container.component'
import { ResolverData } from '../about-instance.resolver'

@Component({
  templateUrl: './about-instance-home.component.html',
  styleUrls: [ './about-instance-common.component.scss' ],
  imports: [
    NgIf,
    NgFor,
    CustomMarkupContainerComponent,
    SupportModalComponent
  ]
})
export class AboutInstanceHomeComponent implements OnInit {
  @ViewChild('supportModal') supportModal: SupportModalComponent

  aboutHTML: AboutHTML
  descriptionElement: HTMLDivElement

  languages: string[] = []
  categories: string[] = []

  config: HTMLServerConfig

  constructor (
    private router: Router,
    private route: ActivatedRoute,
    private serverService: ServerService
  ) {}

  ngOnInit () {
    this.config = this.serverService.getHTMLConfig()

    const {
      languages,
      categories,
      aboutHTML,
      descriptionElement
    }: ResolverData = this.route.parent.snapshot.data.instanceData

    this.aboutHTML = aboutHTML
    this.descriptionElement = descriptionElement

    this.languages = languages
    this.categories = categories

    this.route.data.subscribe(data => {
      if (!data?.isSupport) return

      setTimeout(() => {
        const modal = this.supportModal.show()

        modal.hidden.subscribe(() => this.router.navigateByUrl('/about/instance/home'))
      }, 0)
    })
  }
}
