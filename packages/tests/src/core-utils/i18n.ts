/* oxlint-disable @typescript-eslint/no-unused-expressions */

import { hasLanguageForLocale } from '@peertube/peertube-core-utils'
import { expect } from 'chai'

describe('Has language for locale', function () {
  it('Returns true when a language matches the locale language', function () {
    expect(hasLanguageForLocale([ 'en', 'fr' ], 'fr-FR')).to.be.true
    expect(hasLanguageForLocale([ 'fr' ], 'fr')).to.be.true
  })

  it('Ignores the region and the script of the locale', function () {
    expect(hasLanguageForLocale([ 'zh' ], 'zh-Hans-CN')).to.be.true
    expect(hasLanguageForLocale([ 'pt' ], 'pt-BR')).to.be.true
  })

  it('Supports three letters languages', function () {
    expect(hasLanguageForLocale([ 'kab' ], 'kab')).to.be.true
  })

  it('Is case insensitive', function () {
    expect(hasLanguageForLocale([ 'FR' ], 'fr-FR')).to.be.true
    expect(hasLanguageForLocale([ 'fr' ], 'FR-fr')).to.be.true
  })

  it('Returns false when no language matches the locale language', function () {
    expect(hasLanguageForLocale([ 'en', 'es' ], 'fr-FR')).to.be.false
    expect(hasLanguageForLocale([ 'fr' ], 'kab')).to.be.false
  })

  it('Does not match on a prefix', function () {
    expect(hasLanguageForLocale([ 'fil' ], 'fi-FI')).to.be.false
  })

  it('Returns false without languages or locale', function () {
    expect(hasLanguageForLocale([], 'fr-FR')).to.be.false
    expect(hasLanguageForLocale(undefined, 'fr-FR')).to.be.false
    expect(hasLanguageForLocale([ 'fr' ], undefined)).to.be.false
    expect(hasLanguageForLocale([ 'fr' ], '')).to.be.false
  })
})
