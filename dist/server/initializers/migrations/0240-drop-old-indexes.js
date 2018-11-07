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
        const indexNames = [
            'accounts_application_id',
            'accounts_user_id',
            'accounts_name',
            'account_video_rates_video_id_account_id',
            'account_video_rates_video_id_account_id_type',
            'account_follows_account_id_target_account_id',
            'account_follow_account_id_target_account_id',
            'account_follow_account_id',
            'account_follow_target_account_id',
            'account_follows_account_id',
            'account_follows_target_account_id',
            'o_auth_clients_client_id',
            'o_auth_clients_client_id_client_secret',
            'o_auth_tokens_access_token',
            'o_auth_tokens_refresh_token',
            'o_auth_tokens_o_auth_client_id',
            'o_auth_tokens_user_id',
            'pods_host',
            'servers_host',
            'tags_name',
            'users_email',
            'users_username',
            'videos_channel_id',
            'videos_created_at',
            'videos_duration',
            'videos_likes',
            'videos_name',
            'videos_uuid',
            'videos_views',
            'video_abuses_reporter_account_id',
            'video_abuses_video_id',
            'blacklisted_videos_video_id',
            'video_channels_account_id',
            'video_files_info_hash',
            'video_files_video_id',
            'video_shares_account_id',
            'video_shares_video_id',
            'video_tags_tag_id',
            'video_tags_video_id'
        ];
        for (const indexName of indexNames) {
            yield utils.sequelize.query('DROP INDEX IF EXISTS "' + indexName + '";');
        }
        yield utils.sequelize.query('ALTER TABLE "account" DROP CONSTRAINT IF EXISTS "actorId_foreign_idx";');
        yield utils.sequelize.query('ALTER TABLE "videoChannel" DROP CONSTRAINT IF EXISTS "actorId_foreign_idx";');
        yield utils.sequelize.query('ALTER TABLE "videoShare" DROP CONSTRAINT IF EXISTS "VideoShares_videoId_fkey";');
        yield utils.sequelize.query('DROP TABLE IF EXISTS "videoChannelShare";');
    });
}
exports.up = up;
function down(options) {
    throw new Error('Not implemented.');
}
exports.down = down;
