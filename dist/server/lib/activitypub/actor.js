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
const path_1 = require("path");
const url = require("url");
const uuidv4 = require("uuid/v4");
const activitypub_1 = require("../../helpers/activitypub");
const actor_1 = require("../../helpers/custom-validators/activitypub/actor");
const misc_1 = require("../../helpers/custom-validators/activitypub/misc");
const database_utils_1 = require("../../helpers/database-utils");
const logger_1 = require("../../helpers/logger");
const peertube_crypto_1 = require("../../helpers/peertube-crypto");
const requests_1 = require("../../helpers/requests");
const webfinger_1 = require("../../helpers/webfinger");
const initializers_1 = require("../../initializers");
const account_1 = require("../../models/account/account");
const actor_2 = require("../../models/activitypub/actor");
const avatar_1 = require("../../models/avatar/avatar");
const server_1 = require("../../models/server/server");
const video_channel_1 = require("../../models/video/video-channel");
const job_queue_1 = require("../job-queue");
const utils_1 = require("../../helpers/utils");
const actor_3 = require("../../helpers/actor");
function setAsyncActorKeys(actor) {
    return peertube_crypto_1.createPrivateAndPublicKeys()
        .then(({ publicKey, privateKey }) => {
        actor.set('publicKey', publicKey);
        actor.set('privateKey', privateKey);
        return actor.save();
    })
        .catch(err => {
        logger_1.logger.error('Cannot set public/private keys of actor %d.', actor.uuid, { err });
        return actor;
    });
}
exports.setAsyncActorKeys = setAsyncActorKeys;
function getOrCreateActorAndServerAndModel(activityActor, fetchType = 'actor-and-association-ids', recurseIfNeeded = true, updateCollections = false) {
    return __awaiter(this, void 0, void 0, function* () {
        const actorUrl = activitypub_1.getActorUrl(activityActor);
        let created = false;
        let actor = yield actor_3.fetchActorByUrl(actorUrl, fetchType);
        if (actor && (!actor.Account && !actor.VideoChannel)) {
            yield actor.destroy();
            actor = null;
        }
        if (!actor) {
            const { result } = yield fetchRemoteActor(actorUrl);
            if (result === undefined)
                throw new Error('Cannot fetch remote actor ' + actorUrl);
            let ownerActor = undefined;
            if (recurseIfNeeded === true && result.actor.type === 'Group') {
                const accountAttributedTo = result.attributedTo.find(a => a.type === 'Person');
                if (!accountAttributedTo)
                    throw new Error('Cannot find account attributed to video channel ' + actor.url);
                try {
                    ownerActor = yield getOrCreateActorAndServerAndModel(accountAttributedTo.id, 'all', false);
                }
                catch (err) {
                    logger_1.logger.error('Cannot get or create account attributed to video channel ' + actor.url);
                    throw new Error(err);
                }
            }
            actor = yield database_utils_1.retryTransactionWrapper(saveActorAndServerAndModelIfNotExist, result, ownerActor);
            created = true;
        }
        if (actor.Account)
            actor.Account.Actor = actor;
        if (actor.VideoChannel)
            actor.VideoChannel.Actor = actor;
        const { actor: actorRefreshed, refreshed } = yield database_utils_1.retryTransactionWrapper(refreshActorIfNeeded, actor, fetchType);
        if (!actorRefreshed)
            throw new Error('Actor ' + actorRefreshed.url + ' does not exist anymore.');
        if ((created === true || refreshed === true) && updateCollections === true) {
            const payload = { uri: actor.outboxUrl, type: 'activity' };
            yield job_queue_1.JobQueue.Instance.createJob({ type: 'activitypub-http-fetcher', payload });
        }
        return actorRefreshed;
    });
}
exports.getOrCreateActorAndServerAndModel = getOrCreateActorAndServerAndModel;
function buildActorInstance(type, url, preferredUsername, uuid) {
    return new actor_2.ActorModel({
        type,
        url,
        preferredUsername,
        uuid,
        publicKey: null,
        privateKey: null,
        followersCount: 0,
        followingCount: 0,
        inboxUrl: url + '/inbox',
        outboxUrl: url + '/outbox',
        sharedInboxUrl: initializers_1.CONFIG.WEBSERVER.URL + '/inbox',
        followersUrl: url + '/followers',
        followingUrl: url + '/following'
    });
}
exports.buildActorInstance = buildActorInstance;
function updateActorInstance(actorInstance, attributes) {
    return __awaiter(this, void 0, void 0, function* () {
        const followersCount = yield fetchActorTotalItems(attributes.followers);
        const followingCount = yield fetchActorTotalItems(attributes.following);
        actorInstance.set('type', attributes.type);
        actorInstance.set('uuid', attributes.uuid);
        actorInstance.set('preferredUsername', attributes.preferredUsername);
        actorInstance.set('url', attributes.id);
        actorInstance.set('publicKey', attributes.publicKey.publicKeyPem);
        actorInstance.set('followersCount', followersCount);
        actorInstance.set('followingCount', followingCount);
        actorInstance.set('inboxUrl', attributes.inbox);
        actorInstance.set('outboxUrl', attributes.outbox);
        actorInstance.set('sharedInboxUrl', attributes.endpoints.sharedInbox);
        actorInstance.set('followersUrl', attributes.followers);
        actorInstance.set('followingUrl', attributes.following);
    });
}
exports.updateActorInstance = updateActorInstance;
function updateActorAvatarInstance(actorInstance, avatarName, t) {
    return __awaiter(this, void 0, void 0, function* () {
        if (avatarName !== undefined) {
            if (actorInstance.avatarId) {
                try {
                    yield actorInstance.Avatar.destroy({ transaction: t });
                }
                catch (err) {
                    logger_1.logger.error('Cannot remove old avatar of actor %s.', actorInstance.url, { err });
                }
            }
            const avatar = yield avatar_1.AvatarModel.create({
                filename: avatarName
            }, { transaction: t });
            actorInstance.set('avatarId', avatar.id);
            actorInstance.Avatar = avatar;
        }
        return actorInstance;
    });
}
exports.updateActorAvatarInstance = updateActorAvatarInstance;
function fetchActorTotalItems(url) {
    return __awaiter(this, void 0, void 0, function* () {
        const options = {
            uri: url,
            method: 'GET',
            json: true,
            activityPub: true
        };
        try {
            const { body } = yield requests_1.doRequest(options);
            return body.totalItems ? body.totalItems : 0;
        }
        catch (err) {
            logger_1.logger.warn('Cannot fetch remote actor count %s.', url, { err });
            return 0;
        }
    });
}
exports.fetchActorTotalItems = fetchActorTotalItems;
function fetchAvatarIfExists(actorJSON) {
    return __awaiter(this, void 0, void 0, function* () {
        if (actorJSON.icon && actorJSON.icon.type === 'Image' && initializers_1.IMAGE_MIMETYPE_EXT[actorJSON.icon.mediaType] !== undefined &&
            misc_1.isActivityPubUrlValid(actorJSON.icon.url)) {
            const extension = initializers_1.IMAGE_MIMETYPE_EXT[actorJSON.icon.mediaType];
            const avatarName = uuidv4() + extension;
            const destPath = path_1.join(initializers_1.CONFIG.STORAGE.AVATARS_DIR, avatarName);
            yield requests_1.doRequestAndSaveToFile({
                method: 'GET',
                uri: actorJSON.icon.url
            }, destPath);
            return avatarName;
        }
        return undefined;
    });
}
exports.fetchAvatarIfExists = fetchAvatarIfExists;
function addFetchOutboxJob(actor) {
    return __awaiter(this, void 0, void 0, function* () {
        const serverActor = yield utils_1.getServerActor();
        if (serverActor.id === actor.id) {
            logger_1.logger.error('Cannot fetch our own outbox!');
            return undefined;
        }
        const payload = {
            uri: actor.outboxUrl,
            type: 'activity'
        };
        return job_queue_1.JobQueue.Instance.createJob({ type: 'activitypub-http-fetcher', payload });
    });
}
exports.addFetchOutboxJob = addFetchOutboxJob;
function saveActorAndServerAndModelIfNotExist(result, ownerActor, t) {
    let actor = result.actor;
    if (t !== undefined)
        return save(t);
    return initializers_1.sequelizeTypescript.transaction(t => save(t));
    function save(t) {
        return __awaiter(this, void 0, void 0, function* () {
            const actorHost = url.parse(actor.url).host;
            const serverOptions = {
                where: {
                    host: actorHost
                },
                defaults: {
                    host: actorHost
                },
                transaction: t
            };
            const [server] = yield server_1.ServerModel.findOrCreate(serverOptions);
            actor.set('serverId', server.id);
            if (result.avatarName) {
                const avatar = yield avatar_1.AvatarModel.create({
                    filename: result.avatarName
                }, { transaction: t });
                actor.set('avatarId', avatar.id);
            }
            const [actorCreated] = yield actor_2.ActorModel.findOrCreate({
                defaults: actor.toJSON(),
                where: {
                    url: actor.url
                },
                transaction: t
            });
            if (actorCreated.type === 'Person' || actorCreated.type === 'Application') {
                actorCreated.Account = yield saveAccount(actorCreated, result, t);
                actorCreated.Account.Actor = actorCreated;
            }
            else if (actorCreated.type === 'Group') {
                actorCreated.VideoChannel = yield saveVideoChannel(actorCreated, result, ownerActor, t);
                actorCreated.VideoChannel.Actor = actorCreated;
                actorCreated.VideoChannel.Account = ownerActor.Account;
            }
            return actorCreated;
        });
    }
}
function fetchRemoteActor(actorUrl) {
    return __awaiter(this, void 0, void 0, function* () {
        const options = {
            uri: actorUrl,
            method: 'GET',
            json: true,
            activityPub: true
        };
        logger_1.logger.info('Fetching remote actor %s.', actorUrl);
        const requestResult = yield requests_1.doRequest(options);
        actor_1.normalizeActor(requestResult.body);
        const actorJSON = requestResult.body;
        if (actor_1.isActorObjectValid(actorJSON) === false) {
            logger_1.logger.debug('Remote actor JSON is not valid.', { actorJSON: actorJSON });
            return { result: undefined, statusCode: requestResult.response.statusCode };
        }
        const followersCount = yield fetchActorTotalItems(actorJSON.followers);
        const followingCount = yield fetchActorTotalItems(actorJSON.following);
        const actor = new actor_2.ActorModel({
            type: actorJSON.type,
            uuid: actorJSON.uuid,
            preferredUsername: actorJSON.preferredUsername,
            url: actorJSON.id,
            publicKey: actorJSON.publicKey.publicKeyPem,
            privateKey: null,
            followersCount: followersCount,
            followingCount: followingCount,
            inboxUrl: actorJSON.inbox,
            outboxUrl: actorJSON.outbox,
            sharedInboxUrl: actorJSON.endpoints.sharedInbox,
            followersUrl: actorJSON.followers,
            followingUrl: actorJSON.following
        });
        const avatarName = yield fetchAvatarIfExists(actorJSON);
        const name = actorJSON.name || actorJSON.preferredUsername;
        return {
            statusCode: requestResult.response.statusCode,
            result: {
                actor,
                name,
                avatarName,
                summary: actorJSON.summary,
                support: actorJSON.support,
                attributedTo: actorJSON.attributedTo
            }
        };
    });
}
function saveAccount(actor, result, t) {
    return __awaiter(this, void 0, void 0, function* () {
        const [accountCreated] = yield account_1.AccountModel.findOrCreate({
            defaults: {
                name: result.name,
                description: result.summary,
                actorId: actor.id
            },
            where: {
                actorId: actor.id
            },
            transaction: t
        });
        return accountCreated;
    });
}
function saveVideoChannel(actor, result, ownerActor, t) {
    return __awaiter(this, void 0, void 0, function* () {
        const [videoChannelCreated] = yield video_channel_1.VideoChannelModel.findOrCreate({
            defaults: {
                name: result.name,
                description: result.summary,
                support: result.support,
                actorId: actor.id,
                accountId: ownerActor.Account.id
            },
            where: {
                actorId: actor.id
            },
            transaction: t
        });
        return videoChannelCreated;
    });
}
function refreshActorIfNeeded(actorArg, fetchedType) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!actorArg.isOutdated())
            return { actor: actorArg, refreshed: false };
        const actor = fetchedType === 'all' ? actorArg : yield actor_2.ActorModel.loadByUrlAndPopulateAccountAndChannel(actorArg.url);
        try {
            const actorUrl = yield webfinger_1.getUrlFromWebfinger(actor.preferredUsername + '@' + actor.getHost());
            const { result, statusCode } = yield fetchRemoteActor(actorUrl);
            if (statusCode === 404) {
                logger_1.logger.info('Deleting actor %s because there is a 404 in refresh actor.', actor.url);
                actor.Account ? actor.Account.destroy() : actor.VideoChannel.destroy();
                return { actor: undefined, refreshed: false };
            }
            if (result === undefined) {
                logger_1.logger.warn('Cannot fetch remote actor in refresh actor.');
                return { actor, refreshed: false };
            }
            return initializers_1.sequelizeTypescript.transaction((t) => __awaiter(this, void 0, void 0, function* () {
                database_utils_1.updateInstanceWithAnother(actor, result.actor);
                if (result.avatarName !== undefined) {
                    yield updateActorAvatarInstance(actor, result.avatarName, t);
                }
                actor.setDataValue('updatedAt', new Date());
                yield actor.save({ transaction: t });
                if (actor.Account) {
                    actor.Account.set('name', result.name);
                    actor.Account.set('description', result.summary);
                    yield actor.Account.save({ transaction: t });
                }
                else if (actor.VideoChannel) {
                    actor.VideoChannel.set('name', result.name);
                    actor.VideoChannel.set('description', result.summary);
                    actor.VideoChannel.set('support', result.support);
                    yield actor.VideoChannel.save({ transaction: t });
                }
                return { refreshed: true, actor };
            }));
        }
        catch (err) {
            logger_1.logger.warn('Cannot refresh actor.', { err });
            return { actor, refreshed: false };
        }
    });
}
