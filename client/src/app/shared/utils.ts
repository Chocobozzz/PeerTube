import { DatePipe } from '@angular/common'

export class Utils {

  static dateToHuman (date: Date) {
    return new DatePipe('en').transform(date, 'medium')
  }
}
