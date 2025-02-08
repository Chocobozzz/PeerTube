import { Component, EventEmitter, Input, OnInit, Output, ViewChild } from '@angular/core'
import { HooksService, Notifier } from '@app/core'
import {
  NgbAccordionDirective,
  NgbAccordionItem,
  NgbAccordionHeader,
  NgbAccordionToggle,
  NgbAccordionButton,
  NgbCollapse,
  NgbAccordionCollapse,
  NgbAccordionBody
} from '@ng-bootstrap/ng-bootstrap'
import { About, ClientFilterHookName, PluginClientScope } from '@peertube/peertube-models'
import { InstanceService } from '../shared-main/instance/instance.service'
import { InstanceFeaturesTableComponent } from './instance-features-table.component'
import { GlobalIconComponent } from '../shared-icons/global-icon.component'
import { NgIf, NgFor } from '@angular/common'

@Component({
  selector: 'my-instance-about-accordion',
  templateUrl: './instance-about-accordion.component.html',
  styleUrls: [ './instance-about-accordion.component.scss' ],
  imports: [
    NgIf,
    NgbAccordionDirective,
    NgbAccordionItem,
    NgbAccordionHeader,
    NgbAccordionToggle,
    NgbAccordionButton,
    GlobalIconComponent,
    NgbCollapse,
    NgbAccordionCollapse,
    NgbAccordionBody,
    InstanceFeaturesTableComponent,
    NgFor
  ]
})
export class InstanceAboutAccordionComponent implements OnInit {
  @ViewChild('accordion', { static: true }) accordion: NgbAccordionDirective

  @Output() init: EventEmitter<InstanceAboutAccordionComponent> = new EventEmitter<InstanceAboutAccordionComponent>()

  @Input() displayInstanceName = true
  @Input() displayInstanceShortDescription = true

  @Input() pluginScope: PluginClientScope
  @Input() pluginHook: ClientFilterHookName

  @Input() panels = {
    features: true,
    administrators: true,
    moderation: true,
    codeOfConduct: true,
    terms: true
  }

  about: About
  aboutHtml = {
    terms: '',
    codeOfConduct: '',
    moderationInformation: '',
    administrator: ''
  }

  pluginPanels: { id: string, title: string, html: string }[] = []

  constructor (
    private instanceService: InstanceService,
    private notifier: Notifier,
    private hookService: HooksService
  ) { }

  async ngOnInit () {
    this.instanceService.getAbout()
      .subscribe({
        next: async about => {
          this.about = about

          this.aboutHtml = await this.instanceService.buildHtml(about)

          this.init.emit(this)
        },

        error: err => this.notifier.error(err.message)
      })

    this.pluginPanels = await this.hookService.wrapObject([], this.pluginScope, this.pluginHook)
  }

  expandTerms () {
    this.accordion.expand('terms')
  }

  expandCodeOfConduct () {
    this.accordion.expand('code-of-conduct')
  }

  getAdministratorsPanel () {
    if (!this.about) return false
    if (!this.panels.administrators) return false

    return !!(this.aboutHtml?.administrator || this.about?.instance.maintenanceLifetime || this.about?.instance.businessModel)
  }

  getTermsTitle () {
    return $localize`Terms of ${this.about.instance.name}`
  }

  get moderationPanel () {
    return this.panels.moderation && !!this.aboutHtml.moderationInformation
  }

  get codeOfConductPanel () {
    return this.panels.codeOfConduct && !!this.aboutHtml.codeOfConduct
  }

  get termsPanel () {
    return this.panels.terms && !!this.aboutHtml.terms
  }
}
