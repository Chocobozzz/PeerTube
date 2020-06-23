import { PipeTransform, Pipe } from '@angular/core'
import { SafeHtml } from '@angular/platform-browser'

// Thanks https://gist.github.com/adamrecsko/0f28f474eca63e0279455476cc11eca7#gistcomment-2917369
@Pipe({ name: 'highlight' })
export class HighlightPipe implements PipeTransform {
  /* use this for single match search */
  static SINGLE_MATCH = 'Single-Match'
  /* use this for single match search with a restriction that target should start with search string */
  static SINGLE_AND_STARTS_WITH_MATCH = 'Single-And-StartsWith-Match'
  /* use this for global search */
  static MULTI_MATCH = 'Multi-Match'

  transform (
    contentString: string = null,
    stringToHighlight: string = null,
    option = 'Single-And-StartsWith-Match',
    caseSensitive = false,
    highlightStyleName = 'search-highlight'
  ): SafeHtml {
    if (stringToHighlight && contentString && option) {
      let regex: any = ''
      const caseFlag: string = !caseSensitive ? 'i' : ''

      switch (option) {
        case 'Single-Match': {
          regex = new RegExp(stringToHighlight, caseFlag)
          break
        }
        case 'Single-And-StartsWith-Match': {
          regex = new RegExp('^' + stringToHighlight, caseFlag)
          break
        }
        case 'Multi-Match': {
          regex = new RegExp(stringToHighlight, 'g' + caseFlag)
          break
        }
        default: {
          // default will be a global case-insensitive match
          regex = new RegExp(stringToHighlight, 'gi')
        }
      }

      const replaced = contentString.replace(
        regex,
        (match) => `<span class="${highlightStyleName}">${match}</span>`
      )

      return replaced
    } else {
      return contentString
    }
  }
}
