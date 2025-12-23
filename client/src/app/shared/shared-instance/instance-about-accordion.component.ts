import { Component, OnInit, inject, input, output, viewChild } from '@angular/core'
import { HooksService, Notifier } from '@app/core'
import {
  NgbAccordionBody,
  NgbAccordionButton,
  NgbAccordionCollapse,
  NgbAccordionDirective,
  NgbAccordionHeader,
  NgbAccordionItem,
  NgbAccordionToggle,
  NgbCollapse
} from '@ng-bootstrap/ng-bootstrap'
import { About, ClientFilterHookName, PluginClientScope } from '@peertube/peertube-models'
import { GlobalIconComponent } from '../shared-icons/global-icon.component'
import { InstanceService } from '../shared-main/instance/instance.service'
import { InstanceFeaturesTableComponent } from './instance-features-table.component'

@Component({
  selector: 'my-instance-about-accordion',
  templateUrl: './instance-about-accordion.component.html',
  styleUrls: [ './instance-about-accordion.component.scss' ],
  imports: [
    NgbAccordionDirective,
    NgbAccordionItem,
    NgbAccordionHeader,
    NgbAccordionToggle,
    NgbAccordionButton,
    GlobalIconComponent,
    NgbCollapse,
    NgbAccordionCollapse,
    NgbAccordionBody,
    InstanceFeaturesTableComponent
  ]
})
export class InstanceAboutAccordionComponent implements OnInit {
  private instanceService = inject(InstanceService)
  private notifier = inject(Notifier)
  private hookService = inject(HooksService)

  readonly accordion = viewChild<NgbAccordionDirective>('accordion')

  readonly init = output<InstanceAboutAccordionComponent>()

  readonly displayInstanceName = input(true)
  readonly displayInstanceShortDescription = input(true)

  readonly pluginScope = input<PluginClientScope>(undefined)
  readonly pluginHook = input<ClientFilterHookName>(undefined)

  readonly panels = input({
    features: true,
    administrators: true,
    moderation: true,
    codeOfConduct: true,
    terms: true
  })

  about: About
  aboutHtml = {
    terms: '',
    codeOfConduct: '',
    moderationInformation: '',
    administrator: ''
  }

  pluginPanels: { id: string, title: string, html: string }[] = []

  async ngOnInit () {
    this.instanceService.getAbout()
      .subscribe({
        next: async about => {
          this.about = about

          this.aboutHtml = await this.instanceService.buildHtml(about)

          this.init.emit(this)
        },

        error: err => this.notifier.handleError(err)
      })

    this.pluginPanels = await this.hookService.wrapObject([], this.pluginScope(), this.pluginHook())
  }

  expandTerms () {
    this.accordion().expand('terms')
  }

  expandCodeOfConduct () {
    this.accordion().expand('code-of-conduct')
  }

  getAdministratorsPanel () {
    if (!this.about) return false
    if (!this.panels().administrators) return false

    return !!(this.aboutHtml?.administrator || this.about?.instance.maintenanceLifetime || this.about?.instance.businessModel)
  }

  getTermsTitle () {
    return $localize`Terms of ${this.about.instance.name}`
  }

  get moderationPanel () {
    return this.panels().moderation && !!this.aboutHtml.moderationInformation
  }

  get codeOfConductPanel () {
    return this.panels().codeOfConduct && !!this.aboutHtml.codeOfConduct
  }

  get termsPanel () {
    return this.panels().terms && !!this.aboutHtml.terms
  }
}
