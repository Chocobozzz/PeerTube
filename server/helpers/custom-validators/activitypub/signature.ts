import { exists } from '../misc'
import { isActivityPubUrlValid } from './misc'

function checkSignatureType (signatureType: string) {
  if (signatureType !== 'RsaSignature2017') throw new Error('Should have a RsaSignature2017 signature')
  return true
}

function checkSignatureCreator (signatureCreator: string) {
  if (!exists(signatureCreator)) throw new Error('Should have a signature creator value')
  if (!isActivityPubUrlValid(signatureCreator)) throw new Error('Should have a signature creator that is a valid ActivityPub URL')
  return true
}

function checkSignatureValue (signatureValue: string) {
  if (!exists(signatureValue)) throw new Error('Should have a signature value')
  if (signatureValue.length === 0) throw new Error('Should have a signature of sufficient length')
  return true
}

// ---------------------------------------------------------------------------

export {
  checkSignatureType,
  checkSignatureCreator,
  checkSignatureValue
}
