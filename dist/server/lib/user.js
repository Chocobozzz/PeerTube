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
const uuidv4 = require("uuid/v4");
const initializers_1 = require("../initializers");
const account_1 = require("../models/account/account");
const activitypub_1 = require("./activitypub");
const video_channel_1 = require("./video-channel");
const actor_1 = require("../models/activitypub/actor");
function createUserAccountAndChannel(userToCreate, validateUser = true) {
    return __awaiter(this, void 0, void 0, function* () {
        const { user, account, videoChannel } = yield initializers_1.sequelizeTypescript.transaction((t) => __awaiter(this, void 0, void 0, function* () {
            const userOptions = {
                transaction: t,
                validate: validateUser
            };
            const userCreated = yield userToCreate.save(userOptions);
            const accountCreated = yield createLocalAccountWithoutKeys(userToCreate.username, userToCreate.id, null, t);
            userCreated.Account = accountCreated;
            let channelName = userCreated.username + '_channel';
            const actor = yield actor_1.ActorModel.loadLocalByName(channelName);
            if (actor)
                channelName = uuidv4();
            const videoChannelDisplayName = `Main ${userCreated.username} channel`;
            const videoChannelInfo = {
                name: channelName,
                displayName: videoChannelDisplayName
            };
            const videoChannel = yield video_channel_1.createVideoChannel(videoChannelInfo, accountCreated, t);
            return { user: userCreated, account: accountCreated, videoChannel };
        }));
        account.Actor = yield activitypub_1.setAsyncActorKeys(account.Actor);
        videoChannel.Actor = yield activitypub_1.setAsyncActorKeys(videoChannel.Actor);
        return { user, account, videoChannel };
    });
}
exports.createUserAccountAndChannel = createUserAccountAndChannel;
function createLocalAccountWithoutKeys(name, userId, applicationId, t, type = 'Person') {
    return __awaiter(this, void 0, void 0, function* () {
        const url = activitypub_1.getAccountActivityPubUrl(name);
        const actorInstance = activitypub_1.buildActorInstance(type, url, name);
        const actorInstanceCreated = yield actorInstance.save({ transaction: t });
        const accountInstance = new account_1.AccountModel({
            name,
            userId,
            applicationId,
            actorId: actorInstanceCreated.id
        });
        const accountInstanceCreated = yield accountInstance.save({ transaction: t });
        accountInstanceCreated.Actor = actorInstanceCreated;
        return accountInstanceCreated;
    });
}
exports.createLocalAccountWithoutKeys = createLocalAccountWithoutKeys;
function createApplicationActor(applicationId) {
    return __awaiter(this, void 0, void 0, function* () {
        const accountCreated = yield createLocalAccountWithoutKeys(initializers_1.SERVER_ACTOR_NAME, null, applicationId, undefined, 'Application');
        accountCreated.Actor = yield activitypub_1.setAsyncActorKeys(accountCreated.Actor);
        return accountCreated;
    });
}
exports.createApplicationActor = createApplicationActor;
//# sourceMappingURL=user.js.map