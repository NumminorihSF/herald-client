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

if (module.parent) {
    module.exports = require(__dirname+'/lib/class.js');
}
else {
    var hc = new (require('./lib/class.js'))({
        logger: {
            trace: function(){},
            debug: function(){},
            info: function(){},
            warn: function(){},
            error: function(){},
            fatal: function(){}
        }
    });
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
            },10).unref();
        }, 1000).unref();
    }, 1000).unref();
    process.on('SIGINT', function(){
        hc.close();
        process.exit();
    });
    process.on('SIGTERM', function(){
        hc.close();
        process.exit();
    });
    console.log(process.pid);
}