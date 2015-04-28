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

var defaultLogger = {
    trace: function(){console.log('TRACE '+ Array.prototype.join.call(arguments, ' '));},
    debug: function(){console.log('DEBUG '+ Array.prototype.join.call(arguments, ' '));},
    info: function(){console.log('INFO '+ Array.prototype.join.call(arguments, ' '));},
    warn: function(){console.error('WARN '+ Array.prototype.join.call(arguments, ' '));},
    error: function(){console.error('ERROR '+ Array.prototype.join.call(arguments, ' '));},
    fatal: function(){console.error('FATAL '+ Array.prototype.join.call(arguments, ' '));}
};

function HeraldClient(settings, needCrypt, key){
    HeraldClient.super_.call(this);
    settings = settings || {};
    this.logger = settings.logger || defaultLogger;
    this.iAm = settings.iAm || String(Math.floor(Math.random()*1000000));
    this.connected = false;
    this.cm = settings.messageMaker || new (require('crypt-maker'))({algorithm: needCrypt|| 'no', key: key});
    this.$ = require('net').createConnection(settings.connect || {port: 8765});
    this.tail = '';

    this.$.on('connect', function(){
        this.emit('connect');
        this.$.setEncoding('utf-8');
    }.bind(this));

    this.$.once('data',function(){
        console.log('SEND', {event:'authorize', iAm: this.iAm}, {iAm: this.iAm});
        this.write({event:'authorize', iAm: this.iAm}, {iAm: this.iAm});
        this.$.on('data', function(data){
            this.logger.trace('Has data:', data);
            this.tail += data;
            var array = this.cm.splitMessages(this.tail+this.cm.eom);
            if (!array || array.length === 0) {
                if (this.tail > 1048576) this.tail = '';
            }
            else {
                var hc = this;
                this.tail = '';
                for (var i=0; i < array.length; i++){
                    (function(message){
                        setImmediate(function(){
                            hc.parseMessage(message);
                        });
                    })(array[i])
                }
            }
        }.bind(this));
    }.bind(this));
    this.$.on('close', function(e){
        this.emit('close')
    }.bind(this));

    this.$.on('error', function(e){
        this.emit('error', e);
    }.bind(this));


    this.on('connect', function(){
        this.connected = true;
    }.bind(this));
    this.on('close', function(){
        this.connected = false;
    }.bind(this));

    this.on('ping', function(body){
        this.pong(body)
    }.bind(this));

    return this;
}

(function(){
    require('util').inherits(HeraldClient, (require('events')).EventEmitter);
})();

HeraldClient.prototype.parseMessage = function(message){
    var header = this.cm.getHeader(message);
    if (!header || !header.event) return;
    this.logger.debug('IN '+header, message);
    if (header.event === 'ping') return this.emit('ping', this.cm.getBody(message));
    console.log("EVENT", header.event);
    this.emit(header.event, this.cm.getBody(message));
};

HeraldClient.prototype.pong = function(body){
    this.write({event: 'pong'}, body);
};

HeraldClient.prototype.write = function(header, body){
    var encrypt = this.cm.makeMessage({header: header, body: body});
    if (encrypt) {
        this.logger.debug('PUB '+ header, body);
        this.writeMessage(encrypt);
    }
};

HeraldClient.prototype.writeMessage = function(message){
    this.$.write(message, 'utf-8', function(err, data){
        if (err) {
            this.logger.error(err);
            (require(__dirname+'/retry_logic.js')).call(this, message, arguments[1]);
        }
        else this.logger.info('OK');
    }.bind(this));
};

HeraldClient.prototype.subscribe = function(eventName, callback){
    this.on(eventName, callback);
    this.publish('subscribe', eventName);
};

HeraldClient.prototype.unsubscribe = function(eventName){
    this.removeAllListeners(eventName);
    this.publish('unsubscribe', eventName);
};

HeraldClient.prototype.publish = function(event, body){
    console.log('PUBLISH', new Date(), event);
    this.write({event:event}, body);
};

HeraldClient.prototype.close = function(){
    this.$.end();
};

HeraldClient.prototype.end = function(){
    this.$.end();
};

module.exports = HeraldClient;