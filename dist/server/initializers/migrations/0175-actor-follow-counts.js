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
        const query = 'UPDATE "actor" SET ' +
            '"followersCount" = (SELECT COUNT(*) FROM "actorFollow" WHERE "actor"."id" = "actorFollow"."targetActorId"), ' +
            '"followingCount" = (SELECT COUNT(*) FROM "actorFollow" WHERE "actor"."id" = "actorFollow"."actorId") ' +
            'WHERE "actor"."serverId" IS NULL';
        yield utils.sequelize.query(query);
    });
}
exports.up = up;
function down(options) {
    throw new Error('Not implemented.');
}
exports.down = down;
