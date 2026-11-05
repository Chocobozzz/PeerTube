/* oxlint-disable @typescript-eslint/no-unused-expressions */

import { filterWantedLanguages, hasOneOfLanguages } from '@peertube/peertube-core-utils'
import { expect } from 'chai'

describe('Has one of languages', function () {
  it('Returns true when a language matches a wanted language', function () {
    expect(hasOneOfLanguages([ 'en', 'fr' ], [ 'fr-FR' ])).to.be.true
    expect(hasOneOfLanguages([ 'fr' ], [ 'fr' ])).to.be.true
  })

  it('Supports multiple wanted languages', function () {
    expect(hasOneOfLanguages([ 'es' ], [ 'fr-FR', 'es' ])).to.be.true
    expect(hasOneOfLanguages([ 'de', 'it' ], [ 'fr-FR', 'en', 'it' ])).to.be.true
    expect(hasOneOfLanguages([ 'de' ], [ 'fr-FR', 'en', 'it' ])).to.be.false
  })

  it('Ignores the region and the script of the wanted languages', function () {
    expect(hasOneOfLanguages([ 'zh' ], [ 'zh-Hans-CN' ])).to.be.true
    expect(hasOneOfLanguages([ 'pt' ], [ 'pt-BR' ])).to.be.true
  })

  it('Ignores the region and the script of the languages', function () {
    expect(hasOneOfLanguages([ 'pt-BR' ], [ 'pt-BR' ])).to.be.true
    expect(hasOneOfLanguages([ 'pt-PT' ], [ 'pt-BR' ])).to.be.true
    expect(hasOneOfLanguages([ 'es-419' ], [ 'es-ES' ])).to.be.true
    expect(hasOneOfLanguages([ 'zh-Hans' ], [ 'zh-Hans-CN' ])).to.be.true
    expect(hasOneOfLanguages([ 'zh-Hant' ], [ 'zh-Hant-TW' ])).to.be.true
    expect(hasOneOfLanguages([ 'pt-BR' ], [ 'es-ES' ])).to.be.false
  })

  it('Supports three letters languages', function () {
    expect(hasOneOfLanguages([ 'kab' ], [ 'kab' ])).to.be.true
  })

  it('Is case insensitive', function () {
    expect(hasOneOfLanguages([ 'FR' ], [ 'fr-FR' ])).to.be.true
    expect(hasOneOfLanguages([ 'fr' ], [ 'FR-fr' ])).to.be.true
  })

  it('Returns false when no language matches a wanted language', function () {
    expect(hasOneOfLanguages([ 'en', 'es' ], [ 'fr-FR' ])).to.be.false
    expect(hasOneOfLanguages([ 'fr' ], [ 'kab' ])).to.be.false
  })

  it('Does not match on a prefix', function () {
    expect(hasOneOfLanguages([ 'fil' ], [ 'fi-FI' ])).to.be.false
  })

  it('Does not match the unknown language', function () {
    expect(hasOneOfLanguages([ 'fr' ], [ '_unknown' ])).to.be.false
  })

  it('Returns false without languages or wanted languages', function () {
    expect(hasOneOfLanguages([], [ 'fr-FR' ])).to.be.false
    expect(hasOneOfLanguages(undefined, [ 'fr-FR' ])).to.be.false
    expect(hasOneOfLanguages([ 'fr' ], undefined)).to.be.false
    expect(hasOneOfLanguages([ 'fr' ], [])).to.be.false
    expect(hasOneOfLanguages([ 'fr' ], [ undefined, '' ])).to.be.false
  })
})

describe('Filter wanted languages', function () {
  it('Returns the matching languages, keeping their order and their original code', function () {
    expect(filterWantedLanguages([ 'zh-Hans', 'de', 'FR', 'en' ], [ 'fr-FR', 'zh-Hant-TW' ])).to.deep.equal([ 'zh-Hans', 'FR' ])
  })

  it('Returns an empty array when nothing matches', function () {
    expect(filterWantedLanguages([ 'fil' ], [ 'fi-FI' ])).to.deep.equal([])
    expect(filterWantedLanguages(undefined, [ 'fr' ])).to.deep.equal([])
    expect(filterWantedLanguages([ 'fr' ], undefined)).to.deep.equal([])
  })
})
