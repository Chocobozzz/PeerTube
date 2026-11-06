import { DatePipe } from '@angular/common'

let datePipe: DatePipe
let intl: Intl.DateTimeFormat

export type DateFormat = 'medium' | 'precise'

// Locale to format dates: the interface language, refined by the web browser regional variant if they share the same language
// So an English interface with an en-GB browser displays dd/mm/yyyy dates, a French interface with an en-US browser displays French dates
export function getDateLocale (localeId: string) {
  const language = localeId.split('-')[0]

  const browserLocales = navigator.languages?.length
    ? navigator.languages
    : [ navigator.language ]

  return browserLocales.find(l => l?.includes('-') && l.split('-')[0] === language) ?? localeId
}

export function dateTimeToHuman (localeId: string, date: Date | string | number) {
  return new Date(date).toLocaleString(getDateLocale(localeId), { dateStyle: 'medium', timeStyle: 'short' })
}

export function dateToHuman (localeId: string, date: Date, format: 'medium' | 'precise' = 'medium') {
  if (!datePipe) {
    datePipe = new DatePipe(localeId)
  }

  if (!intl) {
    intl = new Intl.DateTimeFormat(localeId, {
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      year: '2-digit',
      month: 'numeric',
      day: 'numeric',
      fractionalSecondDigits: 3
    })
  }

  if (format === 'medium') return datePipe.transform(date, format)
  if (format === 'precise') return intl.format(date)
}

export function durationToString (duration: number) {
  const hours = Math.floor(duration / 3600)
  const minutes = Math.floor((duration % 3600) / 60)
  const seconds = duration % 60

  const minutesPadding = minutes >= 10 ? '' : '0'
  const secondsPadding = seconds >= 10 ? '' : '0'
  const displayedHours = hours > 0 ? hours.toString() + ':' : ''

  return (
    displayedHours + minutesPadding + minutes.toString() + ':' + secondsPadding + seconds.toString()
  ).replace(/^0/, '')
}
