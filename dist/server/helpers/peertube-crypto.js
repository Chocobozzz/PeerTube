"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const initializers_1 = require("../initializers");
const core_utils_1 = require("./core-utils");
const custom_jsonld_signature_1 = require("./custom-jsonld-signature");
const logger_1 = require("./logger");
const httpSignature = require('http-signature');
function createPrivateAndPublicKeys() {
    return __awaiter(this, void 0, void 0, function* () {
        logger_1.logger.info('Generating a RSA key...');
        const { key } = yield core_utils_1.createPrivateKey(initializers_1.PRIVATE_RSA_KEY_SIZE);
        const { publicKey } = yield core_utils_1.getPublicKey(key);
        return { privateKey: key, publicKey };
    });
}
exports.createPrivateAndPublicKeys = createPrivateAndPublicKeys;
function comparePassword(plainPassword, hashPassword) {
    return core_utils_1.bcryptComparePromise(plainPassword, hashPassword);
}
exports.comparePassword = comparePassword;
function cryptPassword(password) {
    return __awaiter(this, void 0, void 0, function* () {
        const salt = yield core_utils_1.bcryptGenSaltPromise(initializers_1.BCRYPT_SALT_SIZE);
        return core_utils_1.bcryptHashPromise(password, salt);
    });
}
exports.cryptPassword = cryptPassword;
function isHTTPSignatureVerified(httpSignatureParsed, actor) {
    return httpSignature.verifySignature(httpSignatureParsed, actor.publicKey) === true;
}
exports.isHTTPSignatureVerified = isHTTPSignatureVerified;
function parseHTTPSignature(req) {
    return httpSignature.parse(req, { authorizationHeaderName: initializers_1.HTTP_SIGNATURE.HEADER_NAME });
}
exports.parseHTTPSignature = parseHTTPSignature;
function isJsonLDSignatureVerified(fromActor, signedDocument) {
    const publicKeyObject = {
        '@context': custom_jsonld_signature_1.jsig.SECURITY_CONTEXT_URL,
        id: fromActor.url,
        type: 'CryptographicKey',
        owner: fromActor.url,
        publicKeyPem: fromActor.publicKey
    };
    const publicKeyOwnerObject = {
        '@context': custom_jsonld_signature_1.jsig.SECURITY_CONTEXT_URL,
        id: fromActor.url,
        publicKey: [publicKeyObject]
    };
    const options = {
        publicKey: publicKeyObject,
        publicKeyOwner: publicKeyOwnerObject
    };
    return custom_jsonld_signature_1.jsig.promises
        .verify(signedDocument, options)
        .then((result) => result.verified)
        .catch(err => {
        logger_1.logger.error('Cannot check signature.', { err });
        return false;
    });
}
exports.isJsonLDSignatureVerified = isJsonLDSignatureVerified;
function signJsonLDObject(byActor, data) {
    const options = {
        privateKeyPem: byActor.privateKey,
        creator: byActor.url,
        algorithm: 'RsaSignature2017'
    };
    return custom_jsonld_signature_1.jsig.promises.sign(data, options);
}
exports.signJsonLDObject = signJsonLDObject;
