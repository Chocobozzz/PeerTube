import { Component, ElementRef, Inject, LOCALE_ID, ViewChild } from '@angular/core'
import { getDevLocale, isOnDevLocale, sortBy } from '@app/helpers'
import { NgbModal } from '@ng-bootstrap/ng-bootstrap'
import { getCompleteLocale, getShortLocale, I18N_LOCALES } from '@shared/core-utils/i18n'

@Component({
  selector: 'my-language-chooser',
  templateUrl: './language-chooser.component.html',
  styleUrls: [ './language-chooser.component.scss' ]
})
export class LanguageChooserComponent {
  @ViewChild('modal', { static: true }) modal: ElementRef

  languages: { id: string, label: string, iso: string }[] = []

  constructor (
    private modalService: NgbModal,
    @Inject(LOCALE_ID) private localeId: string
  ) {
    const l = Object.keys(I18N_LOCALES)
                    .map(k => ({ id: k, label: I18N_LOCALES[k] , iso: getShortLocale(k) }))

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

    if (locale) return I18N_LOCALES[locale] || english
    return english
  }
}
