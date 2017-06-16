import { DatePipe } from '@angular/common'

export class Utils {

  static dateToHuman (date: String) {
    return new DatePipe('en').transform(date, 'medium')
  }

  static getRowDeleteButton () {
    return '<span class="glyphicon glyphicon-remove glyphicon-black"></span>'
  }
}
