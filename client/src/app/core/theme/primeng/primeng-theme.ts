import base from './base'
import autocomplete from './components/autocomplete'
import checkbox from './components/checkbox'
import chip from './components/chip'
import datatable from './components/datatable'
import datepicker from './components/datepicker'
import inputchips from './components/inputchips'
import inputtext from './components/inputtext'
import multiselect from './components/multiselect'
import paginator from './components/paginator'
import select from './components/select'
import toast from './components/toast'

export const PTPrimeTheme = {
  ...base,

  components: {
    select,
    inputchips,
    chip,
    datepicker,
    inputtext,
    toast,
    autocomplete,
    multiselect,
    checkbox,
    datatable,
    paginator
  }
}
