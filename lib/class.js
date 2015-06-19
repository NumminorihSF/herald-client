/**
 * The MIT License (MIT)
 *
 * Copyright (c) 2015 (NumminorihSF) Konstantine Petryaev
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

/**
 * Default logger. Spawn very much messages.
 */
var defaultLogger = {
  trace: function(){console.log('TRACE\t'+ Array.prototype.join.call(arguments, ' '));},
  debug: function(){console.log('DEBUG\t'+ Array.prototype.join.call(arguments, ' '));},
  info: function(){console.log('INFO\t'+ Array.prototype.join.call(arguments, ' '));},
  warn: function(){console.error('WARN\t'+ Array.prototype.join.call(arguments, ' '));},
  error: function(){console.error('ERROR\t'+ Array.prototype.join.call(arguments, ' '));},
  fatal: function(){console.error('FATAL\t'+ Array.prototype.join.call(arguments, ' '));}
};

/**
 * Default variables for messaging
 * @type {{retry: number, timeout: number}}
 */
var defaultVars = {
  retry: 5,
  timeout: 15000
};


/**
 * Herald Client class.
 * @param {Object} [settings]
 * @param {Object} [settings.logger] - Logger object to use.
 * @param {string} [settings.name] - application name
 * @param {string} [settings.default] - default settings to connect
 * @param {string} [needCrypt] - algorithm to use. 'no' if doesn't need crypt. Default = 'aes128'
 * @param {string} [key] - key to use in crypt. If no key and algorithm !== 'no' throw Error
 * @constructor HeraldClient
 * @returns {HeraldClient}
 */
function HeraldClient(settings, needCrypt, key){
  HeraldClient.super_.call(this);
  settings = settings || {};
  this.default = settings.default || defaultVars;
  this.logger = settings.logger || defaultLogger;
  this.name = settings.name || settings.iAm || String(Math.floor(Math.random()*1000000));
  this.uid = settings.uid || this.name + '_' + String(Math.floor(Math.random()*1000000));
  this.connected = false;

  this.cm = settings.messageMaker || new (require('crypt-maker'))({algorithm: needCrypt|| 'no', key: key});

  this.connectProp = settings.connect || {port: 8765};


  var self = this;
  //NEW

  this.lastMessageId = 1;
  this.lastActionId = 1;
  this.messageQueue = [];
  this.messageCallback = {};
  this.rpcCallback = {};
  this.isSocketFree = false;

  this.rpcFunction = [];


  this.tail = '';
  this.should_work = true;
  this.listening = [];



  this.on('connect', function(){
    this.connected = true;

    setImmediate(function(){
      for (var i = 0; i < this.listening.length; i++){
        (function(event){
          self.rpc('herald-server', {name:'subscribe', args: {event: event}}, function(err, data){});
        })(this.listening[i]);
      }
    }.bind(this));
  }.bind(this));

  this.on('close', function(){
    this.connected = false;
    this.isSocketFree = false;
    if (this.should_work) setTimeout(function(){
      this.connect();
    }.bind(this), 1000);
  }.bind(this));

  this.on('drain', function(){
    if (self.connected) {
      var mes = self.messageQueue.shift();
      if (mes) {
        var ready = self.$.write(mes.m, 'utf-8', mes.c);
        if (ready) self.$.emit('drain');
      }
      else this.isSocketFree = true;
    }
  });
  
  if (!settings.logger) defaultLogger.warn('No logger defined. Use default (it spawns too much messages).');

  return this;
}


/**
 * Get EventEmitter as prototype
 */
(function(){
  require('util').inherits(HeraldClient, (require('events')).EventEmitter);
})();


/**
 * Add options to header.
 * @param {Object} header - header of message
 * @param {Object} options - options for message
 * @private
 */
HeraldClient.prototype._fixHeader = function(header, options){
  if (header.messId) return;
  header.name = this.name;
  header.uid = this.uid;
  header.messId = this.lastMessageId++;
  if (options.ack) header.ack = options.ack;
  header.retry = (typeof options.retry === "number") ? options.retry : this.default.retry;
  header.timeout = (typeof options.timeout === "number") ? options.timeout : this.default.timeout;
};


