herald-client
===========================

Client lib for herald server

Install with:

    npm install herald-client

Dependencies:

    crypt-maker


# Usage

Simple example:

```js

    var hc = new (require('herald-client'))();
        hc.on('error', function(error){
            console.log('HC error:', error);
        });
    
        setTimeout(function() {
            hc.subscribe("channel1", function (obj) {
                console.error('chan1:', obj);
            });
            hc.subscribe("channel2", function (obj) {
                console.log('chan2:', obj);
            });
    
    
            setTimeout(function () {
                hc.unsubscribe("channel1");
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
In this example hc will try connect to 127.0.0.1:8765.

# Methods

## new HeraldClient(options[, algorithm[, key]])

`options` is an Object. May be `{}`. Contains properties:
* `.logger` - Logger object - to log inner events
* `.iAm` - String|Numeric - your unique identifier. Default: Math.floor(Math.random()*1000000);
* `.messageMaker` - Object. Some module, that make and parse messages. See below. Default `crypt-maker`
* `.connect` - Object. Options for new.Socket.connect. 
See https://nodejs.org/api/net.html#net_net_connect_options_connectionlistener Default: `{port:8765}`

If use `crypt-maker` and if `algorithm && algorithm !== 'no'` and no key passed to constructor - throws error.


## hc.connect([options]) 

Connect to server. If options aren't passed, connect with last options.
If already connected - do nothing.
Options are:
* `options` {Object} - Required. Supports the following properties:
  * `port` {Number} - Optional.
  * `host` {String} - Optional.
  * `backlog` {Number} - Optional.
  * `path` {String} - Optional.
  * `exclusive` {Boolean} - Optional.
* `callback` {Function} - Optional.

For all info about this see: See https://nodejs.org/api/net.html#net_net_connect_options_connectionlistener

## hc.close()

Stops the client and close connect from accepting new connections and keeps existing
connections.

## hc.subscribe(eventName, callback)

Create subscribing on server. Then event emitted - call `callback(bodyOfMessage)`

## hc.unsubscribe(eventName)

Unsubscribe from event with name.

## hc.publish(eventName, body)

Publish event on server.

## hc.whisper(whom, body[, header])

`whom` - who need this message
`body` - body of message
`header` - header object of message. Default `{event: 'whisper'}`

## hc.write(header, body)

Make message (by message maker) and send message to socket. If send fails retry do this.

## hc.writeMessage(message)

Send already made message. Retry if fails.


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
After the connect, client should send authorize request to server.
Server passed this data to `authorizeFunction`.

## Default authorize request format

Header should has an field `event == 'authorize'`.
Also there should be field `iAm` with name of application.
Body also should has encrypted field `iAm` with same value. 
**Be careful** by default without any encrypt algorithm any can connect to your server if he know format.

Example of message to authorize (without encrypt):

```
    '{"event":"authorize","iAm":"Dev"}\r\n{"iAm":"Dev"}\r\n\r\n' 
```

If there is some connection with same name - will not authorize new connection and close it.
If header.iAm !== body.iAm - close connect.


## Message header format

Fields:
* `whisp` String - name of connection, where will try to whisper some message 
(event field will be ignore and passed to connection)
* `event` String - an event name, that will be publish. Except `'ping'`, `'pong'`, `'subscribe'`, `'unsubscribe'`
* `time` Numeric [optional] - timestamp of ping event create date.
* `iAm` String [optional] - connection name. Used for whispering. Unique for every connect.

### Special header events

`ping` - create only by HS. Every client should answer "pong" message with body of accepted message.
`pong` - answer for "ping" message.
`subscribe` - connection will subscribe to some events. name of event should be passed at body of message.
`unsubscribe` - connection will unsubscribe from some events. name of event should be passed at body of message.

## Message body format

Body can by plain string, json, number or something else, except functions.

## Message examples

Examples shown without any 

Authorize message:
```js
    '{"event":"authorize","iAm":"Dev"}\r\n{"iAm":"Dev"}\r\n\r\n'
    //  {"event":"authorize","iAm":"Dev"}
    //  {"iAm":"Dev"}
```

Ping message:
```js
    '{"event":"ping","time":1430200822338}\r\n{}\r\n\r\n'
    //  {"event":"ping", "time":1430200822338}
    //  {}
```

Pong message:
```js
    '{"event":"pong","time":1430200822338}\r\n{}\r\n\r\n'
    //  {"event":"pong", "time":1430200822338}
    //  {}
```

Subscribe message:
```js
    '{"event":"subscribe"}\r\n"eventName"\r\n\r\n'
    //  {"event":"subscribe"}
    //  "eventName"
```

Unsubscribe message:
```js
    '{"event":"unsubscribe"}\r\n"eventName"\r\n\r\n'
    //  {"event":"unsubscribe"}
    //  "eventName"
```

Whispering message:
```js
    '{"whisp":"nameOfAppToWhisp","event":"someSecretEvent"}\r\n"eventBody"\r\n\r\n'
    //  {"whisp":"nameOfAppToWhisp","event":"someSecretEvent"}
    //  "eventBody"
```

# messageMaker

Message maker can be passed to server. It should has this methods:

## .makeMessage(message)

`message` is an Object. It should contains:
+ `message.header` - Object. Header of messages
    * `message.header.event` - String. Event, or doing
    * `message.header.iAm` - String. Optional
+ `message.body` - Object. May be `{}`

Returns string formed to write into socket.

## .parseMessage(message)

`message` - encrypted formed string.
Returns {header: headerObject, body: bodyObject}


## .splitMessages(rawString)

`rawString` some string, that socket connection sends. 
If doesn't ends by some message separator - should return `null` or `[]`
If ends by message separator - return array of messages (not parsed and not decrypted)

## .getHeader(message)

Returns header object from raw message.

## .getBody(message)

Returns body object from raw message.

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
