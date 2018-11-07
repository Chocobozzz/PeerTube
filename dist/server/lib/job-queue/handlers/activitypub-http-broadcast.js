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
const Bluebird = require("bluebird");
const logger_1 = require("../../../helpers/logger");
const requests_1 = require("../../../helpers/requests");
const actor_follow_1 = require("../../../models/activitypub/actor-follow");
const activitypub_http_utils_1 = require("./utils/activitypub-http-utils");
const initializers_1 = require("../../../initializers");
function processActivityPubHttpBroadcast(job) {
    return __awaiter(this, void 0, void 0, function* () {
        logger_1.logger.info('Processing ActivityPub broadcast in job %d.', job.id);
        const payload = job.data;
        const body = yield activitypub_http_utils_1.computeBody(payload);
        const httpSignatureOptions = yield activitypub_http_utils_1.buildSignedRequestOptions(payload);
        const options = {
            method: 'POST',
            uri: '',
            json: body,
            httpSignature: httpSignatureOptions,
            timeout: initializers_1.JOB_REQUEST_TIMEOUT,
            headers: activitypub_http_utils_1.buildGlobalHeaders(body)
        };
        const badUrls = [];
        const goodUrls = [];
        yield Bluebird.map(payload.uris, uri => {
            return requests_1.doRequest(Object.assign({}, options, { uri }))
                .then(() => goodUrls.push(uri))
                .catch(() => badUrls.push(uri));
        }, { concurrency: initializers_1.BROADCAST_CONCURRENCY });
        return actor_follow_1.ActorFollowModel.updateActorFollowsScore(goodUrls, badUrls, undefined);
    });
}
exports.processActivityPubHttpBroadcast = processActivityPubHttpBroadcast;