/**
 * Remote procedure calling by name of application
 * @param {string} name - name of application, that you want to rpc
 * @param {Object} action - action, that you want to call at application
 * @param {string} action.name - action name to do
 * @param {string|Object|null} action.args - arguments for rpc or callback, if no args need to rpc - send null.
 * @param {Object|Function} options - options for rpc, or callback if no options need to rpc.
 * @param {function(err:Error|null, result:*?)} [callback] - callback for rpc. If rpc failed and no callback defined - HeraldClient will emit error.
 * @returns {*} true can send just now, false if can't.
 */
HeraldClient.prototype.rpc = function(name, action, options, callback){
  if (!callback){
    if (typeof options === 'function') {
      callback = options;
      options = {};
    }
    else callback = function(err){
      if (err) throw err;
    }
  }

  if (!name || typeof name !== 'string') return callback(new Error('WRONG_ARGS'));
  if (!action || typeof action !== 'object') return callback(new Error('WRONG_ARGS'));
  if (!action.name || typeof action.name !== 'string') return callback(new Error('WRONG_ARGS'));
  if (!('args' in action)) return callback(new Error('WRONG_ARGS'));

  var header = {
    rpc: name,
    action: action.name,
    actionId: this.lastActionId++
  };

  this._fixHeader(header, options || {});

  return this._write(header, {args: action.args}, options, this._makeRpcCallback(header, callback));
};


/**
 * RPC by uid of application
 * @param {string} uid - uid of application, that you want to rpc
 * @param {Object} action - action, that you want to call at application
 * @param {string} action.name - action name to do
 * @param {number|string|Object|null} action.args - arguments for rpc or callback, if no args need to rpc - send null.
 * @param {Object|Function} options - options for rpc, or callback if no options need to rpc.
 * @param {function(err:Error|null, result:*?)} [callback] callback for rpc. If rpc failed and no callback defined - HeraldClient will emit error.
 * @returns {*} true can send just now, false if can't.
 */
HeraldClient.prototype.rpcUid = function(uid, action, options, callback){
  if (!callback){
    if (typeof options === 'function') {
      callback = options;
      options = {};
    }
    else callback = function(err){
      if (err) throw err;
    }
  }

  if (!uid || typeof uid !== 'string') return callback(new Error('WRONG_ARGS'));
  if (!action || typeof action !== 'object') return callback(new Error('WRONG_ARGS'));
  if (!action.name || typeof action.name !== 'string') return callback(new Error('WRONG_ARGS'));
  if (!('args' in action)) return callback(new Error('WRONG_ARGS'));

  var header = {
    rpcUid: uid,
    action: action.name,
    actionId: this.lastActionId++
  };

  this._fixHeader(header, options || {});

  return this._write(header, {args: action.args}, options, this._makeRpcCallback(header, callback));
};


HeraldClient.prototype._makeRpcCallback = function(header, callback){
  var self = this;
  return function(err){
    if (err) return callback(err);
    self.rpcCallback[header.actionId] = function(err, data){
      delete self.rpcCallback[header.actionId];
      clearTimeout(timeout);
      return callback();
    };

    var timeout = setTimeout(function(){
      self.rpcCallback[header.actionId] && self.rpcCallback[header.actionId](new Error('RPC_TIMEOUT'));
    }, header.timeout);
  }
};


/**
 * Send some message to server
 * @param {Object} header - header of message
 * @param {Object|string} body - body of message
 * @param {Object|Function} [options] - options for rpc, or callback if no options need to rpc.
 * @param {function(err:Error|null, result=:*?)} [callback] - callback for rpc. If rpc failed and no callback defined - HeraldClient will emit error.
 * @returns {*} true can send just now, false if can't.
 */
