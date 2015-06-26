/*
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

'use strict';

/**
 * HeraldClient class.
 *      Класс HeraldClient
 * @class HeraldClient
 * @extends event.EventEmitter
 */

/**
 * Constructor.
 *      Конструктор.
 * @method constructor
 * @param {Object} [settings] Settings for HeraldClient.
 *      Настройки для HeraldClient.
 * @param {Object} [settings.default] Default settings for messaging.
 *      Настройки для сообщений по умолчанию.
 * @param {String} [settings.name=Math.random()] Name of application or client.
 *      Название клиента или приложения.
 * @param {String} [settings.uid=this.name+Math.random()] Unique id of application or client.
 *      Уникальный id приложения или клиента.
 * @param {Logger|Object} [settings.logger] Object for log events.
 *      Объект для логгирования событий.
 * @param {Object} [settings.connect='{port:8765}'] Object of connection properties.
 *      Объект настроек подключения к серверу.
 * @param {CryptMaker | Object} [settings.messageMaker] Object with make and parse logic.
 *      Объект, реализующий логику создания сообщений и их парсинга.
 * @param {String} [needCrypt='no'] If need crypt messages - algorithm for crypt. By default doesnt encrypt.
 *      Если необходимо шифровать сообщения - алогоритм шифрования. По умолчанию не шифрует.
 * @param {String} [key] Encryption key.
 *      Ключ шифрования.
 * @returns {HeraldClient}
 */
