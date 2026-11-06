import { DatePipe } from '@angular/common'
import { LOCALE_ID, Pipe, PipeTransform, inject } from '@angular/core'
import { getDateLocale } from '@app/helpers'

// Re-implementation of the angular date pipe that uses the web browser regional variant of the interface language to display dates

const intlFormats: { [format: string]: Intl.DateTimeFormatOptions } = {
  medium: { dateStyle: 'medium', timeStyle: 'medium' },
  long: { dateStyle: 'long', timeStyle: 'long' },
  full: { dateStyle: 'full', timeStyle: 'long' },
  mediumDate: { dateStyle: 'medium' },
  longDate: { dateStyle: 'long' },
  fullDate: { dateStyle: 'full' },
  shortTime: { timeStyle: 'short' },
  mediumTime: { timeStyle: 'medium' }
}

@Pipe({
  name: 'ptDate',
  pure: true,
  standalone: true
})
export class PTDatePipe implements PipeTransform {
  private angularPipe: DatePipe
  private dateLocale: string

  constructor () {
    const localeId = inject(LOCALE_ID)

    this.dateLocale = getDateLocale(localeId)
    this.angularPipe = new DatePipe(localeId)
  }

  transform (value: Date | string | number | null | undefined, format = 'mediumDate'): string {
    if (value === null || value === undefined || value === '') return null

    if (format === 'short') return new Date(value).toLocaleString(this.dateLocale)
    if (format === 'shortDate') return new Date(value).toLocaleDateString(this.dateLocale)

    const intlFormat = intlFormats[format]
    if (intlFormat) return new Date(value).toLocaleString(this.dateLocale, intlFormat)

    return this.angularPipe.transform(value, format)
  }
}
