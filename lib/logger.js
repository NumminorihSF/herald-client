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
 * Default module for logging. Use console.
 *      Модуль по умолчанию для логгирования. Использует консоль.
 * @class HeraldClient.Logger
 * @alternateClassName Logger
 * @member HeraldClient
 */

/**
 * Constructor.
 *      Конструктор.
 * @method constructor
 * @param {String} name Name of Logger.
 *      Название логгера.
 * @returns {Logger} Logger object.
 *      Объект логгера
 */
function Logger (name){
  /**
   * Name of logger. Print every time, then log something.
   *      Имя логгера. Выводится каждый раз, при логгировании.
   * @type {String}
   */
  this.name = name;

  return this;
}

/**
 * Print [TRACE] {@link Logger#name [name]} some your data to console.
 *      Выводит [TRACE] {@link Logger#name [name]} данные для логгирования.
 */
Logger.prototype.trace = function(){
  console.log('[TRACE] [' + this.name + '] ' + Array.prototype.join.call(arguments, ' '));
};

/**
 * Print [DEBUG] {@link Logger#name [name]} some your data to console.
 *      Выводит [DEBUG] {@link Logger#name [name]} данные для логгирования.
 */
Logger.prototype.debug = function(){
  console.log('[DEBUG] [' + this.name + '] ' + Array.prototype.join.call(arguments, ' '));
};

/**
 * Print [INFO] {@link Logger#name [name]} some your data to console.
 *      Выводит [INFO] {@link Logger#name [name]} данные для логгирования.
 */
Logger.prototype.info = function(){
  console.log('[INFO] [' + this.name + '] ' + Array.prototype.join.call(arguments, ' '));
};

/**
 * Print [WARN] {@link Logger#name [name]} some your data to console.
 *      Выводит [WARN] {@link Logger#name [name]} данные для логгирования.
 */
Logger.prototype.warn = function(){
  console.error('[WARN] [' + this.name + '] ' + Array.prototype.join.call(arguments, ' '));
};

/**
 * Print [ERROR] {@link Logger#name [name]} some your data to console.
 *      Выводит [ERROR] {@link Logger#name [name]} данные для логгирования.
 */
Logger.prototype.error = function(){
  console.error('[ERROR] [' + this.name + '] ' + Array.prototype.join.call(arguments, ' '));
};

/**
 * Print [FATAL] {@link Logger#name [name]} some your data to console.
 *      Выводит [FATAL] {@link Logger#name [name]} данные для логгирования.
 */
Logger.prototype.fatal = function(){
  console.error('[FATAL] [' + this.name + '] ' + Array.prototype.join.call(arguments, ' '));
};

/**
 * Create new logger object with name.
 *      Создает и возвращает объект логгера.
 * @param {String} name Name of logger.
 *      Название логгера.
 * @static
 * @returns {Logger} - Logger object.
 *      Объект логгера.
 */
Logger.getLogger = function(name){
  return new Logger(name);
};

module.exports = Logger;