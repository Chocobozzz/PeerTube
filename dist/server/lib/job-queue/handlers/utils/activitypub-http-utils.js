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
const activitypub_1 = require("../../../../helpers/activitypub");
const utils_1 = require("../../../../helpers/utils");
const actor_1 = require("../../../../models/activitypub/actor");
const core_utils_1 = require("../../../../helpers/core-utils");
const initializers_1 = require("../../../../initializers");
function computeBody(payload) {
    return __awaiter(this, void 0, void 0, function* () {
        let body = payload.body;
        if (payload.signatureActorId) {
            const actorSignature = yield actor_1.ActorModel.load(payload.signatureActorId);
            if (!actorSignature)
                throw new Error('Unknown signature actor id.');
            body = yield activitypub_1.buildSignedActivity(actorSignature, payload.body);
        }
        return body;
    });
}
exports.computeBody = computeBody;
function buildSignedRequestOptions(payload) {
    return __awaiter(this, void 0, void 0, function* () {
        let actor;
        if (payload.signatureActorId) {
            actor = yield actor_1.ActorModel.load(payload.signatureActorId);
            if (!actor)
                throw new Error('Unknown signature actor id.');
        }
        else {
            actor = yield utils_1.getServerActor();
        }
        const keyId = actor.getWebfingerUrl();
        return {
            algorithm: initializers_1.HTTP_SIGNATURE.ALGORITHM,
            authorizationHeaderName: initializers_1.HTTP_SIGNATURE.HEADER_NAME,
            keyId,
            key: actor.privateKey,
            headers: initializers_1.HTTP_SIGNATURE.HEADERS_TO_SIGN
        };
    });
}
exports.buildSignedRequestOptions = buildSignedRequestOptions;
function buildGlobalHeaders(body) {
    const digest = 'SHA-256=' + core_utils_1.sha256(JSON.stringify(body), 'base64');
    return {
        'Digest': digest
    };
}
exports.buildGlobalHeaders = buildGlobalHeaders;
