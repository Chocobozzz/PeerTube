import { Injectable, inject } from '@angular/core'
import { PrimeNG } from 'primeng/config'

@Injectable()
export class I18nPrimengCalendarService {
  private config = inject(PrimeNG)

  constructor () {
    this.config.setTranslation({
      dayNames: [
        $localize`Sunday`,
        $localize`Monday`,
        $localize`Tuesday`,
        $localize`Wednesday`,
        $localize`Thursday`,
        $localize`Friday`,
        $localize`Saturday`
      ],

      dayNamesShort: [
        $localize`:Sunday short name|Day name short:Sun`,
        $localize`:Monday short name|Day name short:Mon`,
        $localize`:Tuesday short name|Day name short:Tue`,
        $localize`:Wednesday short name|Day name short:Wed`,
        $localize`:Thursday short name|Day name short:Thu`,
        $localize`:Friday short name|Day name short:Fri`,
        $localize`:Saturday short name|Day name short:Sat`
      ],

      dayNamesMin: [
        $localize`:Sunday min name|Day name min:Su`,
        $localize`:Monday min name|Day name min:Mo`,
        $localize`:Tuesday min name|Day name min:Tu`,
        $localize`:Wednesday min name|Day name min:We`,
        $localize`:Thursday min name|Day name min:Th`,
        $localize`:Friday min name|Day name min:Fr`,
        $localize`:Saturday min name|Day name min:Sa`
      ],

      monthNames: [
        $localize`January`,
        $localize`February`,
        $localize`March`,
        $localize`April`,
        $localize`May`,
        $localize`June`,
        $localize`July`,
        $localize`August`,
        $localize`September`,
        $localize`October`,
        $localize`November`,
        $localize`December`
      ],

      monthNamesShort: [
        $localize`:January short name|Month name short:Jan`,
        $localize`:February short name|Month name short:Feb`,
        $localize`:March short name|Month name short:Mar`,
        $localize`:April short name|Month name short:Apr`,
        $localize`:May short name|Month name short:May`,
        $localize`:June short name|Month name short:Jun`,
        $localize`:July short name|Month name short:Jul`,
        $localize`:August short name|Month name short:Aug`,
        $localize`:September short name|Month name short:Sep`,
        $localize`:October short name|Month name short:Oct`,
        $localize`:November short name|Month name short:Nov`,
        $localize`:December short name|Month name short:Dec`
      ],

      today: $localize`Today`,

      clear: $localize`Clear`
    })
  }

  getTimezone () {
    const gmt = new Date().toString().match(/([A-Z]+[+-][0-9]+)/)[1]
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone

    return `${timezone} - ${gmt}`
  }

  getDateFormat () {
    return $localize`:Date format in this locale.:yy-mm-dd`
  }

  getVideoPublicationYearRange () {
    return '1880:' + (new Date()).getFullYear()
  }
}
