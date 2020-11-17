export const TEXT_RULES = [
  'linkify',
  'autolink',
  'emphasis',
  'link',
  'newline',
  'list'
]

export const TEXT_WITH_HTML_RULES = TEXT_RULES.concat([
  'html_inline',
  'html_block'
])

export const ENHANCED_RULES = TEXT_RULES.concat([ 'image' ])
export const ENHANCED_WITH_HTML_RULES = TEXT_WITH_HTML_RULES.concat([ 'image' ])

export const COMPLETE_RULES = ENHANCED_WITH_HTML_RULES.concat([
  'block',
  'inline',
  'heading',
  'paragraph'
])