function HeraldClient(settings, needCrypt, key){
  HeraldClient.super_.call(this);
  if (typeof settings === 'string'){
    key = needCrypt;
    needCrypt = settings;
    settings = {};
  }
  settings = settings || {};
  this.default = settings.default || HeraldClient.defaultVars;
  this.logger = settings.logger || require(__dirname+'/logger.js').getLogger('H_Client');
  this.name = String( (settings.name || settings.iAm || Math.floor(Math.random()*1000000)) );
  this.uid = String( (settings.uid || this.name + '_' + Math.floor(Math.random()*1000000)) );

  /**
   * Connection status. True if connected.
   *      Статус подключения. True если подключен.
   * @type {boolean}
   */
  this.connected = false;

  this.cm = settings.messageMaker || new (require('crypt-maker'))({algorithm: needCrypt|| 'no', key: key});

  this.connectProp = settings.connect || {port: 8765};


  var self = this;

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
    this.emit('drain');
    setImmediate(function(){
      for (var i = 0; i < this.listening.length; i++){
        (function(event){
          self.rpc('herald-server', {name:'subscribe', args: {event: event}}, function(err, data){
            if (err) self.logger.error('Subscribe on reconnect fails. Event: ' + event + '. Error: ' + err);
          });
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
    var mes = self.messageQueue.shift();
    if (mes) {
      var ready = self.$.write(mes.m, 'utf8', mes.c);
      if (ready) process.nextTick(function(){
        self.emit('drain')
      });
    }
    else self.isSocketFree = true;
  });

  this.on('_sendAuth', function(){
    var messages = this.messageQueue;
    this.messageQueue = [];
    this.isSocketFree = true;
    this.rpc('herald-server', {name:'authorize', args: {wellKnown: 'pHrAsE', name: this.name, uid: this.uid, rand: Math.floor(Math.random()*1000)}}, function(err, data){
      if (!err) return this.emit('connect');
      this.emit('error', err);
    }.bind(this));
    this.messageQueue = messages;
    this.isSocketFree = false;
  }.bind(this));
  if (!settings.logger) this.logger.warn('No logger defined. Use default (it spawns too much messages).');

  return this;
}


/*
 * Get EventEmitter as prototype.
 * Используем EventEmitter в качестве прототипа.
 */
(function(){
  require('util').inherits(HeraldClient, (require('events')).EventEmitter);
})();

/**
 * Default variables for messaging. Переменные по умолчанию для сообщений.
 * @static
 * @type {{retry: number, timeout: number}}
 */
HeraldClient.defaultVars = {
  retry: 5,
  timeout: 15000
};

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
 * Remote procedure calling by name of application.
 *      Удаленный вызов процедуры у одного из приложений с данным именем.
 * @param {string} name Name of application, that you want to rpc.
 *      Имя приложения, в котором нужно вызвать процедуру.
 * @param {Object} action Action object, that you want to call at application.
 *      Объект действия для удаленного выполнения.
 * @param {string} action.name Action name to do
 *      Название действия для удаленного выполнения.
 * @param {string|Object} action.args Arguments for rpc or callback, if no args need to rpc - send `{}`.
 *      Аргументы для удаленой процедуры. Если не нужны - используйте `{}`.
 * @param {Object} [options] Options for rpc.
 *      Опции для rpc.
 * @param {Function} [callback] Callback for rpc. If rpc failed and no callback defined - HeraldClient will emit error.
 * First argument for callback is Error object or null. Second is result.
 *      Callback для удаленного вызова. Если вызов не удачен и параметр не определен - HeraldClient примет ошибку.
 *      Первый аргумент для функции - объект ошибки или null. Второй - результат вызова.
 * @returns {Boolean} true can send just now, false if need to send previous messages.
 *      true если отправленно сразу, false, если необходимо подождать отправки других сообщений.
 */
HeraldClient.prototype.rpc = function(name, action, options, callback){
  if (!callback){
    if (typeof options === 'function') {
      callback = options;
      options = {};
    }
    else callback = function(err){
      this.emit('error', err);
    }.bind(this);
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
 * Remote procedure calling by UID of application.
 *      Удаленный вызов процедуры у одного из приложений с данным UID.
 * @param {string} uid UID of application, that you want to rpc.
 *      UID приложения, в котором нужно вызвать процедуру.
 * @param {Object} action Action object, that you want to call at application.
 *      Объект действия для удаленного выполнения.
 * @param {string} action.name Action name to do
 *      Название действия для удаленного выполнения.
 * @param {string|Object} action.args Arguments for rpc or callback, if no args need to rpc - send `{}`.
 *      Аргументы для удаленой процедуры. Если не нужны - используйте `{}`.
 * @param {Object} [options] Options for rpc.
 *      Опции для rpc.
 * @param {Function} [callback] Callback for rpc. If rpc failed and no callback defined - HeraldClient will emit error.
 * First argument for callback is Error object or null. Second is result.
 *      Callback для удаленного вызова. Если вызов не удачен и параметр не определен - HeraldClient примет ошибку.
 *      Первый аргумент для функции - объект ошибки или null. Второй - результат вызова.
 * @returns {Boolean} true can send just now, false if need to send previous messages.
 *      true если отправленно сразу, false, если необходимо подождать отправки других сообщений.
 */
HeraldClient.prototype.rpcUid = function(uid, action, options, callback){
  if (!callback){
    if (typeof options === 'function') {
      callback = options;
      options = {};
    }
    else callback = function(err){
      this.emit('error', err);
    }.bind(this);
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

/**
 *
 * @param header
 * @param callback
 * @returns {Function}
 * @private
 */
HeraldClient.prototype._makeRpcCallback = function(header, callback){
  var self = this;
  return function(err, data){
    if (err) return callback(err);
    self.rpcCallback[header.actionId] = function(err, data){
      delete self.rpcCallback[header.actionId];
      clearTimeout(timeout);
      return callback(err, data);
    };

    var timeout = setTimeout(function(){
      self.rpcCallback[header.actionId] && self.rpcCallback[header.actionId](new Error('RPC_TIMEOUT'));
    }, header.timeout);
  }
};


/**
 * Send some message to server. Отправить сообщение серверу.
 * @param {Object} header Header of message.
 *      Заголовок сообщения.
 * @param {Object|string} body Body of message.
 *      Тело сообщения.
 * @param {Object} [options] Options for message.
 *      Настройки сообщения.
 * @param {Function} [callback]
 * @returns {Boolean} true can send just now, false if need to send previous messages.
 *      true если отправленно сразу, false, если необходимо подождать отправки других сообщений.
 */
HeraldClient.prototype.write = function(header, body, options, callback){
  if (!callback){
    if (typeof options === 'function') {
      callback = options;
      options = {};
    }
    else callback = function(err){
      this.emit('error', err);
    }.bind(this);
  }

  return this._write(header, body, options, callback);
};


/**
 * Add field to header, apply options
 * @param {Object} header
 * @param {Object} body
 * @param {Object} [options]
 * @param {Function} [callback]
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
 * @param {Function} callback
 * @returns {*}
 * @private
 */
HeraldClient.prototype._writeMessage = function(message, callback){
  //check callback function, create if need
  if (!callback) callback = function(err){if (err) this.emit('error', ((err in Error)?err:new Error(err)));}.bind(this);

  if (!message) return callback(new Error('EMPTY_MESSAGE'));
  if (this.isSocketFree) {
    if (!this.messageQueue.length){
      return this.isSocketFree = this.$.write(message, 'utf-8', callback);
    }
    this.messageQueue.push({m: message, c: callback});
    this.emit('drain');
    return false;
  }
  else this.messageQueue.push({m: message, c: callback});
  return false;
};


/**
 * Find rpc call and use
 * @param {string} action
 * @param {Object} headerPart
 * @param {Object} body
 * @param {Object} body.args
 * @param {Function} callback
 * @returns {*}
 * @private
 */
HeraldClient.prototype._doRpc = function(action, headerPart, body, callback){
  if (!body || !body.args) return callback(new Error('WRONG_ARGS'));
  if (!this.rpcFunction[action]) return callback(new Error('WRONG_ACTION'));
  if (this.rpcFunction[action].length === 2) return this.rpcFunction[action](body.args, callback);
  return this.rpcFunction[action](headerPart, body.args, callback);
};


/**
 * Function for remote calling. It is callback for {@link HeraldClient#addRpcWorker } method.
 * If function has 2 arguments, caller will not send to it.
 *      Функция для удаленного вызова. Передается как callback в метод {@link HeraldClient#addRpcWorker}.
 *      Если у функции 2 аргумента - caller не будет передан.
 * @method remoteProcedure
 * @member HeraldClient
 * @param {Object} [caller] UID and name of application that called this.
 *      UID и название приложения, вызвавшего функцию.
 * @param {Object} args Arguments for call. Аргументы для вызова.
 * @param {Function} callback Callback function to return result. First arg is Error object or null. Second response data if is.
 *      Функция для возврата результатов. Первый аргумент - объект ошибки или null. Второй - результат.
 */


/**
 * Add function to work with rpc calls.
 *      Добавляет функцию для удаленного использования.
 * @param {String} actionName Action name. Название действия.
 * @param {Function} callback Function to call. {@link HeraldClient#remoteProcedure Should be like this}.
 *      Вызываемая функция. {@link HeraldClient#remoteProcedure Должна соответствовать этому шаблону}.
 * @returns {Boolean} True if added. false if was function with such name.
 * False means, that you should remove old rpc function with such actionName.
 *      True если добавленно. false если есть функция с таким именем.
 *      False означает, что Вам необходимо удалить старую функцию с таким названием действия.
 */
HeraldClient.prototype.addRpcWorker = function(actionName, callback){
  if (this.rpcFunction[actionName]) return false;
  this.rpcFunction[actionName] = callback;
  return true;
};


/**
 * Remove rpc function. Удаляет функцию из используемых.
 * @param {String} actionName Action name. Название действия.
 * @returns {Boolean} true if was such function. Else returns false.
 *    true если такая функция была. false, если нет.
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
    return this._doRpc(header.action, {name: header.name, uid: header.uid}, this.cm.getBody(message), function(err, data){
      self._write(
        {rpcRes: header.uid, actionId: header.actionId, action: header.action},
        {error: (err instanceof Error)?err.message:err, result: data},
        {retry: 0, timeout: 10000},
        function(){}
      );
    });
  }

  if (header.event) return this.emit(header.event, {name: header.name, uid: header.uid}, this.cm.getBody(message));

  if (header.rpcRes) {
    if (this.rpcCallback[header.actionId]) {
      var body = this.cm.getBody(message);
      if (body) return this.rpcCallback[header.actionId](body.error, body.result);
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
 * Subscribe to events. Spawn callback for every event with such name.
 *      Подписывает на события. Вызывает Callback каждый раз, когда происходит событие.
 * @param {String} eventName
 * @param {Function} callback First argument is header part with name and uid of application spawned event. Second argument is bode of event message.
 *      Первый аргумент - часть заголовка сообщения с полями названия и uid приложения, запустившего событие. Вторйо аргумент - тело сообщения.
 */
HeraldClient.prototype.subscribe = function(eventName, callback){
  this.on(eventName, callback);
  if (this.listening.indexOf(eventName) === -1) {
    this.rpc('herald-server', {name:'subscribe', args: {event: eventName}}, function(err, data){
      if (err) {
        this.logger.error('SubscribeError', err);
        return this.emit('error', err);
      }
    }.bind(this));
    this.listening.push(eventName);
  }
};

/**
 * Unsubscribe from event(remove all listeners).
 *      Отписывает от событий на сервере.
 * @param {String} eventName
 * @param {Function} callback
 */
HeraldClient.prototype.unsubscribe = function(eventName, callback){

  this.rpc('herald-server', {name:'unsubscribe', args: {event: eventName}}, function(err, data){
    if (typeof callback === 'function') process.nextTick(function(){callback(err, data)});
    if (err) {
      return this.emit('error', err);
    }
    this.removeAllListeners(eventName);
    if (this.listening.indexOf(eventName) !== -1) this.listening.splice(this.listening.indexOf(eventName), 1);
  }.bind(this));
};

/**
 * Publish some event.
 *      Пибликует событие.
 * @param {String} event
 * @param {Object|String} body
 * @param {Function} callback
 */
HeraldClient.prototype.publish = function(event, body, callback){
  this.write({event:event}, body, function(err, data){
    if (callback) callback(err, data);
    else if (err) this.emit('error', err);
  });
};

/**
 * Whisper some event message to some app with name.
 *      Отправляет сообщение о событии приложению с определенным именем.
 * @param {String} whom Name of application to send message.
 *      Название приложения, куда отправлять сообщение.
 * @param {String} event Name of event. Название события.
 * @param {Object|String} body Body of event. Тело события.
 * @param {Function} callback
 * @returns {Boolean} true can send just now, false if need to send previous messages.
 *      true если отправленно сразу, false, если необходимо подождать отправки других сообщений.
 */
HeraldClient.prototype.whisp = function(whom, event, body, callback){
  return this.write({whisp: whom, event: event}, body, callback);
};



/**
 * Whisper some event message to some app with uid.
 *      Отправляет сообщение о событии приложению с определенным uid.
 * @param {String} whomUid uid of application to send message.
 *      uid приложения, куда отправлять сообщение.
 * @param {String} event Name of event. Название события.
 * @param {Object|String} body Body of event. Тело события.
 * @param {Function} callback
 * @returns {Boolean} true can send just now, false if need to send previous messages.
 *      true если отправленно сразу, false, если необходимо подождать отправки других сообщений.
 */
HeraldClient.prototype.whispUid = function(whomUid, event, body, callback){
  this.write({whispUid: whomUid, event: event}, body, callback);
};


/**
 * Connect to server. Подключает к серверу.
 * @param {Object} [settings] Settings for connect. Default get from HeraldClient object.
 *      Настройки для подключения. По умолчанию берет растройки из самого объекта.
 */
HeraldClient.prototype.connect = function(settings){
  if (this.connected) return;
  this.should_work = true;
  this.connectProp = settings || this.connectProp || {port: 8765};

  if (this.$) this.$.removeAllListeners();

  this.$ = require('net').createConnection(this.connectProp);

//  if (!this.messageQueue.length) this.rpc('herald-server', {name:'authorize', args: {wellKnown: 'pHrAsE', name: this.name, uid: this.uid, time: new Date()}}, function(err, data){}.bind(this));

  var self = this;


  this.$.on('connect', function(){

    this.emit('_sendAuth');

    this.$.setEncoding('utf-8');

    this.$.on('data', function(data){
      this.logger.trace('SOCKET_IN:', JSON.stringify(data));
      this.tail += data.replace(/\r\n\r\n[\r\n]*/g, '\r\n\r\n');
      var array = this.cm.splitMessagesForce(this.tail);
      this.tail = array.pop();
      if (this.tail > 1048576) this.tail = '';
      for (var i = 0; i < array.length; i++) {
        (function (message) {
          this._parseMessage(message);
        }.bind(this))(array[i])
      }
    }.bind(this));
  }.bind(this));
  
  this.$.on('close', function(e){
    this.$.removeAllListeners('data');
    this.emit('close', e);
  }.bind(this));

  this.$.on('error', function(e){
    this.emit('error', e);
  }.bind(this));
  
  this.$.on('drain', function(){
    setImmediate(function(){this.emit('drain');}.bind(this));
  }.bind(this));
};

/**
 * Close connect. Закрывает подключение.
 * @param {Function} [callback]
 */
HeraldClient.prototype.close = function(callback){
  this.should_work = false;
  this.$.end();
  if (typeof callback === 'function') this.once('close', callback);
};

/**
 * Close connect. Закрывает подключение.
 * @param {Function} [callback]
 */
HeraldClient.prototype.end = function(callback){
  this.should_work = false;
  this.$.end();
  if (typeof callback === 'function') this.once('close', callback);
};

/**
 * Unref client.
 * @experimental
 * @returns {*}
 */
HeraldClient.prototype.unref = function(){
  this.$.unref();
};

/**
 * Ref client.
 * @experimental
 * @returns {*}
 */
HeraldClient.prototype.ref = function(){
  this.$.ref();
};

/**
 * One more constructor.
 *      Еще один конструктор.
 * @param {Object} [settings] Settings for HeraldClient.
 *      Настройки для HeraldClient.
 * @param {Object} [settings.default] Default settings for messaging.
 *      Настройки для сообщений по умолчанию.
 * @param {String} [settings.name=Math.random()] Name of application or client.
 *      Название клиента или приложения.
 * @param {String} [settings.uid=settings.name+Math.random()] Unique id of application or client.
 *      Уникальный id приложения или клиента.
 * @param {Logger|Object} [settings.logger] Object for log events.
 *      Объект для логгирования событий.
 * @param {Object} [settings.connect=`{port:8765}`] Object of connection properties.
 *      Объект настроек подключения к серверу.
 * @param {CryptMaker | Object} [settings.messageMaker] Object with make and parse logic.
 *      Объект, реализующий логику создания сообщений и их парсинга.
 * @param {String} [needCrypt='no'] If need crypt messages - algorithm for crypt. By default doesn't encrypt.
 *      Если необходимо шифровать сообщения - алогоритм шифрования. По умолчанию не шифрует.
 * @param {String} [key] Encryption key.
 *      Ключ шифрования.
 * @returns {HeraldClient}
 */
HeraldClient.createClient = function(settings, needCrypt, key){
  var hc = new HeraldClient(settings, needCrypt, key);
  hc.connect();
  return hc;
};

module.exports = HeraldClient;
