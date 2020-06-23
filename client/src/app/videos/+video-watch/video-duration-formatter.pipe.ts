import { Pipe, PipeTransform } from '@angular/core'
import { I18n } from '@ngx-translate/i18n-polyfill'

@Pipe({
  name: 'myVideoDurationFormatter'
})
export class VideoDurationPipe implements PipeTransform {

  constructor (private i18n: I18n) {

  }

  transform (value: number): string {
    const hours = Math.floor(value / 3600)
    const minutes = Math.floor((value % 3600) / 60)
    const seconds = value % 60

    if (hours > 0) {
      return this.i18n('{{hours}} h {{minutes}} min {{seconds}} sec', { hours, minutes, seconds })
    }

    if (minutes > 0) {
      return this.i18n('{{minutes}} min {{seconds}} sec', { minutes, seconds })
    }

    return this.i18n('{{seconds}} sec', { seconds })
  }
}