HeraldClient.prototype.write = function(header, body, options, callback){
  if (!callback){
    if (typeof options === 'function') {
      callback = options;
      options = {};
    }
    else callback = function(err){
      if (err) throw err;
    }
  }

  return this._write(header, body, options, callback);
};


/**
 * Add field to header, apply options
 * @param {object} header
 * @param {object} body
 * @param {Object} [options]
 * @param {function(err:Error|null, result:*?)} [callback]
 * @private
 */
HeraldClient.prototype._write = function(header, body, options, callback){
  this._fixHeader(header, options || {});
  var self = this;
  var timeout = setTimeout(function(){
    //remove element, where callback is this function. stop if find it.
    self.messageQueue.some(function(elem, index){
      if (elem.c === self.messageCallback[header.messId]) {
        self.messageQueue.splice(index, 1);
        return true;
      }
      return false;
    });

    self.messageCallback[header.messId] && self.messageCallback[header.messId](new Error('SEND_TIMEOUT'));

  }, header.timeout);

  this.messageCallback[header.messId] = function(err, res){
    clearTimeout(timeout);
    delete self.messageCallback[header.messId];
    callback(err, res);
  };

  return this._writeMessage(this.cm.makeMessage({header: header, body: body}), this.messageCallback[header.messId]);
};


/**
 * Write message and watch
 * @param message
 * @param {function(err:Error|null, result:*?)} callback
 * @returns {*}
 * @private
 */
HeraldClient.prototype._writeMessage = function(message, callback){
  //check callback function, create if need
  if (!callback) callback = function(err){if (err) throw ((err in Error)?err:new Error(err));};

  if (!message) return callback(new Error('EMPTY_MESSAGE'));
  if (!this.messageQueue.length) if (this.isSocketFree) {
    return this.isSocketFree = this.$.write(message, 'utf-8', callback);
  }
  this.messageQueue.push({m: message, c: callback});
  return false;
};


/**
 * Find rpc call and use
 * @param {string} action
 * @param {Object} body
 * @param {Object} body.args
 * @param {function(err:Error|null, res:*?)}callback
 * @returns {*}
 * @private
 */
HeraldClient.prototype._doRpc = function(action, body, callback){
  if (!body || !body.args) return callback(new Error('WRONG_ARGS'));
  if (!this.rpcFunction[action]) return callback(new Error('WRONG_ACTION'));
  return this.rpcFunction[action](body.args, callback);
};


/**
 * Add function to work with rpc calls
 * @param {string} actionName
 * @param {function(args:Object, cb:function(err:Error, res:*?))} callback
 */
HeraldClient.prototype.addRpcWorker = function(actionName, callback){
  if (this.rpcFunction[actionName]) throw new Error('DUBLICATE_ACTION');
  this.rpcFunction[actionName] = callback;
};


/**
 * Remove rpc function
 * @param actionName
 * @returns {boolean} - true if was such function. Else - false
 */
HeraldClient.prototype.removeRpcWorker = function(actionName){
  var answer = actionName in this.rpcFunction;
  delete this.rpcFunction[actionName];
  return answer;
};


/**
 * Parse encrypted message and think, what should do with it
 * @param message
 * @returns {*}
 * @private
 */
HeraldClient.prototype._parseMessage = function(message){
  var header = this.cm.getHeader(message);
  var self = this;

  if (!header || !header.messId) return;
  if (header.rpc) {
    if (header.action == '_ping') return this._pong({header: header, body:Math.floor(Math.random()*1000-500)});
    return this._doRpc(header.action, this.cm.getBody(message), function(err, data){
      if (err) self._write(
        {rpcRes: header.uid, actionId: header.actionId, action: header.action},
        {error: (err instanceof Error)?err.message:err, result: data},
        {retry: 0, timeout: 10000},
        function(){}
      );
    });
  }

  if (header.event) return this.emit(header.event, {name: header.name, uid: header.uid}, this.cm.getBody(message));

  if (header.rpcRes) {
    if (this.messageCallback[header.actionId]) {
      var body = this.cm.getBody(message);
      if (body) return this.messageCallback[header.actionId](body.error, body.response);
    }
  }
};


