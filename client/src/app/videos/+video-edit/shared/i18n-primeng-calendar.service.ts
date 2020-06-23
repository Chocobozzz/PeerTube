import { I18n } from '@ngx-translate/i18n-polyfill'
import { Injectable } from '@angular/core'

@Injectable()
export class I18nPrimengCalendarService {
  private readonly calendarLocale: any = {}

  constructor (private i18n: I18n) {
    this.calendarLocale = {
      firstDayOfWeek: 0,
      dayNames: [
        this.i18n('Sunday'),
        this.i18n('Monday'),
        this.i18n('Tuesday'),
        this.i18n('Wednesday'),
        this.i18n('Thursday'),
        this.i18n('Friday'),
        this.i18n('Saturday')
      ],

      dayNamesShort: [
        this.i18n({ value: 'Sun', description: 'Day name short' }),
        this.i18n({ value: 'Mon', description: 'Day name short' }),
        this.i18n({ value: 'Tue', description: 'Day name short' }),
        this.i18n({ value: 'Wed', description: 'Day name short' }),
        this.i18n({ value: 'Thu', description: 'Day name short' }),
        this.i18n({ value: 'Fri', description: 'Day name short' }),
        this.i18n({ value: 'Sat', description: 'Day name short' })
      ],

      dayNamesMin: [
        this.i18n({ value: 'Su', description: 'Day name min' }),
        this.i18n({ value: 'Mo', description: 'Day name min' }),
        this.i18n({ value: 'Tu', description: 'Day name min' }),
        this.i18n({ value: 'We', description: 'Day name min' }),
        this.i18n({ value: 'Th', description: 'Day name min' }),
        this.i18n({ value: 'Fr', description: 'Day name min' }),
        this.i18n({ value: 'Sa', description: 'Day name min' })
      ],

      monthNames: [
        this.i18n('January'),
        this.i18n('February'),
        this.i18n('March'),
        this.i18n('April'),
        this.i18n('May'),
        this.i18n('June'),
        this.i18n('July'),
        this.i18n('August'),
        this.i18n('September'),
        this.i18n('October'),
        this.i18n('November'),
        this.i18n('December')
      ],

      monthNamesShort: [
        this.i18n({ value: 'Jan', description: 'Month name short' }),
        this.i18n({ value: 'Feb', description: 'Month name short' }),
        this.i18n({ value: 'Mar', description: 'Month name short' }),
        this.i18n({ value: 'Apr', description: 'Month name short' }),
        this.i18n({ value: 'May', description: 'Month name short' }),
        this.i18n({ value: 'Jun', description: 'Month name short' }),
        this.i18n({ value: 'Jul', description: 'Month name short' }),
        this.i18n({ value: 'Aug', description: 'Month name short' }),
        this.i18n({ value: 'Sep', description: 'Month name short' }),
        this.i18n({ value: 'Oct', description: 'Month name short' }),
        this.i18n({ value: 'Nov', description: 'Month name short' }),
        this.i18n({ value: 'Dec', description: 'Month name short' })
      ],

      today: this.i18n('Today'),

      clear: this.i18n('Clear')
    }
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
    return this.i18n({
      value: 'yy-mm-dd ',
      description: 'Date format in this locale.'
    })
  }
}
