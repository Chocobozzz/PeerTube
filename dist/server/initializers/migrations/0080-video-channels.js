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
const Sequelize = require("sequelize");
const uuidv4 = require("uuid/v4");
function up(utils) {
    return __awaiter(this, void 0, void 0, function* () {
        const q = utils.queryInterface;
        const dataAuthorUUID = {
            type: Sequelize.UUID,
            defaultValue: Sequelize.UUIDV4,
            allowNull: true
        };
        yield q.addColumn('Authors', 'uuid', dataAuthorUUID);
        {
            const authors = yield utils.db.Author.findAll();
            for (const author of authors) {
                author.uuid = uuidv4();
                yield author.save();
            }
        }
        dataAuthorUUID.allowNull = false;
        yield q.changeColumn('Authors', 'uuid', dataAuthorUUID);
        const users = yield utils.db.User.findAll();
        for (const user of users) {
            const author = yield utils.db.Author.find({ where: { userId: user.id } });
            if (!author) {
                yield utils.db.Author.create({
                    name: user.username,
                    podId: null,
                    userId: user.id
                });
            }
        }
        yield utils.db.VideoChannel.sync();
        const authors = yield utils.db.Author.findAll();
        for (const author of authors) {
            yield utils.db.VideoChannel.create({
                name: `Default ${author.name} channel`,
                remote: false,
                authorId: author.id
            });
        }
        const dataChannelId = {
            type: Sequelize.INTEGER,
            defaultValue: null,
            allowNull: true
        };
        yield q.addColumn('Videos', 'channelId', dataChannelId);
        const query = 'SELECT "id", "authorId" FROM "Videos"';
        const options = {
            type: Sequelize.QueryTypes.SELECT
        };
        const rawVideos = yield utils.sequelize.query(query, options);
        for (const rawVideo of rawVideos) {
            const videoChannel = yield utils.db.VideoChannel.findOne({ where: { authorId: rawVideo.authorId } });
            const video = yield utils.db.Video.findById(rawVideo.id);
            video.channelId = videoChannel.id;
            yield video.save();
        }
        dataChannelId.allowNull = false;
        yield q.changeColumn('Videos', 'channelId', dataChannelId);
        const constraintName = 'Videos_channelId_fkey';
        const queryForeignKey = 'ALTER TABLE "Videos" ' +
            ' ADD CONSTRAINT "' + constraintName + '"' +
            ' FOREIGN KEY ("channelId") REFERENCES "VideoChannels" ON UPDATE CASCADE ON DELETE CASCADE';
        yield utils.sequelize.query(queryForeignKey);
        yield q.removeColumn('Videos', 'authorId');
    });
}
exports.up = up;
function down(options) {
    throw new Error('Not implemented.');
}
exports.down = down;
