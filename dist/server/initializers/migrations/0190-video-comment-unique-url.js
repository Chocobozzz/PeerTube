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
        {
            const query = 'DELETE FROM "videoComment" s1 ' +
                'USING (SELECT MIN(id) as id, url FROM "videoComment" GROUP BY "url" HAVING COUNT(*) > 1) s2 ' +
                'WHERE s1."url" = s2."url" AND s1.id <> s2.id';
            yield utils.sequelize.query(query);
        }
    });
}
exports.up = up;
function down(options) {
    throw new Error('Not implemented.');
}
exports.down = down;
//# sourceMappingURL=0190-video-comment-unique-url.js.map