/**
 * Send pong message to server
 * @param message
 * @private
 */
HeraldClient.prototype._pong = function(message){
  delete message.header.rpcBroad;
  message.header.rpcRes = message.header.uid;
  message.header.event = 'pong';
  this.write(message.header, message.body, function(){});
};


/**
 * Subscribe to events
 * @param eventName
 * @param callback
 */
HeraldClient.prototype.subscribe = function(eventName, callback){
  this.on(eventName, callback);
  if (this.listening.indexOf(eventName) === -1) {
    this.rpc('herald-server', {name:'subscribe', args: {event: eventName}}, function(err, data){});
    this.listening.push(eventName);
  }
};

/**
 * Unsubscribe from event(remove all listeners)
 * @param eventName
 */
HeraldClient.prototype.unsubscribe = function(eventName){
  this.removeAllListeners(eventName);
  this.rpc('herald-server', {name:'unsubscribe', args: {event: eventName}}, function(err, data){});
  if (this.listening.indexOf(eventName) !== -1) this.listening.splice(this.listening.indexOf(eventName), 1);
};

/**
 * Publish some event
 * @param event
 * @param body
 */
HeraldClient.prototype.publish = function(event, body){
  this.write({event:event}, body, function(){});
};

/**
 * Whisp some message to some app
 * @param whom
 * @param body
 * @param callback
 */
HeraldClient.prototype.whisp = function(whom, body, callback){
  this._write({whisp: whom}, body, callback);
};

/**
 * Connect to server
 * @param {Object} [settings]
 */
HeraldClient.prototype.connect = function(settings){
  if (this.connected) return;
  this.should_work = true;
  this.connectProp = settings || this.connectProp || {port: 8765};

  if (this.$) this.$.removeAllListeners();

  this.$ = require('net').createConnection(this.connectProp);

  if (!this.messageQueue.length) this.rpc('herald-server', {name:'authorize', args: {wellKnown: 'pHrAsE'}}, function(err, data){});


  this.$.once('data', function(){
    this.emit("drain");
  }.bind(this));

  this.$.on('connect', function(){
    var messages = this.messageQueue;
    this.messageQueue = [];
    this.rpc('herald-server', {name:'authorize', args: {wellKnown: 'pHrAsE'}}, function(err, data){
      this.messageQueue = messages;
      this.emit("drain");
    }.bind(this));

    this.emit('connect');
    this.$.setEncoding('utf-8');
    this.$.on('data', function(data){
      this.logger.trace('SOCKET_IN:', data);
      this.tail += data.replace(/\r\n\r\n[\r\n]*/g, '\r\n\r\n');
      var array = this.cm.splitMessages(this.tail);
      if (!array || array.length === 0) {
        if (this.tail > 1048576) this.tail = '';
      }
      else {
        var self = this;
        this.tail = '';
        for (var i=0; i < array.length; i++){
          (function(message){
            setImmediate(function(){
              this._parseMessage(message);
            }.bind(this));
          })(array[i])
        }
      }
    }.bind(this));
  }.bind(this));
  
  this.$.on('close', function(e){
    this.$.removeAllListeners('data');
    this.emit('close');
  }.bind(this));

  this.$.on('error', function(e){
    this.emit('error', e);
  }.bind(this));
  
  this.$.on('drain', function(){
    this.emit('drain');
  }.bind(this));
};


HeraldClient.prototype.close = function(){
  this.should_work = false;
  this.$.end();
};

HeraldClient.prototype.end = function(){
  this.should_work = false;
  this.$.end();
};

HeraldClient.prototype.unref = function(){
  this.$.unref();
};

HeraldClient.prototype.ref = function(){
  this.$.ref();
};


HeraldClient.createClient = function(settings, needCrypt, key){
  var hc = new HeraldClient(settings, needCrypt, key);
  hc.connect();
  return hc;
};

module.exports = HeraldClient;