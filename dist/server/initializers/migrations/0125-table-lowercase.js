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
function up(utils) {
    return __awaiter(this, void 0, void 0, function* () {
        yield utils.queryInterface.renameTable('Applications', 'application');
        yield utils.queryInterface.renameTable('AccountFollows', 'accountFollow');
        yield utils.queryInterface.renameTable('AccountVideoRates', 'accountVideoRate');
        yield utils.queryInterface.renameTable('Accounts', 'account');
        yield utils.queryInterface.renameTable('Avatars', 'avatar');
        yield utils.queryInterface.renameTable('BlacklistedVideos', 'videoBlacklist');
        yield utils.queryInterface.renameTable('Jobs', 'job');
        yield utils.queryInterface.renameTable('OAuthClients', 'oAuthClient');
        yield utils.queryInterface.renameTable('OAuthTokens', 'oAuthToken');
        yield utils.queryInterface.renameTable('Servers', 'server');
        yield utils.queryInterface.renameTable('Tags', 'tag');
        yield utils.queryInterface.renameTable('Users', 'user');
        yield utils.queryInterface.renameTable('VideoAbuses', 'videoAbuse');
        yield utils.queryInterface.renameTable('VideoChannels', 'videoChannel');
        yield utils.queryInterface.renameTable('VideoChannelShares', 'videoChannelShare');
        yield utils.queryInterface.renameTable('VideoFiles', 'videoFile');
        yield utils.queryInterface.renameTable('VideoShares', 'videoShare');
        yield utils.queryInterface.renameTable('VideoTags', 'videoTag');
        yield utils.queryInterface.renameTable('Videos', 'video');
    });
}
exports.up = up;
function down(options) {
    throw new Error('Not implemented.');
}
exports.down = down;
