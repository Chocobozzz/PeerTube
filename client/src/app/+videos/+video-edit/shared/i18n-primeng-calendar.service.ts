import { Injectable } from '@angular/core'
import { PrimeNGConfig } from 'primeng/api'

@Injectable()
export class I18nPrimengCalendarService {
  private readonly calendarLocale: any = {}

  constructor (private config: PrimeNGConfig) {
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
        $localize`:Day name short:Sun`,
        $localize`:Day name short:Mon`,
        $localize`:Day name short:Tue`,
        $localize`:Day name short:Wed`,
        $localize`:Day name short:Thu`,
        $localize`:Day name short:Fri`,
        $localize`:Day name short:Sat`
      ],

      dayNamesMin: [
        $localize`:Day name min:Su`,
        $localize`:Day name min:Mo`,
        $localize`:Day name min:Tu`,
        $localize`:Day name min:We`,
        $localize`:Day name min:Th`,
        $localize`:Day name min:Fr`,
        $localize`:Day name min:Sa`
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
        $localize`:Month name short:Jan`,
        $localize`:Month name short:Feb`,
        $localize`:Month name short:Mar`,
        $localize`:Month name short:Apr`,
        $localize`:Month name short:May`,
        $localize`:Month name short:Jun`,
        $localize`:Month name short:Jul`,
        $localize`:Month name short:Aug`,
        $localize`:Month name short:Sep`,
        $localize`:Month name short:Oct`,
        $localize`:Month name short:Nov`,
        $localize`:Month name short:Dec`
      ],

      today: $localize`Today`,

      clear: $localize`Clear`
    })
  }

  getCalendarLocale () {
    return this.calendarLocale
  }

  getTimezone () {
    const gmt = new Date().toString().match(/([A-Z]+[\+-][0-9]+)/)[1]
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone

    return `${timezone} - ${gmt}`
  }

  getDateFormat () {
    return $localize`:Date format in this locale.:yy-mm-dd`
  }
}
