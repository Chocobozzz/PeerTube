import 'zone.js'

;(window as any).global = window
;(window as any).process = { env: {} }//require('process/')
;(window as any).Buffer = require('buffer').Buffer

import '@angular/localize/init'
