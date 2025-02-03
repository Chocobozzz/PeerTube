import { CommonModule } from '@angular/common'
import { Component, ElementRef, Inject, LOCALE_ID, ViewChild } from '@angular/core'
import { getDevLocale, isOnDevLocale } from '@app/helpers'
import { GlobalIconComponent } from '@app/shared/shared-icons/global-icon.component'
import { NgbModal } from '@ng-bootstrap/ng-bootstrap'
import { getCompleteLocale, getShortLocale, I18N_LOCALES, objectKeysTyped, sortBy } from '@peertube/peertube-core-utils'

@Component({
  selector: 'my-language-chooser',
  templateUrl: './language-chooser.component.html',
  styleUrls: [ './language-chooser.component.scss' ],
  imports: [ CommonModule, GlobalIconComponent ]
})
export class LanguageChooserComponent {
  @ViewChild('modal', { static: true }) modal: ElementRef

  languages: { id: string, label: string, iso: string }[] = []

  constructor (
    private modalService: NgbModal,
    @Inject(LOCALE_ID) private localeId: string
  ) {
    const l = objectKeysTyped(I18N_LOCALES)
      .map(k => ({ id: k, label: I18N_LOCALES[k], iso: getShortLocale(k) }))

    this.languages = sortBy(l, 'label')
  }

  show () {
    this.modalService.open(this.modal, { centered: true })
  }

  buildLanguageLink (lang: { id: string }) {
    return window.location.origin + '/' + lang.id
  }

  getCurrentLanguage () {
    const english = 'English'
    const locale = isOnDevLocale() ? getDevLocale() : getCompleteLocale(this.localeId)

    if (locale) return I18N_LOCALES[locale as keyof typeof I18N_LOCALES] || english
    return english
  }
}
