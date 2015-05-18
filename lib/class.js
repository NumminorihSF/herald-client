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
    trace: function(){console.log('TRACE\t'+ Array.prototype.join.call(arguments, ' '));},
    debug: function(){console.log('DEBUG\t'+ Array.prototype.join.call(arguments, ' '));},
    info: function(){console.log('INFO\t'+ Array.prototype.join.call(arguments, ' '));},
    warn: function(){console.error('WARN\t'+ Array.prototype.join.call(arguments, ' '));},
    error: function(){console.error('ERROR\t'+ Array.prototype.join.call(arguments, ' '));},
    fatal: function(){console.error('FATAL\t'+ Array.prototype.join.call(arguments, ' '));}
};

function HeraldClient(settings, needCrypt, key){
    HeraldClient.super_.call(this);
    settings = settings || {};
    this.logger = settings.logger || defaultLogger;
    this.iAm = settings.iAm || String(Math.floor(Math.random()*1000000));
    this.connected = false;
    this.cm = settings.messageMaker || new (require('crypt-maker'))({algorithm: needCrypt|| 'no', key: key});
    this.connectProp = settings.connect || {port: 8765};
    this.tail = '';
    this.should_work = true;
    this.listening = [];

    this.on('ping', function(body){
        this.pong(body)
    }.bind(this));

    this.on('connect', function(){
        this.connected = true;
        setImmediate(function(){
            for (var i = 0; i < this.listening.length; i++){
                this.publish('subscribe', this.listening[i]);
            }
        }.bind(this));
    }.bind(this));

    this.on('close', function(){
        this.connected = false;
        if (this.should_work) setTimeout(function(){
            this.connect();
        }.bind(this), 1000);
    }.bind(this));

    this.connect();
    return this;
}

(function(){
    require('util').inherits(HeraldClient, (require('events')).EventEmitter);
})();

HeraldClient.prototype.parseMessage = function(message){
    var header = this.cm.getHeader(message);
    if (!header || !header.event) return;
    if (header.event === 'ping') return this.emit('ping', {header: header, body:Math.floor(Math.random()*1000-500)});
    this.logger.debug('PARSED_IN\t'+header, message);
    this.emit(header.event, this.cm.getBody(message));
};

HeraldClient.prototype.pong = function(message){
    message.header.event = 'pong';
    this.write(message.header, message.body);
};

HeraldClient.prototype.write = function(header, body){
    var encrypt = this.cm.makeMessage({header: header, body: body});
    if (encrypt) {
        this.writeMessage(encrypt);
    }
};

HeraldClient.prototype.writeMessage = function(message){
    this.logger.info('TRY OUT\t', message);
    if (this.connected) this.$.write(message, 'utf-8', function(err, data){
        if (err) {
            this.logger.error('OUT\t',err);
            (require(__dirname+'/retrier.js')).call(this, message, arguments[1]);
        }
        else this.logger.info('OUT_OK');
    }.bind(this));
    else if (this.should_work) (require(__dirname+'/retrier.js')).call(this, message, arguments[1]);
    else this.logger.warn('MISSED_SEND', message);
};

HeraldClient.prototype.subscribe = function(eventName, callback){
    this.on(eventName, callback);
    if (this.listening.indexOf(eventName) === -1) {
        this.publish('subscribe', eventName);
        this.listening.push(eventName);
    }
};

HeraldClient.prototype.unsubscribe = function(eventName){
    this.removeAllListeners(eventName);
    this.publish('unsubscribe', eventName);
    if (this.listening.indexOf(eventName) !== -1) this.listening.splice(this.listening.indexOf(eventName), 1);
};

HeraldClient.prototype.publish = function(event, body){
    this.write({event:event}, body);
};

HeraldClient.prototype.whisper = function(whom, body, header){
    header = header || {event:'whisper'};
    header.whisp = whom;
    this.write(header, body);
};

HeraldClient.prototype.connect = function(settings){
    if (this.connected) return;
    this.should_work = true;
    this.connectProp = settings || this.connectProp || {port: 8765};

    if (this.$) this.$.removeAllListeners();

    this.$ = require('net').createConnection(this.connectProp);

    this.$.on('connect', function(){
        this.emit('connect');
        this.$.setEncoding('utf-8');
        this.write({event:'authorize', iAm: this.iAm}, {iAm: this.iAm});
        this.$.on('data', function(data){
            this.logger.trace('SOCKET_IN:', data);
            this.tail += data.replace(/\r\n\r\n[\r\n]*/g, '\r\n\r\n');
            var array = this.cm.splitMessages(this.tail);
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
        this.$.removeAllListeners('data');
        this.emit('close');
    }.bind(this));

    this.$.on('error', function(e){
        this.emit('error', e);
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
module.exports = HeraldClient;