import * as repl from 'repl'
import * as path from 'path'
import * as _ from 'lodash'
import * as moment from 'moment'
import * as YoutubeDL from 'youtube-dl'
import * as uuidv1 from 'uuid/v1'
import * as uuidv3 from 'uuid/v3'
import * as uuidv4 from 'uuid/v4'
import * as uuidv5 from 'uuid/v5'

import { initDatabaseModels, sequelizeTypescript } from '../initializers'
const version = require('../../../package.json').version

const start = async () => {
  await initDatabaseModels(true)

  const initContext = (replServer) => {
    return (context) => {
      context.lodash = _;
      context.path = path;
      context.repl = replServer;
      context.moment = moment;
      context.env = process.env;
      context.models = sequelizeTypescript.models;
      context.YoutubeDL = YoutubeDL
      context.uuidv1 = uuidv1
      context.uuidv3 = uuidv3
      context.uuidv4 = uuidv4
      context.uuidv5 = uuidv5
    }
  }

  const replServer = repl.start({
    prompt: `PeerTube [${version}] >`,
  });

  initContext(replServer)(replServer.context);
  replServer.on('reset', initContext(replServer));

  const resetCommand = {
    help: 'Reset REPL',
    action() {
      this.write('.clear\n');  
      this.displayPrompt();
    }
  };
  replServer.defineCommand('reset', resetCommand);
  replServer.defineCommand('r', resetCommand);

}

start().then(()=>{}).catch(()=>{})
