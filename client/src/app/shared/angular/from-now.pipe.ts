import { Pipe, PipeTransform } from '@angular/core'
import { I18n } from '@ngx-translate/i18n-polyfill'

// Thanks: https://stackoverflow.com/questions/3177836/how-to-format-time-since-xxx-e-g-4-minutes-ago-similar-to-stack-exchange-site
@Pipe({ name: 'myFromNow' })
export class FromNowPipe implements PipeTransform {

  constructor (private i18n: I18n) { }

  transform (arg: number | Date | string) {
    const argDate = new Date(arg)
    const seconds = Math.floor((Date.now() - argDate.getTime()) / 1000)

    let interval = Math.floor(seconds / 31536000)
    if (interval > 1) return this.i18n('{{interval}} years ago', { interval })
    if (interval === 1) return this.i18n('{{interval}} year ago', { interval })

    interval = Math.floor(seconds / 2592000)
    if (interval > 1) return this.i18n('{{interval}} months ago', { interval })
    if (interval === 1) return this.i18n('{{interval}} month ago', { interval })

    interval = Math.floor(seconds / 604800)
    if (interval > 1) return this.i18n('{{interval}} weeks ago', { interval })
    if (interval === 1) return this.i18n('{{interval}} week ago', { interval })

    interval = Math.floor(seconds / 86400)
    if (interval > 1) return this.i18n('{{interval}} days ago', { interval })
    if (interval === 1) return this.i18n('{{interval}} day ago', { interval })

    interval = Math.floor(seconds / 3600)
    if (interval > 1) return this.i18n('{{interval}} hours ago', { interval })
    if (interval === 1) return this.i18n('{{interval}} hour ago', { interval })

    interval = Math.floor(seconds / 60)
    if (interval >= 1) return this.i18n('{{interval}} min ago', { interval })

    return this.i18n('just now')
  }
}
