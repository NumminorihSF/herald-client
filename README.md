herald-client
===========================

**v1 is not backward compatible with v0** 

Client lib for herald server

Install with:

    npm install herald-client

Dependencies:

    crypt-maker


[Documentation by jsDuck. Also in RUS](http://numminorihsf.github.io/herald). 


# Usage

Simple example:

```js

    var hc = new (require('herald-client'))();
        hc.on('error', function(error){
            console.log('HC error:', error);
        });
    
        setTimeout(function() {
            hc.subscribe("channel1", function (sendedBy, obj) {
                console.error('chan1:', obj);
            });
            hc.subscribe("channel2", function (sendedBy, obj) {
                console.log('chan2:', sendedBy, obj);
            });
    
    
            setTimeout(function () {
                hc.unsubscribe("channel1", function(err){
                    if (err) console.error('Error in unsubscribing', err);
                });
                setInterval(function(){
                    hc.publish('channel1', 'C1: '+Math.random());
                    hc.publish('channel2', 'C2: '+Math.random());
                },10);
            }, 1000);
        }, 1000);
        process.on('SIGINT', function(){
            hc.close();
            process.exit();
        });
        process.on('SIGTERM', function(){
            hc.close();
            process.exit();
        });
        
```

In this example hc will try connect to `127.0.0.1:8765`.

# Methods

## new HeraldClient([options], [algorithm[, key]])

`options` is an Object. May be `{}`. Contains properties:
* `.logger` - Logger object - to log inner events
* `.name` - String|Numeric - your application class identified. Default: `Math.floor(Math.random()*1000000)`
* `.uid` - String|Numeric - your application unique identified. 
Default: `name + '_' + Math.floor(Math.random()*1000000)`
* `.messageMaker` - Object. Some module, that make and parse messages. See below. Default: `crypt-maker`
* `.connect` - Object. Options for new.Socket.connect. Default: `{port: 8765}` 
 
See [https://nodejs.org/api/net.html#net_net_connect_options_connectionlistener]
(https://nodejs.org/api/net.html#net_net_connect_options_connectionlistener). Default: `{port:8765}`

If use `crypt-maker` and if `algorithm && algorithm !== 'no'` and no key passed to constructor - throws error.


## hc.connect([options]) 

Connect to server. If options aren't passed, connect with last options.
If already connected - do nothing.
Options are:
* `options` {Object} [optional] 

Supports the following properties:
  * `port` {Number} [optional]
  * `host` {String} [optional]
  * `backlog` {Number} [optional]
  * `path` {String} [optional]
  * `exclusive` {Boolean} [optional]

For all info about this see: See 
[https://nodejs.org/api/net.html#net_net_connect_options_connectionlistener]
(https://nodejs.org/api/net.html#net_net_connect_options_connectionlistener).



## hc.close([callback])

Stops the client and close connect from accepting new connections and keeps existing
connections.

* `callback` {Function} [optional]


## hc.subscribe(eventName, callback)

Create subscribing on server. Then event emitted - call `callback(senderIdentifier, bodyOfMessage)`. 
If error on subscribe `hc` will emit `'error'` event.

* `eventName` {String} - name of event
* `callback` {Function}


## hc.unsubscribe(eventName[, callback])

Unsubscribe from event with name. If no `callback` and error on unsubscribe `hc` will emit `'error'` event.

* `eventName` {String} - name of event
* `callback` {Function} [optional]


## hc.publish(eventName, body[, callback])

Publish event on server. If no `callback` and error on publish `hc` will emit `'error'` event.

* `whom` {String} - application name to send.
* `eventName` {String} - name of event
* `eventBody` {String | Object} - body of event
* `callback` {Function} [optional]



## hc.whisper(whom, body[, header]) removed



## hc.whisp(whom, eventName, eventBody, callback)

Send event message to one application with name. 
(Will send to one instance, but not for all application with name).

* `whom` {String} - application name to send.
* `eventName` {String} - name of event
* `eventBody` {String | Object} - body of event
* `callback` {Function}



## hc.whispUid(whomUid, eventName, eventBody, callback)

Send event message to one application with uid.

* `whomUid` {String} - application name to send.
* `eventName` {String} - name of event
* `eventBody` {String | Object} - body of event
* `callback` {Function}


## hc.rpc(whom, action[, options][, callback])

Try call procedure on application with name. 
(Will send to one instance, but not for all application with name).

* `whom` {String} - application name to send.
* `action` {Object} - action object, that you want to call at application.
* `action.name` {String} - action name, that you want to call at application.
* `action.args` {Object | String | Number | Array} - arguments for action. `!!action.args` should return true.
* `options` {Object} [optional] Options for rpc. *not ready yet*.
* `callback` {Function} [optional]



## hc.rpcUid(whomUid, action[, options][, callback])

Try call procedure on application with uid.

* `whomUid` {String} - application name to send.
* `action` {Object} - action object, that you want to call at application.
* `action.name` {String} - action name, that you want to call at application.
* `action.args` {Object | String | Number | Array} - arguments for action. `!!action.args` should return true.
* `options` {Object} [optional] Options for rpc. *not ready yet*.
* `callback` {Function} [optional]



## hc.write(header, body[, options][, callback])

Send some message to server. *At now ignored by server*

* `header` {Object} - header of message to send.
* `body` {Object|string} - body of message yo send.
* `options` {Object} [optional] Options for rpc. *not ready yet*.
* `callback` {Function} [optional]



## hc.addRpcWorker(actionName, callback)

Add function to work with rpc calls.

* `actionName` {String} - action name.
* `callback` {Function} - function to call. See 
[doc](http://numminorihsf.github.io/herald/index.html#!/api/HeraldClient-method-remoteProcedure)

Returns `true` if added or `false` if there was function with such name.


## hc.removeRpcWorker(actionName)

Remove function from work with rpc calls.

* `actionName` {String} - action name.

Returns `true` if was such function else returns `false`.




## hc.unref()

Calling `unref` on a client will allow the program to exit if this is the only
active client in the event system. If the server is already `unref`d calling
`unref` again will have no effect.
Every success `.connect()` create new connection. That's why you should call `unref` again. 

## hc.ref()

Opposite of `unref`, calling `ref` on a previously `unref`d server will *not*
let the program exit if it's the only server left (the default behavior). If
the server is `ref`d calling `ref` again will have no effect.


# Events

## 'ping'

Emitted when a server send 'ping' event.

## 'connect'

Emitted when the socket has been connected to server.

## 'close'

Emitted when the socket closes. Note that if connections exist, this
event is not emitted until all connections are ended.

## 'error'

* {Error Object}

Emitted when an error occurs.  The `'close'` event will be called directly
following this event.



# Message format

Every message should has `header` and `body`.
If there is no `header` or `body` - message will not sent.


## Authorize

**Be careful** by default without any encrypt algorithm any can connect to your server if he know format.

Example of message to authorize (without encrypt):

```
    '{"rpc":"herald-server","action":"authorize","actionId":7,"name":"156512",
    "uid":"156512_86835","messId":76688,"retry":5,"timeout":15000}\r\n
     {"args":{"wellKnown":"pHrAsE","name":"156512","uid":"156512_86835","rand":459}}\r\n\r\n' 
```

If there is some connection with same uid - will not authorize new connection and close it.



## Message header format

Fields:
* `messId` Number - id of message. Client set it automaticaly.
* `name` String - connection name. Used for whispering and rpc. Client set it to HeraldClient.name.
* `uid` String - connection uid. Used for whispering and rpc. Unique for every connect. Client set it to HeraldClient.uid.
* `retry` Number [optional] - Count of retries of sending this message. If no field - will not retry.
*Now it is ignored by server. Will work soon.*
* `timeout` Number [optional] - Duration in ms to wait answer from client. If no field - will not retry.
*Now it is ignored by server. Will work soon.*

Event:
* `whisp` String [optional] - name of connection to send event message.
* `whispUid` String [optional] - uid of connection to send event message.
* `event` String - event name. If no `whisp` or `whispUid` sends to all subscribers.

RPC:
* `actionId` Number - id of action. Client set it automaticaly.
* `action` String - name of action.
* `rpc` String [optional] - name of connection to send rpc message.
* `rpcUid` String [optional] - uid of connection to send rpc message.
* `rpcRegExp` String|RegExp [optional] - regexp to find connections by name to send rpc message.


## Message body format

Body can by plain string, json, number or something else, except functions.

## Message examples

Examples shown without any encryption.

RPC by client name message:
```js
     '{"rpc":"applicationToCall","action":"actionToCall","actionId":numberActionIdFromSender,
     "name":"nameOfSender","uid":"uidOfSender","messId":numberMessageId}\r\n
         {"args":{argsObject}}\r\n\r\n' 
```

RPC by client UID message:
```js
     '{"rpcUid":"applicationToCall","action":"actionToCall","actionId":numberActionIdFromSender,
     "name":"nameOfSender","uid":"uidOfSender","messId":numberMessageId}\r\n
         {"args":{argsObject}}\r\n\r\n' 
```

Whispering message:
```js
    '{"whisp":"nameOfAppToWhisp","event":"someSecretEvent","name":"nameOfSender","uid":"uidOfSender",
    "messId":numberMessageId}\r\n"eventBody"\r\n\r\n'
```

Event message:
```js
    '{"event":"someEvent","name":"nameOfSender","uid":"uidOfSender","messId":numberMessageId}\r\n"eventBody"\r\n\r\n'
```

# LICENSE - "MIT License"

Copyright (c) 2015 Konstantine Petryaev

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
