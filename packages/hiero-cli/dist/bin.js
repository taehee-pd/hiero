#!/usr/bin/env node
var __create = Object.create;
var __getProtoOf = Object.getPrototypeOf;
var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __toESM = (mod, isNodeMode, target) => {
  target = mod != null ? __create(__getProtoOf(mod)) : {};
  const to = isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target;
  for (let key of __getOwnPropNames(mod))
    if (!__hasOwnProp.call(to, key))
      __defProp(to, key, {
        get: () => mod[key],
        enumerable: true
      });
  return to;
};
var __commonJS = (cb, mod) => () => (mod || cb((mod = { exports: {} }).exports, mod), mod.exports);

// ../../node_modules/.pnpm/fast-bitset@1.3.2/node_modules/fast-bitset/app/BitSet.js
var require_BitSet = __commonJS((exports, module) => {
  var BITS_PER_INT = 31;
  var multiplyDeBruijnBitPosition = [
    0,
    1,
    28,
    2,
    29,
    14,
    24,
    3,
    30,
    22,
    20,
    15,
    25,
    17,
    4,
    8,
    31,
    27,
    13,
    23,
    21,
    19,
    16,
    7,
    26,
    12,
    18,
    6,
    11,
    5,
    10,
    9
  ];
  BitSet = function(nBitsOrKey) {
    var wordCount, arrVals, front, leadingZeros, i;
    if (typeof nBitsOrKey === "number") {
      nBitsOrKey = nBitsOrKey || BITS_PER_INT;
      wordCount = Math.ceil(nBitsOrKey / BITS_PER_INT);
      this.arr = new Uint32Array(wordCount);
      this.MAX_BIT = nBitsOrKey - 1;
    } else {
      arrVals = JSON.parse("[" + nBitsOrKey + "]");
      this.MAX_BIT = arrVals.pop();
      leadingZeros = arrVals.pop();
      if (leadingZeros > 0) {
        front = [];
        for (i = 0;i < leadingZeros; i++)
          front[i] = 0;
        for (i = 0;i < arrVals.length; i++)
          front[leadingZeros + i] = arrVals[i];
        arrVals = front;
      }
      wordCount = Math.ceil((this.MAX_BIT + 1) / BITS_PER_INT);
      this.arr = new Uint32Array(wordCount);
      this.arr.set(arrVals);
    }
  };
  BitSet.prototype.get = function(idx) {
    var word = this._getWord(idx);
    return word === -1 ? false : (this.arr[word] >> idx % BITS_PER_INT & 1) === 1;
  };
  BitSet.prototype.set = function(idx) {
    var word = this._getWord(idx);
    if (word === -1)
      return false;
    this.arr[word] |= 1 << idx % BITS_PER_INT;
    return true;
  };
  BitSet.prototype.setRange = function(from, to) {
    return this._doRange(from, to, _setFunc);
  };
  BitSet.prototype.unset = function(idx) {
    var word = this._getWord(idx);
    if (word === -1)
      return false;
    this.arr[word] &= ~(1 << idx % BITS_PER_INT);
    return true;
  };
  BitSet.prototype.unsetRange = function(from, to) {
    return this._doRange(from, to, _unsetFunc);
  };
  BitSet.prototype.toggle = function(idx) {
    var word = this._getWord(idx);
    if (word === -1)
      return false;
    this.arr[word] ^= 1 << idx % BITS_PER_INT;
    return true;
  };
  BitSet.prototype.toggleRange = function(from, to) {
    return this._doRange(from, to, _toggleFunc);
  };
  BitSet.prototype.clear = function() {
    for (var i = 0;i < this.arr.length; i++) {
      this.arr[i] = 0;
    }
    return true;
  };
  BitSet.prototype.clone = function() {
    return new BitSet(this.dehydrate());
  };
  BitSet.prototype.dehydrate = function() {
    var i, lastUsedWord, s;
    var leadingZeros = 0;
    for (i = 0;i < this.arr.length; i++) {
      if (this.arr[i] !== 0)
        break;
      leadingZeros++;
    }
    for (i = this.arr.length - 1;i >= leadingZeros; i--) {
      if (this.arr[i] !== 0) {
        lastUsedWord = i;
        break;
      }
    }
    s = "";
    for (i = leadingZeros;i <= lastUsedWord; i++) {
      s += this.arr[i] + ",";
    }
    s += leadingZeros + "," + this.MAX_BIT;
    return s;
  };
  BitSet.prototype.and = function(bsOrIdx) {
    return this._op(bsOrIdx, _and);
  };
  BitSet.prototype.or = function(bsOrIdx) {
    return this._op(bsOrIdx, _or);
  };
  BitSet.prototype.xor = function(bsOrIdx) {
    return this._op(bsOrIdx, _xor);
  };
  BitSet.prototype.forEach = function(func) {
    for (var i = this.ffs();i !== -1; i = this.nextSetBit(i + 1)) {
      func(i);
    }
  };
  BitSet.prototype.getCardinality = function() {
    var setCount = 0;
    for (var i = this.arr.length - 1;i >= 0; i--) {
      var j2 = this.arr[i];
      j2 = j2 - (j2 >> 1 & 1431655765);
      j2 = (j2 & 858993459) + (j2 >> 2 & 858993459);
      setCount += (j2 + (j2 >> 4) & 252645135) * 16843009 >> 24;
    }
    return setCount;
  };
  BitSet.prototype.getIndices = function() {
    var indices = [];
    this.forEach(function(i) {
      indices.push(i);
    });
    return indices;
  };
  BitSet.prototype.isSubsetOf = function(bs) {
    var arr1 = this.arr;
    var arr2 = bs.arr;
    var len = arr1.length;
    for (var i = 0;i < len; i++) {
      if ((arr1[i] & arr2[i]) !== arr1[i]) {
        return false;
      }
    }
    return true;
  };
  BitSet.prototype.isEmpty = function() {
    var i, arr;
    arr = this.arr;
    for (i = 0;i < arr.length; i++) {
      if (arr[i]) {
        return false;
      }
    }
    return true;
  };
  BitSet.prototype.isEqual = function(bs) {
    var i;
    for (i = 0;i < this.arr.length; i++) {
      if (this.arr[i] !== bs.arr[i]) {
        return false;
      }
    }
    return true;
  };
  BitSet.prototype.toString = function() {
    var i, str, fullString = "";
    for (i = this.arr.length - 1;i >= 0; i--) {
      str = this.arr[i].toString(2);
      fullString += ("0000000000000000000000000000000" + str).slice(-BITS_PER_INT);
    }
    return fullString;
  };
  BitSet.prototype.ffs = function(_startWord) {
    var setVal, i, fs = -1;
    _startWord = _startWord || 0;
    for (i = _startWord;i < this.arr.length; i++) {
      setVal = this.arr[i];
      if (setVal === 0)
        continue;
      fs = _lsb(setVal) + i * BITS_PER_INT;
      break;
    }
    return fs <= this.MAX_BIT ? fs : -1;
  };
  BitSet.prototype.ffz = function(_startWord) {
    var i, setVal, fz = -1;
    _startWord = _startWord || 0;
    for (i = _startWord;i < this.arr.length; i++) {
      setVal = this.arr[i];
      if (setVal === 2147483647)
        continue;
      setVal ^= 2147483647;
      fz = _lsb(setVal) + i * BITS_PER_INT;
      break;
    }
    return fz <= this.MAX_BIT ? fz : -1;
  };
  BitSet.prototype.fls = function(_startWord) {
    var i, setVal, ls = -1;
    if (_startWord === undefined)
      _startWord = this.arr.length - 1;
    for (i = _startWord;i >= 0; i--) {
      setVal = this.arr[i];
      if (setVal === 0)
        continue;
      ls = _msb(setVal) + i * BITS_PER_INT;
      break;
    }
    return ls;
  };
  BitSet.prototype.flz = function(_startWord) {
    var i, setVal, ls = -1;
    if (_startWord === undefined)
      _startWord = this.arr.length - 1;
    for (i = _startWord;i >= 0; i--) {
      setVal = this.arr[i];
      if (i === this.arr.length - 1) {
        var wordIdx = this.MAX_BIT % BITS_PER_INT;
        var unusedBitCount = BITS_PER_INT - wordIdx - 1;
        setVal |= (1 << unusedBitCount) - 1 << wordIdx + 1;
      }
      if (setVal === 2147483647)
        continue;
      setVal ^= 2147483647;
      ls = _msb(setVal) + i * BITS_PER_INT;
      break;
    }
    return ls;
  };
  BitSet.prototype.nextSetBit = function(idx) {
    var startWord = this._getWord(idx);
    if (startWord === -1)
      return -1;
    var wordIdx = idx % BITS_PER_INT;
    var len = BITS_PER_INT - wordIdx;
    var mask = (1 << len) - 1 << wordIdx;
    var reducedWord = this.arr[startWord] & mask;
    if (reducedWord > 0) {
      return _lsb(reducedWord) + startWord * BITS_PER_INT;
    }
    return this.ffs(startWord + 1);
  };
  BitSet.prototype.nextUnsetBit = function(idx) {
    var startWord = this._getWord(idx);
    if (startWord === -1)
      return -1;
    var mask = (1 << idx % BITS_PER_INT) - 1;
    var reducedWord = this.arr[startWord] | mask;
    if (reducedWord === 2147483647) {
      return this.ffz(startWord + 1);
    }
    return _lsb(2147483647 ^ reducedWord) + startWord * BITS_PER_INT;
  };
  BitSet.prototype.previousSetBit = function(idx) {
    var startWord = this._getWord(idx);
    if (startWord === -1)
      return -1;
    var mask = 2147483647 >>> BITS_PER_INT - idx % BITS_PER_INT - 1;
    var reducedWord = this.arr[startWord] & mask;
    if (reducedWord > 0) {
      return _msb(reducedWord) + startWord * BITS_PER_INT;
    }
    return this.fls(startWord - 1);
  };
  BitSet.prototype.previousUnsetBit = function(idx) {
    var startWord = this._getWord(idx);
    if (startWord === -1)
      return -1;
    var wordIdx = idx % BITS_PER_INT;
    var mask = (1 << BITS_PER_INT - wordIdx - 1) - 1 << wordIdx + 1;
    var reducedWord = this.arr[startWord] | mask;
    if (reducedWord === 2147483647) {
      return this.flz(startWord - 1);
    }
    return _msb(2147483647 ^ reducedWord) + startWord * BITS_PER_INT;
  };
  BitSet.prototype._getWord = function(idx) {
    return idx < 0 || idx > this.MAX_BIT ? -1 : ~~(idx / BITS_PER_INT);
  };
  BitSet.prototype._doRange = function(from, to, func) {
    var i, curStart, curEnd, len;
    if (to < from) {
      to ^= from;
      from ^= to;
      to ^= from;
    }
    var startWord = this._getWord(from);
    var endWord = this._getWord(to);
    if (startWord === -1 || endWord === -1)
      return false;
    for (i = startWord;i <= endWord; i++) {
      curStart = i === startWord ? from % BITS_PER_INT : 0;
      curEnd = i === endWord ? to % BITS_PER_INT : BITS_PER_INT - 1;
      len = curEnd - curStart + 1;
      this.arr[i] = func(this.arr[i], len, curStart);
    }
    return true;
  };
  BitSet.prototype._op = function(bsOrIdx, func) {
    var i, arr1, arr2, len, newBS, word;
    arr1 = this.arr;
    if (typeof bsOrIdx === "number") {
      word = this._getWord(bsOrIdx);
      newBS = this.clone();
      if (word !== -1)
        newBS.arr[word] = func(arr1[word], 1 << bsOrIdx % BITS_PER_INT);
    } else {
      arr2 = bsOrIdx.arr;
      len = arr1.length;
      newBS = new BitSet(this.MAX_BIT + 1);
      for (i = 0;i < len; i++) {
        newBS.arr[i] = func(arr1[i], arr2[i]);
      }
    }
    return newBS;
  };
  function _lsb(word) {
    return multiplyDeBruijnBitPosition[(word & -word) * 125613361 >>> 27];
  }
  function _msb(word) {
    word |= word >> 1;
    word |= word >> 2;
    word |= word >> 4;
    word |= word >> 8;
    word |= word >> 16;
    word = (word >> 1) + 1;
    return multiplyDeBruijnBitPosition[word * 125613361 >>> 27];
  }
  function _toggleFunc(word, len, curStart) {
    var mask = (1 << len) - 1 << curStart;
    return word ^ mask;
  }
  function _setFunc(word, len, curStart) {
    var mask = (1 << len) - 1 << curStart;
    return word | mask;
  }
  function _unsetFunc(word, len, curStart) {
    var mask = 2147483647 ^ (1 << len) - 1 << curStart;
    return word & mask;
  }
  function _and(word1, word2) {
    return word1 & word2;
  }
  function _or(word1, word2) {
    return word1 | word2;
  }
  function _xor(word1, word2) {
    return word1 ^ word2;
  }
  if (typeof define === "function" && define["amd"]) {
    define([], function() {
      return BitSet;
    });
  } else if (typeof exports === "object") {
    module["exports"] = BitSet;
  }
});

// ../../node_modules/.pnpm/hungarian-on3@0.3.1/node_modules/hungarian-on3/app/hungarianOn3.js
var require_hungarianOn3 = __commonJS((exports, module) => {
  var BitSet2 = require_BitSet();
  module.exports = function(costMatrix, isProfit) {
    costMatrix = clone2d(costMatrix);
    var ap = new AP(costMatrix, isProfit);
    if (ap.rows === 0 || ap.cols === 0) {
      return [];
    }
    return ap.execute();
  };
  function AP(costMatrix, isProfit) {
    this.BIG_M = Math.pow(2, 30);
    this.costMatrix = costMatrix;
    this.reduceSearchSpaceRows();
    this.rows = this.costMatrix.length;
    this.cols = this.rows === 0 ? 0 : this.costMatrix[0].length;
    if (isProfit) {
      this.makeItProfit();
    }
    this.makeSquare();
    var dim = this.costMatrix.length;
    this.dim = dim;
    this.labelByWorker = filledArray(dim, 0);
    this.labelByJob = filledArray(dim, this.BIG_M);
    this.minSlackWorkerByJob = new Array(dim);
    this.minSlackValueByJob = new Array(dim);
    this.committedWorkers = new BitSet2(dim);
    this.jobByWorkerBS = new BitSet2(dim);
    this.workerByJobBS = new BitSet2(dim);
    this.parentWorkerByCommittedJob = new Array(dim);
    this.matchJobByWorker = filledArray(dim, -1);
    this.matchWorkerByJob = filledArray(dim, -1);
  }
  AP.prototype.computeInitialFeasibleSolution = function() {
    var j2, w;
    for (w = 0;w < this.dim; w++) {
      for (j2 = 0;j2 < this.dim; j2++) {
        if (this.costMatrix[w][j2] < this.labelByJob[j2]) {
          this.labelByJob[j2] = this.costMatrix[w][j2];
        }
      }
    }
  };
  AP.prototype.execute = function() {
    this.reduceRows();
    this.reduceCols();
    this.computeInitialFeasibleSolution();
    this.greedyMatch();
    var w = this.jobByWorkerBS.ffz();
    while (w !== -1) {
      this.initializePhase(w);
      this.executePhase();
      w = this.jobByWorkerBS.ffz();
    }
    return this.getResult();
  };
  AP.prototype.getResult = function() {
    var w, result;
    var arrRes = [];
    var paddedResults = filledArray(this.inflatedRows, -1);
    result = this.matchJobByWorker.slice(0, this.rows);
    for (w = 0;w < result.length; w++) {
      if (result[w] >= this.cols) {
        result[w] = -1;
      }
    }
    for (w = 0;w < this.rowsKept.length; w++) {
      paddedResults[this.rowsKept[w]] = result[w];
    }
    for (w = 0;w < paddedResults.length; w++) {
      arrRes[w] = [w, paddedResults[w]];
    }
    return arrRes;
  };
  AP.prototype.initializePhase = function(w) {
    var j2, workerCost;
    fillArray(this.parentWorkerByCommittedJob, -1);
    this.committedWorkers.clear();
    this.committedWorkers.set(w);
    workerCost = this.costMatrix[w];
    for (j2 = 0;j2 < this.dim; j2++) {
      if (!workerCost)
        debugger;
      this.minSlackValueByJob[j2] = workerCost[j2] - this.labelByWorker[w] - this.labelByJob[j2];
      this.minSlackWorkerByJob[j2] = w;
    }
  };
  AP.prototype.executePhase = function() {
    var committedJob, temp = 0, parentWorker, worker, mins;
    while (true) {
      mins = this.getMinSlack();
      if (mins.minSlackValue > 0) {
        this.updateLabeling(mins.minSlackValue);
      }
      this.parentWorkerByCommittedJob[mins.minSlackJob] = mins.minSlackWorker;
      if (!this.workerByJobBS.get(mins.minSlackJob)) {
        committedJob = mins.minSlackJob;
        parentWorker = this.parentWorkerByCommittedJob[committedJob];
        while (true) {
          temp = this.matchJobByWorker[parentWorker];
          this.match(parentWorker, committedJob);
          committedJob = temp;
          if (committedJob === -1) {
            break;
          }
          parentWorker = this.parentWorkerByCommittedJob[committedJob];
        }
        return;
      } else {
        worker = this.matchWorkerByJob[mins.minSlackJob];
        this.committedWorkers.set(worker);
        this.updateSlack(worker);
      }
    }
  };
  AP.prototype.updateSlack = function(worker) {
    for (j = 0;j < this.dim; j++) {
      if (this.parentWorkerByCommittedJob[j] === -1) {
        if (this.costMatrix[worker] === undefined)
          debugger;
        var slack = this.costMatrix[worker][j] - this.labelByWorker[worker] - this.labelByJob[j];
        if (this.minSlackValueByJob[j] > slack) {
          this.minSlackValueByJob[j] = slack;
          this.minSlackWorkerByJob[j] = worker;
        }
      }
    }
  };
  AP.prototype.getMinSlack = function() {
    var minSlackWorker = -1;
    var minSlackJob = -1;
    var minSlackValue = Infinity;
    var j2;
    for (j2 = 0;j2 < this.dim; j2++) {
      if (this.parentWorkerByCommittedJob[j2] === -1) {
        if (this.minSlackValueByJob[j2] < minSlackValue) {
          minSlackValue = this.minSlackValueByJob[j2];
          minSlackWorker = this.minSlackWorkerByJob[j2];
          minSlackJob = j2;
          if (minSlackValue === 0)
            break;
        }
      }
    }
    return {
      minSlackWorker,
      minSlackJob,
      minSlackValue
    };
  };
  AP.prototype.greedyMatch = function() {
    var i, j2;
    for (i = 0;i < this.dim; i++) {
      for (j2 = 0;j2 < this.dim; j2++) {
        if (!this.jobByWorkerBS.get(i) && !this.workerByJobBS.get(j2) && this.costMatrix[i][j2] === 0) {
          this.match(i, j2);
          break;
        }
      }
    }
  };
  AP.prototype.match = function(i, j2) {
    this.matchJobByWorker[i] = j2;
    this.matchWorkerByJob[j2] = i;
    this.jobByWorkerBS.set(i);
    this.workerByJobBS.set(j2);
  };
  AP.prototype.reduceRows = function() {
    var minVal, i, j2, costRow;
    for (i = 0;i < this.rows; i++) {
      costRow = this.costMatrix[i];
      minVal = costRow[0];
      for (j2 = 1;j2 < this.cols; j2++) {
        if (costRow[j2] < minVal) {
          minVal = costRow[j2];
        }
      }
      for (j2 = 0;j2 < this.cols; j2++) {
        costRow[j2] -= minVal;
      }
    }
  };
  AP.prototype.reduceCols = function() {
    var costRow, i, j2, minVals;
    minVals = filledArray(this.dim, Infinity);
    for (i = 0;i < this.dim; i++) {
      costRow = this.costMatrix[i];
      for (j2 = 0;j2 < this.cols; j2++) {
        if (costRow[j2] < minVals[j2]) {
          minVals[j2] = costRow[j2];
        }
      }
    }
    for (i = 0;i < this.dim; i++) {
      for (j2 = 0;j2 < this.cols; j2++) {
        this.costMatrix[i][j2] -= minVals[j2];
      }
    }
  };
  AP.prototype.updateLabeling = function(slack) {
    var j2, w;
    for (w = 0;w < this.dim; w++) {
      if (this.committedWorkers.get(w)) {
        this.labelByWorker[w] += slack;
      }
    }
    for (j2 = 0;j2 < this.dim; j2++) {
      if (this.parentWorkerByCommittedJob[j2] !== -1) {
        this.labelByJob[j2] -= slack;
      } else {
        this.minSlackValueByJob[j2] -= slack;
      }
    }
  };
  function filledArray(len, fill) {
    var i, newArray = [];
    for (i = 0;i < len; i++) {
      newArray[i] = fill;
    }
    return newArray;
  }
  function fillArray(arr, fill) {
    var i;
    for (i = 0;i < arr.length; i++) {
      arr[i] = fill;
    }
  }
  function clone2d(mat) {
    var i, copy = [];
    for (i = 0;i < mat.length; i++) {
      copy[i] = mat[i].slice();
    }
    return copy;
  }
  AP.prototype.makeSquare = function() {
    var i, j2, row;
    if (this.rows === this.cols)
      return;
    if (this.rows > this.cols) {
      for (i = 0;i < this.rows; i++) {
        row = this.costMatrix[i];
        for (j2 = this.cols;j2 < this.rows; j2++) {
          row[j2] = 0;
        }
      }
    } else if (this.rows < this.cols) {
      for (i = this.rows;i < this.cols; i++) {
        row = this.costMatrix[i] = [];
        for (j2 = 0;j2 < this.cols; j2++) {
          row[j2] = 0;
        }
      }
    }
  };
  AP.prototype.reduceSearchSpaceRows = function() {
    this.rowsKept = [];
    this.inflatedRows = this.costMatrix.length;
    for (var i = 0;i < this.costMatrix.length; i++) {
      var row = this.costMatrix[i];
      var impossible = true;
      for (var j2 = 0;j2 < row.length; j2++) {
        var val = row[j2];
        if (val < this.BIG_M) {
          impossible = false;
          break;
        }
      }
      if (impossible === true) {
        this.costMatrix[i] = undefined;
      } else {
        this.rowsKept.push(i);
      }
    }
    this.costMatrix = this.removeUndefinedFromArr();
  };
  AP.prototype.removeUndefinedFromArr = function() {
    var newArr = [];
    var val;
    for (var i = 0;i < this.costMatrix.length; i++) {
      val = this.costMatrix[i];
      if (val !== undefined) {
        newArr.push(val);
      }
    }
    return newArr;
  };
  AP.prototype.makeItProfit = function() {
    var biggestVal = 0;
    for (var i = 0;i < this.costMatrix.length; i++) {
      var row = this.costMatrix[i];
      for (var j2 = 0;j2 < row.length; j2++) {
        var val = row[j2];
        if (val > biggestVal && val < this.BIG_M) {
          biggestVal = val;
        }
      }
    }
    for (i = 0;i < this.costMatrix.length; i++) {
      row = this.costMatrix[i];
      for (j2 = 0;j2 < row.length; j2++) {
        row[j2] = row[j2] === 0 ? this.BIG_M : row[j2] - biggestVal;
      }
    }
  };
});

// ../../node_modules/.pnpm/poly2tri@1.5.0/node_modules/poly2tri/dist/version.json
var require_version = __commonJS((exports, module) => {
  module.exports = { version: "1.5.0" };
});

// ../../node_modules/.pnpm/poly2tri@1.5.0/node_modules/poly2tri/src/xy.js
var require_xy = __commonJS((exports, module) => {
  function toStringBase(p) {
    return "(" + p.x + ";" + p.y + ")";
  }
  function toString(p) {
    var s = p.toString();
    return s === "[object Object]" ? toStringBase(p) : s;
  }
  function compare(a, b) {
    if (a.y === b.y) {
      return a.x - b.x;
    } else {
      return a.y - b.y;
    }
  }
  function equals(a, b) {
    return a.x === b.x && a.y === b.y;
  }
  module.exports = {
    toString,
    toStringBase,
    compare,
    equals
  };
});

// ../../node_modules/.pnpm/poly2tri@1.5.0/node_modules/poly2tri/src/pointerror.js
var require_pointerror = __commonJS((exports, module) => {
  var xy = require_xy();
  var PointError = function(message, points) {
    this.name = "PointError";
    this.points = points = points || [];
    this.message = message || "Invalid Points!";
    for (var i = 0;i < points.length; i++) {
      this.message += " " + xy.toString(points[i]);
    }
  };
  PointError.prototype = new Error;
  PointError.prototype.constructor = PointError;
  module.exports = PointError;
});

// ../../node_modules/.pnpm/poly2tri@1.5.0/node_modules/poly2tri/src/point.js
var require_point = __commonJS((exports, module) => {
  var xy = require_xy();
  var Point = function(x, y) {
    this.x = +x || 0;
    this.y = +y || 0;
    this._p2t_edge_list = null;
  };
  Point.prototype.toString = function() {
    return xy.toStringBase(this);
  };
  Point.prototype.toJSON = function() {
    return { x: this.x, y: this.y };
  };
  Point.prototype.clone = function() {
    return new Point(this.x, this.y);
  };
  Point.prototype.set_zero = function() {
    this.x = 0;
    this.y = 0;
    return this;
  };
  Point.prototype.set = function(x, y) {
    this.x = +x || 0;
    this.y = +y || 0;
    return this;
  };
  Point.prototype.negate = function() {
    this.x = -this.x;
    this.y = -this.y;
    return this;
  };
  Point.prototype.add = function(n) {
    this.x += n.x;
    this.y += n.y;
    return this;
  };
  Point.prototype.sub = function(n) {
    this.x -= n.x;
    this.y -= n.y;
    return this;
  };
  Point.prototype.mul = function(s) {
    this.x *= s;
    this.y *= s;
    return this;
  };
  Point.prototype.length = function() {
    return Math.sqrt(this.x * this.x + this.y * this.y);
  };
  Point.prototype.normalize = function() {
    var len = this.length();
    this.x /= len;
    this.y /= len;
    return len;
  };
  Point.prototype.equals = function(p) {
    return this.x === p.x && this.y === p.y;
  };
  Point.negate = function(p) {
    return new Point(-p.x, -p.y);
  };
  Point.add = function(a, b) {
    return new Point(a.x + b.x, a.y + b.y);
  };
  Point.sub = function(a, b) {
    return new Point(a.x - b.x, a.y - b.y);
  };
  Point.mul = function(s, p) {
    return new Point(s * p.x, s * p.y);
  };
  Point.cross = function(a, b) {
    if (typeof a === "number") {
      if (typeof b === "number") {
        return a * b;
      } else {
        return new Point(-a * b.y, a * b.x);
      }
    } else {
      if (typeof b === "number") {
        return new Point(b * a.y, -b * a.x);
      } else {
        return a.x * b.y - a.y * b.x;
      }
    }
  };
  Point.toString = xy.toString;
  Point.compare = xy.compare;
  Point.cmp = xy.compare;
  Point.equals = xy.equals;
  Point.dot = function(a, b) {
    return a.x * b.x + a.y * b.y;
  };
  module.exports = Point;
});

// ../../node_modules/.pnpm/poly2tri@1.5.0/node_modules/poly2tri/src/triangle.js
var require_triangle = __commonJS((exports, module) => {
  var xy = require_xy();
  var Triangle = function(a, b, c) {
    this.points_ = [a, b, c];
    this.neighbors_ = [null, null, null];
    this.interior_ = false;
    this.constrained_edge = [false, false, false];
    this.delaunay_edge = [false, false, false];
  };
  var p2s = xy.toString;
  Triangle.prototype.toString = function() {
    return "[" + p2s(this.points_[0]) + p2s(this.points_[1]) + p2s(this.points_[2]) + "]";
  };
  Triangle.prototype.getPoint = function(index) {
    return this.points_[index];
  };
  Triangle.prototype.GetPoint = Triangle.prototype.getPoint;
  Triangle.prototype.getPoints = function() {
    return this.points_;
  };
  Triangle.prototype.getNeighbor = function(index) {
    return this.neighbors_[index];
  };
  Triangle.prototype.containsPoint = function(point) {
    var points = this.points_;
    return point === points[0] || point === points[1] || point === points[2];
  };
  Triangle.prototype.containsEdge = function(edge) {
    return this.containsPoint(edge.p) && this.containsPoint(edge.q);
  };
  Triangle.prototype.containsPoints = function(p1, p2) {
    return this.containsPoint(p1) && this.containsPoint(p2);
  };
  Triangle.prototype.isInterior = function() {
    return this.interior_;
  };
  Triangle.prototype.setInterior = function(interior) {
    this.interior_ = interior;
    return this;
  };
  Triangle.prototype.markNeighborPointers = function(p1, p2, t) {
    var points = this.points_;
    if (p1 === points[2] && p2 === points[1] || p1 === points[1] && p2 === points[2]) {
      this.neighbors_[0] = t;
    } else if (p1 === points[0] && p2 === points[2] || p1 === points[2] && p2 === points[0]) {
      this.neighbors_[1] = t;
    } else if (p1 === points[0] && p2 === points[1] || p1 === points[1] && p2 === points[0]) {
      this.neighbors_[2] = t;
    } else {
      throw new Error("poly2tri Invalid Triangle.markNeighborPointers() call");
    }
  };
  Triangle.prototype.markNeighbor = function(t) {
    var points = this.points_;
    if (t.containsPoints(points[1], points[2])) {
      this.neighbors_[0] = t;
      t.markNeighborPointers(points[1], points[2], this);
    } else if (t.containsPoints(points[0], points[2])) {
      this.neighbors_[1] = t;
      t.markNeighborPointers(points[0], points[2], this);
    } else if (t.containsPoints(points[0], points[1])) {
      this.neighbors_[2] = t;
      t.markNeighborPointers(points[0], points[1], this);
    }
  };
  Triangle.prototype.clearNeighbors = function() {
    this.neighbors_[0] = null;
    this.neighbors_[1] = null;
    this.neighbors_[2] = null;
  };
  Triangle.prototype.clearDelaunayEdges = function() {
    this.delaunay_edge[0] = false;
    this.delaunay_edge[1] = false;
    this.delaunay_edge[2] = false;
  };
  Triangle.prototype.pointCW = function(p) {
    var points = this.points_;
    if (p === points[0]) {
      return points[2];
    } else if (p === points[1]) {
      return points[0];
    } else if (p === points[2]) {
      return points[1];
    } else {
      return null;
    }
  };
  Triangle.prototype.pointCCW = function(p) {
    var points = this.points_;
    if (p === points[0]) {
      return points[1];
    } else if (p === points[1]) {
      return points[2];
    } else if (p === points[2]) {
      return points[0];
    } else {
      return null;
    }
  };
  Triangle.prototype.neighborCW = function(p) {
    if (p === this.points_[0]) {
      return this.neighbors_[1];
    } else if (p === this.points_[1]) {
      return this.neighbors_[2];
    } else {
      return this.neighbors_[0];
    }
  };
  Triangle.prototype.neighborCCW = function(p) {
    if (p === this.points_[0]) {
      return this.neighbors_[2];
    } else if (p === this.points_[1]) {
      return this.neighbors_[0];
    } else {
      return this.neighbors_[1];
    }
  };
  Triangle.prototype.getConstrainedEdgeCW = function(p) {
    if (p === this.points_[0]) {
      return this.constrained_edge[1];
    } else if (p === this.points_[1]) {
      return this.constrained_edge[2];
    } else {
      return this.constrained_edge[0];
    }
  };
  Triangle.prototype.getConstrainedEdgeCCW = function(p) {
    if (p === this.points_[0]) {
      return this.constrained_edge[2];
    } else if (p === this.points_[1]) {
      return this.constrained_edge[0];
    } else {
      return this.constrained_edge[1];
    }
  };
  Triangle.prototype.getConstrainedEdgeAcross = function(p) {
    if (p === this.points_[0]) {
      return this.constrained_edge[0];
    } else if (p === this.points_[1]) {
      return this.constrained_edge[1];
    } else {
      return this.constrained_edge[2];
    }
  };
  Triangle.prototype.setConstrainedEdgeCW = function(p, ce) {
    if (p === this.points_[0]) {
      this.constrained_edge[1] = ce;
    } else if (p === this.points_[1]) {
      this.constrained_edge[2] = ce;
    } else {
      this.constrained_edge[0] = ce;
    }
  };
  Triangle.prototype.setConstrainedEdgeCCW = function(p, ce) {
    if (p === this.points_[0]) {
      this.constrained_edge[2] = ce;
    } else if (p === this.points_[1]) {
      this.constrained_edge[0] = ce;
    } else {
      this.constrained_edge[1] = ce;
    }
  };
  Triangle.prototype.getDelaunayEdgeCW = function(p) {
    if (p === this.points_[0]) {
      return this.delaunay_edge[1];
    } else if (p === this.points_[1]) {
      return this.delaunay_edge[2];
    } else {
      return this.delaunay_edge[0];
    }
  };
  Triangle.prototype.getDelaunayEdgeCCW = function(p) {
    if (p === this.points_[0]) {
      return this.delaunay_edge[2];
    } else if (p === this.points_[1]) {
      return this.delaunay_edge[0];
    } else {
      return this.delaunay_edge[1];
    }
  };
  Triangle.prototype.setDelaunayEdgeCW = function(p, e) {
    if (p === this.points_[0]) {
      this.delaunay_edge[1] = e;
    } else if (p === this.points_[1]) {
      this.delaunay_edge[2] = e;
    } else {
      this.delaunay_edge[0] = e;
    }
  };
  Triangle.prototype.setDelaunayEdgeCCW = function(p, e) {
    if (p === this.points_[0]) {
      this.delaunay_edge[2] = e;
    } else if (p === this.points_[1]) {
      this.delaunay_edge[0] = e;
    } else {
      this.delaunay_edge[1] = e;
    }
  };
  Triangle.prototype.neighborAcross = function(p) {
    if (p === this.points_[0]) {
      return this.neighbors_[0];
    } else if (p === this.points_[1]) {
      return this.neighbors_[1];
    } else {
      return this.neighbors_[2];
    }
  };
  Triangle.prototype.oppositePoint = function(t, p) {
    var cw = t.pointCW(p);
    return this.pointCW(cw);
  };
  Triangle.prototype.legalize = function(opoint, npoint) {
    var points = this.points_;
    if (opoint === points[0]) {
      points[1] = points[0];
      points[0] = points[2];
      points[2] = npoint;
    } else if (opoint === points[1]) {
      points[2] = points[1];
      points[1] = points[0];
      points[0] = npoint;
    } else if (opoint === points[2]) {
      points[0] = points[2];
      points[2] = points[1];
      points[1] = npoint;
    } else {
      throw new Error("poly2tri Invalid Triangle.legalize() call");
    }
  };
  Triangle.prototype.index = function(p) {
    var points = this.points_;
    if (p === points[0]) {
      return 0;
    } else if (p === points[1]) {
      return 1;
    } else if (p === points[2]) {
      return 2;
    } else {
      throw new Error("poly2tri Invalid Triangle.index() call");
    }
  };
  Triangle.prototype.edgeIndex = function(p1, p2) {
    var points = this.points_;
    if (p1 === points[0]) {
      if (p2 === points[1]) {
        return 2;
      } else if (p2 === points[2]) {
        return 1;
      }
    } else if (p1 === points[1]) {
      if (p2 === points[2]) {
        return 0;
      } else if (p2 === points[0]) {
        return 2;
      }
    } else if (p1 === points[2]) {
      if (p2 === points[0]) {
        return 1;
      } else if (p2 === points[1]) {
        return 0;
      }
    }
    return -1;
  };
  Triangle.prototype.markConstrainedEdgeByIndex = function(index) {
    this.constrained_edge[index] = true;
  };
  Triangle.prototype.markConstrainedEdgeByEdge = function(edge) {
    this.markConstrainedEdgeByPoints(edge.p, edge.q);
  };
  Triangle.prototype.markConstrainedEdgeByPoints = function(p, q) {
    var points = this.points_;
    if (q === points[0] && p === points[1] || q === points[1] && p === points[0]) {
      this.constrained_edge[2] = true;
    } else if (q === points[0] && p === points[2] || q === points[2] && p === points[0]) {
      this.constrained_edge[1] = true;
    } else if (q === points[1] && p === points[2] || q === points[2] && p === points[1]) {
      this.constrained_edge[0] = true;
    }
  };
  module.exports = Triangle;
});

// ../../node_modules/.pnpm/poly2tri@1.5.0/node_modules/poly2tri/src/assert.js
var require_assert = __commonJS((exports, module) => {
  function assert(condition, message) {
    if (!condition) {
      throw new Error(message || "Assert Failed");
    }
  }
  module.exports = assert;
});

// ../../node_modules/.pnpm/poly2tri@1.5.0/node_modules/poly2tri/src/advancingfront.js
var require_advancingfront = __commonJS((exports, module) => {
  var Node = function(p, t) {
    this.point = p;
    this.triangle = t || null;
    this.next = null;
    this.prev = null;
    this.value = p.x;
  };
  var AdvancingFront = function(head, tail) {
    this.head_ = head;
    this.tail_ = tail;
    this.search_node_ = head;
  };
  AdvancingFront.prototype.head = function() {
    return this.head_;
  };
  AdvancingFront.prototype.setHead = function(node) {
    this.head_ = node;
  };
  AdvancingFront.prototype.tail = function() {
    return this.tail_;
  };
  AdvancingFront.prototype.setTail = function(node) {
    this.tail_ = node;
  };
  AdvancingFront.prototype.search = function() {
    return this.search_node_;
  };
  AdvancingFront.prototype.setSearch = function(node) {
    this.search_node_ = node;
  };
  AdvancingFront.prototype.findSearchNode = function() {
    return this.search_node_;
  };
  AdvancingFront.prototype.locateNode = function(x) {
    var node = this.search_node_;
    if (x < node.value) {
      while (node = node.prev) {
        if (x >= node.value) {
          this.search_node_ = node;
          return node;
        }
      }
    } else {
      while (node = node.next) {
        if (x < node.value) {
          this.search_node_ = node.prev;
          return node.prev;
        }
      }
    }
    return null;
  };
  AdvancingFront.prototype.locatePoint = function(point) {
    var px = point.x;
    var node = this.findSearchNode(px);
    var nx = node.point.x;
    if (px === nx) {
      if (point !== node.point) {
        if (point === node.prev.point) {
          node = node.prev;
        } else if (point === node.next.point) {
          node = node.next;
        } else {
          throw new Error("poly2tri Invalid AdvancingFront.locatePoint() call");
        }
      }
    } else if (px < nx) {
      while (node = node.prev) {
        if (point === node.point) {
          break;
        }
      }
    } else {
      while (node = node.next) {
        if (point === node.point) {
          break;
        }
      }
    }
    if (node) {
      this.search_node_ = node;
    }
    return node;
  };
  module.exports = AdvancingFront;
  module.exports.Node = Node;
});

// ../../node_modules/.pnpm/poly2tri@1.5.0/node_modules/poly2tri/src/utils.js
var require_utils = __commonJS((exports) => {
  var EPSILON2 = 0.000000000001;
  exports.EPSILON = EPSILON2;
  var Orientation = {
    CW: 1,
    CCW: -1,
    COLLINEAR: 0
  };
  exports.Orientation = Orientation;
  function orient2d(pa, pb, pc) {
    var detleft = (pa.x - pc.x) * (pb.y - pc.y);
    var detright = (pa.y - pc.y) * (pb.x - pc.x);
    var val = detleft - detright;
    if (val > -EPSILON2 && val < EPSILON2) {
      return Orientation.COLLINEAR;
    } else if (val > 0) {
      return Orientation.CCW;
    } else {
      return Orientation.CW;
    }
  }
  exports.orient2d = orient2d;
  function inScanArea(pa, pb, pc, pd) {
    var oadb = (pa.x - pb.x) * (pd.y - pb.y) - (pd.x - pb.x) * (pa.y - pb.y);
    if (oadb >= -EPSILON2) {
      return false;
    }
    var oadc = (pa.x - pc.x) * (pd.y - pc.y) - (pd.x - pc.x) * (pa.y - pc.y);
    if (oadc <= EPSILON2) {
      return false;
    }
    return true;
  }
  exports.inScanArea = inScanArea;
  function isAngleObtuse(pa, pb, pc) {
    var ax = pb.x - pa.x;
    var ay = pb.y - pa.y;
    var bx = pc.x - pa.x;
    var by = pc.y - pa.y;
    return ax * bx + ay * by < 0;
  }
  exports.isAngleObtuse = isAngleObtuse;
});

// ../../node_modules/.pnpm/poly2tri@1.5.0/node_modules/poly2tri/src/sweep.js
var require_sweep = __commonJS((exports) => {
  var assert = require_assert();
  var PointError = require_pointerror();
  var Triangle = require_triangle();
  var Node = require_advancingfront().Node;
  var utils = require_utils();
  var EPSILON2 = utils.EPSILON;
  var Orientation = utils.Orientation;
  var orient2d = utils.orient2d;
  var inScanArea = utils.inScanArea;
  var isAngleObtuse = utils.isAngleObtuse;
  function triangulate(tcx) {
    tcx.initTriangulation();
    tcx.createAdvancingFront();
    sweepPoints(tcx);
    finalizationPolygon(tcx);
  }
  function sweepPoints(tcx) {
    var i, len = tcx.pointCount();
    for (i = 1;i < len; ++i) {
      var point = tcx.getPoint(i);
      var node = pointEvent(tcx, point);
      var edges = point._p2t_edge_list;
      for (var j2 = 0;edges && j2 < edges.length; ++j2) {
        edgeEventByEdge(tcx, edges[j2], node);
      }
    }
  }
  function finalizationPolygon(tcx) {
    var t = tcx.front().head().next.triangle;
    var p = tcx.front().head().next.point;
    while (!t.getConstrainedEdgeCW(p)) {
      t = t.neighborCCW(p);
    }
    tcx.meshClean(t);
  }
  function pointEvent(tcx, point) {
    var node = tcx.locateNode(point);
    var new_node = newFrontTriangle(tcx, point, node);
    if (point.x <= node.point.x + EPSILON2) {
      fill(tcx, node);
    }
    fillAdvancingFront(tcx, new_node);
    return new_node;
  }
  function edgeEventByEdge(tcx, edge, node) {
    tcx.edge_event.constrained_edge = edge;
    tcx.edge_event.right = edge.p.x > edge.q.x;
    if (isEdgeSideOfTriangle(node.triangle, edge.p, edge.q)) {
      return;
    }
    fillEdgeEvent(tcx, edge, node);
    edgeEventByPoints(tcx, edge.p, edge.q, node.triangle, edge.q);
  }
  function edgeEventByPoints(tcx, ep, eq, triangle, point) {
    if (isEdgeSideOfTriangle(triangle, ep, eq)) {
      return;
    }
    var p1 = triangle.pointCCW(point);
    var o1 = orient2d(eq, p1, ep);
    if (o1 === Orientation.COLLINEAR) {
      throw new PointError("poly2tri EdgeEvent: Collinear not supported!", [eq, p1, ep]);
    }
    var p2 = triangle.pointCW(point);
    var o2 = orient2d(eq, p2, ep);
    if (o2 === Orientation.COLLINEAR) {
      throw new PointError("poly2tri EdgeEvent: Collinear not supported!", [eq, p2, ep]);
    }
    if (o1 === o2) {
      if (o1 === Orientation.CW) {
        triangle = triangle.neighborCCW(point);
      } else {
        triangle = triangle.neighborCW(point);
      }
      edgeEventByPoints(tcx, ep, eq, triangle, point);
    } else {
      flipEdgeEvent(tcx, ep, eq, triangle, point);
    }
  }
  function isEdgeSideOfTriangle(triangle, ep, eq) {
    var index = triangle.edgeIndex(ep, eq);
    if (index !== -1) {
      triangle.markConstrainedEdgeByIndex(index);
      var t = triangle.getNeighbor(index);
      if (t) {
        t.markConstrainedEdgeByPoints(ep, eq);
      }
      return true;
    }
    return false;
  }
  function newFrontTriangle(tcx, point, node) {
    var triangle = new Triangle(point, node.point, node.next.point);
    triangle.markNeighbor(node.triangle);
    tcx.addToMap(triangle);
    var new_node = new Node(point);
    new_node.next = node.next;
    new_node.prev = node;
    node.next.prev = new_node;
    node.next = new_node;
    if (!legalize(tcx, triangle)) {
      tcx.mapTriangleToNodes(triangle);
    }
    return new_node;
  }
  function fill(tcx, node) {
    var triangle = new Triangle(node.prev.point, node.point, node.next.point);
    triangle.markNeighbor(node.prev.triangle);
    triangle.markNeighbor(node.triangle);
    tcx.addToMap(triangle);
    node.prev.next = node.next;
    node.next.prev = node.prev;
    if (!legalize(tcx, triangle)) {
      tcx.mapTriangleToNodes(triangle);
    }
  }
  function fillAdvancingFront(tcx, n) {
    var node = n.next;
    while (node.next) {
      if (isAngleObtuse(node.point, node.next.point, node.prev.point)) {
        break;
      }
      fill(tcx, node);
      node = node.next;
    }
    node = n.prev;
    while (node.prev) {
      if (isAngleObtuse(node.point, node.next.point, node.prev.point)) {
        break;
      }
      fill(tcx, node);
      node = node.prev;
    }
    if (n.next && n.next.next) {
      if (isBasinAngleRight(n)) {
        fillBasin(tcx, n);
      }
    }
  }
  function isBasinAngleRight(node) {
    var ax = node.point.x - node.next.next.point.x;
    var ay = node.point.y - node.next.next.point.y;
    assert(ay >= 0, "unordered y");
    return ax >= 0 || Math.abs(ax) < ay;
  }
  function legalize(tcx, t) {
    for (var i = 0;i < 3; ++i) {
      if (t.delaunay_edge[i]) {
        continue;
      }
      var ot = t.getNeighbor(i);
      if (ot) {
        var p = t.getPoint(i);
        var op = ot.oppositePoint(t, p);
        var oi = ot.index(op);
        if (ot.constrained_edge[oi] || ot.delaunay_edge[oi]) {
          t.constrained_edge[i] = ot.constrained_edge[oi];
          continue;
        }
        var inside = inCircle(p, t.pointCCW(p), t.pointCW(p), op);
        if (inside) {
          t.delaunay_edge[i] = true;
          ot.delaunay_edge[oi] = true;
          rotateTrianglePair(t, p, ot, op);
          var not_legalized = !legalize(tcx, t);
          if (not_legalized) {
            tcx.mapTriangleToNodes(t);
          }
          not_legalized = !legalize(tcx, ot);
          if (not_legalized) {
            tcx.mapTriangleToNodes(ot);
          }
          t.delaunay_edge[i] = false;
          ot.delaunay_edge[oi] = false;
          return true;
        }
      }
    }
    return false;
  }
  function inCircle(pa, pb, pc, pd) {
    var adx = pa.x - pd.x;
    var ady = pa.y - pd.y;
    var bdx = pb.x - pd.x;
    var bdy = pb.y - pd.y;
    var adxbdy = adx * bdy;
    var bdxady = bdx * ady;
    var oabd = adxbdy - bdxady;
    if (oabd <= 0) {
      return false;
    }
    var cdx = pc.x - pd.x;
    var cdy = pc.y - pd.y;
    var cdxady = cdx * ady;
    var adxcdy = adx * cdy;
    var ocad = cdxady - adxcdy;
    if (ocad <= 0) {
      return false;
    }
    var bdxcdy = bdx * cdy;
    var cdxbdy = cdx * bdy;
    var alift = adx * adx + ady * ady;
    var blift = bdx * bdx + bdy * bdy;
    var clift = cdx * cdx + cdy * cdy;
    var det = alift * (bdxcdy - cdxbdy) + blift * ocad + clift * oabd;
    return det > 0;
  }
  function rotateTrianglePair(t, p, ot, op) {
    var n1, n2, n3, n4;
    n1 = t.neighborCCW(p);
    n2 = t.neighborCW(p);
    n3 = ot.neighborCCW(op);
    n4 = ot.neighborCW(op);
    var ce1, ce2, ce3, ce4;
    ce1 = t.getConstrainedEdgeCCW(p);
    ce2 = t.getConstrainedEdgeCW(p);
    ce3 = ot.getConstrainedEdgeCCW(op);
    ce4 = ot.getConstrainedEdgeCW(op);
    var de1, de2, de3, de4;
    de1 = t.getDelaunayEdgeCCW(p);
    de2 = t.getDelaunayEdgeCW(p);
    de3 = ot.getDelaunayEdgeCCW(op);
    de4 = ot.getDelaunayEdgeCW(op);
    t.legalize(p, op);
    ot.legalize(op, p);
    ot.setDelaunayEdgeCCW(p, de1);
    t.setDelaunayEdgeCW(p, de2);
    t.setDelaunayEdgeCCW(op, de3);
    ot.setDelaunayEdgeCW(op, de4);
    ot.setConstrainedEdgeCCW(p, ce1);
    t.setConstrainedEdgeCW(p, ce2);
    t.setConstrainedEdgeCCW(op, ce3);
    ot.setConstrainedEdgeCW(op, ce4);
    t.clearNeighbors();
    ot.clearNeighbors();
    if (n1) {
      ot.markNeighbor(n1);
    }
    if (n2) {
      t.markNeighbor(n2);
    }
    if (n3) {
      t.markNeighbor(n3);
    }
    if (n4) {
      ot.markNeighbor(n4);
    }
    t.markNeighbor(ot);
  }
  function fillBasin(tcx, node) {
    if (orient2d(node.point, node.next.point, node.next.next.point) === Orientation.CCW) {
      tcx.basin.left_node = node.next.next;
    } else {
      tcx.basin.left_node = node.next;
    }
    tcx.basin.bottom_node = tcx.basin.left_node;
    while (tcx.basin.bottom_node.next && tcx.basin.bottom_node.point.y >= tcx.basin.bottom_node.next.point.y) {
      tcx.basin.bottom_node = tcx.basin.bottom_node.next;
    }
    if (tcx.basin.bottom_node === tcx.basin.left_node) {
      return;
    }
    tcx.basin.right_node = tcx.basin.bottom_node;
    while (tcx.basin.right_node.next && tcx.basin.right_node.point.y < tcx.basin.right_node.next.point.y) {
      tcx.basin.right_node = tcx.basin.right_node.next;
    }
    if (tcx.basin.right_node === tcx.basin.bottom_node) {
      return;
    }
    tcx.basin.width = tcx.basin.right_node.point.x - tcx.basin.left_node.point.x;
    tcx.basin.left_highest = tcx.basin.left_node.point.y > tcx.basin.right_node.point.y;
    fillBasinReq(tcx, tcx.basin.bottom_node);
  }
  function fillBasinReq(tcx, node) {
    if (isShallow(tcx, node)) {
      return;
    }
    fill(tcx, node);
    var o;
    if (node.prev === tcx.basin.left_node && node.next === tcx.basin.right_node) {
      return;
    } else if (node.prev === tcx.basin.left_node) {
      o = orient2d(node.point, node.next.point, node.next.next.point);
      if (o === Orientation.CW) {
        return;
      }
      node = node.next;
    } else if (node.next === tcx.basin.right_node) {
      o = orient2d(node.point, node.prev.point, node.prev.prev.point);
      if (o === Orientation.CCW) {
        return;
      }
      node = node.prev;
    } else {
      if (node.prev.point.y < node.next.point.y) {
        node = node.prev;
      } else {
        node = node.next;
      }
    }
    fillBasinReq(tcx, node);
  }
  function isShallow(tcx, node) {
    var height;
    if (tcx.basin.left_highest) {
      height = tcx.basin.left_node.point.y - node.point.y;
    } else {
      height = tcx.basin.right_node.point.y - node.point.y;
    }
    if (tcx.basin.width > height) {
      return true;
    }
    return false;
  }
  function fillEdgeEvent(tcx, edge, node) {
    if (tcx.edge_event.right) {
      fillRightAboveEdgeEvent(tcx, edge, node);
    } else {
      fillLeftAboveEdgeEvent(tcx, edge, node);
    }
  }
  function fillRightAboveEdgeEvent(tcx, edge, node) {
    while (node.next.point.x < edge.p.x) {
      if (orient2d(edge.q, node.next.point, edge.p) === Orientation.CCW) {
        fillRightBelowEdgeEvent(tcx, edge, node);
      } else {
        node = node.next;
      }
    }
  }
  function fillRightBelowEdgeEvent(tcx, edge, node) {
    if (node.point.x < edge.p.x) {
      if (orient2d(node.point, node.next.point, node.next.next.point) === Orientation.CCW) {
        fillRightConcaveEdgeEvent(tcx, edge, node);
      } else {
        fillRightConvexEdgeEvent(tcx, edge, node);
        fillRightBelowEdgeEvent(tcx, edge, node);
      }
    }
  }
  function fillRightConcaveEdgeEvent(tcx, edge, node) {
    fill(tcx, node.next);
    if (node.next.point !== edge.p) {
      if (orient2d(edge.q, node.next.point, edge.p) === Orientation.CCW) {
        if (orient2d(node.point, node.next.point, node.next.next.point) === Orientation.CCW) {
          fillRightConcaveEdgeEvent(tcx, edge, node);
        } else {}
      }
    }
  }
  function fillRightConvexEdgeEvent(tcx, edge, node) {
    if (orient2d(node.next.point, node.next.next.point, node.next.next.next.point) === Orientation.CCW) {
      fillRightConcaveEdgeEvent(tcx, edge, node.next);
    } else {
      if (orient2d(edge.q, node.next.next.point, edge.p) === Orientation.CCW) {
        fillRightConvexEdgeEvent(tcx, edge, node.next);
      } else {}
    }
  }
  function fillLeftAboveEdgeEvent(tcx, edge, node) {
    while (node.prev.point.x > edge.p.x) {
      if (orient2d(edge.q, node.prev.point, edge.p) === Orientation.CW) {
        fillLeftBelowEdgeEvent(tcx, edge, node);
      } else {
        node = node.prev;
      }
    }
  }
  function fillLeftBelowEdgeEvent(tcx, edge, node) {
    if (node.point.x > edge.p.x) {
      if (orient2d(node.point, node.prev.point, node.prev.prev.point) === Orientation.CW) {
        fillLeftConcaveEdgeEvent(tcx, edge, node);
      } else {
        fillLeftConvexEdgeEvent(tcx, edge, node);
        fillLeftBelowEdgeEvent(tcx, edge, node);
      }
    }
  }
  function fillLeftConvexEdgeEvent(tcx, edge, node) {
    if (orient2d(node.prev.point, node.prev.prev.point, node.prev.prev.prev.point) === Orientation.CW) {
      fillLeftConcaveEdgeEvent(tcx, edge, node.prev);
    } else {
      if (orient2d(edge.q, node.prev.prev.point, edge.p) === Orientation.CW) {
        fillLeftConvexEdgeEvent(tcx, edge, node.prev);
      } else {}
    }
  }
  function fillLeftConcaveEdgeEvent(tcx, edge, node) {
    fill(tcx, node.prev);
    if (node.prev.point !== edge.p) {
      if (orient2d(edge.q, node.prev.point, edge.p) === Orientation.CW) {
        if (orient2d(node.point, node.prev.point, node.prev.prev.point) === Orientation.CW) {
          fillLeftConcaveEdgeEvent(tcx, edge, node);
        } else {}
      }
    }
  }
  function flipEdgeEvent(tcx, ep, eq, t, p) {
    var ot = t.neighborAcross(p);
    assert(ot, "FLIP failed due to missing triangle!");
    var op = ot.oppositePoint(t, p);
    if (t.getConstrainedEdgeAcross(p)) {
      var index = t.index(p);
      throw new PointError("poly2tri Intersecting Constraints", [p, op, t.getPoint((index + 1) % 3), t.getPoint((index + 2) % 3)]);
    }
    if (inScanArea(p, t.pointCCW(p), t.pointCW(p), op)) {
      rotateTrianglePair(t, p, ot, op);
      tcx.mapTriangleToNodes(t);
      tcx.mapTriangleToNodes(ot);
      if (p === eq && op === ep) {
        if (eq === tcx.edge_event.constrained_edge.q && ep === tcx.edge_event.constrained_edge.p) {
          t.markConstrainedEdgeByPoints(ep, eq);
          ot.markConstrainedEdgeByPoints(ep, eq);
          legalize(tcx, t);
          legalize(tcx, ot);
        } else {}
      } else {
        var o = orient2d(eq, op, ep);
        t = nextFlipTriangle(tcx, o, t, ot, p, op);
        flipEdgeEvent(tcx, ep, eq, t, p);
      }
    } else {
      var newP = nextFlipPoint(ep, eq, ot, op);
      flipScanEdgeEvent(tcx, ep, eq, t, ot, newP);
      edgeEventByPoints(tcx, ep, eq, t, p);
    }
  }
  function nextFlipTriangle(tcx, o, t, ot, p, op) {
    var edge_index;
    if (o === Orientation.CCW) {
      edge_index = ot.edgeIndex(p, op);
      ot.delaunay_edge[edge_index] = true;
      legalize(tcx, ot);
      ot.clearDelaunayEdges();
      return t;
    }
    edge_index = t.edgeIndex(p, op);
    t.delaunay_edge[edge_index] = true;
    legalize(tcx, t);
    t.clearDelaunayEdges();
    return ot;
  }
  function nextFlipPoint(ep, eq, ot, op) {
    var o2d = orient2d(eq, op, ep);
    if (o2d === Orientation.CW) {
      return ot.pointCCW(op);
    } else if (o2d === Orientation.CCW) {
      return ot.pointCW(op);
    } else {
      throw new PointError("poly2tri [Unsupported] nextFlipPoint: opposing point on constrained edge!", [eq, op, ep]);
    }
  }
  function flipScanEdgeEvent(tcx, ep, eq, flip_triangle, t, p) {
    var ot = t.neighborAcross(p);
    assert(ot, "FLIP failed due to missing triangle");
    var op = ot.oppositePoint(t, p);
    if (inScanArea(eq, flip_triangle.pointCCW(eq), flip_triangle.pointCW(eq), op)) {
      flipEdgeEvent(tcx, eq, op, ot, op);
    } else {
      var newP = nextFlipPoint(ep, eq, ot, op);
      flipScanEdgeEvent(tcx, ep, eq, flip_triangle, ot, newP);
    }
  }
  exports.triangulate = triangulate;
});

// ../../node_modules/.pnpm/poly2tri@1.5.0/node_modules/poly2tri/src/sweepcontext.js
var require_sweepcontext = __commonJS((exports, module) => {
  var PointError = require_pointerror();
  var Point = require_point();
  var Triangle = require_triangle();
  var sweep = require_sweep();
  var AdvancingFront = require_advancingfront();
  var Node = AdvancingFront.Node;
  var kAlpha = 0.3;
  var Edge = function(p1, p2) {
    this.p = p1;
    this.q = p2;
    if (p1.y > p2.y) {
      this.q = p1;
      this.p = p2;
    } else if (p1.y === p2.y) {
      if (p1.x > p2.x) {
        this.q = p1;
        this.p = p2;
      } else if (p1.x === p2.x) {
        throw new PointError("poly2tri Invalid Edge constructor: repeated points!", [p1]);
      }
    }
    if (!this.q._p2t_edge_list) {
      this.q._p2t_edge_list = [];
    }
    this.q._p2t_edge_list.push(this);
  };
  var Basin = function() {
    this.left_node = null;
    this.bottom_node = null;
    this.right_node = null;
    this.width = 0;
    this.left_highest = false;
  };
  Basin.prototype.clear = function() {
    this.left_node = null;
    this.bottom_node = null;
    this.right_node = null;
    this.width = 0;
    this.left_highest = false;
  };
  var EdgeEvent = function() {
    this.constrained_edge = null;
    this.right = false;
  };
  var SweepContext = function(contour, options) {
    options = options || {};
    this.triangles_ = [];
    this.map_ = [];
    this.points_ = options.cloneArrays ? contour.slice(0) : contour;
    this.edge_list = [];
    this.pmin_ = this.pmax_ = null;
    this.front_ = null;
    this.head_ = null;
    this.tail_ = null;
    this.af_head_ = null;
    this.af_middle_ = null;
    this.af_tail_ = null;
    this.basin = new Basin;
    this.edge_event = new EdgeEvent;
    this.initEdges(this.points_);
  };
  SweepContext.prototype.addHole = function(polyline) {
    this.initEdges(polyline);
    var i, len = polyline.length;
    for (i = 0;i < len; i++) {
      this.points_.push(polyline[i]);
    }
    return this;
  };
  SweepContext.prototype.AddHole = SweepContext.prototype.addHole;
  SweepContext.prototype.addHoles = function(holes) {
    var i, len = holes.length;
    for (i = 0;i < len; i++) {
      this.initEdges(holes[i]);
    }
    this.points_ = this.points_.concat.apply(this.points_, holes);
    return this;
  };
  SweepContext.prototype.addPoint = function(point) {
    this.points_.push(point);
    return this;
  };
  SweepContext.prototype.AddPoint = SweepContext.prototype.addPoint;
  SweepContext.prototype.addPoints = function(points) {
    this.points_ = this.points_.concat(points);
    return this;
  };
  SweepContext.prototype.triangulate = function() {
    sweep.triangulate(this);
    return this;
  };
  SweepContext.prototype.getBoundingBox = function() {
    return { min: this.pmin_, max: this.pmax_ };
  };
  SweepContext.prototype.getTriangles = function() {
    return this.triangles_;
  };
  SweepContext.prototype.GetTriangles = SweepContext.prototype.getTriangles;
  SweepContext.prototype.front = function() {
    return this.front_;
  };
  SweepContext.prototype.pointCount = function() {
    return this.points_.length;
  };
  SweepContext.prototype.head = function() {
    return this.head_;
  };
  SweepContext.prototype.setHead = function(p1) {
    this.head_ = p1;
  };
  SweepContext.prototype.tail = function() {
    return this.tail_;
  };
  SweepContext.prototype.setTail = function(p1) {
    this.tail_ = p1;
  };
  SweepContext.prototype.getMap = function() {
    return this.map_;
  };
  SweepContext.prototype.initTriangulation = function() {
    var xmax = this.points_[0].x;
    var xmin = this.points_[0].x;
    var ymax = this.points_[0].y;
    var ymin = this.points_[0].y;
    var i, len = this.points_.length;
    for (i = 1;i < len; i++) {
      var p = this.points_[i];
      p.x > xmax && (xmax = p.x);
      p.x < xmin && (xmin = p.x);
      p.y > ymax && (ymax = p.y);
      p.y < ymin && (ymin = p.y);
    }
    this.pmin_ = new Point(xmin, ymin);
    this.pmax_ = new Point(xmax, ymax);
    var dx = kAlpha * (xmax - xmin);
    var dy = kAlpha * (ymax - ymin);
    this.head_ = new Point(xmax + dx, ymin - dy);
    this.tail_ = new Point(xmin - dx, ymin - dy);
    this.points_.sort(Point.compare);
  };
  SweepContext.prototype.initEdges = function(polyline) {
    var i, len = polyline.length;
    for (i = 0;i < len; ++i) {
      this.edge_list.push(new Edge(polyline[i], polyline[(i + 1) % len]));
    }
  };
  SweepContext.prototype.getPoint = function(index) {
    return this.points_[index];
  };
  SweepContext.prototype.addToMap = function(triangle) {
    this.map_.push(triangle);
  };
  SweepContext.prototype.locateNode = function(point) {
    return this.front_.locateNode(point.x);
  };
  SweepContext.prototype.createAdvancingFront = function() {
    var head;
    var middle;
    var tail;
    var triangle = new Triangle(this.points_[0], this.tail_, this.head_);
    this.map_.push(triangle);
    head = new Node(triangle.getPoint(1), triangle);
    middle = new Node(triangle.getPoint(0), triangle);
    tail = new Node(triangle.getPoint(2));
    this.front_ = new AdvancingFront(head, tail);
    head.next = middle;
    middle.next = tail;
    middle.prev = head;
    tail.prev = middle;
  };
  SweepContext.prototype.removeNode = function(node) {};
  SweepContext.prototype.mapTriangleToNodes = function(t) {
    for (var i = 0;i < 3; ++i) {
      if (!t.getNeighbor(i)) {
        var n = this.front_.locatePoint(t.pointCW(t.getPoint(i)));
        if (n) {
          n.triangle = t;
        }
      }
    }
  };
  SweepContext.prototype.removeFromMap = function(triangle) {
    var i, map = this.map_, len = map.length;
    for (i = 0;i < len; i++) {
      if (map[i] === triangle) {
        map.splice(i, 1);
        break;
      }
    }
  };
  SweepContext.prototype.meshClean = function(triangle) {
    var triangles = [triangle], t, i;
    while (t = triangles.pop()) {
      if (!t.isInterior()) {
        t.setInterior(true);
        this.triangles_.push(t);
        for (i = 0;i < 3; i++) {
          if (!t.constrained_edge[i]) {
            triangles.push(t.getNeighbor(i));
          }
        }
      }
    }
  };
  module.exports = SweepContext;
});

// ../../node_modules/.pnpm/poly2tri@1.5.0/node_modules/poly2tri/src/poly2tri.js
var require_poly2tri = __commonJS((exports) => {
  var previousPoly2tri = global.poly2tri;
  exports.noConflict = function() {
    global.poly2tri = previousPoly2tri;
    return exports;
  };
  exports.VERSION = require_version().version;
  exports.PointError = require_pointerror();
  exports.Point = require_point();
  exports.Triangle = require_triangle();
  exports.SweepContext = require_sweepcontext();
  var sweep = require_sweep();
  exports.triangulate = sweep.triangulate;
  exports.sweep = { Triangulate: sweep.triangulate };
});

// package.json
var require_package = __commonJS((exports, module) => {
  module.exports = {
    name: "@hiero/cli",
    version: "0.2.0",
    description: "Hiero CLI — repo-native icon authoring for host repositories",
    author: "taehee-pd <j.taehee@icloud.com>",
    license: "MIT",
    homepage: "https://github.com/taehee-pd/icon-authoring-tool/tree/main/packages/hiero-cli#readme",
    repository: {
      type: "git",
      url: "https://github.com/taehee-pd/icon-authoring-tool.git",
      directory: "packages/hiero-cli"
    },
    bugs: {
      url: "https://github.com/taehee-pd/icon-authoring-tool/issues"
    },
    bin: {
      hiero: "./dist/bin.js"
    },
    engines: {
      node: ">=18"
    },
    keywords: [
      "hiero",
      "icons",
      "icon-authoring",
      "cli",
      "svg",
      "design-system"
    ],
    type: "module",
    files: [
      "dist",
      "README.md"
    ],
    publishConfig: {
      access: "public",
      provenance: true
    },
    scripts: {
      build: "bun build src/bin.ts --outfile dist/bin.js --target node",
      prepare: "bun run build",
      prepublishOnly: "bun run build"
    }
  };
});

// src/commands/init.ts
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createInterface } from "node:readline/promises";
var DEFAULTS = {
  sourceDir: "hiero",
  releaseTarget: "local-directory",
  outputDir: "src/icons/generated"
};
function configTemplate(d) {
  const releaseBlock = d.releaseTarget === "local-directory" ? `  releaseTargets: [
    {
      kind: 'local-directory',
      outputMode: 'snapshot',
      outputDir: '${d.outputDir}',
    },
  ],` : d.releaseTarget === "git-pr" ? `  releaseTargets: [
    {
      kind: 'git-pr',
      outputMode: 'snapshot',
      owner: 'YOUR_GITHUB_OWNER',
      repo: 'YOUR_GITHUB_REPO',
      baseBranch: 'main',
    },
  ],
  // Set HIERO_GITHUB_TOKEN in .env.local (and confirm .env.local is in
  // .gitignore) before running \`hiero build\` against this target.` : `  releaseTargets: [
    {
      kind: 'npm-registry',
      outputMode: 'snapshot',
      packageName: '@your-org/icons',
    },
  ],
  // Set NPM_TOKEN in .env.local (and confirm .env.local is in
  // .gitignore) before running \`hiero build\` against this target.`;
  return `import type { HieroConfig } from '@hiero/cli';

export default {
  sourceDir: '${d.sourceDir}',
  hostTargets: [
    {
      kind: 'react-app',
      mode: 'live',
      runtimeMode: 'cache-dir',
      cacheDir: '.hiero/cache/app',
    },
  ],
${releaseBlock}
} satisfies HieroConfig;
`;
}
function emptyManifest() {
  return JSON.stringify({
    schemaVersion: "1.0.0",
    generatedAt: new Date().toISOString(),
    iconCount: 0,
    icons: {}
  }, null, 2) + `
`;
}
function defaultIO() {
  let rl = null;
  return {
    log: (message) => {
      console.log(message);
    },
    prompt: async (question, defaultValue) => {
      if (!rl)
        rl = createInterface({ input: process.stdin, output: process.stdout });
      const suffix = defaultValue ? ` (${defaultValue})` : "";
      const answer = await rl.question(`${question}${suffix} `);
      return answer.trim() || defaultValue || "";
    },
    dispose: () => {
      rl?.close();
      rl = null;
    }
  };
}
async function runHealthChecks(cwd) {
  const out = [];
  const configPath = path.join(cwd, "hiero.config.ts");
  if (existsSync(configPath)) {
    out.push({
      name: "hiero.config.ts",
      status: "ok",
      detail: "present"
    });
  } else {
    out.push({
      name: "hiero.config.ts",
      status: "fail",
      detail: "missing — run `hiero init`"
    });
  }
  const envLocal = path.join(cwd, ".env.local");
  const gitignore = path.join(cwd, ".gitignore");
  if (existsSync(envLocal)) {
    let gitignored = false;
    if (existsSync(gitignore)) {
      const text = await readFile(gitignore, "utf8");
      gitignored = /(^|\n)\.env\.local(\n|$)/.test(text);
    }
    out.push({
      name: ".env.local",
      status: gitignored ? "ok" : "fail",
      detail: gitignored ? "gitignored" : "present but NOT in .gitignore — risk of leaking credentials"
    });
  }
  const ghToken = process.env.HIERO_GITHUB_TOKEN ?? process.env.GITHUB_TOKEN;
  out.push({
    name: "GitHub token",
    status: ghToken ? "ok" : "warn",
    detail: ghToken ? "env var set" : "not set — required for git-pr release target"
  });
  const npmrc = path.join(cwd, ".npmrc");
  const npmrcHome = path.join(process.env.HOME ?? "", ".npmrc");
  const npmAuthDetected = !!process.env.NPM_TOKEN || existsSync(npmrc) && /(^|\n)(?:\/\/[^=]+:_authToken|_authToken)/.test(await readFile(npmrc, "utf8").catch(() => "")) || existsSync(npmrcHome) && /(^|\n)(?:\/\/[^=]+:_authToken|_authToken)/.test(await readFile(npmrcHome, "utf8").catch(() => ""));
  out.push({
    name: "npm credentials",
    status: npmAuthDetected ? "ok" : "warn",
    detail: npmAuthDetected ? "token or .npmrc auth detected" : "no NPM_TOKEN env var or .npmrc auth — required for npm-registry target"
  });
  return out;
}
async function runInit(cwd, flags, io = defaultIO()) {
  try {
    return await runInitInner(cwd, flags, io);
  } finally {
    io.dispose?.();
  }
}
async function runInitInner(cwd, flags, io) {
  if (flags["check"]) {
    const checks2 = await runHealthChecks(cwd);
    let allOk = true;
    for (const c of checks2) {
      const icon = c.status === "ok" ? "✅" : c.status === "warn" ? "⚠️ " : "❌";
      io.log(`  ${icon}  ${c.name}: ${c.detail}`);
      if (c.status === "fail")
        allOk = false;
    }
    if (!allOk)
      process.exitCode = 1;
    return;
  }
  const yes = !!flags["yes"] || flags["y"] === true;
  const interactive = !yes && !!process.stdin.isTTY;
  let defaults = DEFAULTS;
  if (interactive) {
    io.log("[hiero] Interactive setup. Press Enter to accept defaults.");
    const sourceDir = await io.prompt("Source directory:", DEFAULTS.sourceDir);
    const releaseTargetRaw = await io.prompt("Release target [local-directory|git-pr|npm-registry]:", DEFAULTS.releaseTarget);
    const releaseTarget = releaseTargetRaw === "git-pr" || releaseTargetRaw === "npm-registry" ? releaseTargetRaw : "local-directory";
    let outputDir = DEFAULTS.outputDir;
    if (releaseTarget === "local-directory") {
      outputDir = await io.prompt("Output directory:", DEFAULTS.outputDir);
    }
    defaults = { sourceDir, releaseTarget, outputDir };
  }
  const configPath = path.join(cwd, "hiero.config.ts");
  const sourceDirPath = path.join(cwd, defaults.sourceDir);
  const iconsDirPath = path.join(sourceDirPath, "icons");
  const manifestPath = path.join(sourceDirPath, "manifest.json");
  let anyCreated = false;
  if (!existsSync(configPath)) {
    await writeFile(configPath, configTemplate(defaults), "utf8");
    log(io, "created", "hiero.config.ts");
    anyCreated = true;
  } else {
    log(io, "exists ", "hiero.config.ts");
  }
  if (!existsSync(sourceDirPath)) {
    await mkdir(sourceDirPath, { recursive: true });
    log(io, "created", `${defaults.sourceDir}/`);
    anyCreated = true;
  }
  if (!existsSync(iconsDirPath)) {
    await mkdir(iconsDirPath, { recursive: true });
    log(io, "created", `${defaults.sourceDir}/icons/`);
    anyCreated = true;
  }
  if (!existsSync(manifestPath)) {
    await writeFile(manifestPath, emptyManifest(), "utf8");
    log(io, "created", `${defaults.sourceDir}/manifest.json`);
    anyCreated = true;
  }
  const checks = await runHealthChecks(cwd);
  io.log("");
  io.log("[hiero] Setup health:");
  for (const c of checks) {
    const icon = c.status === "ok" ? "✅" : c.status === "warn" ? "⚠️ " : "❌";
    io.log(`  ${icon}  ${c.name}: ${c.detail}`);
  }
  if (anyCreated) {
    io.log(`
[hiero] Initialized successfully.

Next steps:
  1.  Run \`hiero dev\` to start the live integration server
  2.  Open the Hiero editor and connect to this repository
       (set the dev server URL to http://localhost:4400)
  3.  Publish icons from the editor — they will appear in ${defaults.sourceDir}/icons/
  4.  Run \`hiero build\` to produce a snapshot build for CI
  5.  Commit ${defaults.sourceDir}/ to version-control as your canonical icon source

If you picked git-pr or npm-registry, set the matching token in .env.local
(and verify .env.local is gitignored). Run \`hiero init --check\` any time
to re-run the health checks.

See docs at https://hiero.dev/docs/getting-started`);
  } else {
    io.log("[hiero] Already initialized — nothing to create.");
  }
}
function log(io, action, file) {
  io.log(`  ${action}  ${file}`);
}

// src/commands/dev.ts
import path8 from "node:path";
import { existsSync as existsSync2 } from "node:fs";

// ../../lib/install-config/validate-config.ts
var ALLOWED_HOST_KINDS = new Set(["react-app", "reference-app"]);
var ALLOWED_RUNTIME_MODES = new Set(["in-memory", "cache-dir", "vendored"]);
var ALLOWED_RELEASE_KINDS = new Set(["local-directory", "git-pr", "npm-registry"]);
function validateConfig(config) {
  const errors = [];
  if (!isObject(config)) {
    return { valid: false, errors: [{ field: "config", message: "Config must be a non-null object." }] };
  }
  validateSourceDir(config, errors);
  validateHostTargets(config, errors);
  validateReleaseTargets(config, errors);
  return errors.length === 0 ? { valid: true } : { valid: false, errors };
}
function validateSourceDir(config, errors) {
  const { sourceDir } = config;
  if (typeof sourceDir !== "string" || sourceDir.trim() === "") {
    errors.push({ field: "sourceDir", message: "sourceDir is required and must be a non-empty string." });
    return;
  }
  validateRepoRelativePath("sourceDir", sourceDir, errors);
}
function validateHostTargets(config, errors) {
  const { hostTargets } = config;
  if (!Array.isArray(hostTargets)) {
    errors.push({ field: "hostTargets", message: "hostTargets must be an array." });
    return;
  }
  hostTargets.forEach((target, i) => {
    const prefix = `hostTargets[${i}]`;
    if (!isObject(target)) {
      errors.push({ field: prefix, message: "Each host target must be a non-null object." });
      return;
    }
    validateHostTarget(target, prefix, errors);
  });
}
function validateHostTarget(target, prefix, errors) {
  const { kind, mode, runtimeMode, cacheDir } = target;
  if (!kind || !ALLOWED_HOST_KINDS.has(String(kind))) {
    errors.push({
      field: `${prefix}.kind`,
      message: `kind must be one of: ${[...ALLOWED_HOST_KINDS].join(", ")}.`
    });
  }
  if (mode !== "live") {
    errors.push({ field: `${prefix}.mode`, message: "mode must be 'live'." });
  }
  if (!runtimeMode || !ALLOWED_RUNTIME_MODES.has(String(runtimeMode))) {
    errors.push({
      field: `${prefix}.runtimeMode`,
      message: `runtimeMode must be one of: ${[...ALLOWED_RUNTIME_MODES].join(", ")}.`
    });
  }
  if (runtimeMode === "cache-dir") {
    if (!cacheDir || typeof cacheDir !== "string" || cacheDir.trim() === "") {
      errors.push({
        field: `${prefix}.cacheDir`,
        message: "cacheDir is required when runtimeMode is 'cache-dir'."
      });
    } else {
      validateRepoRelativePath(`${prefix}.cacheDir`, cacheDir, errors);
    }
  }
  rejectInlineCredentials(target, prefix, errors);
}
function validateReleaseTargets(config, errors) {
  const { releaseTargets } = config;
  if (releaseTargets === undefined || releaseTargets === null) {
    return;
  }
  if (!Array.isArray(releaseTargets)) {
    errors.push({ field: "releaseTargets", message: "releaseTargets must be an array when present." });
    return;
  }
  releaseTargets.forEach((target, i) => {
    const prefix = `releaseTargets[${i}]`;
    if (!isObject(target)) {
      errors.push({ field: prefix, message: "Each release target must be a non-null object." });
      return;
    }
    validateReleaseTarget(target, prefix, errors);
  });
}
function validateReleaseTarget(target, prefix, errors) {
  const { kind } = target;
  if (!kind || !ALLOWED_RELEASE_KINDS.has(String(kind))) {
    errors.push({
      field: `${prefix}.kind`,
      message: `kind must be one of: ${[...ALLOWED_RELEASE_KINDS].join(", ")}.`
    });
    return;
  }
  if (kind === "local-directory") {
    const { outputMode, outputDir } = target;
    if (outputMode !== "snapshot") {
      errors.push({ field: `${prefix}.outputMode`, message: "outputMode must be 'snapshot'." });
    }
    if (!outputDir || typeof outputDir !== "string" || outputDir.trim() === "") {
      errors.push({ field: `${prefix}.outputDir`, message: "outputDir is required and must be a non-empty string." });
    } else {
      validateRepoRelativePath(`${prefix}.outputDir`, outputDir, errors);
    }
  }
  if (kind === "git-pr") {
    const { outputMode, owner, repo, baseBranch, packagePath } = target;
    if (outputMode !== "snapshot") {
      errors.push({ field: `${prefix}.outputMode`, message: "outputMode must be 'snapshot'." });
    }
    if (!owner || typeof owner !== "string" || owner.trim() === "") {
      errors.push({ field: `${prefix}.owner`, message: "owner is required and must be a non-empty string." });
    }
    if (!repo || typeof repo !== "string" || repo.trim() === "") {
      errors.push({ field: `${prefix}.repo`, message: "repo is required and must be a non-empty string." });
    }
    if (!baseBranch || typeof baseBranch !== "string" || baseBranch.trim() === "") {
      errors.push({ field: `${prefix}.baseBranch`, message: "baseBranch is required and must be a non-empty string." });
    }
    if (packagePath !== undefined) {
      if (typeof packagePath !== "string" || packagePath.trim() === "") {
        errors.push({ field: `${prefix}.packagePath`, message: "packagePath must be a non-empty string when provided." });
      } else {
        validateRepoRelativePath(`${prefix}.packagePath`, packagePath, errors);
      }
    }
  }
  if (kind === "npm-registry") {
    const { outputMode, packageName } = target;
    if (outputMode !== "snapshot") {
      errors.push({ field: `${prefix}.outputMode`, message: "outputMode must be 'snapshot'." });
    }
    if (!packageName || typeof packageName !== "string" || packageName.trim() === "") {
      errors.push({ field: `${prefix}.packageName`, message: "packageName is required and must be a non-empty string." });
    }
  }
  rejectInlineCredentials(target, prefix, errors);
}
function validateRepoRelativePath(field, value, errors) {
  if (path2.isAbsolute(value)) {
    errors.push({ field, message: `${field} must be a relative path.` });
    return;
  }
  if (escapesRoot(value)) {
    errors.push({ field, message: `${field} must not escape the repo root.` });
  }
}
function rejectInlineCredentials(target, prefix, errors) {
  const secretLike = ["token", "secret", "password", "key", "auth"];
  for (const [field, value] of Object.entries(target)) {
    if (secretLike.some((s) => field.toLowerCase().includes(s)) && typeof value === "string" && value.trim() !== "") {
      errors.push({
        field: `${prefix}.${field}`,
        message: `Config must not store credentials. Move "${field}" to the platform keychain.`
      });
    }
  }
}
function escapesRoot(p) {
  const parts = p.replace(/\\/g, "/").split("/");
  let depth = 0;
  for (const part of parts) {
    if (part === "" || part === ".")
      continue;
    if (part === "..") {
      depth--;
      if (depth < 0)
        return true;
    } else {
      depth++;
    }
  }
  return false;
}
var path2 = {
  isAbsolute(p) {
    return p.startsWith("/") || /^[A-Za-z]:[/\\]/.test(p);
  }
};
function isObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
// ../../lib/install-config/load-config.ts
function loadConfig(raw, configPath) {
  const label = configPath ?? "hiero.config.ts";
  if (raw === null || raw === undefined) {
    return { ok: false, error: `${label}: default export is missing or undefined.` };
  }
  const result = validateConfig(raw);
  if (!result.valid) {
    const messages = result.errors.map((e) => `  • ${e.field}: ${e.message}`).join(`
`);
    return { ok: false, error: `${label} is invalid:
${messages}` };
  }
  const config = raw;
  return { ok: true, config: normalizeConfig(config) };
}
function normalizeConfig(config) {
  return {
    ...config,
    sourceDir: config.sourceDir.replace(/\/$/, ""),
    hostTargets: config.hostTargets.map((t) => {
      if (t.runtimeMode === "cache-dir" && t.cacheDir) {
        return { ...t, cacheDir: t.cacheDir.replace(/\/$/, "") };
      }
      return t;
    }),
    releaseTargets: config.releaseTargets ?? []
  };
}
// ../../lib/live-sync/dev-server.ts
import { createServer } from "node:http";
import { mkdir as mkdir3, writeFile as writeFile3 } from "node:fs/promises";
import path7 from "node:path";

// ../../lib/live-sync/incremental-rebuild.ts
import path5 from "node:path";

// ../../lib/schema/guards.ts
function isObject2(val) {
  return typeof val === "object" && val !== null && !Array.isArray(val);
}
function isProject(val) {
  if (!isObject2(val))
    return false;
  if (val.version !== "1.0")
    return false;
  if (!isObject2(val.meta))
    return false;
  if (typeof val.meta.name !== "string")
    return false;
  if (!isObject2(val.icons))
    return false;
  for (const icon of Object.values(val.icons)) {
    if (!isIcon(icon))
      return false;
  }
  return true;
}
function isIcon(val) {
  if (!isObject2(val))
    return false;
  if (typeof val.id !== "string")
    return false;
  if (typeof val.name !== "string")
    return false;
  if (!isObject2(val.variants))
    return false;
  return true;
}

// ../../lib/sync-source/types.ts
var ICON_SOURCE_SCHEMA_VERSION = "1.0.0";
var SYNC_SOURCE_MANIFEST_SCHEMA_VERSION = "1.0.0";

// ../../lib/sync-source/export-icon-source.ts
function exportIconSource(icon) {
  const variants = {};
  for (const [variantId, variant] of sortedEntries(icon.variants)) {
    const layers = {};
    for (const [layerId, layer] of sortedEntries(variant.layers)) {
      layers[layerId] = stripLayer(layer);
    }
    variants[variantId] = {
      id: variant.id,
      ...variant.name ? { name: variant.name } : {},
      size: variant.size,
      viewBox: variant.viewBox,
      ...variant.renderingMode ? { renderingMode: variant.renderingMode } : {},
      ...variant.weight ? { weight: variant.weight } : {},
      ...variant.scale ? { scale: variant.scale } : {},
      layers,
      ...variant.topology ? { topology: variant.topology } : {}
    };
  }
  const source = {
    schemaVersion: ICON_SOURCE_SCHEMA_VERSION,
    id: icon.id,
    name: icon.name,
    ...icon.category ? { category: icon.category } : {},
    ...icon.tags && icon.tags.length > 0 ? { tags: [...icon.tags].sort((a, b) => a.localeCompare(b)) } : {},
    variants,
    ...icon.transitions && Object.keys(icon.transitions).length > 0 ? { transitions: icon.transitions } : {},
    ...icon.effects && Object.keys(icon.effects).length > 0 ? { effects: icon.effects } : {}
  };
  return source;
}
function stripLayer(layer) {
  const source = {
    id: layer.id,
    ...layer.role ? { role: layer.role } : {},
    ...layer.visible === false ? { visible: false } : {},
    ...layer.clipPathLayerId ? { clipPathLayerId: layer.clipPathLayerId } : {},
    ...layer.drawOrder !== undefined && layer.drawOrder !== 1 ? { drawOrder: layer.drawOrder } : {},
    ...layer.path ? { path: layer.path } : {},
    style: layer.style,
    ...layer.transform ? { transform: layer.transform } : {}
  };
  return source;
}
function sortedEntries(record) {
  return Object.entries(record).sort(([a], [b]) => a.localeCompare(b));
}

// ../../lib/sync-source/export-manifest.ts
function generateSyncSourceManifest(entries, generatedAt) {
  const sorted = [...entries].sort((a, b) => a.source.id.localeCompare(b.source.id));
  const icons = {};
  for (const entry of sorted) {
    const { source } = entry;
    const sizes = Object.values(source.variants).map((v) => v.size).sort((a, b) => a - b);
    const uniqueSizes = [...new Set(sizes)];
    icons[source.id] = {
      id: source.id,
      name: source.name,
      ...source.category ? { category: source.category } : {},
      ...source.tags && source.tags.length > 0 ? { tags: source.tags } : {},
      variantCount: Object.keys(source.variants).length,
      sizes: uniqueSizes,
      hasTransitions: Boolean(source.transitions && Object.keys(source.transitions).length > 0),
      hasEffects: Boolean(source.effects && Object.keys(source.effects).length > 0),
      sourcePath: entry.sourcePath,
      previewPath: entry.previewPath
    };
  }
  return {
    schemaVersion: SYNC_SOURCE_MANIFEST_SCHEMA_VERSION,
    generatedAt,
    iconCount: sorted.length,
    icons
  };
}

// ../../lib/schema/types.ts
function buildDefaultIconType(v) {
  const fallbackType = Object.values(v.types ?? {})[0];
  return {
    id: v.defaultType ?? fallbackType?.id ?? "default",
    layers: v.layers ?? fallbackType?.layers ?? {},
    topology: v.topology ?? fallbackType?.topology
  };
}
function getVariantDefaultTypeId(v) {
  return v.defaultType ?? Object.keys(v.types ?? {})[0] ?? "default";
}
function getVariantType(v, typeId) {
  const resolvedTypeId = typeId ?? getVariantDefaultTypeId(v);
  const iconType = v.types?.[resolvedTypeId];
  if (iconType) {
    return {
      ...iconType,
      topology: iconType.topology ?? v.topology
    };
  }
  return buildDefaultIconType(v);
}

// ../../lib/rendering/resolve-layer-style.ts
var DEFAULT_RENDERING_MODE = "multicolor";
var ROLE_OPACITY = {
  primary: 1,
  secondary: 0.6,
  tertiary: 0.3
};
function resolveVariantRenderingMode(renderingMode) {
  return renderingMode ?? DEFAULT_RENDERING_MODE;
}
function resolveLayerStyleForRendering(layer, renderingMode, tokens) {
  const role = layer.role ?? "primary";
  const style = layer.style;
  let fill = style.fill;
  let stroke = style.stroke;
  let fillOpacity = style.fillOpacity;
  let strokeOpacity = style.strokeOpacity;
  let autoGradientFlag = false;
  if (renderingMode === "monochrome") {
    fill = coercePaint(fill, "currentColor");
    stroke = coercePaint(stroke, "currentColor");
  } else if (renderingMode === "hierarchical") {
    const opacity = ROLE_OPACITY[role] ?? ROLE_OPACITY.primary;
    fillOpacity = opacity;
    strokeOpacity = opacity;
  } else if (renderingMode === "palette") {
    const paletteColor = tokens?.[role];
    fill = coercePaint(fill, paletteColor);
    stroke = coercePaint(stroke, paletteColor);
  } else if (renderingMode === "autoGradient") {
    autoGradientFlag = true;
  }
  return {
    fill,
    stroke,
    fillOpacity,
    strokeOpacity,
    strokeWidth: style.strokeWidth,
    lineCap: style.lineCap,
    lineJoin: style.lineJoin,
    autoGradient: autoGradientFlag || undefined
  };
}
function coercePaint(paint, nextColor) {
  if (!hasVisiblePaint(paint))
    return paint;
  if (!nextColor)
    return paint;
  if (nextColor === "currentColor") {
    return { mode: "currentColor" };
  }
  return { mode: "fixed", value: nextColor };
}
function applyVariableValue(style, variableResult) {
  if (!variableResult.visible) {
    return {
      ...style,
      fillOpacity: 0,
      strokeOpacity: 0
    };
  }
  return {
    ...style,
    fillOpacity: style.fillOpacity != null ? style.fillOpacity * variableResult.opacity : variableResult.opacity,
    strokeOpacity: style.strokeOpacity != null ? style.strokeOpacity * variableResult.opacity : variableResult.opacity
  };
}
function hasVisiblePaint(paint) {
  if (!paint)
    return false;
  return !(paint.mode === "fixed" && paint.value === "none");
}

// ../../lib/runtime-core/variable-value.ts
var ROLE_THRESHOLDS = {
  primary: [0, 0.33],
  secondary: [0.33, 0.66],
  tertiary: [0.66, 1]
};
function computeVariableValue(layers, variableValue) {
  const clamped = Math.max(0, Math.min(1, variableValue));
  const result = {};
  for (const [layerId, layer] of Object.entries(layers)) {
    if (layer.visible === false) {
      result[layerId] = { opacity: 0, visible: false };
      continue;
    }
    const role = layer.role ?? "primary";
    const [start, end] = ROLE_THRESHOLDS[role] ?? ROLE_THRESHOLDS.primary;
    if (clamped <= start) {
      result[layerId] = { opacity: 0, visible: false };
    } else if (clamped >= end) {
      result[layerId] = { opacity: 1, visible: true };
    } else {
      const opacity = (clamped - start) / (end - start);
      result[layerId] = { opacity, visible: true };
    }
  }
  return result;
}

// ../../lib/export/export-svg.ts
function exportSvgString(icon, variantId, stateId, tokens, renderingMode) {
  const variant = icon.variants[variantId];
  if (!variant)
    return "";
  const state = getVariantType(variant, stateId);
  const effectiveRenderingMode = resolveVariantRenderingMode(renderingMode ?? variant.renderingMode);
  const [vx, vy, vw, vh] = variant.viewBox;
  const lines = [];
  const pathLines = [];
  const defs = new Map;
  lines.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vx} ${vy} ${vw} ${vh}" width="${variant.size}" height="${variant.size}" fill="none">`);
  const layers = Object.keys(state.layers).sort((a, b) => a.localeCompare(b)).map((id) => state.layers[id]);
  const layerById = new Map(layers.map((layer) => [layer.id, layer]));
  const variableValues = computeVariableValue(state.layers, variant.variableValue ?? 1);
  for (const layer of layers) {
    if (layer.visible === false || !layer.path?.d || layer.isClipMask)
      continue;
    const attrs = [];
    attrs.push(`id="${escapeAttr(layer.id)}"`);
    attrs.push(`d="${escapeAttr(layer.path.d)}"`);
    if (layer.path.fillRule) {
      attrs.push(`fill-rule="${layer.path.fillRule}"`);
    }
    const baseStyle = resolveLayerStyleForRendering(layer, effectiveRenderingMode, tokens);
    const resolvedStyle = applyVariableValue(baseStyle, variableValues[layer.id] ?? { opacity: 1, visible: true });
    const fill = resolvePaint(resolvedStyle.fill, layer.id, "fill", defs, tokens);
    if (fill !== "none") {
      attrs.push(`fill="${escapeAttr(fill)}"`);
    }
    const stroke = resolvePaint(resolvedStyle.stroke, layer.id, "stroke", defs, tokens);
    if (stroke !== "none") {
      attrs.push(`stroke="${escapeAttr(stroke)}"`);
    }
    if (resolvedStyle.strokeWidth !== undefined) {
      attrs.push(`stroke-width="${resolvedStyle.strokeWidth}"`);
    }
    if (resolvedStyle.fillOpacity !== undefined) {
      attrs.push(`fill-opacity="${resolvedStyle.fillOpacity}"`);
    }
    if (resolvedStyle.strokeOpacity !== undefined) {
      attrs.push(`stroke-opacity="${resolvedStyle.strokeOpacity}"`);
    }
    if (resolvedStyle.lineCap) {
      attrs.push(`stroke-linecap="${resolvedStyle.lineCap}"`);
    }
    if (resolvedStyle.lineJoin) {
      attrs.push(`stroke-linejoin="${resolvedStyle.lineJoin}"`);
    }
    const transform = buildTransform(layer);
    if (transform) {
      attrs.push(`transform="${escapeAttr(transform)}"`);
    }
    const clipPath = resolveClipPath(layer, layerById, defs);
    if (clipPath) {
      attrs.push(`clip-path="${escapeAttr(clipPath)}"`);
    }
    pathLines.push(`  <path ${attrs.join(" ")}/>`);
  }
  if (defs.size > 0) {
    lines.push("  <defs>");
    for (const definition of defs.values()) {
      lines.push(`    ${definition}`);
    }
    lines.push("  </defs>");
  }
  lines.push(...pathLines);
  lines.push("</svg>");
  return lines.join(`
`);
}
function resolvePaint(paint, layerId, role, defs, tokens) {
  if (!paint)
    return "none";
  switch (paint.mode) {
    case "currentColor":
      return "currentColor";
    case "fixed":
      return paint.value;
    case "token":
      return tokens?.[paint.token] ?? "currentColor";
    case "linearGradient": {
      const gradientId = buildGradientId(layerId, role);
      defs.set(gradientId, serializeLinearGradient(gradientId, paint));
      return `url(#${gradientId})`;
    }
    case "radialGradient": {
      const gradientId = buildGradientId(layerId, role);
      defs.set(gradientId, serializeRadialGradient(gradientId, paint));
      return `url(#${gradientId})`;
    }
    default:
      return "none";
  }
}
function buildTransform(layer) {
  const t = layer.transform;
  if (!t)
    return null;
  const parts = [];
  if (t.x !== undefined || t.y !== undefined) {
    parts.push(`translate(${t.x ?? 0}, ${t.y ?? 0})`);
  }
  if (t.rotate !== undefined) {
    parts.push(`rotate(${t.rotate})`);
  }
  if (t.scaleX !== undefined || t.scaleY !== undefined) {
    parts.push(`scale(${t.scaleX ?? 1}, ${t.scaleY ?? 1})`);
  }
  return parts.length > 0 ? parts.join(" ") : null;
}
function resolveClipPath(layer, layerById, defs) {
  const maskLayerId = layer.clipPathLayerId;
  if (!maskLayerId)
    return null;
  const maskLayer = layerById.get(maskLayerId);
  if (!isValidClipMaskLayer(maskLayer))
    return null;
  const clipPathId = buildClipPathId(layer.id);
  defs.set(clipPathId, serializeClipPath(clipPathId, maskLayer));
  return `url(#${clipPathId})`;
}
function escapeAttr(val) {
  return val.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}
function buildGradientId(layerId, role) {
  return `gradient-${layerId}-${role}`;
}
function buildClipPathId(layerId) {
  return `clip-${layerId}`;
}
function isValidClipMaskLayer(layer) {
  return Boolean(layer && layer.visible !== false && layer.path?.d);
}
function serializeClipPath(id, maskLayer) {
  const attrs = [
    `d="${escapeAttr(maskLayer.path.d)}"`
  ];
  if (maskLayer.path?.fillRule) {
    attrs.push(`fill-rule="${maskLayer.path.fillRule}"`);
  }
  const transform = buildTransform(maskLayer);
  if (transform) {
    attrs.push(`transform="${escapeAttr(transform)}"`);
  }
  return `<clipPath id="${escapeAttr(id)}"><path ${attrs.join(" ")}/></clipPath>`;
}
function serializeLinearGradient(id, paint) {
  const [x1, y1, x2, y2] = getLinearGradientVector(paint.angle);
  return `<linearGradient id="${escapeAttr(id)}" x1="${formatNumber(x1)}" y1="${formatNumber(y1)}" x2="${formatNumber(x2)}" y2="${formatNumber(y2)}">${serializeGradientStops(paint.stops)}</linearGradient>`;
}
function serializeRadialGradient(id, paint) {
  return `<radialGradient id="${escapeAttr(id)}" cx="${formatNumber(paint.cx)}" cy="${formatNumber(paint.cy)}" r="${formatNumber(paint.r)}">${serializeGradientStops(paint.stops)}</radialGradient>`;
}
function serializeGradientStops(stops) {
  return stops.map((stop) => {
    const attrs = [
      `offset="${formatNumber(stop.offset)}"`,
      `stop-color="${escapeAttr(stop.color)}"`
    ];
    if (stop.opacity !== undefined) {
      attrs.push(`stop-opacity="${formatNumber(stop.opacity)}"`);
    }
    return `<stop ${attrs.join(" ")}/>`;
  }).join("");
}
function getLinearGradientVector(angle) {
  const radians = angle * Math.PI / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const scale = 0.5 / Math.max(Math.abs(cos), Math.abs(sin), 0.000001);
  return [
    0.5 - cos * scale,
    0.5 - sin * scale,
    0.5 + cos * scale,
    0.5 + sin * scale
  ];
}
function formatNumber(value) {
  const rounded = Number(value.toFixed(6));
  return Object.is(rounded, -0) ? "0" : String(rounded);
}

// ../../lib/sync-source/export-preview.ts
function generatePreviewSvg(icon, tokens) {
  const variantIds = Object.keys(icon.variants).sort((a, b) => a.localeCompare(b));
  const variantId = variantIds[0];
  if (!variantId)
    return null;
  const variant = icon.variants[variantId];
  const svg = exportSvgString(icon, variantId, "", tokens, variant.renderingMode);
  return svg || null;
}

// ../../lib/sync-source/serialize.ts
function serializeSourceJson(value) {
  return `${JSON.stringify(sortValue(value), null, 2)}
`;
}
function sortValue(value) {
  if (Array.isArray(value)) {
    return value.map(sortValue);
  }
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, sortValue(v)]));
  }
  return value;
}

// ../../lib/sync-source/validate.ts
var VALID_ICON_DIR_NAME = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;
var MAX_ICON_DIR_NAME_LENGTH = 128;
function toIconDirName(name) {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
function isValidIconDirName(dirName) {
  return dirName.length > 0 && dirName.length <= MAX_ICON_DIR_NAME_LENGTH && VALID_ICON_DIR_NAME.test(dirName);
}
function containsPathTraversal(filePath) {
  const segments = filePath.split("/");
  return segments.some((segment) => segment === ".." || segment === "." || segment === "");
}
function validateIconsForExport(icons) {
  const errors = [];
  const seenIds = new Set;
  const seenDirNames = new Map;
  for (const [iconId, icon] of Object.entries(icons)) {
    if (!iconId || iconId.trim() === "") {
      errors.push({ kind: "empty-icon-id", message: "Icon has an empty id." });
      continue;
    }
    if (!icon.name || icon.name.trim() === "") {
      errors.push({
        kind: "empty-icon-name",
        message: `Icon "${iconId}" has an empty name.`
      });
      continue;
    }
    if (seenIds.has(iconId)) {
      errors.push({
        kind: "duplicate-icon-id",
        message: `Duplicate icon id: "${iconId}".`
      });
    }
    seenIds.add(iconId);
    const dirName = toIconDirName(icon.name);
    if (!isValidIconDirName(dirName)) {
      errors.push({
        kind: "invalid-icon-name",
        message: `Icon "${iconId}" produces invalid directory name: "${dirName}".`
      });
    }
    const existingIdForDir = seenDirNames.get(dirName);
    if (existingIdForDir && existingIdForDir !== iconId) {
      errors.push({
        kind: "duplicate-icon-dir",
        message: `Icons "${existingIdForDir}" and "${iconId}" both map to directory name "${dirName}".`
      });
    }
    seenDirNames.set(dirName, iconId);
    const testPath = `icons/${dirName}/icon.json`;
    if (containsPathTraversal(testPath)) {
      errors.push({
        kind: "path-traversal",
        message: `Icon "${iconId}" would produce a path with traversal: "${testPath}".`
      });
    }
  }
  return errors;
}
function validateSourcePayload(payload) {
  const errors = [];
  if (payload.manifest.iconCount !== payload.iconCount) {
    errors.push({
      kind: "manifest-count-mismatch",
      message: `Manifest declares ${payload.manifest.iconCount} icons but payload contains ${payload.iconCount}.`
    });
  }
  const filePaths = new Set(payload.files.map((f) => f.path));
  for (const entry of Object.values(payload.manifest.icons)) {
    if (!filePaths.has(entry.sourcePath)) {
      errors.push({
        kind: "manifest-missing-icon",
        message: `Manifest references "${entry.sourcePath}" but no file was generated.`
      });
    }
    if (!filePaths.has(entry.previewPath)) {
      errors.push({
        kind: "manifest-missing-icon",
        message: `Manifest references "${entry.previewPath}" but no file was generated.`
      });
    }
  }
  for (const file of payload.files) {
    if (file.path.includes("..")) {
      errors.push({
        kind: "path-traversal",
        message: `Generated file path contains traversal: "${file.path}".`
      });
    }
  }
  return errors;
}

// ../../lib/sync-source/export-source-payload.ts
function exportSourcePayload(project, options) {
  if (!isProject(project)) {
    throw new Error("Invalid project input for source export.");
  }
  const preErrors = validateIconsForExport(project.icons);
  if (preErrors.length > 0) {
    const messages = preErrors.map((e) => `  - [${e.kind}] ${e.message}`).join(`
`);
    throw new Error(`Source export validation failed:
${messages}`);
  }
  const generatedAt = options?.generatedAt ?? new Date().toISOString();
  const tokens = project.tokenSet?.colors;
  const files = [];
  const manifestInputs = [];
  const iconEntries = Object.entries(project.icons).sort(([a], [b]) => a.localeCompare(b));
  for (const [, icon] of iconEntries) {
    const dirName = toIconDirName(icon.name);
    const sourcePath = `icons/${dirName}/icon.json`;
    const previewPath = `icons/${dirName}/preview.svg`;
    const source = exportIconSource(icon);
    files.push({ path: sourcePath, contents: serializeSourceJson(source) });
    const previewSvg = generatePreviewSvg(icon, tokens);
    if (previewSvg) {
      files.push({ path: previewPath, contents: `${previewSvg}
` });
    }
    manifestInputs.push({ source, sourcePath, previewPath });
  }
  const manifest = generateSyncSourceManifest(manifestInputs, generatedAt);
  files.push({ path: "manifest.json", contents: serializeSourceJson(manifest) });
  files.sort((a, b) => a.path.localeCompare(b.path));
  const payload = {
    files,
    manifest,
    iconCount: iconEntries.length
  };
  const postErrors = validateSourcePayload(payload);
  if (postErrors.length > 0) {
    const messages = postErrors.map((e) => `  - [${e.kind}] ${e.message}`).join(`
`);
    throw new Error(`Source payload validation failed:
${messages}`);
  }
  return payload;
}
// ../../lib/sync-source/source-to-project.ts
import { readdir, readFile as readFile2, stat } from "node:fs/promises";
import path3 from "node:path";
function iconFromSource(source) {
  const variants = {};
  for (const [variantId, sv] of Object.entries(source.variants)) {
    variants[variantId] = variantFromSource(sv);
  }
  return {
    id: source.id,
    name: source.name,
    ...source.category ? { category: source.category } : {},
    ...source.tags && source.tags.length > 0 ? { tags: source.tags } : {},
    variants,
    ...source.effects && Object.keys(source.effects).length > 0 ? { effects: source.effects } : {}
  };
}
function variantFromSource(sv) {
  const layers = {};
  for (const [layerId, sl] of Object.entries(sv.layers)) {
    layers[layerId] = layerFromSource(sl);
  }
  return {
    id: sv.id,
    ...sv.name ? { name: sv.name } : {},
    size: sv.size,
    viewBox: sv.viewBox,
    ...sv.renderingMode ? { renderingMode: sv.renderingMode } : {},
    ...sv.weight ? { weight: sv.weight } : {},
    ...sv.scale ? { scale: sv.scale } : {},
    layers,
    ...sv.topology ? { topology: sv.topology } : {}
  };
}
function layerFromSource(sl) {
  return {
    id: sl.id,
    ...sl.role ? { role: sl.role } : {},
    ...sl.visible === false ? { visible: false } : {},
    ...sl.clipPathLayerId ? { clipPathLayerId: sl.clipPathLayerId } : {},
    ...sl.drawOrder !== undefined ? { drawOrder: sl.drawOrder } : {},
    ...sl.path ? { path: sl.path } : {},
    style: sl.style,
    ...sl.transform ? { transform: sl.transform } : {}
  };
}
function projectFromSourceFiles(files, options) {
  let manifest = null;
  const iconSources = [];
  for (const file of files) {
    if (file.path === "manifest.json") {
      manifest = JSON.parse(file.contents);
    } else if (file.path.endsWith("/icon.json")) {
      iconSources.push(JSON.parse(file.contents));
    }
  }
  if (!manifest) {
    throw new Error("Missing manifest.json in source files.");
  }
  const icons = {};
  for (const source of iconSources) {
    icons[source.id] = iconFromSource(source);
  }
  const now = options?.updatedAt ?? manifest.generatedAt ?? new Date().toISOString();
  const project = {
    version: "1.0",
    meta: {
      name: options?.name ?? "Source Export",
      createdAt: now,
      updatedAt: now
    },
    icons,
    ...options?.tokenColors ? { tokenSet: { colors: options.tokenColors } } : {}
  };
  if (!isProject(project)) {
    throw new Error("Reconstructed project failed validation.");
  }
  return project;
}
async function projectFromSourceDir(sourceDir, options) {
  const files = [];
  const manifestPath = path3.join(sourceDir, "manifest.json");
  const manifestContents = await readFile2(manifestPath, "utf8");
  files.push({ path: "manifest.json", contents: manifestContents });
  const iconsDir = path3.join(sourceDir, "icons");
  try {
    const iconDirs = await readdir(iconsDir);
    for (const dirName of iconDirs.sort()) {
      const dirPath = path3.join(iconsDir, dirName);
      const dirStat = await stat(dirPath);
      if (!dirStat.isDirectory())
        continue;
      const iconJsonPath = path3.join(dirPath, "icon.json");
      try {
        const iconContents = await readFile2(iconJsonPath, "utf8");
        files.push({ path: `icons/${dirName}/icon.json`, contents: iconContents });
      } catch {}
    }
  } catch {}
  return projectFromSourceFiles(files, options);
}
// ../../lib/compiler-contracts/types.ts
var COMPILED_ICON_SCHEMA_URI = "https://hiero.dev/schemas/compiled-icon/1.0.0";
var PACKAGE_MANIFEST_SCHEMA_URI = "https://hiero.dev/schemas/manifest/1.0.0";
var ICON_CHANGE_RECORD_SCHEMA_URI = "https://hiero.dev/schemas/change-record/1.0.0";
// ../../lib/compiler-contracts/validators.ts
function isObject3(val) {
  return typeof val === "object" && val !== null && !Array.isArray(val);
}
function isStringArray(val) {
  return Array.isArray(val) && val.every((item) => typeof item === "string");
}
function isNumberArray(val) {
  return Array.isArray(val) && val.every((item) => typeof item === "number");
}
function isSpringConfig(val) {
  return isObject3(val) && val.type === "spring" && typeof val.stiffness === "number" && typeof val.damping === "number" && (val.mass === undefined || typeof val.mass === "number") && (val.velocity === undefined || typeof val.velocity === "number");
}
function isRecordOf(val, predicate) {
  return isObject3(val) && Object.values(val).every((item) => predicate(item));
}
var REQUIRED_RENDERING_MODES = [
  "monochrome",
  "hierarchical",
  "palette",
  "multicolor"
];
var RENDERING_MODES = [
  ...REQUIRED_RENDERING_MODES
];
var TRACK_PROPERTIES = [
  "opacity",
  "rotate",
  "translateX",
  "translateY",
  "scale",
  "pathLength",
  "trimStart",
  "trimEnd",
  "trimOffset"
];
var EFFECT_KINDS = [
  "bounce",
  "pulse",
  "breathe",
  "wiggle",
  "rotate",
  "scale",
  "variableColor",
  "lineDrawOn",
  "lineDrawOff",
  "draw"
];
var CHANGE_KINDS = [
  "geometry",
  "style",
  "state-added",
  "state-removed",
  "variant-added",
  "variant-removed",
  "mode-added",
  "mode-removed",
  "animation-added",
  "animation-changed",
  "animation-removed",
  "effect-added",
  "effect-removed",
  "metadata",
  "breaking"
];
function isCompiledLayer(val) {
  if (!isObject3(val))
    return false;
  if (typeof val.id !== "string")
    return false;
  if (typeof val.role !== "string")
    return false;
  if (!isObject3(val.path))
    return false;
  if (typeof val.path.d !== "string")
    return false;
  if (val.path.fillRule !== undefined && val.path.fillRule !== "nonzero" && val.path.fillRule !== "evenodd") {
    return false;
  }
  if (!isObject3(val.style))
    return false;
  if (typeof val.style.fill !== "string")
    return false;
  if (typeof val.style.fillOpacity !== "number")
    return false;
  if (typeof val.style.stroke !== "string")
    return false;
  if (typeof val.style.strokeOpacity !== "number")
    return false;
  if (typeof val.style.strokeWidth !== "number")
    return false;
  if (val.style.lineCap !== undefined && (typeof val.style.lineCap !== "string" || !["butt", "round", "square"].includes(val.style.lineCap))) {
    return false;
  }
  if (val.style.lineJoin !== undefined && (typeof val.style.lineJoin !== "string" || !["miter", "round", "bevel"].includes(val.style.lineJoin))) {
    return false;
  }
  if (val.transform !== undefined) {
    if (!isObject3(val.transform))
      return false;
    if (typeof val.transform.x !== "number")
      return false;
    if (typeof val.transform.y !== "number")
      return false;
    if (typeof val.transform.rotate !== "number")
      return false;
    if (typeof val.transform.scaleX !== "number")
      return false;
    if (typeof val.transform.scaleY !== "number")
      return false;
  }
  return true;
}
function isCompiledLayerSet(val) {
  return isObject3(val) && Array.isArray(val.layers) && val.layers.every(isCompiledLayer);
}
function isCompiledVariant(val) {
  if (!isObject3(val))
    return false;
  if (typeof val.size !== "number")
    return false;
  if (!Array.isArray(val.viewBox) || val.viewBox.length !== 4 || !val.viewBox.every((n) => typeof n === "number")) {
    return false;
  }
  return isCompiledLayerSet(val.layers);
}
function isCompiledLayerBinding(val) {
  if (!isObject3(val))
    return false;
  if (val.fromLayerId !== undefined && typeof val.fromLayerId !== "string")
    return false;
  if (val.toLayerId !== undefined && typeof val.toLayerId !== "string")
    return false;
  if (val.tracks !== undefined) {
    if (!Array.isArray(val.tracks))
      return false;
    for (const track of val.tracks) {
      if (!isObject3(track))
        return false;
      if (!TRACK_PROPERTIES.includes(track.property)) {
        return false;
      }
      if (!isNumberArray(track.keyframes) && !isStringArray(track.keyframes)) {
        return false;
      }
    }
  }
  if (val.morph !== undefined) {
    if (!isObject3(val.morph))
      return false;
    if (!["strict", "bestGuess"].includes(val.morph.topology))
      return false;
    if (val.morph.keyframes !== undefined) {
      if (!Array.isArray(val.morph.keyframes))
        return false;
      for (const kf of val.morph.keyframes) {
        if (!isObject3(kf))
          return false;
        if (typeof kf.t !== "number" || kf.t < 0 || kf.t > 1)
          return false;
        if (typeof kf.d !== "string")
          return false;
        if (typeof kf.alpha !== "number")
          return false;
      }
    }
  }
  return true;
}
function isCompiledTransition(val) {
  if (!isObject3(val))
    return false;
  if (typeof val.from !== "string")
    return false;
  if (typeof val.to !== "string")
    return false;
  if (typeof val.durationMs !== "number")
    return false;
  if (typeof val.easing !== "string" && !isSpringConfig(val.easing))
    return false;
  if (!["track", "strictMorph", "bestGuessMorph", "replace"].includes(val.strategy)) {
    return false;
  }
  return Array.isArray(val.bindings) && val.bindings.every(isCompiledLayerBinding);
}
function isCompiledEffect(val) {
  if (!isObject3(val))
    return false;
  if (!EFFECT_KINDS.includes(val.kind))
    return false;
  if (typeof val.durationMs !== "number")
    return false;
  if (typeof val.easing !== "string" && !isSpringConfig(val.easing))
    return false;
  if (val.params !== undefined) {
    if (!isObject3(val.params))
      return false;
    if (!Object.values(val.params).every((param) => ["string", "number", "boolean"].includes(typeof param))) {
      return false;
    }
  }
  return true;
}
function isCompiledIcon(val) {
  if (!isObject3(val))
    return false;
  if (val.$schema !== COMPILED_ICON_SCHEMA_URI)
    return false;
  if (typeof val.id !== "string")
    return false;
  if (typeof val.name !== "string")
    return false;
  if (typeof val.componentName !== "string")
    return false;
  if (!isObject3(val.meta))
    return false;
  if (typeof val.meta.category !== "string")
    return false;
  if (!isStringArray(val.meta.tags))
    return false;
  if (typeof val.meta.updatedAt !== "string")
    return false;
  if (typeof val.meta.version !== "string")
    return false;
  if (typeof val.meta.contentHash !== "string")
    return false;
  if (!isRecordOf(val.variants, isCompiledVariant))
    return false;
  if (!Array.isArray(val.transitions) || !val.transitions.every(isCompiledTransition)) {
    return false;
  }
  if (!Array.isArray(val.effects) || !val.effects.every(isCompiledEffect)) {
    return false;
  }
  return true;
}
function isIconEntry(val) {
  if (!isObject3(val))
    return false;
  if (typeof val.id !== "string")
    return false;
  if (typeof val.name !== "string")
    return false;
  if (typeof val.componentName !== "string")
    return false;
  if (typeof val.category !== "string")
    return false;
  if (!isStringArray(val.tags))
    return false;
  if (typeof val.version !== "string")
    return false;
  if (typeof val.updatedAt !== "string")
    return false;
  if (typeof val.contentHash !== "string")
    return false;
  if (!isNumberArray(val.supportedSizes))
    return false;
  if (!Array.isArray(val.supportedModes) || !val.supportedModes.every((mode) => RENDERING_MODES.includes(mode))) {
    return false;
  }
  if (typeof val.hasAnimation !== "boolean")
    return false;
  if (typeof val.hasMorphTransition !== "boolean")
    return false;
  if (typeof val.compiledPath !== "string")
    return false;
  return true;
}
function isCollectionEntry(val) {
  if (!isObject3(val))
    return false;
  if (typeof val.name !== "string")
    return false;
  if (val.description !== undefined && typeof val.description !== "string")
    return false;
  if (!isStringArray(val.iconIds))
    return false;
  return true;
}
function isPackageManifest(val) {
  if (!isObject3(val))
    return false;
  if (val.$schema !== PACKAGE_MANIFEST_SCHEMA_URI)
    return false;
  if (!isObject3(val.package))
    return false;
  if (typeof val.package.name !== "string")
    return false;
  if (typeof val.package.version !== "string")
    return false;
  if (typeof val.package.builtAt !== "string")
    return false;
  if (typeof val.package.iconSchemaVersion !== "string")
    return false;
  if (typeof val.package.iconCount !== "number")
    return false;
  if (val.package.gitSha !== undefined && typeof val.package.gitSha !== "string")
    return false;
  if (val.package.gitBranch !== undefined && typeof val.package.gitBranch !== "string") {
    return false;
  }
  if (!isRecordOf(val.icons, isIconEntry))
    return false;
  if (!isRecordOf(val.collections, isCollectionEntry))
    return false;
  return true;
}
function isIconChange(val) {
  if (!isObject3(val))
    return false;
  if (!CHANGE_KINDS.includes(val.kind))
    return false;
  if (typeof val.summary !== "string")
    return false;
  if (typeof val.breaking !== "boolean")
    return false;
  if (val.scope !== undefined) {
    if (!isObject3(val.scope))
      return false;
    if (val.scope.variantSize !== undefined && typeof val.scope.variantSize !== "number") {
      return false;
    }
    if (val.scope.stateId !== undefined && typeof val.scope.stateId !== "string")
      return false;
    if (val.scope.layerId !== undefined && typeof val.scope.layerId !== "string")
      return false;
    if (val.scope.renderingMode !== undefined && !RENDERING_MODES.includes(val.scope.renderingMode)) {
      return false;
    }
    if (val.scope.effectKind !== undefined && !EFFECT_KINDS.includes(val.scope.effectKind)) {
      return false;
    }
  }
  return true;
}
function isIconChangeRecord(val) {
  if (!isObject3(val))
    return false;
  if (val.$schema !== ICON_CHANGE_RECORD_SCHEMA_URI)
    return false;
  if (typeof val.iconId !== "string")
    return false;
  if (typeof val.iconName !== "string")
    return false;
  if (typeof val.componentName !== "string")
    return false;
  if (typeof val.fromVersion !== "string")
    return false;
  if (typeof val.toVersion !== "string")
    return false;
  if (typeof val.publishedAt !== "string")
    return false;
  if (!["major", "minor", "patch"].includes(val.bump))
    return false;
  if (typeof val.isBreaking !== "boolean")
    return false;
  if (val.designerNote !== undefined && typeof val.designerNote !== "string")
    return false;
  if (!Array.isArray(val.changes) || !val.changes.every(isIconChange))
    return false;
  return true;
}
// ../../lib/export/diff-compiled-icons.ts
var MODE_ORDER = [
  "monochrome",
  "hierarchical",
  "palette",
  "multicolor"
];
function diffCompiledIcons(previous, next, options) {
  const changes = [];
  diffMetadata(previous, next, changes);
  diffVariants(previous, next, changes);
  diffAnimation(previous, next, changes);
  diffEffects(previous.effects, next.effects, changes);
  const isBreakingByChanges = changes.some((change) => change.breaking);
  const isBreaking = options?.breakingOverride ?? isBreakingByChanges;
  if (isBreaking) {
    const hasBreakingChange = changes.some((change) => change.kind === "breaking");
    if (!hasBreakingChange) {
      changes.push({
        kind: "breaking",
        summary: options?.breakingOverride === true ? "Marked as breaking by manual override." : "Contains one or more breaking removals.",
        breaking: true
      });
    }
  }
  const record = {
    $schema: ICON_CHANGE_RECORD_SCHEMA_URI,
    iconId: next.id,
    iconName: next.name,
    componentName: next.componentName,
    fromVersion: previous.meta.version,
    toVersion: next.meta.version,
    publishedAt: options?.publishedAt ?? new Date().toISOString(),
    bump: deriveBump(changes, isBreaking),
    isBreaking,
    designerNote: options?.designerNote,
    changes
  };
  validateIconChangeRecordOrThrow(record);
  return record;
}
function validateIconChangeRecordOrThrow(value) {
  if (!isIconChangeRecord(value)) {
    throw new Error("Malformed IconChangeRecord payload.");
  }
}
function diffMetadata(previous, next, changes) {
  const metadataChanges = [];
  if (previous.name !== next.name) {
    metadataChanges.push(`name: "${previous.name}" -> "${next.name}"`);
  }
  if (previous.componentName !== next.componentName) {
    metadataChanges.push(`componentName: "${previous.componentName}" -> "${next.componentName}"`);
  }
  if (previous.meta.category !== next.meta.category) {
    metadataChanges.push(`category: "${previous.meta.category}" -> "${next.meta.category}"`);
  }
  const prevTags = [...previous.meta.tags].sort((a, b) => a.localeCompare(b));
  const nextTags = [...next.meta.tags].sort((a, b) => a.localeCompare(b));
  if (prevTags.join("|") !== nextTags.join("|")) {
    metadataChanges.push(`tags: [${prevTags.join(", ")}] -> [${nextTags.join(", ")}]`);
  }
  if (metadataChanges.length > 0) {
    changes.push({
      kind: "metadata",
      summary: `Metadata updated (${metadataChanges.join("; ")}).`,
      breaking: false
    });
  }
}
function diffVariants(previous, next, changes) {
  const previousVariantIds = new Set(Object.keys(previous.variants));
  const nextVariantIds = new Set(Object.keys(next.variants));
  for (const variantId of [...nextVariantIds].sort((a, b) => a.localeCompare(b))) {
    if (!previousVariantIds.has(variantId)) {
      const size = next.variants[variantId].size;
      changes.push({
        kind: "variant-added",
        summary: `Added variant ${variantId} (${size}px).`,
        breaking: false,
        scope: { variantSize: size }
      });
    }
  }
  for (const variantId of [...previousVariantIds].sort((a, b) => a.localeCompare(b))) {
    if (!nextVariantIds.has(variantId)) {
      const size = previous.variants[variantId].size;
      changes.push({
        kind: "variant-removed",
        summary: `Removed variant ${variantId} (${size}px).`,
        breaking: true,
        scope: { variantSize: size }
      });
    }
  }
  for (const variantId of [...previousVariantIds].sort((a, b) => a.localeCompare(b))) {
    if (!nextVariantIds.has(variantId))
      continue;
    const prevVariant = previous.variants[variantId];
    const nextVariant = next.variants[variantId];
    const prevStates = { default: { modes: { monochrome: prevVariant.layers } } };
    const nextStates = { default: { modes: { monochrome: nextVariant.layers } } };
    diffStates(prevVariant.size, prevStates, nextStates, changes);
  }
}
function diffStates(variantSize, previousStates, nextStates, changes) {
  const previousStateIds = new Set(Object.keys(previousStates));
  const nextStateIds = new Set(Object.keys(nextStates));
  for (const stateId of [...nextStateIds].sort((a, b) => a.localeCompare(b))) {
    if (!previousStateIds.has(stateId)) {
      changes.push({
        kind: "state-added",
        summary: `Added state "${stateId}" for ${variantSize}px variant.`,
        breaking: false,
        scope: { variantSize, stateId }
      });
    }
  }
  for (const stateId of [...previousStateIds].sort((a, b) => a.localeCompare(b))) {
    if (!nextStateIds.has(stateId)) {
      changes.push({
        kind: "state-removed",
        summary: `Removed state "${stateId}" for ${variantSize}px variant.`,
        breaking: true,
        scope: { variantSize, stateId }
      });
    }
  }
  for (const stateId of [...previousStateIds].sort((a, b) => a.localeCompare(b))) {
    if (!nextStateIds.has(stateId))
      continue;
    const previousModes = previousStates[stateId].modes;
    const nextModes = nextStates[stateId].modes;
    const previousModeKeys = new Set(Object.keys(previousModes));
    const nextModeKeys = new Set(Object.keys(nextModes));
    for (const mode of MODE_ORDER) {
      const had = previousModeKeys.has(mode);
      const has = nextModeKeys.has(mode);
      if (!had && has) {
        changes.push({
          kind: "mode-added",
          summary: `Added ${mode} mode to state "${stateId}" (${variantSize}px).`,
          breaking: false,
          scope: { variantSize, stateId, renderingMode: mode }
        });
        continue;
      }
      if (had && !has) {
        changes.push({
          kind: "mode-removed",
          summary: `Removed ${mode} mode from state "${stateId}" (${variantSize}px).`,
          breaking: true,
          scope: { variantSize, stateId, renderingMode: mode }
        });
        continue;
      }
      if (!had || !has)
        continue;
      diffLayerSets(variantSize, stateId, mode, previousModes[mode].layers, nextModes[mode].layers, changes);
    }
  }
}
function diffLayerSets(variantSize, stateId, mode, previousLayers, nextLayers, changes) {
  const previousById = new Map(previousLayers.map((layer) => [layer.id, layer]));
  const nextById = new Map(nextLayers.map((layer) => [layer.id, layer]));
  const commonLayerIds = [...previousById.keys()].filter((layerId) => nextById.has(layerId)).sort((a, b) => a.localeCompare(b));
  for (const layerId of commonLayerIds) {
    const prevLayer = previousById.get(layerId);
    const nextLayer = nextById.get(layerId);
    if (hasGeometryChange(prevLayer, nextLayer)) {
      changes.push({
        kind: "geometry",
        summary: `Geometry updated for layer "${layerId}" in ${mode}/${stateId} (${variantSize}px).`,
        breaking: false,
        scope: { variantSize, stateId, layerId, renderingMode: mode }
      });
    }
    if (hasStyleChange(prevLayer, nextLayer)) {
      changes.push({
        kind: "style",
        summary: `Style updated for layer "${layerId}" in ${mode}/${stateId} (${variantSize}px).`,
        breaking: false,
        scope: { variantSize, stateId, layerId, renderingMode: mode }
      });
    }
  }
}
function hasGeometryChange(previous, next) {
  return previous.path.d !== next.path.d || previous.path.fillRule !== next.path.fillRule || serializeCanonical(previous.transform) !== serializeCanonical(next.transform);
}
function hasStyleChange(previous, next) {
  return previous.style.fill !== next.style.fill || previous.style.fillOpacity !== next.style.fillOpacity || previous.style.stroke !== next.style.stroke || previous.style.strokeOpacity !== next.style.strokeOpacity || previous.style.strokeWidth !== next.style.strokeWidth || previous.style.lineCap !== next.style.lineCap || previous.style.lineJoin !== next.style.lineJoin;
}
function diffAnimation(previous, next, changes) {
  const hadAnimation = previous.transitions.length > 0 || previous.effects.length > 0;
  const hasAnimation = next.transitions.length > 0 || next.effects.length > 0;
  if (!hadAnimation && hasAnimation) {
    changes.push({
      kind: "animation-added",
      summary: "Animation capability added.",
      breaking: false
    });
    return;
  }
  if (hadAnimation && !hasAnimation) {
    changes.push({
      kind: "animation-removed",
      summary: "Animation capability removed.",
      breaking: true
    });
    return;
  }
  if (hadAnimation && hasAnimation) {
    const previousSignature = serializeCanonical(previous.transitions);
    const nextSignature = serializeCanonical(next.transitions);
    if (previousSignature !== nextSignature) {
      changes.push({
        kind: "animation-changed",
        summary: "Animation transitions changed.",
        breaking: false
      });
    }
  }
}
function diffEffects(previous, next, changes) {
  const previousCounts = countByKind(previous);
  const nextCounts = countByKind(next);
  const allKinds = new Set([...Object.keys(previousCounts), ...Object.keys(nextCounts)]);
  for (const kind of [...allKinds].sort((a, b) => a.localeCompare(b))) {
    const prevCount = previousCounts[kind] ?? 0;
    const nextCount = nextCounts[kind] ?? 0;
    if (nextCount > prevCount) {
      changes.push({
        kind: "effect-added",
        summary: `Added effect "${kind}".`,
        breaking: false,
        scope: { effectKind: kind }
      });
    }
    if (nextCount < prevCount) {
      changes.push({
        kind: "effect-removed",
        summary: `Removed effect "${kind}".`,
        breaking: true,
        scope: { effectKind: kind }
      });
    }
  }
}
function deriveBump(changes, isBreaking) {
  if (isBreaking || changes.some((change) => change.breaking))
    return "major";
  const hasAdditiveChange = changes.some((change) => [
    "state-added",
    "variant-added",
    "mode-added",
    "animation-added",
    "effect-added"
  ].includes(change.kind));
  if (hasAdditiveChange)
    return "minor";
  return "patch";
}
function countByKind(effects) {
  return effects.reduce((acc, effect) => {
    acc[effect.kind] = (acc[effect.kind] ?? 0) + 1;
    return acc;
  }, {});
}
function serializeCanonical(value) {
  return JSON.stringify(sortJsonValue(value));
}
function sortJsonValue(value) {
  if (Array.isArray(value))
    return value.map(sortJsonValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined).sort(([left], [right]) => left.localeCompare(right)).map(([key, entry]) => [key, sortJsonValue(entry)]));
  }
  return value;
}

// ../../lib/export/export-compiled-icon.ts
import { createHash } from "node:crypto";

// ../../lib/schema/compound.ts
function hasCompound(layer) {
  const c = layer.compound;
  if (!c)
    return false;
  if (typeof c.cacheVersion !== "number")
    return false;
  if (typeof c.operands !== "object" || c.operands === null)
    return false;
  if (!c.tree || typeof c.tree !== "object")
    return false;
  return isValidCompoundNode(c.tree);
}
function isValidCompoundNode(node) {
  if (node.kind === "leaf") {
    return typeof node.operandId === "string" && node.operandId.length > 0;
  }
  if (node.kind === "op") {
    if (node.op !== "unite" && node.op !== "subtract" && node.op !== "intersect" && node.op !== "exclude") {
      return false;
    }
    if (!Array.isArray(node.children) || node.children.length === 0) {
      return false;
    }
    return node.children.every(isValidCompoundNode);
  }
  return false;
}

// ../../lib/runtime-core/path-normalization.ts
function canonicalizeLayerPath(layer) {
  const d = layer?.path?.d;
  if (!d)
    return null;
  const transformed = applyTransformToPath(d, layer.transform);
  return canonicalizePath(transformed);
}
function canonicalizePath(d) {
  const commands = toAbsoluteCommands(d);
  const normalized = normalizeSubpathOrdering(commands);
  const canonicalD = normalized.map((command) => `${command.command}${command.values.map(formatNumber2).join(" ")}`.trim()).join(" ").replace(/\s+/g, " ").trim();
  const stats = computeGeometryStats(normalized);
  return { d: canonicalD, stats };
}
function applyTransformToPath(d, transform) {
  if (!transform)
    return d;
  const tx = transform.x ?? 0;
  const ty = transform.y ?? 0;
  const rotate = (transform.rotate ?? 0) * Math.PI / 180;
  const sx = transform.scaleX ?? 1;
  const sy = transform.scaleY ?? 1;
  const cos = Math.cos(rotate);
  const sin = Math.sin(rotate);
  const mapPoint = (x, y) => {
    const scaledX = x * sx;
    const scaledY = y * sy;
    return {
      x: scaledX * cos - scaledY * sin + tx,
      y: scaledX * sin + scaledY * cos + ty
    };
  };
  const commands = toAbsoluteCommands(d).map((command) => {
    const out = [...command.values];
    switch (command.command) {
      case "M":
      case "L":
        assignPoint(out, 0, mapPoint(out[0], out[1]));
        break;
      case "Q":
        assignPoint(out, 0, mapPoint(out[0], out[1]));
        assignPoint(out, 2, mapPoint(out[2], out[3]));
        break;
      case "C":
        assignPoint(out, 0, mapPoint(out[0], out[1]));
        assignPoint(out, 2, mapPoint(out[2], out[3]));
        assignPoint(out, 4, mapPoint(out[4], out[5]));
        break;
      case "A": {
        const end = mapPoint(out[5], out[6]);
        out[0] = Math.abs(out[0] * sx);
        out[1] = Math.abs(out[1] * sy);
        out[2] = out[2] + (transform.rotate ?? 0);
        assignPoint(out, 5, end);
        break;
      }
      default:
        break;
    }
    return { command: command.command, values: out };
  });
  return commands.map((command) => `${command.command}${command.values.map(formatNumber2).join(" ")}`.trim()).join(" ");
}
function assignPoint(values, index, point) {
  values[index] = point.x;
  values[index + 1] = point.y;
}
function normalizeSubpathOrdering(commands) {
  const subpaths = [];
  let current = [];
  for (const command of commands) {
    if (command.command === "M" && current.length > 0) {
      subpaths.push(current);
      current = [];
    }
    current.push(command);
  }
  if (current.length > 0) {
    subpaths.push(current);
  }
  subpaths.sort((a, b) => {
    const am = a[0]?.values ?? [0, 0];
    const bm = b[0]?.values ?? [0, 0];
    if (am[0] !== bm[0])
      return am[0] - bm[0];
    if (am[1] !== bm[1])
      return am[1] - bm[1];
    return signatureOf(a).localeCompare(signatureOf(b));
  });
  return subpaths.flat();
}
function signatureOf(subpath) {
  return subpath.map((command) => command.command).join("");
}
function computeGeometryStats(commands) {
  const commandSignature = commands.map((command) => command.command);
  const closed = [];
  let subpathCount = 0;
  let currentClosed = false;
  const points = [];
  for (const command of commands) {
    if (command.command === "M") {
      if (subpathCount > 0) {
        closed.push(currentClosed);
      }
      subpathCount += 1;
      currentClosed = false;
    }
    if (command.command === "Z") {
      currentClosed = true;
      continue;
    }
    collectCommandPoints(command).forEach((point) => points.push(point));
  }
  if (subpathCount > 0) {
    closed.push(currentClosed);
  }
  const bbox = computeBBox(points);
  const centroid = {
    x: (bbox.minX + bbox.maxX) / 2,
    y: (bbox.minY + bbox.maxY) / 2
  };
  return {
    subpathCount,
    commandSignature,
    closed,
    bbox,
    centroid,
    pointCount: points.length
  };
}
function collectCommandPoints(command) {
  const v = command.values;
  switch (command.command) {
    case "M":
    case "L":
      return [{ x: v[0] ?? 0, y: v[1] ?? 0 }];
    case "Q":
      return [{ x: v[0] ?? 0, y: v[1] ?? 0 }, { x: v[2] ?? 0, y: v[3] ?? 0 }];
    case "C":
      return [
        { x: v[0] ?? 0, y: v[1] ?? 0 },
        { x: v[2] ?? 0, y: v[3] ?? 0 },
        { x: v[4] ?? 0, y: v[5] ?? 0 }
      ];
    case "A":
      return [{ x: v[5] ?? 0, y: v[6] ?? 0 }];
    default:
      return [];
  }
}
function computeBBox(points) {
  if (points.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  }
  let minX = points[0].x;
  let minY = points[0].y;
  let maxX = points[0].x;
  let maxY = points[0].y;
  for (const point of points) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }
  return { minX, minY, maxX, maxY };
}
function toAbsoluteCommands(d) {
  const tokens = tokenize(d);
  const commands = [];
  let index = 0;
  let cx = 0;
  let cy = 0;
  let sx = 0;
  let sy = 0;
  function readNumber() {
    return parseFloat(tokens[index++] ?? "0");
  }
  while (index < tokens.length) {
    const token = tokens[index++];
    if (!token || !/^[a-zA-Z]$/.test(token)) {
      continue;
    }
    const isRelative = token === token.toLowerCase();
    switch (token.toUpperCase()) {
      case "M": {
        if (!hasNumbers(tokens, index, 2))
          break;
        cx = readNumber() + (isRelative ? cx : 0);
        cy = readNumber() + (isRelative ? cy : 0);
        sx = cx;
        sy = cy;
        commands.push({ command: "M", values: [cx, cy] });
        while (hasNumbers(tokens, index, 2)) {
          cx = readNumber() + (isRelative ? cx : 0);
          cy = readNumber() + (isRelative ? cy : 0);
          commands.push({ command: "L", values: [cx, cy] });
        }
        break;
      }
      case "L":
        while (hasNumbers(tokens, index, 2)) {
          cx = readNumber() + (isRelative ? cx : 0);
          cy = readNumber() + (isRelative ? cy : 0);
          commands.push({ command: "L", values: [cx, cy] });
        }
        break;
      case "H":
        while (hasNumbers(tokens, index, 1)) {
          cx = readNumber() + (isRelative ? cx : 0);
          commands.push({ command: "L", values: [cx, cy] });
        }
        break;
      case "V":
        while (hasNumbers(tokens, index, 1)) {
          cy = readNumber() + (isRelative ? cy : 0);
          commands.push({ command: "L", values: [cx, cy] });
        }
        break;
      case "Q":
        while (hasNumbers(tokens, index, 4)) {
          const x1 = readNumber() + (isRelative ? cx : 0);
          const y1 = readNumber() + (isRelative ? cy : 0);
          cx = readNumber() + (isRelative ? cx : 0);
          cy = readNumber() + (isRelative ? cy : 0);
          commands.push({ command: "Q", values: [x1, y1, cx, cy] });
        }
        break;
      case "C":
        while (hasNumbers(tokens, index, 6)) {
          const x1 = readNumber() + (isRelative ? cx : 0);
          const y1 = readNumber() + (isRelative ? cy : 0);
          const x2 = readNumber() + (isRelative ? cx : 0);
          const y2 = readNumber() + (isRelative ? cy : 0);
          cx = readNumber() + (isRelative ? cx : 0);
          cy = readNumber() + (isRelative ? cy : 0);
          commands.push({ command: "C", values: [x1, y1, x2, y2, cx, cy] });
        }
        break;
      case "A":
        while (hasNumbers(tokens, index, 7)) {
          const rx = readNumber();
          const ry = readNumber();
          const rotation = readNumber();
          const largeArc = readNumber();
          const sweep = readNumber();
          cx = readNumber() + (isRelative ? cx : 0);
          cy = readNumber() + (isRelative ? cy : 0);
          commands.push({ command: "A", values: [rx, ry, rotation, largeArc, sweep, cx, cy] });
        }
        break;
      case "Z":
        cx = sx;
        cy = sy;
        commands.push({ command: "Z", values: [] });
        break;
      default:
        break;
    }
  }
  return commands;
}
function hasNumbers(tokens, index, count) {
  for (let offset = 0;offset < count; offset += 1) {
    if (!isNumber(tokens[index + offset])) {
      return false;
    }
  }
  return true;
}
function isNumber(token) {
  return typeof token === "string" && /^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/.test(token);
}
function tokenize(d) {
  const tokens = [];
  const re = /([a-zA-Z])|([+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)/g;
  let match;
  while ((match = re.exec(d)) !== null) {
    tokens.push(match[0]);
  }
  return tokens;
}
function formatNumber2(value) {
  const rounded = Number(value.toFixed(4));
  return Object.is(rounded, -0) ? "0" : String(rounded);
}

// ../../lib/runtime-core/contour-tree.ts
function buildContourTree(canonical, fillRule = "nonzero") {
  const subpaths = extractSubpaths(canonical.d, canonical.stats.closed);
  const rings = [];
  const openSubpathIndices = [];
  for (const sub of subpaths) {
    if (!sub.closed || sub.points.length < 3) {
      openSubpathIndices.push(sub.subpathIndex);
      continue;
    }
    rings.push({
      subpathIndex: sub.subpathIndex,
      points: sub.points,
      signedArea: signedArea(sub.points),
      closed: true,
      bbox: bboxOf(sub.points)
    });
  }
  const nodes = rings.map((_, i) => ({
    ringIndex: i,
    parent: null,
    children: [],
    depth: 0
  }));
  for (let i = 0;i < rings.length; i++) {
    const repPoint = representativePoint(rings[i]);
    let bestParent = -1;
    let bestParentArea = Number.POSITIVE_INFINITY;
    for (let j2 = 0;j2 < rings.length; j2++) {
      if (i === j2)
        continue;
      const candidate = rings[j2];
      if (!pointInRing(repPoint, candidate))
        continue;
      const area = Math.abs(candidate.signedArea);
      if (area < bestParentArea) {
        bestParentArea = area;
        bestParent = j2;
      }
    }
    if (bestParent >= 0) {
      nodes[i].parent = bestParent;
      nodes[bestParent].children.push(i);
    }
  }
  for (let i = 0;i < nodes.length; i++) {
    let depth = 0;
    let cursor = nodes[i].parent;
    let safety = nodes.length;
    while (cursor !== null && safety > 0) {
      depth += 1;
      cursor = nodes[cursor].parent;
      safety -= 1;
    }
    nodes[i].depth = depth;
  }
  const rootIds = nodes.map((node, i) => node.parent === null ? i : -1).filter((i) => i >= 0);
  return { rings, nodes, rootIds, openSubpathIndices, fillRule };
}
function extractSubpaths(d, closedFlags) {
  const tokens = tokenize2(d);
  const result = [];
  let current = null;
  let cursor = 0;
  let cx;
  let cy;
  function readNumber() {
    return Number.parseFloat(tokens[cursor++] ?? "0");
  }
  function pushPoint(x, y) {
    if (!current)
      return;
    current.points.push({ x, y });
    cx = x;
    cy = y;
  }
  while (cursor < tokens.length) {
    const token = tokens[cursor++];
    if (!token || !/^[a-zA-Z]$/.test(token))
      continue;
    const upper = token.toUpperCase();
    switch (upper) {
      case "M": {
        if (current)
          result.push(current);
        const subpathIndex = result.length;
        cx = readNumber();
        cy = readNumber();
        current = {
          subpathIndex,
          points: [{ x: cx, y: cy }],
          closed: closedFlags[subpathIndex] ?? false
        };
        while (hasNumberPair(tokens, cursor)) {
          pushPoint(readNumber(), readNumber());
        }
        break;
      }
      case "L":
        while (hasNumberPair(tokens, cursor)) {
          pushPoint(readNumber(), readNumber());
        }
        break;
      case "Q":
        while (hasNumberPair(tokens, cursor) && hasNumberPair(tokens, cursor + 2)) {
          readNumber();
          readNumber();
          pushPoint(readNumber(), readNumber());
        }
        break;
      case "C":
        while (hasNumberPair(tokens, cursor) && hasNumberPair(tokens, cursor + 2) && hasNumberPair(tokens, cursor + 4)) {
          readNumber();
          readNumber();
          readNumber();
          readNumber();
          pushPoint(readNumber(), readNumber());
        }
        break;
      case "A":
        while (hasNumber(tokens, cursor) && hasNumber(tokens, cursor + 1) && hasNumber(tokens, cursor + 2) && hasNumber(tokens, cursor + 3) && hasNumber(tokens, cursor + 4) && hasNumberPair(tokens, cursor + 5)) {
          readNumber();
          readNumber();
          readNumber();
          readNumber();
          readNumber();
          pushPoint(readNumber(), readNumber());
        }
        break;
      case "Z":
        break;
      default:
        break;
    }
  }
  if (current)
    result.push(current);
  return result;
}
function tokenize2(d) {
  const matches = d.match(/[a-zA-Z]|-?\d*\.?\d+(?:[eE][+-]?\d+)?/g);
  return matches ?? [];
}
function hasNumber(tokens, index) {
  const token = tokens[index];
  if (!token)
    return false;
  return /^-?\d*\.?\d+(?:[eE][+-]?\d+)?$/.test(token);
}
function hasNumberPair(tokens, index) {
  return hasNumber(tokens, index) && hasNumber(tokens, index + 1);
}
function signedArea(points) {
  if (points.length < 3)
    return 0;
  let area = 0;
  for (let i = 0;i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    area += a.x * b.y - b.x * a.y;
  }
  return area / 2;
}
function bboxOf(points) {
  if (points.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  }
  let minX = points[0].x;
  let minY = points[0].y;
  let maxX = minX;
  let maxY = minY;
  for (const p of points) {
    if (p.x < minX)
      minX = p.x;
    if (p.y < minY)
      minY = p.y;
    if (p.x > maxX)
      maxX = p.x;
    if (p.y > maxY)
      maxY = p.y;
  }
  return { minX, minY, maxX, maxY };
}
function representativePoint(ring) {
  const interiorSign = ring.signedArea >= 0 ? -1 : 1;
  const span = Math.max(ring.bbox.maxX - ring.bbox.minX, ring.bbox.maxY - ring.bbox.minY, 1);
  const eps = span * 0.001;
  for (let i = 0;i < ring.points.length; i++) {
    const a = ring.points[i];
    const b = ring.points[(i + 1) % ring.points.length];
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    if (len === 0)
      continue;
    const nx = -dy / len * interiorSign;
    const ny = dx / len * interiorSign;
    const candidate = { x: mx + nx * eps, y: my + ny * eps };
    if (pointInRing(candidate, ring))
      return candidate;
  }
  return ring.points[0] ?? { x: 0, y: 0 };
}
function pointInRing(p, ring) {
  if (p.x < ring.bbox.minX || p.x > ring.bbox.maxX || p.y < ring.bbox.minY || p.y > ring.bbox.maxY) {
    return false;
  }
  const pts = ring.points;
  let inside = false;
  for (let i = 0, j2 = pts.length - 1;i < pts.length; j2 = i++) {
    const xi = pts[i].x;
    const yi = pts[i].y;
    const xj = pts[j2].x;
    const yj = pts[j2].y;
    const intersects = yi > p.y !== yj > p.y && p.x < (xj - xi) * (p.y - yi) / (yj - yi) + xi;
    if (intersects)
      inside = !inside;
  }
  return inside;
}

// ../../lib/runtime-core/topology-classifier.ts
function describeLayer(layer) {
  const canonical = canonicalizeLayerPath(layer);
  const tree = canonical ? buildContourTree(canonical, fillRuleOf(layer)) : null;
  const closedSubpathCount = tree?.rings.length ?? 0;
  const openSubpathCount = tree?.openSubpathIndices.length ?? 0;
  return {
    hasGeometry: !!canonical,
    hasCompound: hasCompoundField(layer),
    isStrokeOnly: isStrokeOnlyStyle(layer),
    isFillOnly: isFillOnlyStyle(layer),
    canonical,
    tree,
    closedSubpathCount,
    openSubpathCount
  };
}
function classifyTopologyPair(from, to) {
  if (from.hasCompound || to.hasCompound)
    return "T6";
  const fromShape = shapeOf(from);
  const toShape = shapeOf(to);
  if (fromShape === "pure-closed" && toShape === "pure-closed" && (from.isStrokeOnly && to.isFillOnly || from.isFillOnly && to.isStrokeOnly)) {
    return "T7";
  }
  if (fromShape === "mixed" || toShape === "mixed")
    return "T5";
  if (fromShape === "pure-closed" && toShape === "pure-closed") {
    return from.closedSubpathCount === 1 && to.closedSubpathCount === 1 ? "T1" : "T3";
  }
  if (fromShape === "pure-open" && toShape === "pure-open") {
    return from.openSubpathCount === 1 && to.openSubpathCount === 1 ? "T2" : "T4";
  }
  return "T8";
}
function shapeOf(t) {
  if (t.closedSubpathCount === 0 && t.openSubpathCount === 0)
    return "empty";
  if (t.closedSubpathCount > 0 && t.openSubpathCount === 0)
    return "pure-closed";
  if (t.openSubpathCount > 0 && t.closedSubpathCount === 0)
    return "pure-open";
  return "mixed";
}
function fillRuleOf(layer) {
  return layer.path?.fillRule === "evenodd" ? "evenodd" : "nonzero";
}
function hasCompoundField(layer) {
  return hasCompound(layer);
}
function isStrokeOnlyStyle(layer) {
  const style = layer.style;
  return Boolean(style?.stroke) && !style?.fill;
}
function isFillOnlyStyle(layer) {
  const style = layer.style;
  return Boolean(style?.fill) && !style?.stroke;
}

// ../../lib/runtime-core/easing.ts
var EASING_FUNCTIONS = {
  linear: (t) => t,
  "ease-in": (t) => t * t,
  "ease-out": (t) => 1 - (1 - t) * (1 - t),
  "ease-in-out": (t) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2,
  "ease-in-cubic": (t) => t * t * t,
  "ease-out-cubic": (t) => 1 - Math.pow(1 - t, 3)
};
function getEasingFunction(name) {
  const normalized = name.trim().toLowerCase();
  if (EASING_FUNCTIONS[normalized]) {
    return EASING_FUNCTIONS[normalized];
  }
  const cubicBezier = parseCubicBezier(normalized);
  if (cubicBezier) {
    return cubicBezier;
  }
  const steps = parseSteps(normalized);
  if (steps) {
    return steps;
  }
  return EASING_FUNCTIONS.linear;
}
function parseCubicBezier(value) {
  const match = value.match(/^cubic-bezier\(\s*(-?\d*\.?\d+)\s*,\s*(-?\d*\.?\d+)\s*,\s*(-?\d*\.?\d+)\s*,\s*(-?\d*\.?\d+)\s*\)$/);
  if (!match) {
    return null;
  }
  const x1 = Number.parseFloat(match[1]);
  const y1 = Number.parseFloat(match[2]);
  const x2 = Number.parseFloat(match[3]);
  const y2 = Number.parseFloat(match[4]);
  if (![x1, y1, x2, y2].every(Number.isFinite)) {
    return null;
  }
  return createCubicBezierEasing(x1, y1, x2, y2);
}
function parseSteps(value) {
  const match = value.match(/^steps\(\s*(\d+)\s*(?:,\s*(start|end)\s*)?\)$/);
  if (!match) {
    return null;
  }
  const stepCount = Number.parseInt(match[1], 10);
  const position = match[2] === "start" ? "start" : "end";
  if (!Number.isFinite(stepCount) || stepCount <= 0) {
    return null;
  }
  return (t) => {
    const clamped = clamp01(t);
    if (position === "start") {
      return Math.min(1, Math.ceil(clamped * stepCount) / stepCount);
    }
    return Math.floor(clamped * stepCount) / stepCount;
  };
}
function createCubicBezierEasing(x1, y1, x2, y2) {
  return (t) => {
    const x = clamp01(t);
    if (x === 0 || x === 1) {
      return x;
    }
    let guess = x;
    for (let index = 0;index < 8; index += 1) {
      const xEstimate = cubicBezierAt(guess, x1, x2) - x;
      const slope = cubicBezierDerivativeAt(guess, x1, x2);
      if (Math.abs(xEstimate) < 0.0000001) {
        break;
      }
      if (Math.abs(slope) < 0.0000001) {
        guess = binarySearchBezier(x, x1, x2);
        break;
      }
      guess -= xEstimate / slope;
    }
    return cubicBezierAt(clamp01(guess), y1, y2);
  };
}
function cubicBezierAt(t, a1, a2) {
  const invT = 1 - t;
  return 3 * invT * invT * t * a1 + 3 * invT * t * t * a2 + t * t * t;
}
function cubicBezierDerivativeAt(t, a1, a2) {
  const invT = 1 - t;
  return 3 * invT * invT * a1 + 6 * invT * t * (a2 - a1) + 3 * t * t * (1 - a2);
}
function binarySearchBezier(x, x1, x2) {
  let start = 0;
  let end = 1;
  let guess = x;
  for (let index = 0;index < 12; index += 1) {
    guess = (start + end) / 2;
    const estimate = cubicBezierAt(guess, x1, x2);
    if (Math.abs(estimate - x) < 0.0000001) {
      break;
    }
    if (estimate < x) {
      start = guess;
    } else {
      end = guess;
    }
  }
  return guess;
}
function clamp01(value) {
  if (value <= 0)
    return 0;
  if (value >= 1)
    return 1;
  return value;
}

// ../../lib/runtime-core/motion-curves.ts
var SOFT = {
  g: getEasingFunction("ease-in-out"),
  alpha: getEasingFunction("ease-out-cubic"),
  alphaOffsetRatio: 0.08
};
var SNAPPY = {
  g: getEasingFunction("ease-out"),
  alpha: getEasingFunction("ease-out-cubic"),
  alphaOffsetRatio: 0.04
};
function defaultMotionCurves(cadence = "soft") {
  if (cadence === "snappy")
    return SNAPPY;
  return SOFT;
}
function geometryProgress(curves, t) {
  return curves.g(clamp012(t));
}
function clamp012(value) {
  if (!Number.isFinite(value))
    return 0;
  if (value <= 0)
    return 0;
  if (value >= 1)
    return 1;
  return value;
}

// ../../lib/runtime-core/cascade-tiers/identity.ts
function resolveIdentity(input) {
  if (input.taxonomy === "T7")
    return null;
  const fromD = input.fromTopology.canonical?.d ?? null;
  const toD = input.toTopology.canonical?.d ?? null;
  if (fromD === null || toD === null)
    return null;
  if (fromD !== toD)
    return null;
  const constant = fromD;
  return {
    interpolator: () => constant,
    motion: input.motion,
    distortion: 0,
    signal: null
  };
}

// ../../lib/editor-core/parse.ts
var _idCounter = 0;
function nextId(prefix) {
  return `${prefix}-${++_idCounter}`;
}
var EDITABLE_COMMANDS = new Set(["M", "L", "H", "V", "C", "S", "Q", "T", "A", "Z"]);
function parseSvgPath(d) {
  const path4 = { id: nextId("path"), subPaths: [] };
  const tokens = tokenize3(d);
  let currentSubPath = null;
  let cx = 0;
  let cy = 0;
  let i = 0;
  let lastCurveFamily = null;
  function num() {
    return parseFloat(tokens[i++] ?? "0");
  }
  while (i < tokens.length) {
    const cmd = tokens[i++];
    switch (cmd) {
      case "M":
      case "m": {
        const isRel = cmd === "m";
        const x = num() + (isRel ? cx : 0);
        const y = num() + (isRel ? cy : 0);
        cx = x;
        cy = y;
        currentSubPath = {
          id: nextId("sp"),
          points: [makePoint(x, y)],
          closed: false
        };
        path4.subPaths.push(currentSubPath);
        while (i < tokens.length && isNumber2(tokens[i])) {
          const lx = num() + (isRel ? cx : 0);
          const ly = num() + (isRel ? cy : 0);
          cx = lx;
          cy = ly;
          currentSubPath.points.push(makePoint(lx, ly, { type: "line" }));
        }
        lastCurveFamily = null;
        break;
      }
      case "L":
      case "l": {
        const isRel = cmd === "l";
        while (i < tokens.length && isNumber2(tokens[i])) {
          const x = num() + (isRel ? cx : 0);
          const y = num() + (isRel ? cy : 0);
          cx = x;
          cy = y;
          currentSubPath?.points.push(makePoint(x, y, { type: "line" }));
        }
        lastCurveFamily = null;
        break;
      }
      case "H":
      case "h": {
        const isRel = cmd === "h";
        while (i < tokens.length && isNumber2(tokens[i])) {
          const x = num() + (isRel ? cx : 0);
          cx = x;
          currentSubPath?.points.push(makePoint(x, cy, { type: "line" }));
        }
        lastCurveFamily = null;
        break;
      }
      case "V":
      case "v": {
        const isRel = cmd === "v";
        while (i < tokens.length && isNumber2(tokens[i])) {
          const y = num() + (isRel ? cy : 0);
          cy = y;
          currentSubPath?.points.push(makePoint(cx, y, { type: "line" }));
        }
        lastCurveFamily = null;
        break;
      }
      case "C":
      case "c": {
        const isRel = cmd === "c";
        while (i < tokens.length && isNumber2(tokens[i])) {
          const x1 = num() + (isRel ? cx : 0);
          const y1 = num() + (isRel ? cy : 0);
          const x2 = num() + (isRel ? cx : 0);
          const y2 = num() + (isRel ? cy : 0);
          const x = num() + (isRel ? cx : 0);
          const y = num() + (isRel ? cy : 0);
          const prev = currentSubPath?.points[currentSubPath.points.length - 1];
          if (prev) {
            prev.handleOut = { x: x1, y: y1 };
            prev.nodeType = inferNodeType(prev.position, prev.handleIn, { x: x1, y: y1 });
          }
          const pt = makePoint(x, y, { type: "cubic" });
          pt.handleIn = { x: x2, y: y2 };
          pt.nodeType = "smooth";
          currentSubPath?.points.push(pt);
          cx = x;
          cy = y;
        }
        lastCurveFamily = "cubic";
        break;
      }
      case "Q":
      case "q": {
        const isRel = cmd === "q";
        while (i < tokens.length && isNumber2(tokens[i])) {
          const cpx = num() + (isRel ? cx : 0);
          const cpy = num() + (isRel ? cy : 0);
          const x = num() + (isRel ? cx : 0);
          const y = num() + (isRel ? cy : 0);
          const prev = currentSubPath?.points[currentSubPath.points.length - 1];
          if (prev) {
            prev.handleOut = { x: cpx, y: cpy };
          }
          const pt = makePoint(x, y, {
            type: "quadratic",
            control: { x: cpx, y: cpy }
          });
          pt.handleIn = { x: cpx, y: cpy };
          currentSubPath?.points.push(pt);
          cx = x;
          cy = y;
        }
        lastCurveFamily = "quadratic";
        break;
      }
      case "S":
      case "s": {
        const isRel = cmd === "s";
        while (i < tokens.length && isNumber2(tokens[i])) {
          const x2 = num() + (isRel ? cx : 0);
          const y2 = num() + (isRel ? cy : 0);
          const x = num() + (isRel ? cx : 0);
          const y = num() + (isRel ? cy : 0);
          const prev = currentSubPath?.points[currentSubPath.points.length - 1];
          if (prev) {
            const reflected = lastCurveFamily === "cubic" && prev.handleIn ? {
              x: 2 * prev.position.x - prev.handleIn.x,
              y: 2 * prev.position.y - prev.handleIn.y
            } : { x: prev.position.x, y: prev.position.y };
            prev.handleOut = reflected;
            prev.nodeType = inferNodeType(prev.position, prev.handleIn, prev.handleOut);
          }
          const pt = makePoint(x, y, { type: "cubic" });
          pt.handleIn = { x: x2, y: y2 };
          pt.nodeType = "smooth";
          currentSubPath?.points.push(pt);
          cx = x;
          cy = y;
          lastCurveFamily = "cubic";
        }
        break;
      }
      case "T":
      case "t": {
        const isRel = cmd === "t";
        while (i < tokens.length && isNumber2(tokens[i])) {
          const x = num() + (isRel ? cx : 0);
          const y = num() + (isRel ? cy : 0);
          const prev = currentSubPath?.points[currentSubPath.points.length - 1];
          let control = { x: 0, y: 0 };
          if (prev) {
            control = lastCurveFamily === "quadratic" && prev.handleIn ? {
              x: 2 * prev.position.x - prev.handleIn.x,
              y: 2 * prev.position.y - prev.handleIn.y
            } : { x: prev.position.x, y: prev.position.y };
            prev.handleOut = control;
          }
          const pt = makePoint(x, y, { type: "quadratic", control });
          pt.handleIn = control;
          currentSubPath?.points.push(pt);
          cx = x;
          cy = y;
          lastCurveFamily = "quadratic";
        }
        break;
      }
      case "A":
      case "a": {
        const isRel = cmd === "a";
        while (i < tokens.length && isNumber2(tokens[i])) {
          const rx = num();
          const ry = num();
          const xAxisRotation = num();
          const largeArc = toFlag(num());
          const sweep = toFlag(num());
          const x = num() + (isRel ? cx : 0);
          const y = num() + (isRel ? cy : 0);
          cx = x;
          cy = y;
          currentSubPath?.points.push(makePoint(x, y, {
            type: "arc",
            rx,
            ry,
            xAxisRotation,
            largeArc,
            sweep
          }));
        }
        lastCurveFamily = null;
        break;
      }
      case "Z":
      case "z": {
        if (currentSubPath) {
          currentSubPath.closed = true;
          if (currentSubPath.points.length > 0) {
            const first = currentSubPath.points[0];
            cx = first.position.x;
            cy = first.position.y;
          }
        }
        lastCurveFamily = null;
        break;
      }
    }
  }
  for (const sp of path4.subPaths) {
    for (const pt of sp.points) {
      if (pt.handleIn && pt.handleOut) {
        pt.nodeType = inferNodeType(pt.position, pt.handleIn, pt.handleOut);
      }
    }
  }
  return path4;
}
function makePoint(x, y, segment = null) {
  return {
    id: nextId("pt"),
    position: { x, y },
    handleIn: null,
    handleOut: null,
    nodeType: "static",
    segment
  };
}
function inferNodeType(position, handleIn, handleOut) {
  if (!handleIn || !handleOut)
    return "smooth";
  const inDx = handleIn.x - position.x;
  const inDy = handleIn.y - position.y;
  const outDx = handleOut.x - position.x;
  const outDy = handleOut.y - position.y;
  const inLen = Math.hypot(inDx, inDy);
  const outLen = Math.hypot(outDx, outDy);
  if (inLen < 0.001 || outLen < 0.001)
    return "smooth";
  const dot = inDx / inLen * (outDx / outLen) + inDy / inLen * (outDy / outLen);
  if (dot > -0.99) {
    return "corner";
  }
  if (Math.abs(inLen - outLen) < 0.01) {
    return "symmetric";
  }
  return "smooth";
}
function toFlag(value) {
  return value >= 1 ? 1 : 0;
}
function isNumber2(token) {
  return /^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/.test(token);
}
function tokenize3(d) {
  const tokens = [];
  const re = /([a-zA-Z])|([+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)/g;
  let m;
  while ((m = re.exec(d)) !== null) {
    tokens.push(m[0]);
  }
  return tokens;
}

// ../../lib/runtime-core/arc-to-cubic.ts
function arcToCubicSegments(start, rx, ry, xAxisRotation, largeArcFlag, sweepFlag, end) {
  if (rx === 0 || ry === 0) {
    return [{ c1: { ...start }, c2: { ...end }, end: { ...end } }];
  }
  if (start.x === end.x && start.y === end.y) {
    return [];
  }
  rx = Math.abs(rx);
  ry = Math.abs(ry);
  const phi = xAxisRotation * Math.PI / 180;
  const cosPhi = Math.cos(phi);
  const sinPhi = Math.sin(phi);
  const dx = (start.x - end.x) / 2;
  const dy = (start.y - end.y) / 2;
  const x1p = cosPhi * dx + sinPhi * dy;
  const y1p = -sinPhi * dx + cosPhi * dy;
  const x1pSq = x1p * x1p;
  const y1pSq = y1p * y1p;
  let rxSq = rx * rx;
  let rySq = ry * ry;
  const radiiCheck = x1pSq / rxSq + y1pSq / rySq;
  if (radiiCheck > 1) {
    const scale = Math.sqrt(radiiCheck);
    rx *= scale;
    ry *= scale;
    rxSq = rx * rx;
    rySq = ry * ry;
  }
  const numerator = Math.max(0, rxSq * rySq - rxSq * y1pSq - rySq * x1pSq);
  const denominator = rxSq * y1pSq + rySq * x1pSq;
  if (denominator === 0) {
    return [{ c1: { ...start }, c2: { ...end }, end: { ...end } }];
  }
  const sq = Math.sqrt(numerator / denominator);
  const sign = largeArcFlag === sweepFlag ? -1 : 1;
  const cxp = sign * sq * (rx * y1p / ry);
  const cyp = sign * sq * (-ry * x1p / rx);
  const mx = (start.x + end.x) / 2;
  const my = (start.y + end.y) / 2;
  const cx = cosPhi * cxp - sinPhi * cyp + mx;
  const cy = sinPhi * cxp + cosPhi * cyp + my;
  const theta1 = angleBetween(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
  let dtheta = angleBetween((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
  if (sweepFlag === 0 && dtheta > 0) {
    dtheta -= 2 * Math.PI;
  } else if (sweepFlag === 1 && dtheta < 0) {
    dtheta += 2 * Math.PI;
  }
  if (Math.abs(dtheta) < 0.000001) {
    return [{ c1: { ...start }, c2: { ...end }, end: { ...end } }];
  }
  const segmentCount = Math.max(1, Math.ceil(Math.abs(dtheta) / (Math.PI / 4)));
  const segmentAngle = dtheta / segmentCount;
  const segments = [];
  let currentAngle = theta1;
  let currentPoint = { ...start };
  for (let i = 0;i < segmentCount; i++) {
    const nextAngle = currentAngle + segmentAngle;
    const cubic = arcSegmentToCubic(cx, cy, rx, ry, phi, currentAngle, segmentAngle, currentPoint);
    segments.push(cubic);
    currentAngle = nextAngle;
    currentPoint = cubic.end;
  }
  if (segments.length > 0) {
    segments[segments.length - 1].end = { ...end };
  }
  return segments;
}
function arcSegmentToCubic(cx, cy, rx, ry, phi, theta, dtheta, startPoint) {
  const alpha = 4 / 3 * Math.tan(dtheta / 4);
  const cosPhi_ = Math.cos(phi);
  const sinPhi_ = Math.sin(phi);
  const cosTheta1 = Math.cos(theta);
  const sinTheta1 = Math.sin(theta);
  const cosTheta2 = Math.cos(theta + dtheta);
  const sinTheta2 = Math.sin(theta + dtheta);
  const dx1 = -rx * sinTheta1;
  const dy1 = ry * cosTheta1;
  const c1x = startPoint.x + alpha * (cosPhi_ * dx1 - sinPhi_ * dy1);
  const c1y = startPoint.y + alpha * (sinPhi_ * dx1 + cosPhi_ * dy1);
  const ex = cx + rx * cosTheta2 * cosPhi_ - ry * sinTheta2 * sinPhi_;
  const ey = cy + rx * cosTheta2 * sinPhi_ + ry * sinTheta2 * cosPhi_;
  const dx2 = -rx * sinTheta2;
  const dy2 = ry * cosTheta2;
  const c2x = ex - alpha * (cosPhi_ * dx2 - sinPhi_ * dy2);
  const c2y = ey - alpha * (sinPhi_ * dx2 + cosPhi_ * dy2);
  return {
    c1: { x: c1x, y: c1y },
    c2: { x: c2x, y: c2y },
    end: { x: ex, y: ey }
  };
}
function angleBetween(ux, uy, vx, vy) {
  const dot = ux * vx + uy * vy;
  const cross = ux * vy - uy * vx;
  const lenU = Math.sqrt(ux * ux + uy * uy);
  const lenV = Math.sqrt(vx * vx + vy * vy);
  const denom = lenU * lenV;
  if (denom === 0)
    return 0;
  const cosAngle = Math.max(-1, Math.min(1, dot / denom));
  const angle = Math.acos(cosAngle);
  return cross < 0 ? -angle : angle;
}

// ../../lib/runtime-core/cross-icon-morph.ts
function computeSignedArea(sub) {
  const points = [sub.start];
  for (const seg of sub.segments) {
    points.push(seg.end);
  }
  let area = 0;
  for (let i = 0;i < points.length; i++) {
    const curr = points[i];
    const next = points[(i + 1) % points.length];
    area += curr.x * next.y - next.x * curr.y;
  }
  return area / 2;
}
function ensureClockwise(sub) {
  const area = computeSignedArea(sub);
  if (area >= 0)
    return sub;
  const n = sub.segments.length;
  if (n === 0)
    return sub;
  const reversedSegments = [];
  for (let i = n - 1;i >= 0; i--) {
    const seg = sub.segments[i];
    const prevEnd = i === 0 ? sub.start : sub.segments[i - 1].end;
    reversedSegments.push({
      c1: { ...seg.c2 },
      c2: { ...seg.c1 },
      end: { ...prevEnd }
    });
  }
  return {
    start: { ...sub.segments[n - 1].end },
    segments: reversedSegments,
    closed: sub.closed
  };
}
function matchSubPaths(from, to) {
  const matches = [];
  const usedFrom = new Set;
  const usedTo = new Set;
  const candidates = [];
  for (let fi = 0;fi < from.length; fi++) {
    for (let ti = 0;ti < to.length; ti++) {
      const score = computeSubPathSimilarity(from[fi], to[ti]);
      candidates.push({ fromIndex: fi, toIndex: ti, score });
    }
  }
  candidates.sort((a, b) => b.score - a.score);
  for (const candidate of candidates) {
    if (usedFrom.has(candidate.fromIndex) || usedTo.has(candidate.toIndex)) {
      continue;
    }
    matches.push(candidate);
    usedFrom.add(candidate.fromIndex);
    usedTo.add(candidate.toIndex);
  }
  return matches;
}
function computeSubPathSimilarity(a, b) {
  const centroidA = computeSubPathCentroid(a);
  const centroidB = computeSubPathCentroid(b);
  const bboxA = computeSubPathBBox(a);
  const bboxB = computeSubPathBBox(b);
  const maxSpan = Math.max(bboxA.maxX - bboxA.minX, bboxA.maxY - bboxA.minY, bboxB.maxX - bboxB.minX, bboxB.maxY - bboxB.minY, 1);
  const centroidDist = Math.hypot(centroidA.x - centroidB.x, centroidA.y - centroidB.y);
  const centroidScore = Math.max(0, 1 - centroidDist / maxSpan);
  const aw = Math.max(bboxA.maxX - bboxA.minX, 0.001);
  const ah = Math.max(bboxA.maxY - bboxA.minY, 0.001);
  const bw = Math.max(bboxB.maxX - bboxB.minX, 0.001);
  const bh = Math.max(bboxB.maxY - bboxB.minY, 0.001);
  const bboxScore = Math.max(0, 1 - (Math.abs(aw - bw) / Math.max(aw, bw) + Math.abs(ah - bh) / Math.max(ah, bh)) / 2);
  const areaA = Math.abs(computeSignedArea(a));
  const areaB = Math.abs(computeSignedArea(b));
  const maxArea = Math.max(areaA, areaB, 0.001);
  const areaScore = 1 - Math.abs(areaA - areaB) / maxArea;
  const segA = a.segments.length;
  const segB = b.segments.length;
  const maxSeg = Math.max(segA, segB, 1);
  const segCountScore = 1 - Math.abs(segA - segB) / maxSeg;
  const closedBonus = a.closed === b.closed ? 0.2 : 0;
  return centroidScore * 0.35 + bboxScore * 0.3 + areaScore * 0.1 + segCountScore * 0.05 + closedBonus;
}
var GL12_W = [
  0.2491470458134028,
  0.2491470458134028,
  0.2334925365383548,
  0.2334925365383548,
  0.2031674267230659,
  0.2031674267230659,
  0.1600783285433462,
  0.1600783285433462,
  0.1069393259953184,
  0.1069393259953184,
  0.0471753363865118,
  0.0471753363865118
];
var GL12_X = [
  -0.1252334085114689,
  0.1252334085114689,
  -0.3678314989981802,
  0.3678314989981802,
  -0.5873179542866175,
  0.5873179542866175,
  -0.7699026741943047,
  0.7699026741943047,
  -0.9041172563704749,
  0.9041172563704749,
  -0.9815606342467192,
  0.9815606342467192
];
function cubicSpeed(p0, p1, p2, p3, t) {
  const mt = 1 - t;
  const ax = 3 * ((p1.x - p0.x) * mt * mt + 2 * (p2.x - p1.x) * mt * t + (p3.x - p2.x) * t * t);
  const ay = 3 * ((p1.y - p0.y) * mt * mt + 2 * (p2.y - p1.y) * mt * t + (p3.y - p2.y) * t * t);
  return Math.sqrt(ax * ax + ay * ay);
}
function segmentArcLengthGL(start, seg) {
  let sum = 0;
  for (let i = 0;i < 12; i++) {
    const t = 0.5 * (GL12_X[i] + 1);
    sum += GL12_W[i] * cubicSpeed(start, seg.c1, seg.c2, seg.end, t);
  }
  return 0.5 * sum;
}
function buildArcLengthLut(subPath) {
  const lut = [];
  let accumulated = 0;
  let prevEnd = subPath.start;
  for (const seg of subPath.segments) {
    accumulated += segmentArcLengthGL(prevEnd, seg);
    lut.push(accumulated);
    prevEnd = seg.end;
  }
  return { lut, total: accumulated };
}
function sampleSubPathAtFraction(subPath, lut, total, frac) {
  if (subPath.segments.length === 0)
    return { ...subPath.start };
  const target = frac * total;
  let lo = 0;
  let hi = lut.length - 1;
  while (lo < hi) {
    const mid = lo + hi >> 1;
    if (lut[mid] < target)
      lo = mid + 1;
    else
      hi = mid;
  }
  const segIdx = lo;
  const seg = subPath.segments[segIdx];
  const segStart = segIdx === 0 ? subPath.start : subPath.segments[segIdx - 1].end;
  const arcAtStart = segIdx === 0 ? 0 : lut[segIdx - 1];
  const arcAtEnd = lut[segIdx];
  const segLen = arcAtEnd - arcAtStart;
  const tLocal = segLen < 0.0000000001 ? 0 : (target - arcAtStart) / segLen;
  const t = Math.max(0, Math.min(1, tLocal));
  const mt = 1 - t;
  return {
    x: mt * mt * mt * segStart.x + 3 * mt * mt * t * seg.c1.x + 3 * mt * t * t * seg.c2.x + t * t * t * seg.end.x,
    y: mt * mt * mt * segStart.y + 3 * mt * mt * t * seg.c1.y + 3 * mt * t * t * seg.c2.y + t * t * t * seg.end.y
  };
}
function findOptimalShapeIndex(from, to) {
  if (from.segments.length === 0 || to.segments.length === 0)
    return 0;
  if (!from.closed || !to.closed)
    return 0;
  const n = Math.min(from.segments.length, to.segments.length);
  let bestOffset = 0;
  let bestCost = Infinity;
  for (let offset = 0;offset < n; offset++) {
    let cost = 0;
    for (let i = 0;i < n; i++) {
      const fromSeg = from.segments[i];
      const toSeg = to.segments[(i + offset) % n];
      cost += pointDistSq(fromSeg.end, toSeg.end);
      cost += pointDistSq(fromSeg.c1, toSeg.c1) * 0.5;
      cost += pointDistSq(fromSeg.c2, toSeg.c2) * 0.5;
    }
    const fromStart = from.start;
    const toStart = offset === 0 ? to.start : to.segments[(offset - 1) % n].end;
    cost += pointDistSq(fromStart, toStart);
    if (cost < bestCost) {
      bestCost = cost;
      bestOffset = offset;
    }
  }
  return bestOffset;
}
function rotateSubPathSegments(subPath, offset) {
  if (offset === 0 || subPath.segments.length === 0)
    return subPath;
  const n = subPath.segments.length;
  const normalizedOffset = (offset % n + n) % n;
  if (normalizedOffset === 0)
    return subPath;
  const rotated = [
    ...subPath.segments.slice(normalizedOffset),
    ...subPath.segments.slice(0, normalizedOffset)
  ];
  const newStart = normalizedOffset > 0 ? subPath.segments[normalizedOffset - 1].end : subPath.start;
  return {
    start: { ...newStart },
    segments: rotated,
    closed: subPath.closed
  };
}
function reverseSubPathSegments(subPath) {
  const n = subPath.segments.length;
  if (n === 0) {
    return {
      start: { ...subPath.start },
      segments: [],
      closed: subPath.closed
    };
  }
  const prevEnd = (i) => i === 0 ? subPath.start : subPath.segments[i - 1].end;
  const reversed = new Array(n);
  for (let r = 0;r < n; r += 1) {
    const origIdx = n - 1 - r;
    const origSeg = subPath.segments[origIdx];
    reversed[r] = {
      c1: { ...origSeg.c2 },
      c2: { ...origSeg.c1 },
      end: { ...prevEnd(origIdx) }
    };
  }
  return {
    start: { ...subPath.segments[n - 1].end },
    segments: reversed,
    closed: subPath.closed
  };
}
function computeSubPathAlignmentCost(from, to) {
  const n = Math.min(from.segments.length, to.segments.length);
  let cost = pointDistSq(from.start, to.start);
  for (let i = 0;i < n; i += 1) {
    const f = from.segments[i];
    const t = to.segments[i];
    cost += pointDistSq(f.end, t.end);
    cost += pointDistSq(f.c1, t.c1) * 0.5;
    cost += pointDistSq(f.c2, t.c2) * 0.5;
  }
  return cost;
}
function sampleSubPathNPoints(sub, N) {
  if (sub.segments.length === 0) {
    return Array.from({ length: N }, () => ({ ...sub.start }));
  }
  const { lut, total } = buildArcLengthLut(sub);
  if (total < 0.0000000001) {
    return Array.from({ length: N }, () => ({ ...sub.start }));
  }
  return Array.from({ length: N }, (_, i) => sampleSubPathAtFraction(sub, lut, total, i / N));
}
function catmullRomToClosedBezier(pts) {
  const n = pts.length;
  if (n < 2)
    return { start: pts[0] ?? { x: 0, y: 0 }, segments: [], closed: true };
  const TENSION = 1 / 6;
  const segments = [];
  for (let i = 0;i < n; i++) {
    const prev = pts[(i - 1 + n) % n];
    const curr = pts[i];
    const next = pts[(i + 1) % n];
    const nextNext = pts[(i + 2) % n];
    segments.push({
      c1: {
        x: curr.x + (next.x - prev.x) * TENSION,
        y: curr.y + (next.y - prev.y) * TENSION
      },
      c2: {
        x: next.x - (nextNext.x - curr.x) * TENSION,
        y: next.y - (nextNext.y - curr.y) * TENSION
      },
      end: next
    });
  }
  return { start: pts[0], segments, closed: true };
}
function catmullRomToOpenBezier(pts) {
  const n = pts.length;
  if (n < 2)
    return { start: pts[0] ?? { x: 0, y: 0 }, segments: [], closed: false };
  const TENSION = 1 / 6;
  const segments = [];
  for (let i = 0;i < n - 1; i++) {
    const prev = pts[Math.max(0, i - 1)];
    const curr = pts[i];
    const next = pts[i + 1];
    const nextNext = pts[Math.min(n - 1, i + 2)];
    segments.push({
      c1: {
        x: curr.x + (next.x - prev.x) * TENSION,
        y: curr.y + (next.y - prev.y) * TENSION
      },
      c2: {
        x: next.x - (nextNext.x - curr.x) * TENSION,
        y: next.y - (nextNext.y - curr.y) * TENSION
      },
      end: next
    });
  }
  return { start: pts[0], segments, closed: false };
}
function alignSampledPoints(fromPts, toPts) {
  const N = fromPts.length;
  let bestOffset = 0;
  let bestCost = Infinity;
  for (let offset = 0;offset < N; offset++) {
    let cost = 0;
    for (let i = 0;i < N; i++) {
      cost += pointDistSq(fromPts[i], toPts[(i + offset) % N]);
    }
    if (cost < bestCost) {
      bestCost = cost;
      bestOffset = offset;
    }
  }
  if (bestOffset === 0)
    return toPts;
  return [...toPts.slice(bestOffset), ...toPts.slice(0, bestOffset)];
}
function crossIconMorph(from, to) {
  if (from.length === 0 && to.length === 0)
    return null;
  const N = 64;
  const normalizedFrom = from.map(ensureClockwise);
  const normalizedTo = to.map(ensureClockwise);
  const matches = matchSubPaths(normalizedFrom, normalizedTo);
  const matchedFrom = new Set(matches.map((m) => m.fromIndex));
  const matchedTo = new Set(matches.map((m) => m.toIndex));
  const pairs = [];
  for (const match of matches) {
    const fromSub = cloneSubPath(normalizedFrom[match.fromIndex]);
    const toSub = cloneSubPath(normalizedTo[match.toIndex]);
    const fromPts = sampleSubPathNPoints(fromSub, N);
    const rawToPts = sampleSubPathNPoints(toSub, N);
    const toPts = fromSub.closed && toSub.closed ? alignSampledPoints(fromPts, rawToPts) : rawToPts;
    pairs.push({ fromPts, toPts, disappearing: false, appearing: false, closed: fromSub.closed && toSub.closed });
  }
  for (let i = 0;i < normalizedFrom.length; i++) {
    if (!matchedFrom.has(i)) {
      const fromSub = cloneSubPath(normalizedFrom[i]);
      const centroid = computeSubPathCentroid(fromSub);
      pairs.push({
        fromPts: sampleSubPathNPoints(fromSub, N),
        toPts: Array.from({ length: N }, () => ({ ...centroid })),
        disappearing: true,
        appearing: false,
        closed: fromSub.closed
      });
    }
  }
  for (let i = 0;i < normalizedTo.length; i++) {
    if (!matchedTo.has(i)) {
      const toSub = cloneSubPath(normalizedTo[i]);
      const centroid = computeSubPathCentroid(toSub);
      pairs.push({
        fromPts: Array.from({ length: N }, () => ({ ...centroid })),
        toPts: sampleSubPathNPoints(toSub, N),
        disappearing: false,
        appearing: true,
        closed: toSub.closed
      });
    }
  }
  return (t) => {
    if (t <= 0)
      return serializePath(normalizedFrom);
    if (t >= 1)
      return serializePath(normalizedTo);
    const result = [];
    for (const pair of pairs) {
      let effectiveT = t;
      if (pair.disappearing) {
        effectiveT = easeInCubic(t);
      } else if (pair.appearing) {
        effectiveT = easeOutCubic(t);
      }
      const pts = pair.fromPts.map((fp, i) => lerpPoint(fp, pair.toPts[i], effectiveT));
      result.push(pair.closed ? catmullRomToClosedBezier(pts) : catmullRomToOpenBezier(pts));
    }
    return serializePath(result);
  };
}
function serializePath(path4) {
  const parts = [];
  for (const sub of path4) {
    parts.push(`M${fmt(sub.start.x)} ${fmt(sub.start.y)}`);
    for (const seg of sub.segments) {
      parts.push(`C${fmt(seg.c1.x)} ${fmt(seg.c1.y)} ${fmt(seg.c2.x)} ${fmt(seg.c2.y)} ${fmt(seg.end.x)} ${fmt(seg.end.y)}`);
    }
    if (sub.closed) {
      parts.push("Z");
    }
  }
  return parts.join(" ");
}
function easeInCubic(t) {
  return t * t * t;
}
function easeOutCubic(t) {
  const t1 = t - 1;
  return t1 * t1 * t1 + 1;
}
function computeSubPathCentroid(sub) {
  const points = [sub.start];
  for (const seg of sub.segments) {
    points.push(seg.end);
  }
  const cx = points.reduce((s, p) => s + p.x, 0) / points.length;
  const cy = points.reduce((s, p) => s + p.y, 0) / points.length;
  return { x: cx, y: cy };
}
function computeSubPathBBox(sub) {
  const points = [sub.start];
  for (const seg of sub.segments) {
    points.push(seg.c1, seg.c2, seg.end);
  }
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  return { minX, minY, maxX, maxY };
}
function lerpPoint(a, b, t) {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}
function pointDistSq(a, b) {
  return (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
}
function cloneSubPath(sub) {
  return {
    start: { ...sub.start },
    segments: sub.segments.map((s) => ({
      c1: { ...s.c1 },
      c2: { ...s.c2 },
      end: { ...s.end }
    })),
    closed: sub.closed
  };
}
function fmt(n) {
  const r = Number(n.toFixed(3));
  return Object.is(r, -0) ? "0" : String(r);
}

// ../../lib/runtime-core/intrinsic-interpolation.ts
var EPSILON = 0.000001;
function decomposeHandle(point, chordStart, chordEnd) {
  const dx = chordEnd.x - chordStart.x;
  const dy = chordEnd.y - chordStart.y;
  const chordLen = Math.sqrt(dx * dx + dy * dy);
  if (chordLen < EPSILON) {
    const px2 = point.x - chordStart.x;
    const py2 = point.y - chordStart.y;
    const mag = Math.sqrt(px2 * px2 + py2 * py2);
    return {
      tangentRatio: mag > EPSILON ? px2 / mag : 0,
      normalRatio: mag > EPSILON ? py2 / mag : 0,
      magnitude: mag
    };
  }
  const tx = dx / chordLen;
  const ty = dy / chordLen;
  const nx = -ty;
  const ny = tx;
  const px = point.x - chordStart.x;
  const py = point.y - chordStart.y;
  const tangentProj = px * tx + py * ty;
  const normalProj = px * nx + py * ny;
  return {
    tangentRatio: tangentProj / chordLen,
    normalRatio: normalProj / chordLen,
    magnitude: Math.sqrt(px * px + py * py)
  };
}
function reconstructHandle(handle, chordStart, chordEnd) {
  const dx = chordEnd.x - chordStart.x;
  const dy = chordEnd.y - chordStart.y;
  const chordLen = Math.sqrt(dx * dx + dy * dy);
  if (chordLen < EPSILON) {
    return {
      x: chordStart.x + handle.magnitude * handle.tangentRatio,
      y: chordStart.y + handle.magnitude * handle.normalRatio
    };
  }
  const tx = dx / chordLen;
  const ty = dy / chordLen;
  const nx = -ty;
  const ny = tx;
  const x = chordStart.x + handle.tangentRatio * chordLen * tx + handle.normalRatio * chordLen * nx;
  const y = chordStart.y + handle.tangentRatio * chordLen * ty + handle.normalRatio * chordLen * ny;
  return { x, y };
}
function decomposePolar(start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  return {
    length: Math.sqrt(dx * dx + dy * dy),
    angle: Math.atan2(dy, dx)
  };
}
function reconstructFromPolar(start, edge) {
  return {
    x: start.x + edge.length * Math.cos(edge.angle),
    y: start.y + edge.length * Math.sin(edge.angle)
  };
}
function angleLerp(a, b, t) {
  let diff = b - a;
  while (diff > Math.PI)
    diff -= 2 * Math.PI;
  while (diff < -Math.PI)
    diff += 2 * Math.PI;
  let result = a + diff * t;
  while (result > Math.PI)
    result -= 2 * Math.PI;
  while (result < -Math.PI)
    result += 2 * Math.PI;
  return result;
}
function lerpIntrinsicHandle(a, b, t) {
  return {
    tangentRatio: a.tangentRatio + (b.tangentRatio - a.tangentRatio) * t,
    normalRatio: a.normalRatio + (b.normalRatio - a.normalRatio) * t,
    magnitude: a.magnitude + (b.magnitude - a.magnitude) * t
  };
}

// ../../lib/runtime-core/morph.ts
function strictMorph(fromD, toD) {
  const from = canonicalizeCommands(fromD);
  const to = canonicalizeCommands(toD);
  const fromSignature = from.map((command) => command.command);
  const toSignature = to.map((command) => command.command);
  if (!arrayEquals(fromSignature, toSignature)) {
    throw new Error(`Path command signatures do not match: [${fromSignature.join(", ")}] vs [${toSignature.join(", ")}].`);
  }
  for (let index = 0;index < from.length; index += 1) {
    if (from[index].values.length !== to[index].values.length) {
      throw new Error(`Path command value counts differ at index ${index}.`);
    }
  }
  return (t) => {
    if (t <= 0)
      return fromD;
    if (t >= 1)
      return toD;
    return from.map((command, index) => {
      const target = to[index];
      return formatCommand(command.command, command.values.map((value, valueIndex) => lerp(value, target.values[valueIndex], t)));
    }).join(" ");
  };
}
function intrinsicStrictMorph(fromD, toD) {
  const from = canonicalizeCommands(fromD);
  const to = canonicalizeCommands(toD);
  const fromSignature = from.map((c) => c.command);
  const toSignature = to.map((c) => c.command);
  if (!arrayEquals(fromSignature, toSignature)) {
    throw new Error(`Path command signatures do not match: [${fromSignature.join(", ")}] vs [${toSignature.join(", ")}].`);
  }
  for (let i = 0;i < from.length; i++) {
    if (from[i].values.length !== to[i].values.length) {
      throw new Error(`Path command value counts differ at index ${i}.`);
    }
  }
  const EPSILON2 = 0.000001;
  const entries = [];
  let fromCx = 0, fromCy = 0, toCx = 0, toCy = 0;
  for (let i = 0;i < from.length; i++) {
    const fc = from[i];
    const tc = to[i];
    const entry = {
      command: fc.command,
      fromValues: fc.values,
      toValues: tc.values
    };
    switch (fc.command) {
      case "M": {
        fromCx = fc.values[0];
        fromCy = fc.values[1];
        toCx = tc.values[0];
        toCy = tc.values[1];
        break;
      }
      case "L": {
        const fromStart = { x: fromCx, y: fromCy };
        const fromEnd = { x: fc.values[0], y: fc.values[1] };
        const toStart = { x: toCx, y: toCy };
        const toEnd = { x: tc.values[0], y: tc.values[1] };
        const fromEdge = decomposePolar(fromStart, fromEnd);
        const toEdge = decomposePolar(toStart, toEnd);
        if (fromEdge.length > EPSILON2 || toEdge.length > EPSILON2) {
          entry.intrinsic = { fromEdge, toEdge };
        }
        fromCx = fromEnd.x;
        fromCy = fromEnd.y;
        toCx = toEnd.x;
        toCy = toEnd.y;
        break;
      }
      case "H": {
        const fromStart = { x: fromCx, y: fromCy };
        const fromEnd = { x: fc.values[0], y: fromCy };
        const toStart = { x: toCx, y: toCy };
        const toEnd = { x: tc.values[0], y: toCy };
        entry.intrinsic = {
          fromEdge: decomposePolar(fromStart, fromEnd),
          toEdge: decomposePolar(toStart, toEnd)
        };
        fromCx = fromEnd.x;
        toCx = toEnd.x;
        break;
      }
      case "V": {
        const fromStart = { x: fromCx, y: fromCy };
        const fromEnd = { x: fromCx, y: fc.values[0] };
        const toStart = { x: toCx, y: toCy };
        const toEnd = { x: toCx, y: tc.values[0] };
        entry.intrinsic = {
          fromEdge: decomposePolar(fromStart, fromEnd),
          toEdge: decomposePolar(toStart, toEnd)
        };
        fromCy = fromEnd.y;
        toCy = toEnd.y;
        break;
      }
      case "C": {
        const fromStart = { x: fromCx, y: fromCy };
        const fromC1 = { x: fc.values[0], y: fc.values[1] };
        const fromC2 = { x: fc.values[2], y: fc.values[3] };
        const fromEnd = { x: fc.values[4], y: fc.values[5] };
        const toStart = { x: toCx, y: toCy };
        const toC1 = { x: tc.values[0], y: tc.values[1] };
        const toC2 = { x: tc.values[2], y: tc.values[3] };
        const toEnd = { x: tc.values[4], y: tc.values[5] };
        const fromEdge = decomposePolar(fromStart, fromEnd);
        const toEdge = decomposePolar(toStart, toEnd);
        if (fromEdge.length > EPSILON2 || toEdge.length > EPSILON2) {
          entry.intrinsic = {
            fromEdge,
            toEdge,
            fromC1: decomposeHandle(fromC1, fromStart, fromEnd),
            toC1: decomposeHandle(toC1, toStart, toEnd),
            fromC2: decomposeHandle(fromC2, fromStart, fromEnd),
            toC2: decomposeHandle(toC2, toStart, toEnd)
          };
        }
        fromCx = fromEnd.x;
        fromCy = fromEnd.y;
        toCx = toEnd.x;
        toCy = toEnd.y;
        break;
      }
      case "Q": {
        const fromStart = { x: fromCx, y: fromCy };
        const fromC1 = { x: fc.values[0], y: fc.values[1] };
        const fromEnd = { x: fc.values[2], y: fc.values[3] };
        const toStart = { x: toCx, y: toCy };
        const toC1 = { x: tc.values[0], y: tc.values[1] };
        const toEnd = { x: tc.values[2], y: tc.values[3] };
        const fromEdge = decomposePolar(fromStart, fromEnd);
        const toEdge = decomposePolar(toStart, toEnd);
        if (fromEdge.length > EPSILON2 || toEdge.length > EPSILON2) {
          entry.intrinsic = {
            fromEdge,
            toEdge,
            fromC1: decomposeHandle(fromC1, fromStart, fromEnd),
            toC1: decomposeHandle(toC1, toStart, toEnd)
          };
        }
        fromCx = fromEnd.x;
        fromCy = fromEnd.y;
        toCx = toEnd.x;
        toCy = toEnd.y;
        break;
      }
      case "Z": {
        break;
      }
      default: {
        if (fc.values.length >= 2) {
          fromCx = fc.values[fc.values.length - 2];
          fromCy = fc.values[fc.values.length - 1];
          toCx = tc.values[tc.values.length - 2];
          toCy = tc.values[tc.values.length - 1];
        }
        break;
      }
    }
    entries.push(entry);
  }
  return (t) => {
    if (t <= 0)
      return fromD;
    if (t >= 1)
      return toD;
    let cursorX = 0, cursorY = 0;
    return entries.map((entry) => {
      if (!entry.intrinsic) {
        const values = entry.fromValues.map((v, j2) => lerp(v, entry.toValues[j2], t));
        switch (entry.command) {
          case "M":
            cursorX = values[0];
            cursorY = values[1];
            break;
          case "L":
            cursorX = values[0];
            cursorY = values[1];
            break;
          case "H":
            cursorX = values[0];
            break;
          case "V":
            cursorY = values[0];
            break;
          case "C":
            cursorX = values[4];
            cursorY = values[5];
            break;
          case "Q":
            cursorX = values[2];
            cursorY = values[3];
            break;
        }
        return formatCommand(entry.command, values);
      }
      const { fromEdge, toEdge } = entry.intrinsic;
      const interpLength = lerp(fromEdge.length, toEdge.length, t);
      const interpAngle = angleLerp(fromEdge.angle, toEdge.angle, t);
      const start = { x: cursorX, y: cursorY };
      const end = reconstructFromPolar(start, { length: interpLength, angle: interpAngle });
      switch (entry.command) {
        case "L": {
          cursorX = end.x;
          cursorY = end.y;
          return formatCommand("L", [end.x, end.y]);
        }
        case "H": {
          cursorX = end.x;
          return formatCommand("H", [end.x]);
        }
        case "V": {
          cursorY = end.y;
          return formatCommand("V", [end.y]);
        }
        case "C": {
          const c1 = entry.intrinsic.fromC1 && entry.intrinsic.toC1 ? reconstructHandle(lerpIntrinsicHandle(entry.intrinsic.fromC1, entry.intrinsic.toC1, t), start, end) : { x: lerp(entry.fromValues[0], entry.toValues[0], t), y: lerp(entry.fromValues[1], entry.toValues[1], t) };
          const c2 = entry.intrinsic.fromC2 && entry.intrinsic.toC2 ? reconstructHandle(lerpIntrinsicHandle(entry.intrinsic.fromC2, entry.intrinsic.toC2, t), start, end) : { x: lerp(entry.fromValues[2], entry.toValues[2], t), y: lerp(entry.fromValues[3], entry.toValues[3], t) };
          cursorX = end.x;
          cursorY = end.y;
          return formatCommand("C", [c1.x, c1.y, c2.x, c2.y, end.x, end.y]);
        }
        case "Q": {
          const c1 = entry.intrinsic.fromC1 && entry.intrinsic.toC1 ? reconstructHandle(lerpIntrinsicHandle(entry.intrinsic.fromC1, entry.intrinsic.toC1, t), start, end) : { x: lerp(entry.fromValues[0], entry.toValues[0], t), y: lerp(entry.fromValues[1], entry.toValues[1], t) };
          cursorX = end.x;
          cursorY = end.y;
          return formatCommand("Q", [c1.x, c1.y, end.x, end.y]);
        }
        default: {
          const values = entry.fromValues.map((v, j2) => lerp(v, entry.toValues[j2], t));
          if (values.length >= 2) {
            cursorX = values[values.length - 2];
            cursorY = values[values.length - 1];
          }
          return formatCommand(entry.command, values);
        }
      }
    }).join(" ");
  };
}
function attemptCrossIconMorph(fromD, toD) {
  const from = normalizeToCubicPath(fromD);
  const to = normalizeToCubicPath(toD);
  if (!from || !to) {
    return null;
  }
  return crossIconMorph(from, to);
}
function bestGuessMorph(fromD, toD) {
  const from = normalizeToCubicPath(fromD);
  const to = normalizeToCubicPath(toD);
  if (!from || !to) {
    return null;
  }
  const aligned = alignCubicPaths(from, to);
  if (!aligned) {
    return null;
  }
  const [alignedFrom, alignedTo] = aligned;
  const normalizedFrom = serializeCubicPath(alignedFrom);
  const normalizedTo = serializeCubicPath(alignedTo);
  let interpolate;
  try {
    interpolate = strictMorph(normalizedFrom, normalizedTo);
  } catch {
    return null;
  }
  return (t) => {
    if (t <= 0)
      return fromD;
    if (t >= 1)
      return toD;
    return interpolate(t);
  };
}
function canonicalizeCommands(d) {
  const tokens = tokenize4(d);
  const commands = [];
  let index = 0;
  let cx = 0;
  let cy = 0;
  let subPathStartX = 0;
  let subPathStartY = 0;
  function readNumber() {
    return parseFloat(tokens[index++] ?? "0");
  }
  while (index < tokens.length) {
    const token = tokens[index++];
    if (!token || !/^[a-zA-Z]$/.test(token)) {
      continue;
    }
    switch (token) {
      case "M":
      case "m": {
        const isRelative = token === "m";
        if (!hasNumbers2(tokens, index, 2))
          break;
        cx = readNumber() + (isRelative ? cx : 0);
        cy = readNumber() + (isRelative ? cy : 0);
        subPathStartX = cx;
        subPathStartY = cy;
        commands.push({ command: "M", values: [cx, cy] });
        while (hasNumbers2(tokens, index, 2)) {
          cx = readNumber() + (isRelative ? cx : 0);
          cy = readNumber() + (isRelative ? cy : 0);
          commands.push({ command: "L", values: [cx, cy] });
        }
        break;
      }
      case "L":
      case "l": {
        const isRelative = token === "l";
        while (hasNumbers2(tokens, index, 2)) {
          cx = readNumber() + (isRelative ? cx : 0);
          cy = readNumber() + (isRelative ? cy : 0);
          commands.push({ command: "L", values: [cx, cy] });
        }
        break;
      }
      case "H":
      case "h": {
        const isRelative = token === "h";
        while (hasNumbers2(tokens, index, 1)) {
          cx = readNumber() + (isRelative ? cx : 0);
          commands.push({ command: "H", values: [cx] });
        }
        break;
      }
      case "V":
      case "v": {
        const isRelative = token === "v";
        while (hasNumbers2(tokens, index, 1)) {
          cy = readNumber() + (isRelative ? cy : 0);
          commands.push({ command: "V", values: [cy] });
        }
        break;
      }
      case "C":
      case "c": {
        const isRelative = token === "c";
        while (hasNumbers2(tokens, index, 6)) {
          const x1 = readNumber() + (isRelative ? cx : 0);
          const y1 = readNumber() + (isRelative ? cy : 0);
          const x2 = readNumber() + (isRelative ? cx : 0);
          const y2 = readNumber() + (isRelative ? cy : 0);
          cx = readNumber() + (isRelative ? cx : 0);
          cy = readNumber() + (isRelative ? cy : 0);
          commands.push({ command: "C", values: [x1, y1, x2, y2, cx, cy] });
        }
        break;
      }
      case "Q":
      case "q": {
        const isRelative = token === "q";
        while (hasNumbers2(tokens, index, 4)) {
          const x1 = readNumber() + (isRelative ? cx : 0);
          const y1 = readNumber() + (isRelative ? cy : 0);
          cx = readNumber() + (isRelative ? cx : 0);
          cy = readNumber() + (isRelative ? cy : 0);
          commands.push({ command: "Q", values: [x1, y1, cx, cy] });
        }
        break;
      }
      case "A":
      case "a": {
        const isRelative = token === "a";
        while (hasNumbers2(tokens, index, 7)) {
          const rx = readNumber();
          const ry = readNumber();
          const xAxisRotation = readNumber();
          const largeArc = readNumber();
          const sweep = readNumber();
          cx = readNumber() + (isRelative ? cx : 0);
          cy = readNumber() + (isRelative ? cy : 0);
          commands.push({
            command: "A",
            values: [rx, ry, xAxisRotation, largeArc, sweep, cx, cy]
          });
        }
        break;
      }
      case "Z":
      case "z":
        cx = subPathStartX;
        cy = subPathStartY;
        commands.push({ command: "Z", values: [] });
        break;
      default:
        break;
    }
  }
  return commands;
}
function normalizeToCubicPath(d) {
  const path4 = parseSvgPath(d);
  const normalized = [];
  for (const subPath of path4.subPaths) {
    const firstPoint = subPath.points[0];
    if (!firstPoint)
      continue;
    const segments = [];
    for (let index = 1;index < subPath.points.length; index += 1) {
      const prev = subPath.points[index - 1];
      const next = subPath.points[index];
      if (next.segment?.type === "arc") {
        const arc = next.segment;
        const arcSegments = arcToCubicSegments(prev.position, arc.rx ?? 0, arc.ry ?? 0, arc.xAxisRotation ?? 0, arc.largeArc ? 1 : 0, arc.sweep ? 1 : 0, next.position);
        if (arcSegments.length === 0) {
          segments.push({
            c1: clonePoint(prev.position),
            c2: clonePoint(next.position),
            end: clonePoint(next.position)
          });
        } else {
          segments.push(...arcSegments);
        }
        continue;
      }
      const segment = toCubicSegment(prev, next);
      if (!segment) {
        return null;
      }
      segments.push(segment);
    }
    normalized.push({
      start: clonePoint(firstPoint.position),
      segments,
      closed: subPath.closed
    });
  }
  return normalized;
}
function toCubicSegment(prev, next) {
  if (next.segment?.type === "arc") {
    const arc = next.segment;
    const segments = arcToCubicSegments(prev.position, arc.rx ?? 0, arc.ry ?? 0, arc.xAxisRotation ?? 0, arc.largeArc ? 1 : 0, arc.sweep ? 1 : 0, next.position);
    if (segments.length === 0) {
      return {
        c1: clonePoint(prev.position),
        c2: clonePoint(next.position),
        end: clonePoint(next.position)
      };
    }
    return segments[segments.length - 1];
  }
  if (next.segment?.type === "quadratic") {
    const control = next.segment.control;
    return {
      c1: {
        x: prev.position.x + (control.x - prev.position.x) * 2 / 3,
        y: prev.position.y + (control.y - prev.position.y) * 2 / 3
      },
      c2: {
        x: next.position.x + (control.x - next.position.x) * 2 / 3,
        y: next.position.y + (control.y - next.position.y) * 2 / 3
      },
      end: clonePoint(next.position)
    };
  }
  if (next.segment?.type === "cubic" || prev.handleOut || next.handleIn) {
    return {
      c1: clonePoint(prev.handleOut ?? prev.position),
      c2: clonePoint(next.handleIn ?? next.position),
      end: clonePoint(next.position)
    };
  }
  return {
    c1: clonePoint(prev.position),
    c2: clonePoint(next.position),
    end: clonePoint(next.position)
  };
}
function alignCubicPaths(from, to) {
  const left = cloneCubicPath(from);
  const right = cloneCubicPath(to);
  const subPathCount = Math.max(left.length, right.length);
  while (left.length < subPathCount) {
    const template = right[left.length];
    if (!template)
      return null;
    left.push(createDegenerateSubPath(getLastPoint(left), template));
  }
  while (right.length < subPathCount) {
    const template = left[right.length];
    if (!template)
      return null;
    right.push(createDegenerateSubPath(getLastPoint(right), template));
  }
  for (let index = 0;index < subPathCount; index += 1) {
    const leftSubPath = left[index];
    const rightSubPath = right[index];
    if (leftSubPath.closed !== rightSubPath.closed) {
      return null;
    }
    const segmentCount = Math.max(leftSubPath.segments.length, rightSubPath.segments.length);
    padSubPathSegments(leftSubPath, segmentCount);
    padSubPathSegments(rightSubPath, segmentCount);
    if (segmentCount > 1) {
      const reversedRight = reverseSubPathSegments(rightSubPath);
      const forwardCost = computeSubPathAlignmentCost(leftSubPath, rightSubPath);
      const reversedCost = computeSubPathAlignmentCost(leftSubPath, reversedRight);
      if (reversedCost < forwardCost) {
        right[index] = reversedRight;
      }
    }
    if (right[index].closed && leftSubPath.closed && segmentCount > 1) {
      const offset = findOptimalShapeIndex(leftSubPath, right[index]);
      if (offset > 0) {
        const rotated = rotateSubPathSegments(right[index], offset);
        right[index] = rotated;
      }
    }
  }
  return [left, right];
}
function createDegenerateSubPath(origin, template) {
  const start = clonePoint(origin);
  const segments = Array.from({ length: template.segments.length }, () => ({
    c1: clonePoint(start),
    c2: clonePoint(start),
    end: clonePoint(start)
  }));
  return {
    start,
    segments,
    closed: template.closed
  };
}
function padSubPathSegments(subPath, segmentCount) {
  let end = getSubPathEnd(subPath);
  while (subPath.segments.length < segmentCount) {
    subPath.segments.push({
      c1: clonePoint(end),
      c2: clonePoint(end),
      end: clonePoint(end)
    });
    end = getSubPathEnd(subPath);
  }
}
function serializeCubicPath(path4) {
  const commands = [];
  for (const subPath of path4) {
    commands.push(formatCommand("M", [subPath.start.x, subPath.start.y]));
    for (const segment of subPath.segments) {
      commands.push(formatCommand("C", [
        segment.c1.x,
        segment.c1.y,
        segment.c2.x,
        segment.c2.y,
        segment.end.x,
        segment.end.y
      ]));
    }
    if (subPath.closed) {
      commands.push("Z");
    }
  }
  return commands.join(" ");
}
function getLastPoint(path4) {
  const lastSubPath = path4[path4.length - 1];
  if (!lastSubPath) {
    return { x: 0, y: 0 };
  }
  return clonePoint(getSubPathEnd(lastSubPath));
}
function getSubPathEnd(subPath) {
  const lastSegment = subPath.segments[subPath.segments.length - 1];
  return lastSegment ? clonePoint(lastSegment.end) : clonePoint(subPath.start);
}
function cloneCubicPath(path4) {
  return path4.map((subPath) => ({
    start: clonePoint(subPath.start),
    closed: subPath.closed,
    segments: subPath.segments.map((segment) => ({
      c1: clonePoint(segment.c1),
      c2: clonePoint(segment.c2),
      end: clonePoint(segment.end)
    }))
  }));
}
function clonePoint(point) {
  return { x: point.x, y: point.y };
}
function tokenize4(d) {
  const tokens = [];
  const re = /([a-zA-Z])|([+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)/g;
  let match;
  while ((match = re.exec(d)) !== null) {
    tokens.push(match[0]);
  }
  return tokens;
}
function hasNumbers2(tokens, index, count) {
  for (let offset = 0;offset < count; offset += 1) {
    if (!isNumber3(tokens[index + offset])) {
      return false;
    }
  }
  return true;
}
function isNumber3(token) {
  return typeof token === "string" && /^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/.test(token);
}
function formatCommand(command, values) {
  if (values.length === 0) {
    return command;
  }
  return `${command}${values.map((value) => formatNumber3(value)).join(" ")}`;
}
function formatNumber3(value) {
  const rounded = Number(value.toFixed(3));
  return Object.is(rounded, -0) ? "0" : String(rounded);
}
function lerp(from, to, t) {
  return from + (to - from) * t;
}
function arrayEquals(a, b) {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

// ../../lib/runtime-core/cascade-tiers/compound-isomorphic.ts
function resolveCompoundIsomorphic(input) {
  const fromHas = hasCompound(input.from);
  const toHas = hasCompound(input.to);
  if (!fromHas || !toHas)
    return null;
  const fromC = input.from.compound;
  const toC = input.to.compound;
  if (!treesIsomorphic(fromC.tree, toC.tree))
    return null;
  const fromD = input.fromTopology.canonical?.d ?? "";
  const toD = input.toTopology.canonical?.d ?? "";
  const interpolator = bestGuessMorph(fromD, toD) ?? attemptCrossIconMorph(fromD, toD);
  if (!interpolator)
    return null;
  return {
    interpolator,
    motion: input.motion,
    distortion: 0,
    signal: null
  };
}
function treesIsomorphic(a, b) {
  if (a.kind !== b.kind)
    return false;
  if (a.kind === "leaf")
    return true;
  if (b.kind !== "op")
    return false;
  if (a.op !== b.op)
    return false;
  if (a.children.length !== b.children.length)
    return false;
  for (let i = 0;i < a.children.length; i++) {
    if (!treesIsomorphic(a.children[i], b.children[i]))
      return false;
  }
  return true;
}

// ../../lib/runtime-core/transition-metrics.ts
function sampleTrajectory(interpolator, n) {
  if (n < 2) {
    throw new Error(`sampleTrajectory requires n >= 2 (got ${n})`);
  }
  const frames = [];
  for (let i = 0;i < n; i++) {
    const t = i / (n - 1);
    frames.push({ t, d: interpolator(t) });
  }
  return { frames };
}
function boundaryDistortion(trajectory) {
  const perFrame = trajectory.frames.map((f) => ringsOf(f.d));
  if (perFrame.length < 2)
    return 0;
  let total = 0;
  let pairCount = 0;
  for (let i = 1;i < perFrame.length; i++) {
    const prev = perFrame[i - 1];
    const curr = perFrame[i];
    const ringCount = Math.min(prev.length, curr.length);
    for (let r = 0;r < ringCount; r++) {
      const a = turningFunction(prev[r]);
      const b = turningFunction(curr[r]);
      total += turningFunctionDistance(a, b);
      pairCount += 1;
    }
  }
  return pairCount === 0 ? 0 : total / pairCount;
}
function ringsOf(d) {
  const canonical = canonicalizePath(d);
  const tree = buildContourTree(canonical);
  const closed = tree.rings.map((r) => r.points);
  const open = openSubpathPolylines(canonical.d, tree.openSubpathIndices);
  return [...closed, ...open];
}
function openSubpathPolylines(d, openIndices) {
  if (openIndices.length === 0)
    return [];
  const wanted = new Set(openIndices);
  const polylines = [];
  const tokens = tokenizePath(d);
  let cursor = 0;
  let subpathIndex = -1;
  let current = null;
  let cx;
  let cy;
  function readNumber() {
    return Number.parseFloat(tokens[cursor++] ?? "0");
  }
  function pushPoint(x, y) {
    cx = x;
    cy = y;
    if (current)
      current.push({ x, y });
  }
  while (cursor < tokens.length) {
    const token = tokens[cursor++];
    if (!token || !/^[a-zA-Z]$/.test(token))
      continue;
    const upper = token.toUpperCase();
    switch (upper) {
      case "M": {
        if (current)
          polylines.push(current);
        subpathIndex += 1;
        cx = readNumber();
        cy = readNumber();
        current = wanted.has(subpathIndex) ? [{ x: cx, y: cy }] : null;
        while (hasNumberPair2(tokens, cursor)) {
          pushPoint(readNumber(), readNumber());
        }
        break;
      }
      case "L":
        while (hasNumberPair2(tokens, cursor)) {
          pushPoint(readNumber(), readNumber());
        }
        break;
      case "Q":
        while (hasNumberPair2(tokens, cursor) && hasNumberPair2(tokens, cursor + 2)) {
          readNumber();
          readNumber();
          pushPoint(readNumber(), readNumber());
        }
        break;
      case "C":
        while (hasNumberPair2(tokens, cursor) && hasNumberPair2(tokens, cursor + 2) && hasNumberPair2(tokens, cursor + 4)) {
          readNumber();
          readNumber();
          readNumber();
          readNumber();
          pushPoint(readNumber(), readNumber());
        }
        break;
      case "A":
        while (hasNumber2(tokens, cursor) && hasNumber2(tokens, cursor + 1) && hasNumber2(tokens, cursor + 2) && hasNumber2(tokens, cursor + 3) && hasNumber2(tokens, cursor + 4) && hasNumberPair2(tokens, cursor + 5)) {
          readNumber();
          readNumber();
          readNumber();
          readNumber();
          readNumber();
          pushPoint(readNumber(), readNumber());
        }
        break;
      case "Z":
        if (current) {
          polylines.push(current);
          current = null;
        }
        break;
      default:
        break;
    }
  }
  if (current)
    polylines.push(current);
  return polylines;
}
function tokenizePath(d) {
  const matches = d.match(/[a-zA-Z]|-?\d*\.?\d+(?:[eE][+-]?\d+)?/g);
  return matches ?? [];
}
function hasNumber2(tokens, index) {
  const token = tokens[index];
  if (!token)
    return false;
  return /^-?\d*\.?\d+(?:[eE][+-]?\d+)?$/.test(token);
}
function hasNumberPair2(tokens, index) {
  return hasNumber2(tokens, index) && hasNumber2(tokens, index + 1);
}
function turningFunction(points) {
  if (points.length < 2)
    return [[0, 0]];
  const segLengths = [];
  let total = 0;
  for (let i = 0;i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    segLengths.push(len);
    total += len;
  }
  if (total === 0)
    return [[0, 0]];
  const result = [[0, 0]];
  let cumulativeS = 0;
  let cumulativeTheta = 0;
  for (let i = 0;i < points.length; i++) {
    const prev = points[(i - 1 + points.length) % points.length];
    const curr = points[i];
    const next = points[(i + 1) % points.length];
    const a1 = Math.atan2(curr.y - prev.y, curr.x - prev.x);
    const a2 = Math.atan2(next.y - curr.y, next.x - curr.x);
    let delta = a2 - a1;
    while (delta > Math.PI)
      delta -= 2 * Math.PI;
    while (delta < -Math.PI)
      delta += 2 * Math.PI;
    cumulativeTheta += delta;
    cumulativeS += segLengths[i] / total;
    result.push([cumulativeS, cumulativeTheta]);
  }
  return result;
}
function turningFunctionDistance(a, b) {
  const breakpoints = Array.from(new Set([...a.map(([s]) => s), ...b.map(([s]) => s)])).sort((x, y) => x - y);
  let total = 0;
  for (let i = 1;i < breakpoints.length; i++) {
    const s0 = breakpoints[i - 1];
    const s1 = breakpoints[i];
    const va = sampleTurning(a, s0);
    const vb = sampleTurning(b, s0);
    total += Math.abs(va - vb) * (s1 - s0);
  }
  return total;
}
function sampleTurning(fn, s) {
  let value = fn[0]?.[1] ?? 0;
  for (const [bs, bv] of fn) {
    if (bs <= s)
      value = bv;
    else
      break;
  }
  return value;
}

// ../../lib/runtime-core/cascade-tiers/intrinsic-strict.ts
var SAMPLE_FRAMES = 5;
function resolveIntrinsicStrict(input) {
  if (input.taxonomy === "T6" || input.taxonomy === "T7" || input.taxonomy === "T8") {
    return null;
  }
  const fromCanonical = input.fromTopology.canonical;
  const toCanonical = input.toTopology.canonical;
  if (!fromCanonical || !toCanonical)
    return null;
  if (!hasMatchingSignature(fromCanonical.stats, toCanonical.stats)) {
    return null;
  }
  let interpolator;
  try {
    interpolator = intrinsicStrictMorph(fromCanonical.d, toCanonical.d);
  } catch {
    return null;
  }
  if (!interpolator) {
    interpolator = bestGuessMorph(fromCanonical.d, toCanonical.d);
    if (!interpolator)
      return null;
  }
  const distortion = estimateDistortion(interpolator);
  return {
    interpolator,
    motion: input.motion,
    distortion,
    signal: null
  };
}
function hasMatchingSignature(a, b) {
  if (a.subpathCount !== b.subpathCount)
    return false;
  if (a.commandSignature.length !== b.commandSignature.length)
    return false;
  for (let i = 0;i < a.commandSignature.length; i++) {
    if (a.commandSignature[i] !== b.commandSignature[i])
      return false;
  }
  if (a.closed.length !== b.closed.length)
    return false;
  for (let i = 0;i < a.closed.length; i++) {
    if (a.closed[i] !== b.closed[i])
      return false;
  }
  return true;
}
function estimateDistortion(interpolator) {
  try {
    const trajectory = sampleTrajectory(interpolator, SAMPLE_FRAMES);
    return boundaryDistortion(trajectory);
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

// ../../lib/runtime-core/cascade-tiers/hungarian-matcher.ts
var import_hungarian_on3 = __toESM(require_hungarianOn3(), 1);

// ../../lib/runtime-core/correspondence-hints.ts
function resolveSubpathPins(hints, fromSubpathCount, toSubpathCount) {
  const pins = [];
  const seenFrom = new Set;
  const seenTo = new Set;
  for (const [fromId, toId] of hints.subpath) {
    const fromIndex = parseSubpathId(fromId);
    const toIndex = parseSubpathId(toId);
    if (fromIndex === null || toIndex === null)
      continue;
    if (fromIndex < 0 || fromIndex >= fromSubpathCount)
      continue;
    if (toIndex < 0 || toIndex >= toSubpathCount)
      continue;
    if (seenFrom.has(fromIndex) || seenTo.has(toIndex))
      continue;
    seenFrom.add(fromIndex);
    seenTo.add(toIndex);
    pins.push({ fromIndex, toIndex });
  }
  return pins;
}
function parseSubpathId(id) {
  const match = /^subpath:(\d+)$/.exec(id);
  if (!match)
    return null;
  const idx = Number.parseInt(match[1], 10);
  if (!Number.isFinite(idx))
    return null;
  return idx;
}

// ../../lib/runtime-core/cascade-tiers/hungarian-matcher.ts
var FORBIDDEN_COST = 1e9;
var PIN_REWARD = 0;
function hungarianMatch(fromCanonical, toCanonical, hints) {
  const fromCount = fromCanonical.stats.subpathCount;
  const toCount = toCanonical.stats.subpathCount;
  if (fromCount === 0 || toCount === 0) {
    return {
      matches: [],
      fromOrphans: Array.from({ length: fromCount }, (_, i) => i),
      toOrphans: Array.from({ length: toCount }, (_, i) => i)
    };
  }
  const stats = perSubpathStats(fromCanonical, toCanonical);
  const pins = resolveSubpathPins(hints, fromCount, toCount);
  const pinFromMap = new Map;
  const pinToMap = new Map;
  for (const pin of pins) {
    pinFromMap.set(pin.fromIndex, pin.toIndex);
    pinToMap.set(pin.toIndex, pin.fromIndex);
  }
  const matrix = [];
  for (let f = 0;f < fromCount; f++) {
    const row = [];
    const pinnedTo = pinFromMap.get(f);
    for (let t = 0;t < toCount; t++) {
      if (pinnedTo !== undefined) {
        row.push(pinnedTo === t ? PIN_REWARD : FORBIDDEN_COST);
      } else if (pinToMap.has(t)) {
        row.push(FORBIDDEN_COST);
      } else {
        row.push(pairCost(stats.from[f], stats.to[t], stats.span));
      }
    }
    matrix.push(row);
  }
  const assignment = import_hungarian_on3.default(matrix);
  const matches = [];
  const fromUsed = new Set;
  const toUsed = new Set;
  for (const [f, t] of assignment) {
    if (f < 0 || f >= fromCount)
      continue;
    if (t < 0 || t >= toCount)
      continue;
    const cost = matrix[f][t];
    if (cost >= FORBIDDEN_COST)
      continue;
    matches.push({ fromIndex: f, toIndex: t, cost });
    fromUsed.add(f);
    toUsed.add(t);
  }
  const fromOrphans = [];
  for (let f = 0;f < fromCount; f++)
    if (!fromUsed.has(f))
      fromOrphans.push(f);
  const toOrphans = [];
  for (let t = 0;t < toCount; t++)
    if (!toUsed.has(t))
      toOrphans.push(t);
  return { matches, fromOrphans, toOrphans };
}
function perSubpathStats(from, to) {
  const fromStats = buildPerSubpathStats(from);
  const toStats = buildPerSubpathStats(to);
  const span = Math.max(diagonalOf(from), diagonalOf(to), 1);
  return { from: fromStats, to: toStats, span };
}
function diagonalOf(p) {
  const { minX, minY, maxX, maxY } = p.stats.bbox;
  return Math.hypot(maxX - minX, maxY - minY);
}
function buildPerSubpathStats(canonical) {
  const subpaths = splitSubpaths(canonical.d);
  return subpaths.map((d, i) => {
    const points = subpathPoints(d);
    const closed = canonical.stats.closed[i] ?? false;
    return {
      centroid: meanPoint(points),
      bbox: bboxSize(points),
      signedArea: closed ? signedArea2(points) : 0,
      commandLength: d.split(" ").length,
      closed
    };
  });
}
function pairCost(a, b, span) {
  const typePenalty = a.closed === b.closed ? 0 : 0.6;
  const centroidDist = Math.hypot(a.centroid.x - b.centroid.x, a.centroid.y - b.centroid.y) / span;
  const areaDiff = a.closed && b.closed ? Math.abs(Math.abs(a.signedArea) - Math.abs(b.signedArea)) / Math.max(Math.abs(a.signedArea), Math.abs(b.signedArea), 1) : 0;
  const aw = Math.max(a.bbox.width, 0.001);
  const ah = Math.max(a.bbox.height, 0.001);
  const bw = Math.max(b.bbox.width, 0.001);
  const bh = Math.max(b.bbox.height, 0.001);
  const bboxDiff = Math.abs(aw - bw) / Math.max(aw, bw) + Math.abs(ah - bh) / Math.max(ah, bh);
  const sigDiff = Math.abs(a.commandLength - b.commandLength) / Math.max(a.commandLength, b.commandLength, 1);
  return typePenalty + 0.4 * centroidDist + 0.25 * bboxDiff + 0.2 * areaDiff + 0.15 * sigDiff;
}
function splitSubpaths(d) {
  const parts = d.split(/(?=\bM)/);
  return parts.map((p) => p.trim()).filter((p) => p.length > 0);
}
function reorderCanonicalSubpaths(d, priority) {
  const subpaths = splitSubpaths(d);
  if (subpaths.length === 0)
    return d;
  const seen = new Set;
  const out = [];
  for (const idx of priority) {
    if (idx < 0 || idx >= subpaths.length || seen.has(idx))
      continue;
    out.push(subpaths[idx]);
    seen.add(idx);
  }
  for (let i = 0;i < subpaths.length; i++) {
    if (!seen.has(i))
      out.push(subpaths[i]);
  }
  return out.join(" ").replace(/\s+/g, " ").trim();
}
function subpathPoints(d) {
  const tokens = d.match(/[a-zA-Z]|-?\d*\.?\d+/g) ?? [];
  const points = [];
  let i = 0;
  while (i < tokens.length) {
    const t = tokens[i];
    if (!/^[a-zA-Z]$/.test(t)) {
      i += 1;
      continue;
    }
    i += 1;
    const cmd = t.toUpperCase();
    if (cmd === "M" || cmd === "L") {
      while (i + 1 < tokens.length && /^-?\d*\.?\d+$/.test(tokens[i] ?? "") && /^-?\d*\.?\d+$/.test(tokens[i + 1] ?? "")) {
        points.push({
          x: Number.parseFloat(tokens[i]),
          y: Number.parseFloat(tokens[i + 1])
        });
        i += 2;
      }
    } else if (cmd === "C") {
      while (i + 5 < tokens.length) {
        const ok = [0, 1, 2, 3, 4, 5].every((k) => /^-?\d*\.?\d+$/.test(tokens[i + k] ?? ""));
        if (!ok)
          break;
        points.push({
          x: Number.parseFloat(tokens[i + 4]),
          y: Number.parseFloat(tokens[i + 5])
        });
        i += 6;
      }
    } else if (cmd === "Q") {
      while (i + 3 < tokens.length) {
        const ok = [0, 1, 2, 3].every((k) => /^-?\d*\.?\d+$/.test(tokens[i + k] ?? ""));
        if (!ok)
          break;
        points.push({
          x: Number.parseFloat(tokens[i + 2]),
          y: Number.parseFloat(tokens[i + 3])
        });
        i += 4;
      }
    } else if (cmd === "A") {
      while (i + 6 < tokens.length) {
        const ok = [0, 1, 2, 3, 4, 5, 6].every((k) => /^-?\d*\.?\d+$/.test(tokens[i + k] ?? ""));
        if (!ok)
          break;
        points.push({
          x: Number.parseFloat(tokens[i + 5]),
          y: Number.parseFloat(tokens[i + 6])
        });
        i += 7;
      }
    } else if (cmd === "Z") {}
  }
  return points;
}
function meanPoint(points) {
  if (points.length === 0)
    return { x: 0, y: 0 };
  let sx = 0;
  let sy = 0;
  for (const p of points) {
    sx += p.x;
    sy += p.y;
  }
  return { x: sx / points.length, y: sy / points.length };
}
function bboxSize(points) {
  if (points.length === 0)
    return { width: 0, height: 0 };
  let minX = points[0].x;
  let minY = points[0].y;
  let maxX = minX;
  let maxY = minY;
  for (const p of points) {
    if (p.x < minX)
      minX = p.x;
    if (p.y < minY)
      minY = p.y;
    if (p.x > maxX)
      maxX = p.x;
    if (p.y > maxY)
      maxY = p.y;
  }
  return { width: maxX - minX, height: maxY - minY };
}
function signedArea2(points) {
  if (points.length < 3)
    return 0;
  let area = 0;
  for (let i = 0;i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    area += a.x * b.y - b.x * a.y;
  }
  return area / 2;
}

// ../../lib/runtime-core/cascade-tiers/hierarchical-match.ts
var SAMPLE_FRAMES2 = 5;
function resolveHierarchicalMatch(input) {
  if (input.taxonomy === "T6" || input.taxonomy === "T7" || input.taxonomy === "T8") {
    return null;
  }
  const fromCanonical = input.fromTopology.canonical;
  const toCanonical = input.toTopology.canonical;
  if (!fromCanonical || !toCanonical)
    return null;
  const match = hungarianMatch(fromCanonical, toCanonical, input.hints);
  const fromD = match.matches.length > 0 ? reorderCanonicalSubpaths(fromCanonical.d, match.matches.map((m) => m.fromIndex)) : fromCanonical.d;
  const toD = match.matches.length > 0 ? reorderCanonicalSubpaths(toCanonical.d, match.matches.map((m) => m.toIndex)) : toCanonical.d;
  let interpolator = bestGuessMorph(fromD, toD);
  if (!interpolator) {
    interpolator = attemptCrossIconMorph(fromD, toD);
  }
  if (!interpolator)
    return null;
  const distortion = estimateDistortion2(interpolator);
  return {
    interpolator,
    motion: input.motion,
    distortion,
    signal: null
  };
}
function estimateDistortion2(interpolator) {
  try {
    const trajectory = sampleTrajectory(interpolator, SAMPLE_FRAMES2);
    return boundaryDistortion(trajectory);
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

// ../../lib/runtime-core/cascade-tiers/arap-wrap.ts
var poly2tri = __toESM(require_poly2tri(), 1);
function triangulateContourTree(tree) {
  if (tree.rings.length === 0)
    return [];
  const outer = tree.rings.reduce((acc, r) => Math.abs(r.signedArea) > Math.abs(acc.signedArea) ? r : acc, tree.rings[0]);
  const outerNodeIdx = tree.rings.findIndex((r) => r === outer);
  const outerNode = tree.nodes[outerNodeIdx];
  if (!outerNode)
    return [];
  const holes = [];
  for (const childIdx of outerNode.children) {
    const child = tree.rings[childIdx];
    if (!child)
      continue;
    holes.push(toContourPoints(child.points));
  }
  const swctx = new poly2tri.SweepContext(toContourPoints(outer.points));
  for (const hole of holes)
    swctx.addHole(hole);
  swctx.triangulate();
  return swctx.getTriangles().map((t) => ({
    a: { x: t.getPoint(0).x, y: t.getPoint(0).y },
    b: { x: t.getPoint(1).x, y: t.getPoint(1).y },
    c: { x: t.getPoint(2).x, y: t.getPoint(2).y }
  }));
}
function toContourPoints(points) {
  if (points.length < 2)
    return [...points];
  const last = points[points.length - 1];
  const first = points[0];
  if (last.x === first.x && last.y === first.y)
    return points.slice(0, -1);
  return [...points];
}
function shouldWrapWithArap(tree) {
  if (!tree || tree.rings.length === 0)
    return false;
  const outer = tree.rings.reduce((acc, r) => Math.abs(r.signedArea) > Math.abs(acc.signedArea) ? r : acc, tree.rings[0]);
  return countSharpTurns(outer.points) >= 5;
}
function countSharpTurns(points) {
  if (points.length < 3)
    return 0;
  let count = 0;
  for (let i = 0;i < points.length; i++) {
    const prev = points[(i - 1 + points.length) % points.length];
    const curr = points[i];
    const next = points[(i + 1) % points.length];
    const a1 = Math.atan2(curr.y - prev.y, curr.x - prev.x);
    const a2 = Math.atan2(next.y - curr.y, next.x - curr.x);
    let delta = a2 - a1;
    while (delta > Math.PI)
      delta -= 2 * Math.PI;
    while (delta < -Math.PI)
      delta += 2 * Math.PI;
    if (Math.abs(delta) > Math.PI / 3)
      count += 1;
  }
  return count;
}
function wrapWithArap(baseline, fromTree, _toTree) {
  if (!fromTree)
    return baseline;
  let triangleData = null;
  let sourceVertices = [];
  let targetVertices = [];
  let sourceClosed = false;
  let initFailed = false;
  function init() {
    if (triangleData !== null || initFailed)
      return;
    try {
      const sourceD = baseline(0);
      const targetD = baseline(1);
      sourceVertices = extractAnchorPoints(sourceD);
      targetVertices = extractAnchorPoints(targetD);
      sourceClosed = /[Zz]\s*$/.test(sourceD.trim());
      if (sourceVertices.length === 0 || sourceVertices.length !== targetVertices.length) {
        initFailed = true;
        return;
      }
      const triangles = triangulateContourTree(fromTree);
      if (triangles.length === 0) {
        initFailed = true;
        return;
      }
      const data = [];
      for (const tri of triangles) {
        const ia = nearestVertexIndex(tri.a, sourceVertices);
        const ib = nearestVertexIndex(tri.b, sourceVertices);
        const ic = nearestVertexIndex(tri.c, sourceVertices);
        if (ia < 0 || ib < 0 || ic < 0)
          continue;
        if (ia === ib || ib === ic || ic === ia)
          continue;
        const sa = sourceVertices[ia];
        const sb = sourceVertices[ib];
        const sc = sourceVertices[ic];
        const ta = targetVertices[ia];
        const tb = targetVertices[ib];
        const tc = targetVertices[ic];
        const sourceCentroid = centroidOf(sa, sb, sc);
        const targetCentroid = centroidOf(ta, tb, tc);
        const F = computeAffine2x2(sub(sa, sourceCentroid), sub(sb, sourceCentroid), sub(ta, targetCentroid), sub(tb, targetCentroid));
        if (!F)
          continue;
        const { rotationAngle, scale } = polarDecomposition2D(F);
        const area = Math.abs(triangleArea(sa, sb, sc));
        if (area < 0.000000001)
          continue;
        data.push({
          vertexIndices: [ia, ib, ic],
          sourceCentroid,
          targetCentroid,
          rotationAngle,
          scale,
          area
        });
      }
      if (data.length === 0) {
        initFailed = true;
        return;
      }
      triangleData = data;
    } catch {
      initFailed = true;
    }
  }
  return (t) => {
    if (t <= 0)
      return baseline(0);
    if (t >= 1)
      return baseline(1);
    init();
    if (initFailed || !triangleData)
      return baseline(t);
    const acc = new Array(sourceVertices.length);
    for (let i = 0;i < sourceVertices.length; i++) {
      acc[i] = { x: 0, y: 0, weight: 0 };
    }
    for (const td of triangleData) {
      const cx = (1 - t) * td.sourceCentroid.x + t * td.targetCentroid.x;
      const cy = (1 - t) * td.sourceCentroid.y + t * td.targetCentroid.y;
      const angleT = t * td.rotationAngle;
      const cosA = Math.cos(angleT);
      const sinA = Math.sin(angleT);
      const sa = 1 - t + t * td.scale.a;
      const sb = t * td.scale.b;
      const sc2 = t * td.scale.c;
      const sd = 1 - t + t * td.scale.d;
      const f00 = cosA * sa - sinA * sc2;
      const f01 = cosA * sb - sinA * sd;
      const f10 = sinA * sa + cosA * sc2;
      const f11 = sinA * sb + cosA * sd;
      for (let i = 0;i < 3; i++) {
        const idx = td.vertexIndices[i];
        const sv = sourceVertices[idx];
        const ux = sv.x - td.sourceCentroid.x;
        const uy = sv.y - td.sourceCentroid.y;
        const dx = f00 * ux + f01 * uy;
        const dy = f10 * ux + f11 * uy;
        const px = cx + dx;
        const py = cy + dy;
        acc[idx].x += px * td.area;
        acc[idx].y += py * td.area;
        acc[idx].weight += td.area;
      }
    }
    const morphed = sourceVertices.map((sv, i) => {
      const a = acc[i];
      if (a.weight === 0) {
        const tv = targetVertices[i];
        return { x: (1 - t) * sv.x + t * tv.x, y: (1 - t) * sv.y + t * tv.y };
      }
      return { x: a.x / a.weight, y: a.y / a.weight };
    });
    return verticesToPolylinePath(morphed, sourceClosed);
  };
}
function sub(a, b) {
  return { x: a.x - b.x, y: a.y - b.y };
}
function centroidOf(a, b, c) {
  return { x: (a.x + b.x + c.x) / 3, y: (a.y + b.y + c.y) / 3 };
}
function triangleArea(a, b, c) {
  return ((b.x - a.x) * (c.y - a.y) - (c.x - a.x) * (b.y - a.y)) / 2;
}
function nearestVertexIndex(p, vertices) {
  let best = -1;
  let bestSq = Number.POSITIVE_INFINITY;
  for (let i = 0;i < vertices.length; i++) {
    const v = vertices[i];
    const dx = p.x - v.x;
    const dy = p.y - v.y;
    const sq = dx * dx + dy * dy;
    if (sq < bestSq) {
      bestSq = sq;
      best = i;
    }
  }
  return bestSq < 0.001 ? best : -1;
}
function computeAffine2x2(sa, sb, ta, tb) {
  const det = sa.x * sb.y - sa.y * sb.x;
  if (Math.abs(det) < 0.000000001)
    return null;
  return {
    a: (ta.x * sb.y - tb.x * sa.y) / det,
    b: (-ta.x * sb.x + tb.x * sa.x) / det,
    c: (ta.y * sb.y - tb.y * sa.y) / det,
    d: (-ta.y * sb.x + tb.y * sa.x) / det
  };
}
function polarDecomposition2D(F) {
  const detF = F.a * F.d - F.b * F.c;
  const theta = detF >= 0 ? Math.atan2(F.c - F.b, F.a + F.d) : 0;
  const cosT = Math.cos(theta);
  const sinT = Math.sin(theta);
  return {
    rotationAngle: theta,
    scale: {
      a: cosT * F.a + sinT * F.c,
      b: cosT * F.b + sinT * F.d,
      c: -sinT * F.a + cosT * F.c,
      d: -sinT * F.b + cosT * F.d
    }
  };
}
function extractAnchorPoints(d) {
  const points = [];
  const tokens = d.match(/[a-zA-Z]|-?\d*\.?\d+(?:[eE][+-]?\d+)?/g) ?? [];
  let cursor = 0;
  while (cursor < tokens.length) {
    const cmd = tokens[cursor++];
    if (!/^[a-zA-Z]$/.test(cmd))
      continue;
    const upper = cmd.toUpperCase();
    if (upper === "M" || upper === "L") {
      while (cursor + 1 < tokens.length && isNumber4(tokens[cursor]) && isNumber4(tokens[cursor + 1])) {
        points.push({ x: +tokens[cursor], y: +tokens[cursor + 1] });
        cursor += 2;
      }
    } else if (upper === "C") {
      while (cursor + 5 < tokens.length && isNumber4(tokens[cursor]) && isNumber4(tokens[cursor + 1]) && isNumber4(tokens[cursor + 2]) && isNumber4(tokens[cursor + 3]) && isNumber4(tokens[cursor + 4]) && isNumber4(tokens[cursor + 5])) {
        points.push({ x: +tokens[cursor + 4], y: +tokens[cursor + 5] });
        cursor += 6;
      }
    } else if (upper === "Q") {
      while (cursor + 3 < tokens.length && isNumber4(tokens[cursor]) && isNumber4(tokens[cursor + 1]) && isNumber4(tokens[cursor + 2]) && isNumber4(tokens[cursor + 3])) {
        points.push({ x: +tokens[cursor + 2], y: +tokens[cursor + 3] });
        cursor += 4;
      }
    } else if (upper === "A") {
      while (cursor + 6 < tokens.length && isNumber4(tokens[cursor]) && isNumber4(tokens[cursor + 1]) && isNumber4(tokens[cursor + 2]) && isNumber4(tokens[cursor + 3]) && isNumber4(tokens[cursor + 4]) && isNumber4(tokens[cursor + 5]) && isNumber4(tokens[cursor + 6])) {
        points.push({ x: +tokens[cursor + 5], y: +tokens[cursor + 6] });
        cursor += 7;
      }
    }
  }
  return points;
}
function isNumber4(token) {
  return token !== undefined && /^-?\d*\.?\d+(?:[eE][+-]?\d+)?$/.test(token);
}
function verticesToPolylinePath(vertices, closed) {
  if (vertices.length === 0)
    return "";
  const parts = [];
  for (let i = 0;i < vertices.length; i++) {
    const v = vertices[i];
    parts.push(`${i === 0 ? "M" : "L"}${formatNum(v.x)} ${formatNum(v.y)}`);
  }
  if (closed)
    parts.push("Z");
  return parts.join(" ");
}
function formatNum(n) {
  if (Number.isInteger(n))
    return String(n);
  const fixed = n.toFixed(3);
  return fixed.replace(/\.?0+$/, "") || "0";
}

// ../../lib/runtime-core/cascade-tiers/arap.ts
var SAMPLE_FRAMES3 = 5;
function resolveArapQualityWrap(input) {
  if (input.taxonomy === "T6" || input.taxonomy === "T7" || input.taxonomy === "T8") {
    return null;
  }
  if (!shouldWrapWithArap(input.fromTopology.tree))
    return null;
  const baseline = resolveHierarchicalMatch(input);
  if (!baseline)
    return null;
  const wrapped = wrapWithArap(baseline.interpolator, input.fromTopology.tree, input.toTopology.tree);
  const distortion = estimateDistortion3(wrapped);
  return {
    interpolator: wrapped,
    motion: input.motion,
    distortion,
    signal: null
  };
}
function estimateDistortion3(interpolator) {
  try {
    const trajectory = sampleTrajectory(interpolator, SAMPLE_FRAMES3);
    return boundaryDistortion(trajectory);
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

// ../../node_modules/.pnpm/clipper2-ts@2.0.1-15/node_modules/clipper2-ts/dist/Core.js
var ClipType;
(function(ClipType2) {
  ClipType2[ClipType2["NoClip"] = 0] = "NoClip";
  ClipType2[ClipType2["Intersection"] = 1] = "Intersection";
  ClipType2[ClipType2["Union"] = 2] = "Union";
  ClipType2[ClipType2["Difference"] = 3] = "Difference";
  ClipType2[ClipType2["Xor"] = 4] = "Xor";
})(ClipType || (ClipType = {}));
var PathType;
(function(PathType2) {
  PathType2[PathType2["Subject"] = 0] = "Subject";
  PathType2[PathType2["Clip"] = 1] = "Clip";
})(PathType || (PathType = {}));
var FillRule;
(function(FillRule2) {
  FillRule2[FillRule2["EvenOdd"] = 0] = "EvenOdd";
  FillRule2[FillRule2["NonZero"] = 1] = "NonZero";
  FillRule2[FillRule2["Positive"] = 2] = "Positive";
  FillRule2[FillRule2["Negative"] = 3] = "Negative";
})(FillRule || (FillRule = {}));
var PointInPolygonResult;
(function(PointInPolygonResult2) {
  PointInPolygonResult2[PointInPolygonResult2["IsOn"] = 0] = "IsOn";
  PointInPolygonResult2[PointInPolygonResult2["IsInside"] = 1] = "IsInside";
  PointInPolygonResult2[PointInPolygonResult2["IsOutside"] = 2] = "IsOutside";
})(PointInPolygonResult || (PointInPolygonResult = {}));
var maxSafeInteger = Number.MAX_SAFE_INTEGER;
var maxDeltaForSafeProduct = Math.floor(Math.sqrt(maxSafeInteger));
function isSafeProduct(a, b) {
  if (!Number.isSafeInteger(a) || !Number.isSafeInteger(b))
    return false;
  if (a === 0 || b === 0)
    return true;
  return Math.abs(a) <= maxSafeInteger / Math.abs(b);
}
function isSafeSum(a, b) {
  return Math.abs(a) + Math.abs(b) <= maxSafeInteger;
}
function safeMultiplyDifference(a, b, c, d) {
  if (isSafeProduct(a, b) && isSafeProduct(c, d)) {
    const prod1 = a * b;
    const prod2 = c * d;
    if (isSafeSum(prod1, prod2)) {
      return prod1 - prod2;
    }
  }
  if (Number.isSafeInteger(a) && Number.isSafeInteger(b) && Number.isSafeInteger(c) && Number.isSafeInteger(d)) {
    return Number(BigInt(a) * BigInt(b) - BigInt(c) * BigInt(d));
  }
  return a * b - c * d;
}
function safeMultiplySum(a, b, c, d) {
  if (isSafeProduct(a, b) && isSafeProduct(c, d)) {
    const prod1 = a * b;
    const prod2 = c * d;
    if (isSafeSum(prod1, prod2)) {
      return prod1 + prod2;
    }
  }
  if (Number.isSafeInteger(a) && Number.isSafeInteger(b) && Number.isSafeInteger(c) && Number.isSafeInteger(d)) {
    return Number(BigInt(a) * BigInt(b) + BigInt(c) * BigInt(d));
  }
  return a * b + c * d;
}
var B0 = BigInt(0);
var B2 = BigInt(2);
var B4 = BigInt(4);
var B64 = BigInt(64);
var UINT64_MASK = BigInt("0xFFFFFFFFFFFFFFFF");
var IC_MaxInt64 = BigInt("9223372036854775807");
var IC_MaxCoord = Number(IC_MaxInt64 / B4);
var IC_Invalid64 = Number(IC_MaxInt64);
var IC_floatingPointTolerance = 0.000000000001;
var IC_defaultMinimumEdgeLength = 0.1;
var IC_maxCoordForSafeAreaProduct = Math.floor(maxDeltaForSafeProduct / 2);
var IC_maxCoordForSafeCrossSq = Math.floor(Math.sqrt(Math.sqrt(maxSafeInteger / 4)));
function maxSafeCoordinateForScale(scale) {
  if (!Number.isFinite(scale)) {
    throw new RangeError("Scale must be a finite number");
  }
  const absScale = Math.abs(scale);
  if (absScale === 0)
    return Number.POSITIVE_INFINITY;
  return maxSafeInteger / absScale;
}
function checkSafeScaleValue(value, maxAbs, context) {
  if (!Number.isFinite(value) || Math.abs(value) > maxAbs) {
    throw new RangeError(`Scaled coordinate exceeds Number.MAX_SAFE_INTEGER in ${context}`);
  }
}
function ensureSafeInteger(value, context) {
  if (!Number.isFinite(value) || Math.abs(value) > maxSafeInteger) {
    throw new RangeError(`Coordinate exceeds Number.MAX_SAFE_INTEGER in ${context}`);
  }
}
function crossProduct(pt1, pt2, pt3) {
  const a = pt2.x - pt1.x;
  const b = pt3.y - pt2.y;
  const c = pt2.y - pt1.y;
  const d = pt3.x - pt2.x;
  if (Math.abs(a) < maxDeltaForSafeProduct && Math.abs(b) < maxDeltaForSafeProduct && Math.abs(c) < maxDeltaForSafeProduct && Math.abs(d) < maxDeltaForSafeProduct) {
    return a * b - c * d;
  }
  return safeMultiplyDifference(a, b, c, d);
}
function crossProductSign(pt1, pt2, pt3) {
  const a = pt2.x - pt1.x;
  const b = pt3.y - pt2.y;
  const c = pt2.y - pt1.y;
  const d = pt3.x - pt2.x;
  if (Math.abs(a) < maxDeltaForSafeProduct && Math.abs(b) < maxDeltaForSafeProduct && Math.abs(c) < maxDeltaForSafeProduct && Math.abs(d) < maxDeltaForSafeProduct) {
    const prod1 = a * b;
    const prod2 = c * d;
    return prod1 > prod2 ? 1 : prod1 < prod2 ? -1 : 0;
  }
  if (!Number.isSafeInteger(a) || !Number.isSafeInteger(b) || !Number.isSafeInteger(c) || !Number.isSafeInteger(d)) {
    const prod1 = a * b;
    const prod2 = c * d;
    return prod1 > prod2 ? 1 : prod1 < prod2 ? -1 : 0;
  }
  const bigProd1 = BigInt(a) * BigInt(b);
  const bigProd2 = BigInt(c) * BigInt(d);
  if (bigProd1 === bigProd2)
    return 0;
  return bigProd1 > bigProd2 ? 1 : -1;
}
function checkPrecision(precision) {
  if (precision < -8 || precision > 8) {
    throw new Error("Error: Precision is out of range.");
  }
}
function isAlmostZero(value) {
  return Math.abs(value) <= IC_floatingPointTolerance;
}
function triSign(x) {
  return x < 0 ? -1 : x > 0 ? 1 : 0;
}
function multiplyUInt64(a, b) {
  const aBig = BigInt(a);
  const bBig = BigInt(b);
  const res = aBig * bBig;
  return {
    lo64: res & UINT64_MASK,
    hi64: res >> B64
  };
}
function productsAreEqual(a, b, c, d) {
  const absA = Math.abs(a);
  const absB = Math.abs(b);
  const absC = Math.abs(c);
  const absD = Math.abs(d);
  if (absA < maxDeltaForSafeProduct && absB < maxDeltaForSafeProduct && absC < maxDeltaForSafeProduct && absD < maxDeltaForSafeProduct) {
    return a * b === c * d;
  }
  const signAb = (a < 0 ? -1 : a > 0 ? 1 : 0) * (b < 0 ? -1 : b > 0 ? 1 : 0);
  const signCd = (c < 0 ? -1 : c > 0 ? 1 : 0) * (d < 0 ? -1 : d > 0 ? 1 : 0);
  if (signAb !== signCd)
    return false;
  if (signAb === 0)
    return true;
  if (!Number.isSafeInteger(absA) || !Number.isSafeInteger(absB) || !Number.isSafeInteger(absC) || !Number.isSafeInteger(absD)) {
    return a * b === c * d;
  }
  const bigA = BigInt(absA);
  const bigB = BigInt(absB);
  const bigC = BigInt(absC);
  const bigD = BigInt(absD);
  return bigA * bigB === bigC * bigD;
}
function isCollinear(pt1, sharedPt, pt2) {
  const a = sharedPt.x - pt1.x;
  const b = pt2.y - sharedPt.y;
  const c = sharedPt.y - pt1.y;
  const d = pt2.x - sharedPt.x;
  return productsAreEqual(a, b, c, d);
}
function dotProduct(pt1, pt2, pt3) {
  const a = pt2.x - pt1.x;
  const b = pt3.x - pt2.x;
  const c = pt2.y - pt1.y;
  const d = pt3.y - pt2.y;
  if (Math.abs(a) < maxDeltaForSafeProduct && Math.abs(b) < maxDeltaForSafeProduct && Math.abs(c) < maxDeltaForSafeProduct && Math.abs(d) < maxDeltaForSafeProduct) {
    return a * b + c * d;
  }
  return safeMultiplySum(a, b, c, d);
}
function dotProductSign(pt1, pt2, pt3) {
  const a = pt2.x - pt1.x;
  const b = pt3.x - pt2.x;
  const c = pt2.y - pt1.y;
  const d = pt3.y - pt2.y;
  if (Math.abs(a) < maxDeltaForSafeProduct && Math.abs(b) < maxDeltaForSafeProduct && Math.abs(c) < maxDeltaForSafeProduct && Math.abs(d) < maxDeltaForSafeProduct) {
    const sum = a * b + c * d;
    return sum > 0 ? 1 : sum < 0 ? -1 : 0;
  }
  if (!Number.isSafeInteger(a) || !Number.isSafeInteger(b) || !Number.isSafeInteger(c) || !Number.isSafeInteger(d)) {
    const sum = a * b + c * d;
    return sum > 0 ? 1 : sum < 0 ? -1 : 0;
  }
  const bigSum = BigInt(a) * BigInt(b) + BigInt(c) * BigInt(d);
  if (bigSum === B0)
    return 0;
  return bigSum > B0 ? 1 : -1;
}
function icArea(path4) {
  const cnt = path4.length;
  if (cnt < 3)
    return 0;
  let allSmall = true;
  for (let i = 0;i < cnt && allSmall; i++) {
    const pt = path4[i];
    if (Math.abs(pt.x) >= IC_maxCoordForSafeAreaProduct || Math.abs(pt.y) >= IC_maxCoordForSafeAreaProduct) {
      allSmall = false;
    }
  }
  let prevPt = path4[cnt - 1];
  if (allSmall) {
    let total = 0;
    for (const pt of path4) {
      total += (prevPt.y + pt.y) * (prevPt.x - pt.x);
      prevPt = pt;
    }
    return total * 0.5;
  }
  let totalBig = B0;
  for (const pt of path4) {
    const sum = prevPt.y + pt.y;
    const diff = prevPt.x - pt.x;
    if (Number.isSafeInteger(sum) && Number.isSafeInteger(diff)) {
      totalBig += BigInt(sum) * BigInt(diff);
    } else if (Number.isSafeInteger(prevPt.y) && Number.isSafeInteger(pt.y) && Number.isSafeInteger(prevPt.x) && Number.isSafeInteger(pt.x)) {
      const sumBig = BigInt(prevPt.y) + BigInt(pt.y);
      const diffBig = BigInt(prevPt.x) - BigInt(pt.x);
      totalBig += sumBig * diffBig;
    } else {
      totalBig += BigInt(Math.round(sum * diff));
    }
    prevPt = pt;
  }
  return Number(totalBig) * 0.5;
}
function crossProductD(vec1, vec2) {
  return vec1.y * vec2.x - vec2.y * vec1.x;
}
function dotProductD(vec1, vec2) {
  return vec1.x * vec2.x + vec1.y * vec2.y;
}
function roundToEven(value) {
  const r = Math.round(value);
  if (value === r - 0.5 && (r & 1) !== 0)
    return r - 1;
  return r;
}
function checkCastInt64(val) {
  if (val >= IC_MaxCoord || val <= -IC_MaxCoord)
    return IC_Invalid64;
  return Math.round(val);
}
function getLineIntersectPt(ln1a, ln1b, ln2a, ln2b) {
  const dy1 = ln1b.y - ln1a.y;
  const dx1 = ln1b.x - ln1a.x;
  const dy2 = ln2b.y - ln2a.y;
  const dx2 = ln2b.x - ln2a.x;
  const det = safeMultiplyDifference(dy1, dx2, dy2, dx1);
  if (det === 0) {
    return null;
  }
  const t = safeMultiplyDifference(ln1a.x - ln2a.x, dy2, ln1a.y - ln2a.y, dx2) / det;
  if (t <= 0) {
    return { x: ln1a.x, y: ln1a.y, z: ln1a.z || 0 };
  } else if (t >= 1) {
    return { x: ln1b.x, y: ln1b.y, z: ln1b.z || 0 };
  } else {
    return {
      x: Math.trunc(ln1a.x + t * dx1),
      y: Math.trunc(ln1a.y + t * dy1),
      z: 0
    };
  }
}
function getLineIntersectPtD(ln1a, ln1b, ln2a, ln2b) {
  const dy1 = ln1b.y - ln1a.y;
  const dx1 = ln1b.x - ln1a.x;
  const dy2 = ln2b.y - ln2a.y;
  const dx2 = ln2b.x - ln2a.x;
  const det = dy1 * dx2 - dy2 * dx1;
  if (det === 0) {
    return { success: false, ip: { x: 0, y: 0, z: 0 } };
  }
  const t = ((ln1a.x - ln2a.x) * dy2 - (ln1a.y - ln2a.y) * dx2) / det;
  let ip;
  if (t <= 0) {
    ip = { ...ln1a, z: 0 };
  } else if (t >= 1) {
    ip = { ...ln1b, z: 0 };
  } else {
    ip = {
      x: ln1a.x + t * dx1,
      y: ln1a.y + t * dy1,
      z: 0
    };
  }
  return { success: true, ip };
}
function segsIntersect(seg1a, seg1b, seg2a, seg2b, inclusive = false) {
  if (!inclusive) {
    const s1 = crossProductSign(seg1a, seg2a, seg2b);
    const s2 = crossProductSign(seg1b, seg2a, seg2b);
    const s3 = crossProductSign(seg2a, seg1a, seg1b);
    const s4 = crossProductSign(seg2b, seg1a, seg1b);
    return s1 !== 0 && s2 !== 0 && s1 !== s2 && (s3 !== 0 && s4 !== 0 && s3 !== s4);
  }
  const res1 = crossProductSign(seg1a, seg2a, seg2b);
  const res2 = crossProductSign(seg1b, seg2a, seg2b);
  if (res1 !== 0 && res1 === res2)
    return false;
  const res3 = crossProductSign(seg2a, seg1a, seg1b);
  const res4 = crossProductSign(seg2b, seg1a, seg1b);
  if (res3 !== 0 && res3 === res4)
    return false;
  return res1 !== 0 || res2 !== 0 || res3 !== 0 || res4 !== 0;
}
function icGetBounds(path4) {
  if (path4.length === 0)
    return { left: 0, top: 0, right: 0, bottom: 0 };
  const result = {
    left: Number.MAX_SAFE_INTEGER,
    top: Number.MAX_SAFE_INTEGER,
    right: Number.MIN_SAFE_INTEGER,
    bottom: Number.MIN_SAFE_INTEGER
  };
  for (const pt of path4) {
    if (pt.x < result.left)
      result.left = pt.x;
    if (pt.x > result.right)
      result.right = pt.x;
    if (pt.y < result.top)
      result.top = pt.y;
    if (pt.y > result.bottom)
      result.bottom = pt.y;
  }
  return result.left === Number.MAX_SAFE_INTEGER ? { left: 0, top: 0, right: 0, bottom: 0 } : result;
}
function getClosestPtOnSegment(offPt, seg1, seg2) {
  if (seg1.x === seg2.x && seg1.y === seg2.y)
    return { x: seg1.x, y: seg1.y, z: 0 };
  const dx = seg2.x - seg1.x;
  const dy = seg2.y - seg1.y;
  const q = safeMultiplySum(offPt.x - seg1.x, dx, offPt.y - seg1.y, dy) / safeMultiplySum(dx, dx, dy, dy);
  const qClamped = q < 0 ? 0 : q > 1 ? 1 : q;
  return {
    x: Math.round(seg1.x + qClamped * dx),
    y: Math.round(seg1.y + qClamped * dy),
    z: 0
  };
}
function icPointInPolygon(pt, polygon) {
  const len = polygon.length;
  let start = 0;
  if (len < 3)
    return PointInPolygonResult.IsOutside;
  while (start < len && polygon[start].y === pt.y)
    start++;
  if (start === len)
    return PointInPolygonResult.IsOutside;
  let isAbove = polygon[start].y < pt.y;
  const startingAbove = isAbove;
  let val = 0;
  let i = start + 1;
  let end = len;
  while (true) {
    if (i === end) {
      if (end === 0 || start === 0)
        break;
      end = start;
      i = 0;
    }
    if (isAbove) {
      while (i < end && polygon[i].y < pt.y)
        i++;
    } else {
      while (i < end && polygon[i].y > pt.y)
        i++;
    }
    if (i === end)
      continue;
    const curr = polygon[i];
    const prev = i > 0 ? polygon[i - 1] : polygon[len - 1];
    if (curr.y === pt.y) {
      if (curr.x === pt.x || curr.y === prev.y && pt.x < prev.x !== pt.x < curr.x) {
        return PointInPolygonResult.IsOn;
      }
      i++;
      if (i === start)
        break;
      continue;
    }
    if (pt.x < curr.x && pt.x < prev.x) {} else if (pt.x > prev.x && pt.x > curr.x) {
      val = 1 - val;
    } else {
      const cps2 = crossProductSign(prev, curr, pt);
      if (cps2 === 0)
        return PointInPolygonResult.IsOn;
      if (cps2 < 0 === isAbove)
        val = 1 - val;
    }
    isAbove = !isAbove;
    i++;
  }
  if (isAbove === startingAbove) {
    return val === 0 ? PointInPolygonResult.IsOutside : PointInPolygonResult.IsInside;
  }
  if (i === len)
    i = 0;
  const cps = i === 0 ? crossProductSign(polygon[len - 1], polygon[0], pt) : crossProductSign(polygon[i - 1], polygon[i], pt);
  if (cps === 0)
    return PointInPolygonResult.IsOn;
  if (cps < 0 === isAbove)
    val = 1 - val;
  return val === 0 ? PointInPolygonResult.IsOutside : PointInPolygonResult.IsInside;
}
function path2ContainsPath1(path1, path22) {
  let pip = PointInPolygonResult.IsOn;
  for (const pt of path1) {
    switch (icPointInPolygon(pt, path22)) {
      case PointInPolygonResult.IsOutside:
        if (pip === PointInPolygonResult.IsOutside)
          return false;
        pip = PointInPolygonResult.IsOutside;
        break;
      case PointInPolygonResult.IsInside:
        if (pip === PointInPolygonResult.IsInside)
          return true;
        pip = PointInPolygonResult.IsInside;
        break;
      default:
        break;
    }
  }
  const mp = icGetBounds(path1);
  let midX, midY;
  if (Number.isSafeInteger(mp.left) && Number.isSafeInteger(mp.right) && Math.abs(mp.left) + Math.abs(mp.right) > Number.MAX_SAFE_INTEGER) {
    midX = Number((BigInt(mp.left) + BigInt(mp.right)) / B2);
    midY = Number((BigInt(mp.top) + BigInt(mp.bottom)) / B2);
  } else {
    midX = Math.round((mp.left + mp.right) / 2);
    midY = Math.round((mp.top + mp.bottom) / 2);
  }
  const midPt = { x: midX, y: midY };
  return icPointInPolygon(midPt, path22) !== PointInPolygonResult.IsOutside;
}
var InternalClipper = {
  MaxInt64: IC_MaxInt64,
  MaxCoord: IC_MaxCoord,
  max_coord: IC_MaxCoord,
  min_coord: -IC_MaxCoord,
  Invalid64: IC_Invalid64,
  floatingPointTolerance: IC_floatingPointTolerance,
  defaultMinimumEdgeLength: IC_defaultMinimumEdgeLength,
  maxCoordForSafeAreaProduct: IC_maxCoordForSafeAreaProduct,
  maxCoordForSafeCrossSq: IC_maxCoordForSafeCrossSq,
  maxSafeCoordinateForScale,
  checkSafeScaleValue,
  ensureSafeInteger,
  crossProduct,
  crossProductSign,
  checkPrecision,
  isAlmostZero,
  triSign,
  multiplyUInt64,
  productsAreEqual,
  isCollinear,
  dotProduct,
  dotProductSign,
  area: icArea,
  crossProductD,
  dotProductD,
  roundToEven,
  checkCastInt64,
  getLineIntersectPt,
  getLineIntersectPtD,
  segsIntersect,
  getBounds: icGetBounds,
  getClosestPtOnSegment,
  pointInPolygon: icPointInPolygon,
  path2ContainsPath1
};
var Point64Utils = {
  create(x = 0, y = 0, z = 0) {
    return { x: Math.round(x), y: Math.round(y), z };
  },
  fromPointD(pt) {
    InternalClipper.ensureSafeInteger(pt.x, "Point64Utils.fromPointD");
    InternalClipper.ensureSafeInteger(pt.y, "Point64Utils.fromPointD");
    return { x: Math.round(pt.x), y: Math.round(pt.y), z: pt.z || 0 };
  },
  scale(pt, scale) {
    return {
      x: Math.round(pt.x * scale),
      y: Math.round(pt.y * scale),
      z: pt.z || 0
    };
  },
  equals(a, b) {
    return a.x === b.x && a.y === b.y;
  },
  add(a, b) {
    if (Number.isSafeInteger(a.x) && Number.isSafeInteger(b.x) && Number.isSafeInteger(a.y) && Number.isSafeInteger(b.y)) {
      const sumX = a.x + b.x;
      const sumY = a.y + b.y;
      if (Number.isSafeInteger(sumX) && Number.isSafeInteger(sumY)) {
        return { x: sumX, y: sumY, z: 0 };
      }
      return {
        x: Number(BigInt(a.x) + BigInt(b.x)),
        y: Number(BigInt(a.y) + BigInt(b.y)),
        z: 0
      };
    }
    return { x: a.x + b.x, y: a.y + b.y, z: 0 };
  },
  subtract(a, b) {
    return { x: a.x - b.x, y: a.y - b.y, z: 0 };
  },
  toString(pt) {
    if (pt.z !== undefined && pt.z !== 0) {
      return `${pt.x},${pt.y},${pt.z} `;
    }
    return `${pt.x},${pt.y} `;
  }
};
var PointDUtils = {
  create(x = 0, y = 0, z = 0) {
    return { x, y, z };
  },
  fromPoint64(pt) {
    return { x: pt.x, y: pt.y, z: pt.z || 0 };
  },
  scale(pt, scale) {
    return { x: pt.x * scale, y: pt.y * scale, z: pt.z || 0 };
  },
  equals(a, b) {
    return InternalClipper.isAlmostZero(a.x - b.x) && InternalClipper.isAlmostZero(a.y - b.y);
  },
  negate(pt) {
    pt.x = -pt.x;
    pt.y = -pt.y;
  },
  toString(pt, precision = 2) {
    if (pt.z !== undefined && pt.z !== 0) {
      return `${pt.x.toFixed(precision)},${pt.y.toFixed(precision)},${pt.z}`;
    }
    return `${pt.x.toFixed(precision)},${pt.y.toFixed(precision)}`;
  }
};
var Rect64Utils = {
  create(l = 0, t = 0, r = 0, b = 0) {
    return { left: l, top: t, right: r, bottom: b };
  },
  createInvalid() {
    return {
      left: Number.MAX_SAFE_INTEGER,
      top: Number.MAX_SAFE_INTEGER,
      right: Number.MIN_SAFE_INTEGER,
      bottom: Number.MIN_SAFE_INTEGER
    };
  },
  width(rect) {
    return rect.right - rect.left;
  },
  height(rect) {
    return rect.bottom - rect.top;
  },
  isEmpty(rect) {
    return rect.bottom <= rect.top || rect.right <= rect.left;
  },
  isValid(rect) {
    return rect.left < Number.MAX_SAFE_INTEGER;
  },
  midPoint(rect) {
    if (Number.isSafeInteger(rect.left) && Number.isSafeInteger(rect.right) && Math.abs(rect.left) + Math.abs(rect.right) > Number.MAX_SAFE_INTEGER) {
      const midX = Number((BigInt(rect.left) + BigInt(rect.right)) / B2);
      const midY = Number((BigInt(rect.top) + BigInt(rect.bottom)) / B2);
      return { x: midX, y: midY };
    }
    return {
      x: Math.round((rect.left + rect.right) / 2),
      y: Math.round((rect.top + rect.bottom) / 2)
    };
  },
  contains(rect, pt) {
    return pt.x > rect.left && pt.x < rect.right && pt.y > rect.top && pt.y < rect.bottom;
  },
  containsRect(rect, rec) {
    return rec.left >= rect.left && rec.right <= rect.right && rec.top >= rect.top && rec.bottom <= rect.bottom;
  },
  intersects(rect, rec) {
    return Math.max(rect.left, rec.left) <= Math.min(rect.right, rec.right) && Math.max(rect.top, rec.top) <= Math.min(rect.bottom, rec.bottom);
  },
  asPath(rect) {
    return [
      { x: rect.left, y: rect.top, z: 0 },
      { x: rect.right, y: rect.top, z: 0 },
      { x: rect.right, y: rect.bottom, z: 0 },
      { x: rect.left, y: rect.bottom, z: 0 }
    ];
  }
};
var RectDUtils = {
  create(l = 0, t = 0, r = 0, b = 0) {
    return { left: l, top: t, right: r, bottom: b };
  },
  createInvalid() {
    return {
      left: Number.MAX_VALUE,
      top: Number.MAX_VALUE,
      right: -Number.MAX_VALUE,
      bottom: -Number.MAX_VALUE
    };
  },
  width(rect) {
    return rect.right - rect.left;
  },
  height(rect) {
    return rect.bottom - rect.top;
  },
  isEmpty(rect) {
    return rect.bottom <= rect.top || rect.right <= rect.left;
  },
  midPoint(rect) {
    return {
      x: (rect.left + rect.right) / 2,
      y: (rect.top + rect.bottom) / 2
    };
  },
  contains(rect, pt) {
    return pt.x > rect.left && pt.x < rect.right && pt.y > rect.top && pt.y < rect.bottom;
  },
  containsRect(rect, rec) {
    return rec.left >= rect.left && rec.right <= rect.right && rec.top >= rect.top && rec.bottom <= rect.bottom;
  },
  intersects(rect, rec) {
    return Math.max(rect.left, rec.left) < Math.min(rect.right, rec.right) && Math.max(rect.top, rec.top) < Math.min(rect.bottom, rec.bottom);
  },
  asPath(rect) {
    return [
      { x: rect.left, y: rect.top, z: 0 },
      { x: rect.right, y: rect.top, z: 0 },
      { x: rect.right, y: rect.bottom, z: 0 },
      { x: rect.left, y: rect.bottom, z: 0 }
    ];
  }
};
var InvalidRect64 = Object.freeze(Rect64Utils.createInvalid());
var InvalidRectD = Object.freeze(RectDUtils.createInvalid());
// ../../node_modules/.pnpm/clipper2-ts@2.0.1-15/node_modules/clipper2-ts/dist/Engine.js
var B02 = BigInt(0);
var B22 = BigInt(2);
var B42 = BigInt(4);
var VertexFlags;
(function(VertexFlags2) {
  VertexFlags2[VertexFlags2["None"] = 0] = "None";
  VertexFlags2[VertexFlags2["OpenStart"] = 1] = "OpenStart";
  VertexFlags2[VertexFlags2["OpenEnd"] = 2] = "OpenEnd";
  VertexFlags2[VertexFlags2["LocalMax"] = 4] = "LocalMax";
  VertexFlags2[VertexFlags2["LocalMin"] = 8] = "LocalMin";
})(VertexFlags || (VertexFlags = {}));

class ScanlineHeap {
  data = [];
  push(value) {
    this.data.push(value);
    this.siftUp(this.data.length - 1);
  }
  pop() {
    if (this.data.length === 0)
      return null;
    const max = this.data[0];
    const last = this.data.pop();
    if (this.data.length > 0) {
      this.data[0] = last;
      this.siftDown(0);
    }
    return max;
  }
  clear() {
    this.data.length = 0;
  }
  siftUp(index) {
    const val = this.data[index];
    while (index > 0) {
      const parent = index - 1 >> 1;
      if (this.data[parent] >= val)
        break;
      this.data[index] = this.data[parent];
      index = parent;
    }
    this.data[index] = val;
  }
  siftDown(index) {
    const length = this.data.length;
    const val = this.data[index];
    while (true) {
      const left = (index << 1) + 1;
      if (left >= length)
        break;
      const right = left + 1;
      let child = left;
      if (right < length && this.data[right] > this.data[left])
        child = right;
      if (this.data[child] <= val)
        break;
      this.data[index] = this.data[child];
      index = child;
    }
    this.data[index] = val;
  }
}

class Vertex {
  pt;
  next = null;
  prev = null;
  flags;
  constructor(pt, flags, prev) {
    this.pt = pt;
    this.flags = flags;
    this.prev = prev;
  }
}

class LocalMinima {
  vertex;
  polytype;
  isOpen;
  constructor(vertex, polytype, isOpen = false) {
    this.vertex = vertex;
    this.polytype = polytype;
    this.isOpen = isOpen;
  }
  equals(other) {
    return other !== null && this.vertex === other.vertex;
  }
}
function createIntersectNode(pt, edge1, edge2) {
  return { pt, edge1, edge2 };
}

class OutPt {
  pt;
  next;
  prev;
  outrec;
  horz;
  constructor(pt, outrec) {
    this.pt = pt;
    this.outrec = outrec;
    this.next = this;
    this.prev = this;
    this.horz = null;
  }
}
var JoinWith;
(function(JoinWith2) {
  JoinWith2[JoinWith2["None"] = 0] = "None";
  JoinWith2[JoinWith2["Left"] = 1] = "Left";
  JoinWith2[JoinWith2["Right"] = 2] = "Right";
})(JoinWith || (JoinWith = {}));
var HorzPosition;
(function(HorzPosition2) {
  HorzPosition2[HorzPosition2["Bottom"] = 0] = "Bottom";
  HorzPosition2[HorzPosition2["Middle"] = 1] = "Middle";
  HorzPosition2[HorzPosition2["Top"] = 2] = "Top";
})(HorzPosition || (HorzPosition = {}));

class OutRec {
  idx = 0;
  owner = null;
  frontEdge = null;
  backEdge = null;
  pts = null;
  polypath = null;
  bounds = { left: 0, top: 0, right: 0, bottom: 0 };
  path = [];
  isOpen = false;
  splits = null;
  recursiveSplit = null;
}

class HorzSegment {
  leftOp;
  rightOp;
  leftToRight;
  constructor(op) {
    this.leftOp = op;
    this.rightOp = null;
    this.leftToRight = true;
  }
}

class HorzJoin {
  op1;
  op2;
  constructor(ltor, rtol) {
    this.op1 = ltor;
    this.op2 = rtol;
  }
}

class Active {
  bot = { x: 0, y: 0 };
  top = { x: 0, y: 0 };
  curX = 0;
  dx = 0;
  windDx = 0;
  windCount = 0;
  windCount2 = 0;
  outrec = null;
  prevInAEL = null;
  nextInAEL = null;
  prevInSEL = null;
  nextInSEL = null;
  jump = null;
  vertexTop = null;
  localMin = null;
  isLeftBound = false;
  joinWith = JoinWith.None;
}
var ClipperEngine = {
  addLocMin(vert, polytype, isOpen, minimaList) {
    if ((vert.flags & VertexFlags.LocalMin) !== VertexFlags.None)
      return;
    vert.flags |= VertexFlags.LocalMin;
    const lm = new LocalMinima(vert, polytype, isOpen);
    minimaList.push(lm);
  },
  addPathsToVertexList(paths, polytype, isOpen, minimaList, vertexList) {
    for (let i = 0, len = paths.length;i < len; i++) {
      const path4 = paths[i];
      let v0 = null;
      let prevV = null;
      for (let j2 = 0, len2 = path4.length;j2 < len2; j2++) {
        const pt = path4[j2];
        if (v0 === null) {
          v0 = new Vertex(pt, VertexFlags.None, null);
          vertexList.push(v0);
          prevV = v0;
        } else if (!(prevV.pt.x === pt.x && prevV.pt.y === pt.y)) {
          const currV2 = new Vertex(pt, VertexFlags.None, prevV);
          vertexList.push(currV2);
          prevV.next = currV2;
          prevV = currV2;
        }
      }
      if (prevV?.prev == null)
        continue;
      if (!isOpen && prevV.pt.x === v0.pt.x && prevV.pt.y === v0.pt.y)
        prevV = prevV.prev;
      prevV.next = v0;
      v0.prev = prevV;
      if (!isOpen && prevV.next === prevV)
        continue;
      let goingUp;
      if (isOpen) {
        let currV2 = v0.next;
        while (currV2 !== v0 && currV2.pt.y === v0.pt.y)
          currV2 = currV2.next;
        goingUp = currV2.pt.y <= v0.pt.y;
        if (goingUp) {
          v0.flags = VertexFlags.OpenStart;
          ClipperEngine.addLocMin(v0, polytype, true, minimaList);
        } else {
          v0.flags = VertexFlags.OpenStart | VertexFlags.LocalMax;
        }
      } else {
        prevV = v0.prev;
        while (prevV !== v0 && prevV.pt.y === v0.pt.y)
          prevV = prevV.prev;
        if (prevV === v0)
          continue;
        goingUp = prevV.pt.y > v0.pt.y;
      }
      const goingUp0 = goingUp;
      prevV = v0;
      let currV = v0.next;
      while (currV !== v0) {
        if (currV.pt.y > prevV.pt.y && goingUp) {
          prevV.flags |= VertexFlags.LocalMax;
          goingUp = false;
        } else if (currV.pt.y < prevV.pt.y && !goingUp) {
          goingUp = true;
          ClipperEngine.addLocMin(prevV, polytype, isOpen, minimaList);
        }
        prevV = currV;
        currV = currV.next;
      }
      if (isOpen) {
        prevV.flags |= VertexFlags.OpenEnd;
        if (goingUp)
          prevV.flags |= VertexFlags.LocalMax;
        else
          ClipperEngine.addLocMin(prevV, polytype, isOpen, minimaList);
      } else if (goingUp !== goingUp0) {
        if (goingUp0)
          ClipperEngine.addLocMin(prevV, polytype, false, minimaList);
        else
          prevV.flags |= VertexFlags.LocalMax;
      }
    }
  }
};
class ClipperBase {
  static openPathsEnabled = true;
  cliptype = ClipType.NoClip;
  fillrule = FillRule.EvenOdd;
  actives = null;
  sel = null;
  minimaList = [];
  intersectList = [];
  vertexList = [];
  outrecList = [];
  scanlineHeap = new ScanlineHeap;
  scanlineSet = new Set;
  scanlineArr = [];
  useScanlineArray = false;
  horzSegList = [];
  horzJoinList = [];
  currentLocMin = 0;
  currentBotY = 0;
  isSortedMinimaList = false;
  hasOpenPaths = false;
  usingPolytree = false;
  succeeded = false;
  zCallbackInternal = undefined;
  preserveCollinear = true;
  reverseSolution = false;
  constructor() {}
  getZCallback() {
    return;
  }
  xyEqual(pt1, pt2) {
    return pt1.x === pt2.x && pt1.y === pt2.y;
  }
  setZ(ae1, ae2, intersectPt) {
    const zCallback = this.zCallbackInternal;
    if (!zCallback)
      return;
    if (ClipperBase.getPolyType(ae1) === PathType.Subject) {
      if (this.xyEqual(intersectPt, ae1.bot)) {
        intersectPt.z = ae1.bot.z ?? 0;
      } else if (this.xyEqual(intersectPt, ae1.top)) {
        intersectPt.z = ae1.top.z ?? 0;
      } else if (this.xyEqual(intersectPt, ae2.bot)) {
        intersectPt.z = ae2.bot.z ?? 0;
      } else if (this.xyEqual(intersectPt, ae2.top)) {
        intersectPt.z = ae2.top.z ?? 0;
      } else {
        intersectPt.z = 0;
      }
      zCallback(ae1.bot, ae1.top, ae2.bot, ae2.top, intersectPt);
    } else {
      if (this.xyEqual(intersectPt, ae2.bot)) {
        intersectPt.z = ae2.bot.z ?? 0;
      } else if (this.xyEqual(intersectPt, ae2.top)) {
        intersectPt.z = ae2.top.z ?? 0;
      } else if (this.xyEqual(intersectPt, ae1.bot)) {
        intersectPt.z = ae1.bot.z ?? 0;
      } else if (this.xyEqual(intersectPt, ae1.top)) {
        intersectPt.z = ae1.top.z ?? 0;
      } else {
        intersectPt.z = 0;
      }
      zCallback(ae2.bot, ae2.top, ae1.bot, ae1.top, intersectPt);
    }
  }
  static isOdd(val) {
    return (val & 1) !== 0;
  }
  static isHotEdge(ae) {
    return ae.outrec != null;
  }
  static isOpen(ae) {
    return ClipperBase.openPathsEnabled && ae.localMin.isOpen;
  }
  static isOpenEnd(ae) {
    return ClipperBase.openPathsEnabled && ae.localMin.isOpen && ClipperBase.isOpenEndVertex(ae.vertexTop);
  }
  static isOpenEndVertex(v) {
    return (v.flags & (VertexFlags.OpenStart | VertexFlags.OpenEnd)) !== VertexFlags.None;
  }
  static getPrevHotEdge(ae) {
    let prev = ae.prevInAEL;
    if (!ClipperBase.openPathsEnabled) {
      while (prev !== null && !ClipperBase.isHotEdge(prev)) {
        prev = prev.prevInAEL;
      }
      return prev;
    }
    while (prev !== null && (prev.localMin.isOpen || !ClipperBase.isHotEdge(prev))) {
      prev = prev.prevInAEL;
    }
    return prev;
  }
  static isFront(ae) {
    return ae === ae.outrec.frontEdge;
  }
  static getDx(pt1, pt2) {
    const dy = pt2.y - pt1.y;
    if (dy !== 0) {
      return (pt2.x - pt1.x) / dy;
    }
    return pt2.x > pt1.x ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY;
  }
  static topX(ae, currentY) {
    if (currentY === ae.top.y || ae.top.x === ae.bot.x)
      return ae.top.x;
    if (currentY === ae.bot.y)
      return ae.bot.x;
    return InternalClipper.roundToEven(ae.bot.x + ae.dx * (currentY - ae.bot.y));
  }
  static isHorizontal(ae) {
    return ae.top.y === ae.bot.y;
  }
  static isHeadingRightHorz(ae) {
    return ae.dx === Number.NEGATIVE_INFINITY;
  }
  static isHeadingLeftHorz(ae) {
    return ae.dx === Number.POSITIVE_INFINITY;
  }
  static swapActives(ae1, ae2) {
    return [ae2, ae1];
  }
  static getPolyType(ae) {
    return ae.localMin.polytype;
  }
  static isSamePolyType(ae1, ae2) {
    return ae1.localMin.polytype === ae2.localMin.polytype;
  }
  static setDx(ae) {
    ae.dx = ClipperBase.getDx(ae.bot, ae.top);
  }
  static nextVertex(ae) {
    return ae.windDx > 0 ? ae.vertexTop.next : ae.vertexTop.prev;
  }
  static prevPrevVertex(ae) {
    return ae.windDx > 0 ? ae.vertexTop.prev.prev : ae.vertexTop.next.next;
  }
  static isMaxima(vertexOrAe) {
    if ("flags" in vertexOrAe) {
      return (vertexOrAe.flags & VertexFlags.LocalMax) !== VertexFlags.None;
    } else {
      return ClipperBase.isMaxima(vertexOrAe.vertexTop);
    }
  }
  static getMaximaPair(ae) {
    let ae2 = ae.nextInAEL;
    while (ae2 !== null) {
      if (ae2.vertexTop === ae.vertexTop)
        return ae2;
      ae2 = ae2.nextInAEL;
    }
    return null;
  }
  boundingBoxesOverlap(p1, p2, p3, p4) {
    const min1x = Math.min(p1.x, p2.x);
    const max1x = Math.max(p1.x, p2.x);
    const min1y = Math.min(p1.y, p2.y);
    const max1y = Math.max(p1.y, p2.y);
    const min2x = Math.min(p3.x, p4.x);
    const max2x = Math.max(p3.x, p4.x);
    const min2y = Math.min(p3.y, p4.y);
    const max2y = Math.max(p3.y, p4.y);
    return !(max1x < min2x || max2x < min1x || max1y < min2y || max2y < min1y);
  }
  clearSolutionOnly() {
    while (this.actives !== null)
      this.deleteFromAEL(this.actives);
    this.scanlineHeap.clear();
    this.scanlineSet.clear();
    this.scanlineArr.length = 0;
    this.disposeIntersectNodes();
    this.outrecList.length = 0;
    this.horzSegList.length = 0;
    this.horzJoinList.length = 0;
  }
  clear() {
    this.clearSolutionOnly();
    this.minimaList.length = 0;
    this.vertexList.length = 0;
    this.currentLocMin = 0;
    this.isSortedMinimaList = false;
    this.hasOpenPaths = false;
  }
  reset() {
    if (!this.isSortedMinimaList) {
      this.minimaList.sort((a, b) => b.vertex.pt.y - a.vertex.pt.y);
      this.isSortedMinimaList = true;
    }
    this.scanlineHeap.clear();
    this.scanlineSet.clear();
    this.scanlineArr.length = 0;
    this.useScanlineArray = this.minimaList.length <= 16;
    for (let i = this.minimaList.length - 1;i >= 0; i--) {
      this.insertScanline(this.minimaList[i].vertex.pt.y);
    }
    this.currentBotY = 0;
    this.currentLocMin = 0;
    this.actives = null;
    this.sel = null;
    this.succeeded = true;
  }
  upgradeScanlineStructureFromArray() {
    const arr = this.scanlineArr;
    for (let i = 0, len = arr.length;i < len; i++) {
      const y = arr[i];
      this.scanlineSet.add(y);
      this.scanlineHeap.push(y);
    }
    arr.length = 0;
    this.useScanlineArray = false;
  }
  insertScanline(y) {
    if (this.useScanlineArray) {
      const arr = this.scanlineArr;
      for (let i = 0, len = arr.length;i < len; i++) {
        if (arr[i] === y)
          return;
      }
      arr.push(y);
      if (arr.length > 64)
        this.upgradeScanlineStructureFromArray();
      return;
    }
    if (this.scanlineSet.has(y))
      return;
    this.scanlineSet.add(y);
    this.scanlineHeap.push(y);
  }
  popScanline() {
    if (this.useScanlineArray) {
      const arr = this.scanlineArr;
      const len = arr.length;
      if (len === 0)
        return null;
      let bestIdx = 0;
      let bestY = arr[0];
      for (let i = 1;i < len; i++) {
        const v = arr[i];
        if (v > bestY) {
          bestY = v;
          bestIdx = i;
        }
      }
      arr[bestIdx] = arr[len - 1];
      arr.pop();
      return bestY;
    }
    const y = this.scanlineHeap.pop();
    if (y === null)
      return null;
    this.scanlineSet.delete(y);
    return y;
  }
  hasLocMinAtY(y) {
    return this.currentLocMin < this.minimaList.length && this.minimaList[this.currentLocMin].vertex.pt.y === y;
  }
  popLocalMinima() {
    return this.minimaList[this.currentLocMin++];
  }
  addPath(path4, polytype, isOpen = false) {
    const tmp = [path4];
    this.addPaths(tmp, polytype, isOpen);
  }
  addPaths(paths, polytype, isOpen = false) {
    if (isOpen)
      this.hasOpenPaths = true;
    this.isSortedMinimaList = false;
    ClipperEngine.addPathsToVertexList(paths, polytype, isOpen, this.minimaList, this.vertexList);
  }
  addReuseableData(reuseableData) {
    if (reuseableData["minimaList"].length === 0)
      return;
    this.isSortedMinimaList = false;
    for (const lm of reuseableData["minimaList"]) {
      this.minimaList.push(new LocalMinima(lm.vertex, lm.polytype, lm.isOpen));
      if (lm.isOpen)
        this.hasOpenPaths = true;
    }
  }
  deleteFromAEL(ae) {
    const prev = ae.prevInAEL;
    const next = ae.nextInAEL;
    if (prev === null && next === null && ae !== this.actives)
      return;
    if (prev !== null) {
      prev.nextInAEL = next;
    } else {
      this.actives = next;
    }
    if (next !== null)
      next.prevInAEL = prev;
  }
  getBounds() {
    const bounds = {
      left: Number.MAX_SAFE_INTEGER,
      top: Number.MAX_SAFE_INTEGER,
      right: Number.MIN_SAFE_INTEGER,
      bottom: Number.MIN_SAFE_INTEGER
    };
    for (const t of this.vertexList) {
      let v = t;
      do {
        if (v.pt.x < bounds.left)
          bounds.left = v.pt.x;
        if (v.pt.x > bounds.right)
          bounds.right = v.pt.x;
        if (v.pt.y < bounds.top)
          bounds.top = v.pt.y;
        if (v.pt.y > bounds.bottom)
          bounds.bottom = v.pt.y;
        v = v.next;
      } while (v !== t);
    }
    return Rect64Utils.isEmpty(bounds) ? { left: 0, top: 0, right: 0, bottom: 0 } : bounds;
  }
  executeInternal(ct, fillRule) {
    if (ct === ClipType.NoClip)
      return;
    ClipperBase.openPathsEnabled = this.hasOpenPaths;
    this.zCallbackInternal = this.getZCallback();
    this.fillrule = fillRule;
    this.cliptype = ct;
    this.reset();
    let y = this.popScanline();
    if (y === null)
      return;
    while (this.succeeded) {
      this.insertLocalMinimaIntoAEL(y);
      let ae;
      while ((ae = this.popHorz()) !== null)
        this.doHorizontal(ae);
      if (this.horzSegList.length > 0) {
        this.convertHorzSegsToJoins();
        this.horzSegList.length = 0;
      }
      this.currentBotY = y;
      const nextY = this.popScanline();
      if (nextY === null)
        break;
      y = nextY;
      this.doIntersections(y);
      this.doTopOfScanbeam(y);
      while ((ae = this.popHorz()) !== null)
        this.doHorizontal(ae);
    }
    if (this.succeeded)
      this.processHorzJoins();
  }
  insertLocalMinimaIntoAEL(botY) {
    while (this.hasLocMinAtY(botY)) {
      const localMinima = this.popLocalMinima();
      let leftBound;
      if ((localMinima.vertex.flags & VertexFlags.OpenStart) !== VertexFlags.None) {
        leftBound = null;
      } else {
        leftBound = new Active;
        leftBound.bot = localMinima.vertex.pt;
        leftBound.curX = localMinima.vertex.pt.x;
        leftBound.windDx = -1;
        leftBound.vertexTop = localMinima.vertex.prev;
        leftBound.top = localMinima.vertex.prev.pt;
        leftBound.outrec = null;
        leftBound.localMin = localMinima;
        ClipperBase.setDx(leftBound);
      }
      let rightBound;
      if ((localMinima.vertex.flags & VertexFlags.OpenEnd) !== VertexFlags.None) {
        rightBound = null;
      } else {
        rightBound = new Active;
        rightBound.bot = localMinima.vertex.pt;
        rightBound.curX = localMinima.vertex.pt.x;
        rightBound.windDx = 1;
        rightBound.vertexTop = localMinima.vertex.next;
        rightBound.top = localMinima.vertex.next.pt;
        rightBound.outrec = null;
        rightBound.localMin = localMinima;
        ClipperBase.setDx(rightBound);
      }
      if (leftBound !== null && rightBound !== null) {
        if (ClipperBase.isHorizontal(leftBound)) {
          if (ClipperBase.isHeadingRightHorz(leftBound))
            [leftBound, rightBound] = ClipperBase.swapActives(leftBound, rightBound);
        } else if (ClipperBase.isHorizontal(rightBound)) {
          if (ClipperBase.isHeadingLeftHorz(rightBound))
            [leftBound, rightBound] = ClipperBase.swapActives(leftBound, rightBound);
        } else if (leftBound.dx < rightBound.dx) {
          [leftBound, rightBound] = ClipperBase.swapActives(leftBound, rightBound);
        }
      } else if (leftBound === null) {
        leftBound = rightBound;
        rightBound = null;
      }
      let contributing;
      leftBound.isLeftBound = true;
      this.insertLeftEdge(leftBound);
      if (!ClipperBase.openPathsEnabled) {
        this.setWindCountForClosedPathEdge(leftBound);
        contributing = this.isContributingClosed(leftBound);
      } else if (ClipperBase.isOpen(leftBound)) {
        this.setWindCountForOpenPathEdge(leftBound);
        contributing = this.isContributingOpen(leftBound);
      } else {
        this.setWindCountForClosedPathEdge(leftBound);
        contributing = this.isContributingClosed(leftBound);
      }
      if (rightBound !== null) {
        rightBound.windCount = leftBound.windCount;
        rightBound.windCount2 = leftBound.windCount2;
        this.insertRightEdge(leftBound, rightBound);
        if (contributing) {
          this.addLocalMinPoly(leftBound, rightBound, leftBound.bot, true);
          if (!ClipperBase.isHorizontal(leftBound)) {
            this.checkJoinLeft(leftBound, leftBound.bot);
          }
        }
        while (rightBound.nextInAEL !== null && this.isValidAelOrder(rightBound.nextInAEL, rightBound)) {
          this.intersectEdges(rightBound, rightBound.nextInAEL, rightBound.bot);
          this.swapPositionsInAEL(rightBound, rightBound.nextInAEL);
        }
        if (ClipperBase.isHorizontal(rightBound)) {
          this.pushHorz(rightBound);
        } else {
          this.checkJoinRight(rightBound, rightBound.bot);
          this.insertScanline(rightBound.top.y);
        }
      } else if (contributing && ClipperBase.openPathsEnabled) {
        this.startOpenPath(leftBound, leftBound.bot);
      }
      if (ClipperBase.isHorizontal(leftBound)) {
        this.pushHorz(leftBound);
      } else {
        this.insertScanline(leftBound.top.y);
      }
    }
  }
  pushHorz(ae) {
    ae.nextInSEL = this.sel;
    this.sel = ae;
  }
  popHorz() {
    const ae = this.sel;
    if (ae === null)
      return null;
    this.sel = this.sel.nextInSEL;
    return ae;
  }
  doHorizontal(horz) {
    if (!ClipperBase.openPathsEnabled) {
      this.doHorizontalClosed(horz);
      return;
    }
    const horzIsOpen = ClipperBase.isOpen(horz);
    const y = horz.bot.y;
    const vertexMax = horzIsOpen ? this.getCurrYMaximaVertexOpen(horz) : this.getCurrYMaximaVertex(horz);
    const { isLeftToRight, leftX, rightX } = this.resetHorzDirection(horz, vertexMax);
    let leftX2 = leftX;
    let rightX2 = rightX;
    if (ClipperBase.isHotEdge(horz)) {
      const op = this.addOutPt(horz, { x: horz.curX, y });
      this.addToHorzSegList(op);
    }
    while (true) {
      let ae = isLeftToRight ? horz.nextInAEL : horz.prevInAEL;
      while (ae !== null) {
        if (ae.vertexTop === vertexMax) {
          if (ClipperBase.isHotEdge(horz) && this.isJoined(ae))
            this.split(ae, ae.top);
          if (ClipperBase.isHotEdge(horz)) {
            while (horz.vertexTop !== vertexMax) {
              this.addOutPt(horz, horz.top);
              this.updateEdgeIntoAEL(horz);
            }
            if (isLeftToRight) {
              this.addLocalMaxPoly(horz, ae, horz.top);
            } else {
              this.addLocalMaxPoly(ae, horz, horz.top);
            }
          }
          this.deleteFromAEL(ae);
          this.deleteFromAEL(horz);
          return;
        }
        if (vertexMax !== horz.vertexTop || ClipperBase.isOpenEnd(horz)) {
          if (isLeftToRight && ae.curX > rightX2 || !isLeftToRight && ae.curX < leftX2)
            break;
          if (ae.curX === horz.top.x && !ClipperBase.isHorizontal(ae)) {
            const pt2 = ClipperBase.nextVertex(horz).pt;
            if (ClipperBase.isOpen(ae) && !ClipperBase.isSamePolyType(ae, horz) && !ClipperBase.isHotEdge(ae)) {
              if (isLeftToRight && ClipperBase.topX(ae, pt2.y) > pt2.x || !isLeftToRight && ClipperBase.topX(ae, pt2.y) < pt2.x)
                break;
            } else if (isLeftToRight && ClipperBase.topX(ae, pt2.y) >= pt2.x || !isLeftToRight && ClipperBase.topX(ae, pt2.y) <= pt2.x)
              break;
          }
        }
        const pt = { x: ae.curX, y };
        if (isLeftToRight) {
          this.intersectEdges(horz, ae, pt);
          this.swapPositionsInAEL(horz, ae);
          this.checkJoinLeft(ae, pt);
          horz.curX = ae.curX;
          ae = horz.nextInAEL;
        } else {
          this.intersectEdges(ae, horz, pt);
          this.swapPositionsInAEL(ae, horz);
          this.checkJoinRight(ae, pt);
          horz.curX = ae.curX;
          ae = horz.prevInAEL;
        }
        if (ClipperBase.isHotEdge(horz)) {
          this.addToHorzSegList(this.getLastOp(horz));
        }
      }
      if (horzIsOpen && ClipperBase.isOpenEnd(horz)) {
        if (ClipperBase.isHotEdge(horz)) {
          this.addOutPt(horz, horz.top);
          if (ClipperBase.isFront(horz)) {
            horz.outrec.frontEdge = null;
          } else {
            horz.outrec.backEdge = null;
          }
          horz.outrec = null;
        }
        this.deleteFromAEL(horz);
        return;
      }
      if (ClipperBase.nextVertex(horz).pt.y !== horz.top.y) {
        break;
      }
      if (ClipperBase.isHotEdge(horz)) {
        this.addOutPt(horz, horz.top);
      }
      this.updateEdgeIntoAEL(horz);
      const resetResult = this.resetHorzDirection(horz, vertexMax);
      leftX2 = resetResult.leftX;
      rightX2 = resetResult.rightX;
    }
    if (ClipperBase.isHotEdge(horz)) {
      const op = this.addOutPt(horz, horz.top);
      this.addToHorzSegList(op);
    }
    this.updateEdgeIntoAEL(horz);
  }
  doHorizontalClosed(horz) {
    const y = horz.bot.y;
    const vertexMax = this.getCurrYMaximaVertex(horz);
    const { isLeftToRight, leftX, rightX } = this.resetHorzDirection(horz, vertexMax);
    let leftX2 = leftX;
    let rightX2 = rightX;
    if (ClipperBase.isHotEdge(horz)) {
      const op = this.addOutPt(horz, { x: horz.curX, y });
      this.addToHorzSegList(op);
    }
    while (true) {
      let ae = isLeftToRight ? horz.nextInAEL : horz.prevInAEL;
      while (ae !== null) {
        if (ae.vertexTop === vertexMax) {
          if (ClipperBase.isHotEdge(horz) && this.isJoined(ae))
            this.split(ae, ae.top);
          if (ClipperBase.isHotEdge(horz)) {
            while (horz.vertexTop !== vertexMax) {
              this.addOutPt(horz, horz.top);
              this.updateEdgeIntoAEL(horz);
            }
            if (isLeftToRight) {
              this.addLocalMaxPoly(horz, ae, horz.top);
            } else {
              this.addLocalMaxPoly(ae, horz, horz.top);
            }
          }
          this.deleteFromAEL(ae);
          this.deleteFromAEL(horz);
          return;
        }
        if (vertexMax !== horz.vertexTop) {
          if (isLeftToRight && ae.curX > rightX2 || !isLeftToRight && ae.curX < leftX2)
            break;
          if (ae.curX === horz.top.x && !ClipperBase.isHorizontal(ae)) {
            const nextPt = ClipperBase.nextVertex(horz).pt;
            const tx = ClipperBase.topX(ae, nextPt.y);
            if (isLeftToRight && tx >= nextPt.x || !isLeftToRight && tx <= nextPt.x)
              break;
          }
        }
        const pt = { x: ae.curX, y };
        if (isLeftToRight) {
          this.intersectEdges(horz, ae, pt);
          this.swapPositionsInAEL(horz, ae);
          this.checkJoinLeft(ae, pt);
          horz.curX = ae.curX;
          ae = horz.nextInAEL;
        } else {
          this.intersectEdges(ae, horz, pt);
          this.swapPositionsInAEL(ae, horz);
          this.checkJoinRight(ae, pt);
          horz.curX = ae.curX;
          ae = horz.prevInAEL;
        }
        if (ClipperBase.isHotEdge(horz)) {
          this.addToHorzSegList(this.getLastOp(horz));
        }
      }
      if (ClipperBase.nextVertex(horz).pt.y !== horz.top.y) {
        break;
      }
      if (ClipperBase.isHotEdge(horz)) {
        this.addOutPt(horz, horz.top);
      }
      this.updateEdgeIntoAEL(horz);
      const resetResult = this.resetHorzDirection(horz, vertexMax);
      leftX2 = resetResult.leftX;
      rightX2 = resetResult.rightX;
    }
    if (ClipperBase.isHotEdge(horz)) {
      const op = this.addOutPt(horz, horz.top);
      this.addToHorzSegList(op);
    }
    this.updateEdgeIntoAEL(horz);
  }
  convertHorzSegsToJoins() {
    let k = 0;
    for (const hs of this.horzSegList) {
      if (this.updateHorzSegment(hs))
        k++;
    }
    if (k < 2)
      return;
    this.horzSegList.sort((a, b) => this.horzSegSort(a, b));
    for (let i = 0;i < k - 1; i++) {
      const hs1 = this.horzSegList[i];
      for (let j2 = i + 1;j2 < k; j2++) {
        const hs2 = this.horzSegList[j2];
        if (hs2.leftOp.pt.x >= hs1.rightOp.pt.x || hs2.leftToRight === hs1.leftToRight || hs2.rightOp.pt.x <= hs1.leftOp.pt.x)
          continue;
        const currY = hs1.leftOp.pt.y;
        if (hs1.leftToRight) {
          while (hs1.leftOp.next.pt.y === currY && hs1.leftOp.next.pt.x <= hs2.leftOp.pt.x)
            hs1.leftOp = hs1.leftOp.next;
          while (hs2.leftOp.prev.pt.y === currY && hs2.leftOp.prev.pt.x <= hs1.leftOp.pt.x)
            hs2.leftOp = hs2.leftOp.prev;
          const join = new HorzJoin(this.duplicateOp(hs1.leftOp, true), this.duplicateOp(hs2.leftOp, false));
          this.horzJoinList.push(join);
        } else {
          while (hs1.leftOp.prev.pt.y === currY && hs1.leftOp.prev.pt.x <= hs2.leftOp.pt.x)
            hs1.leftOp = hs1.leftOp.prev;
          while (hs2.leftOp.next.pt.y === currY && hs2.leftOp.next.pt.x <= hs1.leftOp.pt.x)
            hs2.leftOp = hs2.leftOp.next;
          const join = new HorzJoin(this.duplicateOp(hs2.leftOp, true), this.duplicateOp(hs1.leftOp, false));
          this.horzJoinList.push(join);
        }
      }
    }
  }
  updateHorzSegment(hs) {
    const op = hs.leftOp;
    const outrec = this.getRealOutRec(op.outrec);
    const outrecHasEdges = outrec.frontEdge !== null;
    const currY = op.pt.y;
    let opP = op;
    let opN = op;
    if (outrecHasEdges) {
      const opA = outrec.pts;
      const opZ = opA.next;
      while (opP !== opZ && opP.prev.pt.y === currY)
        opP = opP.prev;
      while (opN !== opA && opN.next.pt.y === currY)
        opN = opN.next;
    } else {
      while (opP.prev !== opN && opP.prev.pt.y === currY)
        opP = opP.prev;
      while (opN.next !== opP && opN.next.pt.y === currY)
        opN = opN.next;
    }
    const result = this.setHorzSegHeadingForward(hs, opP, opN) && hs.leftOp.horz === null;
    if (result) {
      hs.leftOp.horz = hs;
    } else {
      hs.rightOp = null;
    }
    return result;
  }
  setHorzSegHeadingForward(hs, opP, opN) {
    if (opP.pt.x === opN.pt.x)
      return false;
    if (opP.pt.x < opN.pt.x) {
      hs.leftOp = opP;
      hs.rightOp = opN;
      hs.leftToRight = true;
    } else {
      hs.leftOp = opN;
      hs.rightOp = opP;
      hs.leftToRight = false;
    }
    return true;
  }
  horzSegSort(hs1, hs2) {
    if (hs1.rightOp === null) {
      return hs2.rightOp === null ? 0 : 1;
    }
    if (hs2.rightOp === null)
      return -1;
    return hs1.leftOp.pt.x - hs2.leftOp.pt.x;
  }
  duplicateOp(op, insertAfter) {
    const result = new OutPt(op.pt, op.outrec);
    if (insertAfter) {
      result.next = op.next;
      result.next.prev = result;
      result.prev = op;
      op.next = result;
    } else {
      result.prev = op.prev;
      result.prev.next = result;
      result.next = op;
      op.prev = result;
    }
    return result;
  }
  getRealOutRec(outRec) {
    while (outRec !== null && outRec.pts === null) {
      outRec = outRec.owner;
    }
    return outRec;
  }
  doIntersections(y) {
    if (this.buildIntersectList(y)) {
      this.processIntersectList();
      this.disposeIntersectNodes();
    }
  }
  doTopOfScanbeam(y) {
    this.sel = null;
    let ae = this.actives;
    while (ae !== null) {
      if (ae.top.y === y) {
        ae.curX = ae.top.x;
        if (ClipperBase.isMaxima(ae)) {
          ae = this.doMaxima(ae);
          continue;
        } else {
          if (ClipperBase.isHotEdge(ae))
            this.addOutPt(ae, ae.top);
          this.updateEdgeIntoAEL(ae);
          if (ClipperBase.isHorizontal(ae)) {
            this.pushHorz(ae);
          }
        }
      } else {
        ae.curX = ClipperBase.topX(ae, y);
      }
      ae = ae.nextInAEL;
    }
  }
  processHorzJoins() {
    for (const j2 of this.horzJoinList) {
      const or1 = this.getRealOutRec(j2.op1.outrec);
      const or2 = this.getRealOutRec(j2.op2.outrec);
      const op1b = j2.op1.next;
      const op2b = j2.op2.prev;
      j2.op1.next = j2.op2;
      j2.op2.prev = j2.op1;
      op1b.prev = op2b;
      op2b.next = op1b;
      if (or1 === or2) {
        const or2New = this.newOutRec();
        or2New.pts = op1b;
        this.fixOutRecPts(or2New);
        if (or1.pts.outrec === or2New) {
          or1.pts = j2.op1;
          or1.pts.outrec = or1;
        }
        if (this.usingPolytree) {
          if (this.path1InsidePath2(or1.pts, or2New.pts)) {
            [or2New.pts, or1.pts] = [or1.pts, or2New.pts];
            this.fixOutRecPts(or1);
            this.fixOutRecPts(or2New);
            or2New.owner = or1;
          } else if (this.path1InsidePath2(or2New.pts, or1.pts)) {
            or2New.owner = or1;
          } else {
            or2New.owner = or1.owner;
          }
          if (or1.splits === null)
            or1.splits = [];
          or1.splits.push(or2New.idx);
        } else {
          or2New.owner = or1;
        }
      } else {
        or2.pts = null;
        if (this.usingPolytree) {
          this.setOwner(or2, or1);
          this.moveSplits(or2, or1);
        } else {
          or2.owner = or1;
        }
      }
    }
  }
  fixOutRecPts(outrec) {
    let op = outrec.pts;
    do {
      op.outrec = outrec;
      op = op.next;
    } while (op !== outrec.pts);
  }
  path1InsidePath2(op1, op2) {
    let pip = PointInPolygonResult.IsOn;
    let op = op1;
    do {
      switch (this.pointInOpPolygon(op.pt, op2)) {
        case PointInPolygonResult.IsOutside:
          if (pip === PointInPolygonResult.IsOutside)
            return false;
          pip = PointInPolygonResult.IsOutside;
          break;
        case PointInPolygonResult.IsInside:
          if (pip === PointInPolygonResult.IsInside)
            return true;
          pip = PointInPolygonResult.IsInside;
          break;
        default:
          break;
      }
      op = op.next;
    } while (op !== op1);
    return InternalClipper.path2ContainsPath1(this.getCleanPath(op1), this.getCleanPath(op2));
  }
  pointInOpPolygon(pt, op) {
    if (op === op.next || op.prev === op.next) {
      return PointInPolygonResult.IsOutside;
    }
    let op2 = op;
    do {
      if (op.pt.y !== pt.y)
        break;
      op = op.next;
    } while (op !== op2);
    if (op.pt.y === pt.y)
      return PointInPolygonResult.IsOutside;
    let isAbove = op.pt.y < pt.y;
    const startingAbove = isAbove;
    let val = 0;
    op2 = op.next;
    while (op2 !== op) {
      if (isAbove) {
        while (op2 !== op && op2.pt.y < pt.y)
          op2 = op2.next;
      } else {
        while (op2 !== op && op2.pt.y > pt.y)
          op2 = op2.next;
      }
      if (op2 === op)
        break;
      if (op2.pt.y === pt.y) {
        if (op2.pt.x === pt.x || op2.pt.y === op2.prev.pt.y && pt.x < op2.prev.pt.x !== pt.x < op2.pt.x)
          return PointInPolygonResult.IsOn;
        op2 = op2.next;
        if (op2 === op)
          break;
        continue;
      }
      if (op2.pt.x <= pt.x || op2.prev.pt.x <= pt.x) {
        if (op2.prev.pt.x < pt.x && op2.pt.x < pt.x) {
          val = 1 - val;
        } else {
          const d = InternalClipper.crossProductSign(op2.prev.pt, op2.pt, pt);
          if (d === 0)
            return PointInPolygonResult.IsOn;
          if (d < 0 === isAbove)
            val = 1 - val;
        }
      }
      isAbove = !isAbove;
      op2 = op2.next;
    }
    if (isAbove === startingAbove)
      return val === 0 ? PointInPolygonResult.IsOutside : PointInPolygonResult.IsInside;
    {
      const d = InternalClipper.crossProductSign(op2.prev.pt, op2.pt, pt);
      if (d === 0)
        return PointInPolygonResult.IsOn;
      if (d < 0 === isAbove)
        val = 1 - val;
    }
    return val === 0 ? PointInPolygonResult.IsOutside : PointInPolygonResult.IsInside;
  }
  getCleanPath(op) {
    const result = [];
    let op2 = op;
    while (op2.next !== op && (op2.pt.x === op2.next.pt.x && op2.pt.x === op2.prev.pt.x || op2.pt.y === op2.next.pt.y && op2.pt.y === op2.prev.pt.y))
      op2 = op2.next;
    result.push(op2.pt);
    let prevOp = op2;
    op2 = op2.next;
    while (op2 !== op) {
      if ((op2.pt.x !== op2.next.pt.x || op2.pt.x !== prevOp.pt.x) && (op2.pt.y !== op2.next.pt.y || op2.pt.y !== prevOp.pt.y)) {
        result.push(op2.pt);
        prevOp = op2;
      }
      op2 = op2.next;
    }
    return result;
  }
  moveSplits(fromOr, toOr) {
    if (fromOr.splits === null)
      return;
    if (toOr.splits === null)
      toOr.splits = [];
    for (const i of fromOr.splits) {
      if (i !== toOr.idx) {
        toOr.splits.push(i);
      }
    }
    fromOr.splits = null;
  }
  buildIntersectList(topY) {
    if (this.actives?.nextInAEL === null)
      return false;
    this.adjustCurrXAndCopyToSEL(topY);
    let left = this.sel;
    while (left !== null && left.jump !== null) {
      let prevBase = null;
      while (left !== null && left.jump !== null) {
        let currBase = left;
        let right = left.jump;
        let lEnd = right;
        const rEnd = right?.jump || null;
        left.jump = rEnd;
        while (left !== lEnd && right !== rEnd) {
          if (right.curX < left.curX) {
            let tmp = right.prevInSEL;
            while (true) {
              this.addNewIntersectNode(tmp, right, topY);
              if (tmp === left)
                break;
              tmp = tmp.prevInSEL;
            }
            tmp = right;
            right = this.extractFromSEL(tmp);
            lEnd = right;
            if (left !== null)
              this.insert1Before2InSEL(tmp, left);
            if (left !== currBase)
              continue;
            currBase = tmp;
            currBase.jump = rEnd;
            if (prevBase === null) {
              this.sel = currBase;
            } else {
              prevBase.jump = currBase;
            }
          } else {
            left = left.nextInSEL;
          }
        }
        prevBase = currBase;
        left = rEnd;
      }
      left = this.sel;
    }
    return this.intersectList.length > 0;
  }
  processIntersectList() {
    this.intersectList.sort((a, b) => {
      if (a.pt.y !== b.pt.y)
        return a.pt.y > b.pt.y ? -1 : 1;
      if (a.pt.x !== b.pt.x)
        return a.pt.x < b.pt.x ? -1 : 1;
      if (a.edge1.curX !== b.edge1.curX)
        return a.edge1.curX < b.edge1.curX ? -1 : 1;
      return a.edge2.curX < b.edge2.curX ? -1 : a.edge2.curX > b.edge2.curX ? 1 : 0;
    });
    for (let i = 0;i < this.intersectList.length; ++i) {
      if (!this.edgesAdjacentInAEL(this.intersectList[i])) {
        let j2 = i + 1;
        while (!this.edgesAdjacentInAEL(this.intersectList[j2]))
          j2++;
        [this.intersectList[j2], this.intersectList[i]] = [this.intersectList[i], this.intersectList[j2]];
      }
      const node = this.intersectList[i];
      this.intersectEdges(node.edge1, node.edge2, node.pt);
      this.swapPositionsInAEL(node.edge1, node.edge2);
      node.edge1.curX = node.pt.x;
      node.edge2.curX = node.pt.x;
      this.checkJoinLeft(node.edge2, node.pt, true);
      this.checkJoinRight(node.edge1, node.pt, true);
    }
  }
  edgesAdjacentInAEL(inode) {
    return inode.edge1.nextInAEL === inode.edge2 || inode.edge1.prevInAEL === inode.edge2;
  }
  adjustCurrXAndCopyToSEL(topY) {
    let ae = this.actives;
    this.sel = ae;
    while (ae !== null) {
      ae.prevInSEL = ae.prevInAEL;
      ae.nextInSEL = ae.nextInAEL;
      ae.jump = ae.nextInSEL;
      ae.curX = ClipperBase.topX(ae, topY);
      ae = ae.nextInAEL;
    }
  }
  doMaxima(ae) {
    const prevE = ae.prevInAEL;
    let nextE = ae.nextInAEL;
    if (ClipperBase.isOpenEnd(ae)) {
      if (ClipperBase.isHotEdge(ae))
        this.addOutPt(ae, ae.top);
      if (ClipperBase.isHorizontal(ae))
        return nextE;
      if (ClipperBase.isHotEdge(ae)) {
        if (ClipperBase.isFront(ae)) {
          ae.outrec.frontEdge = null;
        } else {
          ae.outrec.backEdge = null;
        }
        ae.outrec = null;
      }
      this.deleteFromAEL(ae);
      return nextE;
    }
    const maxPair = ClipperBase.getMaximaPair(ae);
    if (maxPair === null)
      return nextE;
    if (this.isJoined(ae))
      this.split(ae, ae.top);
    if (this.isJoined(maxPair))
      this.split(maxPair, maxPair.top);
    while (nextE !== maxPair) {
      this.intersectEdges(ae, nextE, ae.top);
      this.swapPositionsInAEL(ae, nextE);
      nextE = ae.nextInAEL;
    }
    if (ClipperBase.isOpen(ae)) {
      if (ClipperBase.isHotEdge(ae)) {
        this.addLocalMaxPoly(ae, maxPair, ae.top);
      }
      this.deleteFromAEL(maxPair);
      this.deleteFromAEL(ae);
      return prevE !== null ? prevE.nextInAEL : this.actives;
    }
    if (ClipperBase.isHotEdge(ae)) {
      this.addLocalMaxPoly(ae, maxPair, ae.top);
    }
    this.deleteFromAEL(ae);
    this.deleteFromAEL(maxPair);
    return prevE !== null ? prevE.nextInAEL : this.actives;
  }
  updateEdgeIntoAEL(ae) {
    ae.bot = ae.top;
    ae.vertexTop = ClipperBase.nextVertex(ae);
    ae.top = ae.vertexTop.pt;
    ae.curX = ae.bot.x;
    ClipperBase.setDx(ae);
    if (this.isJoined(ae))
      this.split(ae, ae.bot);
    if (ClipperBase.isHorizontal(ae)) {
      if (!ClipperBase.openPathsEnabled) {
        this.trimHorz(ae, this.preserveCollinear);
      } else if (!ClipperBase.isOpen(ae)) {
        this.trimHorz(ae, this.preserveCollinear);
      }
      return;
    }
    this.insertScanline(ae.top.y);
    this.checkJoinLeft(ae, ae.bot);
    this.checkJoinRight(ae, ae.bot, true);
  }
  trimHorz(horzEdge, preserveCollinear) {
    let wasTrimmed = false;
    let pt = ClipperBase.nextVertex(horzEdge).pt;
    while (pt.y === horzEdge.top.y) {
      if (preserveCollinear && pt.x < horzEdge.top.x !== horzEdge.bot.x < horzEdge.top.x) {
        break;
      }
      horzEdge.vertexTop = ClipperBase.nextVertex(horzEdge);
      horzEdge.top = pt;
      wasTrimmed = true;
      if (ClipperBase.isMaxima(horzEdge))
        break;
      pt = ClipperBase.nextVertex(horzEdge).pt;
    }
    if (wasTrimmed)
      ClipperBase.setDx(horzEdge);
  }
  addToHorzSegList(op) {
    if (op.outrec.isOpen)
      return;
    this.horzSegList.push(new HorzSegment(op));
  }
  addNewIntersectNode(ae1, ae2, topY) {
    let ip = InternalClipper.getLineIntersectPt(ae1.bot, ae1.top, ae2.bot, ae2.top);
    if (ip === null) {
      ip = { x: ae1.curX, y: topY };
    }
    if (ip.y > this.currentBotY || ip.y < topY) {
      const absDx1 = Math.abs(ae1.dx);
      const absDx2 = Math.abs(ae2.dx);
      if (absDx1 > 100 && absDx2 > 100) {
        if (absDx1 > absDx2) {
          ip = InternalClipper.getClosestPtOnSegment(ip, ae1.bot, ae1.top);
        } else {
          ip = InternalClipper.getClosestPtOnSegment(ip, ae2.bot, ae2.top);
        }
      } else if (absDx1 > 100) {
        ip = InternalClipper.getClosestPtOnSegment(ip, ae1.bot, ae1.top);
      } else if (absDx2 > 100) {
        ip = InternalClipper.getClosestPtOnSegment(ip, ae2.bot, ae2.top);
      } else {
        if (ip.y < topY)
          ip.y = topY;
        else
          ip.y = this.currentBotY;
        if (absDx1 < absDx2)
          ip.x = ClipperBase.topX(ae1, ip.y);
        else
          ip.x = ClipperBase.topX(ae2, ip.y);
      }
    }
    const node = createIntersectNode(ip, ae1, ae2);
    this.intersectList.push(node);
  }
  extractFromSEL(ae) {
    const res = ae.nextInSEL;
    if (res !== null) {
      res.prevInSEL = ae.prevInSEL;
    }
    ae.prevInSEL.nextInSEL = res;
    return res;
  }
  insert1Before2InSEL(ae1, ae2) {
    ae1.prevInSEL = ae2.prevInSEL;
    if (ae1.prevInSEL !== null) {
      ae1.prevInSEL.nextInSEL = ae1;
    }
    ae1.nextInSEL = ae2;
    ae2.prevInSEL = ae1;
  }
  getCurrYMaximaVertexOpen(ae) {
    let result = ae.vertexTop;
    if (ae.windDx > 0) {
      while (result.next.pt.y === result.pt.y && (result.flags & (VertexFlags.OpenEnd | VertexFlags.LocalMax)) === VertexFlags.None)
        result = result.next;
    } else {
      while (result.prev.pt.y === result.pt.y && (result.flags & (VertexFlags.OpenEnd | VertexFlags.LocalMax)) === VertexFlags.None)
        result = result.prev;
    }
    if (!ClipperBase.isMaxima(result))
      result = null;
    return result;
  }
  getCurrYMaximaVertex(ae) {
    let result = ae.vertexTop;
    if (ae.windDx > 0) {
      while (result.next.pt.y === result.pt.y)
        result = result.next;
    } else {
      while (result.prev.pt.y === result.pt.y)
        result = result.prev;
    }
    if (!ClipperBase.isMaxima(result))
      result = null;
    return result;
  }
  resetHorzDirection(horz, vertexMax) {
    if (horz.bot.x === horz.top.x) {
      const leftX = horz.curX;
      const rightX = horz.curX;
      let ae = horz.nextInAEL;
      while (ae !== null && ae.vertexTop !== vertexMax)
        ae = ae.nextInAEL;
      return { isLeftToRight: ae !== null, leftX, rightX };
    }
    if (horz.curX < horz.top.x) {
      return { isLeftToRight: true, leftX: horz.curX, rightX: horz.top.x };
    } else {
      return { isLeftToRight: false, leftX: horz.top.x, rightX: horz.curX };
    }
  }
  getLastOp(hotEdge) {
    const outrec = hotEdge.outrec;
    return hotEdge === outrec.frontEdge ? outrec.pts : outrec.pts.next;
  }
  insertLeftEdge(ae) {
    if (this.actives === null) {
      ae.prevInAEL = null;
      ae.nextInAEL = null;
      this.actives = ae;
    } else if (!this.isValidAelOrder(this.actives, ae)) {
      ae.prevInAEL = null;
      ae.nextInAEL = this.actives;
      this.actives.prevInAEL = ae;
      this.actives = ae;
    } else {
      let ae2 = this.actives;
      while (ae2.nextInAEL !== null && this.isValidAelOrder(ae2.nextInAEL, ae)) {
        ae2 = ae2.nextInAEL;
      }
      if (ae2.joinWith === JoinWith.Right)
        ae2 = ae2.nextInAEL;
      ae.nextInAEL = ae2.nextInAEL;
      if (ae2.nextInAEL !== null)
        ae2.nextInAEL.prevInAEL = ae;
      ae.prevInAEL = ae2;
      ae2.nextInAEL = ae;
    }
  }
  insertRightEdge(ae1, ae2) {
    ae2.nextInAEL = ae1.nextInAEL;
    if (ae1.nextInAEL !== null)
      ae1.nextInAEL.prevInAEL = ae2;
    ae2.prevInAEL = ae1;
    ae1.nextInAEL = ae2;
  }
  setWindCountForOpenPathEdge(ae) {
    let ae2 = this.actives;
    if (this.fillrule === FillRule.EvenOdd) {
      let cnt1 = 0, cnt2 = 0;
      while (ae2 !== ae) {
        if (ClipperBase.getPolyType(ae2) === PathType.Clip) {
          cnt2++;
        } else if (!ClipperBase.isOpen(ae2)) {
          cnt1++;
        }
        ae2 = ae2.nextInAEL;
      }
      ae.windCount = ClipperBase.isOdd(cnt1) ? 1 : 0;
      ae.windCount2 = ClipperBase.isOdd(cnt2) ? 1 : 0;
    } else {
      while (ae2 !== ae) {
        if (ClipperBase.getPolyType(ae2) === PathType.Clip) {
          ae.windCount2 += ae2.windDx;
        } else if (!ClipperBase.isOpen(ae2)) {
          ae.windCount += ae2.windDx;
        }
        ae2 = ae2.nextInAEL;
      }
    }
  }
  setWindCountForClosedPathEdge(ae) {
    let ae2 = ae.prevInAEL;
    const pt = ClipperBase.getPolyType(ae);
    if (!ClipperBase.openPathsEnabled) {
      while (ae2 !== null && ClipperBase.getPolyType(ae2) !== pt)
        ae2 = ae2.prevInAEL;
      if (ae2 === null) {
        ae.windCount = ae.windDx;
        ae2 = this.actives;
      } else if (this.fillrule === FillRule.EvenOdd) {
        ae.windCount = ae.windDx;
        ae.windCount2 = ae2.windCount2;
        ae2 = ae2.nextInAEL;
      } else {
        if (ae2.windCount * ae2.windDx < 0) {
          if (Math.abs(ae2.windCount) > 1) {
            if (ae2.windDx * ae.windDx < 0) {
              ae.windCount = ae2.windCount;
            } else {
              ae.windCount = ae2.windCount + ae.windDx;
            }
          } else {
            ae.windCount = ae.windDx;
          }
        } else {
          if (ae2.windDx * ae.windDx < 0) {
            ae.windCount = ae2.windCount;
          } else {
            ae.windCount = ae2.windCount + ae.windDx;
          }
        }
        ae.windCount2 = ae2.windCount2;
        ae2 = ae2.nextInAEL;
      }
      if (this.fillrule === FillRule.EvenOdd) {
        while (ae2 !== ae) {
          if (ClipperBase.getPolyType(ae2) !== pt) {
            ae.windCount2 = ae.windCount2 === 0 ? 1 : 0;
          }
          ae2 = ae2.nextInAEL;
        }
      } else {
        while (ae2 !== ae) {
          if (ClipperBase.getPolyType(ae2) !== pt) {
            ae.windCount2 += ae2.windDx;
          }
          ae2 = ae2.nextInAEL;
        }
      }
      return;
    }
    while (ae2 !== null && (ClipperBase.getPolyType(ae2) !== pt || ClipperBase.isOpen(ae2)))
      ae2 = ae2.prevInAEL;
    if (ae2 === null) {
      ae.windCount = ae.windDx;
      ae2 = this.actives;
    } else if (this.fillrule === FillRule.EvenOdd) {
      ae.windCount = ae.windDx;
      ae.windCount2 = ae2.windCount2;
      ae2 = ae2.nextInAEL;
    } else {
      if (ae2.windCount * ae2.windDx < 0) {
        if (Math.abs(ae2.windCount) > 1) {
          if (ae2.windDx * ae.windDx < 0) {
            ae.windCount = ae2.windCount;
          } else {
            ae.windCount = ae2.windCount + ae.windDx;
          }
        } else {
          ae.windCount = ClipperBase.isOpen(ae) ? 1 : ae.windDx;
        }
      } else {
        if (ae2.windDx * ae.windDx < 0) {
          ae.windCount = ae2.windCount;
        } else {
          ae.windCount = ae2.windCount + ae.windDx;
        }
      }
      ae.windCount2 = ae2.windCount2;
      ae2 = ae2.nextInAEL;
    }
    if (this.fillrule === FillRule.EvenOdd) {
      while (ae2 !== ae) {
        if (ClipperBase.getPolyType(ae2) !== pt && !ClipperBase.isOpen(ae2)) {
          ae.windCount2 = ae.windCount2 === 0 ? 1 : 0;
        }
        ae2 = ae2.nextInAEL;
      }
    } else {
      while (ae2 !== ae) {
        if (ClipperBase.getPolyType(ae2) !== pt && !ClipperBase.isOpen(ae2)) {
          ae.windCount2 += ae2.windDx;
        }
        ae2 = ae2.nextInAEL;
      }
    }
  }
  isContributingOpen(ae) {
    let isInClip, isInSubj;
    switch (this.fillrule) {
      case FillRule.Positive:
        isInSubj = ae.windCount > 0;
        isInClip = ae.windCount2 > 0;
        break;
      case FillRule.Negative:
        isInSubj = ae.windCount < 0;
        isInClip = ae.windCount2 < 0;
        break;
      default:
        isInSubj = ae.windCount !== 0;
        isInClip = ae.windCount2 !== 0;
        break;
    }
    switch (this.cliptype) {
      case ClipType.Intersection:
        return isInClip;
      case ClipType.Union:
        return !isInSubj && !isInClip;
      default:
        return !isInClip;
    }
  }
  isContributingClosed(ae) {
    switch (this.fillrule) {
      case FillRule.Positive:
        if (ae.windCount !== 1)
          return false;
        break;
      case FillRule.Negative:
        if (ae.windCount !== -1)
          return false;
        break;
      case FillRule.NonZero:
        if (Math.abs(ae.windCount) !== 1)
          return false;
        break;
    }
    switch (this.cliptype) {
      case ClipType.Intersection:
        return this.fillrule === FillRule.Positive ? ae.windCount2 > 0 : this.fillrule === FillRule.Negative ? ae.windCount2 < 0 : ae.windCount2 !== 0;
      case ClipType.Union:
        return this.fillrule === FillRule.Positive ? ae.windCount2 <= 0 : this.fillrule === FillRule.Negative ? ae.windCount2 >= 0 : ae.windCount2 === 0;
      case ClipType.Difference: {
        const result = this.fillrule === FillRule.Positive ? ae.windCount2 <= 0 : this.fillrule === FillRule.Negative ? ae.windCount2 >= 0 : ae.windCount2 === 0;
        return ClipperBase.getPolyType(ae) === PathType.Subject ? result : !result;
      }
      case ClipType.Xor:
        return true;
      default:
        return false;
    }
  }
  addLocalMinPoly(ae1, ae2, pt, isNew = false) {
    const outrec = this.newOutRec();
    ae1.outrec = outrec;
    ae2.outrec = outrec;
    if (ClipperBase.isOpen(ae1)) {
      outrec.owner = null;
      outrec.isOpen = true;
      if (ae1.windDx > 0) {
        this.setSides(outrec, ae1, ae2);
      } else {
        this.setSides(outrec, ae2, ae1);
      }
    } else {
      outrec.isOpen = false;
      const prevHotEdge = ClipperBase.getPrevHotEdge(ae1);
      if (prevHotEdge !== null) {
        if (this.usingPolytree) {
          this.setOwner(outrec, prevHotEdge.outrec);
        }
        outrec.owner = prevHotEdge.outrec;
        if (this.outrecIsAscending(prevHotEdge) === isNew) {
          this.setSides(outrec, ae2, ae1);
        } else {
          this.setSides(outrec, ae1, ae2);
        }
      } else {
        outrec.owner = null;
        if (isNew) {
          this.setSides(outrec, ae1, ae2);
        } else {
          this.setSides(outrec, ae2, ae1);
        }
      }
    }
    const op = new OutPt(pt, outrec);
    outrec.pts = op;
    return op;
  }
  outrecIsAscending(hotEdge) {
    return hotEdge === hotEdge.outrec.frontEdge;
  }
  newOutRec() {
    const result = new OutRec;
    result.idx = this.outrecList.length;
    this.outrecList.push(result);
    return result;
  }
  startOpenPath(ae, pt) {
    const outrec = this.newOutRec();
    outrec.isOpen = true;
    if (ae.windDx > 0) {
      outrec.frontEdge = ae;
      outrec.backEdge = null;
    } else {
      outrec.frontEdge = null;
      outrec.backEdge = ae;
    }
    ae.outrec = outrec;
    const op = new OutPt(pt, outrec);
    outrec.pts = op;
    return op;
  }
  checkJoinLeft(ae, pt, checkCurrX = false) {
    const prev = ae.prevInAEL;
    if (prev === null || !ClipperBase.isHotEdge(ae) || !ClipperBase.isHotEdge(prev) || ClipperBase.isHorizontal(ae) || ClipperBase.isHorizontal(prev) || ClipperBase.isOpen(ae) || ClipperBase.isOpen(prev))
      return;
    if ((pt.y < ae.top.y + 2 || pt.y < prev.top.y + 2) && (ae.bot.y > pt.y || prev.bot.y > pt.y))
      return;
    if (checkCurrX) {
      if (this.perpendicDistFromLineSqrdGreaterThanQuarter(pt, prev.bot, prev.top))
        return;
    } else if (ae.curX !== prev.curX)
      return;
    if (!InternalClipper.isCollinear(ae.top, pt, prev.top))
      return;
    if (ae.outrec.idx === prev.outrec.idx) {
      this.addLocalMaxPoly(prev, ae, pt);
    } else if (ae.outrec.idx < prev.outrec.idx) {
      this.joinOutrecPaths(ae, prev);
    } else {
      this.joinOutrecPaths(prev, ae);
    }
    prev.joinWith = JoinWith.Right;
    ae.joinWith = JoinWith.Left;
  }
  checkJoinRight(ae, pt, checkCurrX = false) {
    const next = ae.nextInAEL;
    if (next === null || !ClipperBase.isHotEdge(ae) || !ClipperBase.isHotEdge(next) || ClipperBase.isHorizontal(ae) || ClipperBase.isHorizontal(next) || ClipperBase.isOpen(ae) || ClipperBase.isOpen(next))
      return;
    if ((pt.y < ae.top.y + 2 || pt.y < next.top.y + 2) && (ae.bot.y > pt.y || next.bot.y > pt.y))
      return;
    if (checkCurrX) {
      if (this.perpendicDistFromLineSqrdGreaterThanQuarter(pt, next.bot, next.top))
        return;
    } else if (ae.curX !== next.curX)
      return;
    if (!InternalClipper.isCollinear(ae.top, pt, next.top))
      return;
    if (ae.outrec.idx === next.outrec.idx) {
      this.addLocalMaxPoly(ae, next, pt);
    } else if (ae.outrec.idx < next.outrec.idx) {
      this.joinOutrecPaths(ae, next);
    } else {
      this.joinOutrecPaths(next, ae);
    }
    ae.joinWith = JoinWith.Right;
    next.joinWith = JoinWith.Left;
  }
  perpendicDistFromLineSqrdGreaterThanQuarter(pt, line1, line2) {
    const a = pt.x - line1.x;
    const b = pt.y - line1.y;
    const c = line2.x - line1.x;
    const d = line2.y - line1.y;
    if (c === 0 && d === 0)
      return false;
    const maxCoord = InternalClipper.maxCoordForSafeCrossSq;
    if (Math.abs(a) < maxCoord && Math.abs(b) < maxCoord && Math.abs(c) < maxCoord && Math.abs(d) < maxCoord) {
      const cross2 = a * d - c * b;
      return cross2 * cross2 / (c * c + d * d) > 0.25;
    }
    if (Number.isSafeInteger(a) && Number.isSafeInteger(b) && Number.isSafeInteger(c) && Number.isSafeInteger(d)) {
      const cross2 = BigInt(a) * BigInt(d) - BigInt(c) * BigInt(b);
      const crossSq = cross2 * cross2;
      const denom = BigInt(c) * BigInt(c) + BigInt(d) * BigInt(d);
      return B42 * crossSq > denom;
    }
    const cross = a * d - c * b;
    return cross * cross / (c * c + d * d) > 0.25;
  }
  intersectEdges(ae1, ae2, pt) {
    let resultOp;
    if (this.hasOpenPaths && (ClipperBase.isOpen(ae1) || ClipperBase.isOpen(ae2))) {
      if (ClipperBase.isOpen(ae1) && ClipperBase.isOpen(ae2))
        return;
      if (ClipperBase.isOpen(ae2))
        [ae1, ae2] = ClipperBase.swapActives(ae1, ae2);
      if (this.isJoined(ae2))
        this.split(ae2, pt);
      if (this.cliptype === ClipType.Union) {
        if (!ClipperBase.isHotEdge(ae2))
          return;
      } else if (ae2.localMin.polytype === PathType.Subject)
        return;
      switch (this.fillrule) {
        case FillRule.Positive:
          if (ae2.windCount !== 1)
            return;
          break;
        case FillRule.Negative:
          if (ae2.windCount !== -1)
            return;
          break;
        default:
          if (Math.abs(ae2.windCount) !== 1)
            return;
          break;
      }
      if (ClipperBase.isHotEdge(ae1)) {
        resultOp = this.addOutPt(ae1, pt);
        this.setZ(ae1, ae2, resultOp.pt);
        if (ClipperBase.isFront(ae1)) {
          ae1.outrec.frontEdge = null;
        } else {
          ae1.outrec.backEdge = null;
        }
        ae1.outrec = null;
      } else if (pt.x === ae1.localMin.vertex.pt.x && pt.y === ae1.localMin.vertex.pt.y && !ClipperBase.isOpenEndVertex(ae1.localMin.vertex)) {
        const ae3 = this.findEdgeWithMatchingLocMin(ae1);
        if (ae3 !== null && ClipperBase.isHotEdge(ae3)) {
          ae1.outrec = ae3.outrec;
          if (ae1.windDx > 0) {
            this.setSides(ae3.outrec, ae1, ae3);
          } else {
            this.setSides(ae3.outrec, ae3, ae1);
          }
          return;
        }
        resultOp = this.startOpenPath(ae1, pt);
      } else {
        resultOp = this.startOpenPath(ae1, pt);
      }
      this.setZ(ae1, ae2, resultOp.pt);
      return;
    }
    if (this.isJoined(ae1))
      this.split(ae1, pt);
    if (this.isJoined(ae2))
      this.split(ae2, pt);
    let oldE1WindCount, oldE2WindCount;
    if (ae1.localMin.polytype === ae2.localMin.polytype) {
      if (this.fillrule === FillRule.EvenOdd) {
        oldE1WindCount = ae1.windCount;
        ae1.windCount = ae2.windCount;
        ae2.windCount = oldE1WindCount;
      } else {
        if (ae1.windCount + ae2.windDx === 0) {
          ae1.windCount = -ae1.windCount;
        } else {
          ae1.windCount += ae2.windDx;
        }
        if (ae2.windCount - ae1.windDx === 0) {
          ae2.windCount = -ae2.windCount;
        } else {
          ae2.windCount -= ae1.windDx;
        }
      }
    } else {
      if (this.fillrule !== FillRule.EvenOdd) {
        ae1.windCount2 += ae2.windDx;
      } else {
        ae1.windCount2 = ae1.windCount2 === 0 ? 1 : 0;
      }
      if (this.fillrule !== FillRule.EvenOdd) {
        ae2.windCount2 -= ae1.windDx;
      } else {
        ae2.windCount2 = ae2.windCount2 === 0 ? 1 : 0;
      }
    }
    switch (this.fillrule) {
      case FillRule.Positive:
        oldE1WindCount = ae1.windCount;
        oldE2WindCount = ae2.windCount;
        break;
      case FillRule.Negative:
        oldE1WindCount = -ae1.windCount;
        oldE2WindCount = -ae2.windCount;
        break;
      default:
        oldE1WindCount = Math.abs(ae1.windCount);
        oldE2WindCount = Math.abs(ae2.windCount);
        break;
    }
    const e1WindCountIs0or1 = oldE1WindCount === 0 || oldE1WindCount === 1;
    const e2WindCountIs0or1 = oldE2WindCount === 0 || oldE2WindCount === 1;
    if (!ClipperBase.isHotEdge(ae1) && !e1WindCountIs0or1 || !ClipperBase.isHotEdge(ae2) && !e2WindCountIs0or1)
      return;
    if (ClipperBase.isHotEdge(ae1) && ClipperBase.isHotEdge(ae2)) {
      if (oldE1WindCount !== 0 && oldE1WindCount !== 1 || oldE2WindCount !== 0 && oldE2WindCount !== 1 || ae1.localMin.polytype !== ae2.localMin.polytype && this.cliptype !== ClipType.Xor) {
        resultOp = this.addLocalMaxPoly(ae1, ae2, pt);
        if (resultOp)
          this.setZ(ae1, ae2, resultOp.pt);
      } else if (ClipperBase.isFront(ae1) || ae1.outrec === ae2.outrec) {
        resultOp = this.addLocalMaxPoly(ae1, ae2, pt);
        if (resultOp)
          this.setZ(ae1, ae2, resultOp.pt);
        const op2 = this.addLocalMinPoly(ae1, ae2, pt);
        this.setZ(ae1, ae2, op2.pt);
      } else {
        resultOp = this.addOutPt(ae1, pt);
        this.setZ(ae1, ae2, resultOp.pt);
        const op2 = this.addOutPt(ae2, pt);
        this.setZ(ae1, ae2, op2.pt);
        this.swapOutrecs(ae1, ae2);
      }
    } else if (ClipperBase.isHotEdge(ae1)) {
      resultOp = this.addOutPt(ae1, pt);
      this.setZ(ae1, ae2, resultOp.pt);
      this.swapOutrecs(ae1, ae2);
    } else if (ClipperBase.isHotEdge(ae2)) {
      resultOp = this.addOutPt(ae2, pt);
      this.setZ(ae1, ae2, resultOp.pt);
      this.swapOutrecs(ae1, ae2);
    } else {
      let e1Wc2, e2Wc2;
      switch (this.fillrule) {
        case FillRule.Positive:
          e1Wc2 = ae1.windCount2;
          e2Wc2 = ae2.windCount2;
          break;
        case FillRule.Negative:
          e1Wc2 = -ae1.windCount2;
          e2Wc2 = -ae2.windCount2;
          break;
        default:
          e1Wc2 = Math.abs(ae1.windCount2);
          e2Wc2 = Math.abs(ae2.windCount2);
          break;
      }
      if (!ClipperBase.isSamePolyType(ae1, ae2)) {
        resultOp = this.addLocalMinPoly(ae1, ae2, pt);
        this.setZ(ae1, ae2, resultOp.pt);
      } else if (oldE1WindCount === 1 && oldE2WindCount === 1) {
        resultOp = null;
        switch (this.cliptype) {
          case ClipType.Union:
            if (e1Wc2 > 0 && e2Wc2 > 0)
              return;
            resultOp = this.addLocalMinPoly(ae1, ae2, pt);
            break;
          case ClipType.Difference:
            if (ClipperBase.getPolyType(ae1) === PathType.Clip && e1Wc2 > 0 && e2Wc2 > 0 || ClipperBase.getPolyType(ae1) === PathType.Subject && e1Wc2 <= 0 && e2Wc2 <= 0) {
              resultOp = this.addLocalMinPoly(ae1, ae2, pt);
            }
            break;
          case ClipType.Xor:
            resultOp = this.addLocalMinPoly(ae1, ae2, pt);
            break;
          default:
            if (e1Wc2 <= 0 || e2Wc2 <= 0)
              return;
            resultOp = this.addLocalMinPoly(ae1, ae2, pt);
            break;
        }
        if (resultOp)
          this.setZ(ae1, ae2, resultOp.pt);
      }
    }
  }
  swapPositionsInAEL(ae1, ae2) {
    const next = ae2.nextInAEL;
    if (next !== null)
      next.prevInAEL = ae1;
    const prev = ae1.prevInAEL;
    if (prev !== null)
      prev.nextInAEL = ae2;
    ae2.prevInAEL = prev;
    ae2.nextInAEL = ae1;
    ae1.prevInAEL = ae2;
    ae1.nextInAEL = next;
    if (ae2.prevInAEL === null)
      this.actives = ae2;
  }
  isValidAelOrder(resident, newcomer) {
    if (newcomer.curX !== resident.curX) {
      return newcomer.curX > resident.curX;
    }
    const d = InternalClipper.crossProductSign(resident.top, newcomer.bot, newcomer.top);
    if (d !== 0)
      return d < 0;
    if (!ClipperBase.isMaxima(resident) && resident.top.y > newcomer.top.y) {
      return InternalClipper.crossProductSign(newcomer.bot, resident.top, ClipperBase.nextVertex(resident).pt) <= 0;
    }
    if (!ClipperBase.isMaxima(newcomer) && newcomer.top.y > resident.top.y) {
      return InternalClipper.crossProductSign(newcomer.bot, newcomer.top, ClipperBase.nextVertex(newcomer).pt) >= 0;
    }
    const y = newcomer.bot.y;
    const newcomerIsLeft = newcomer.isLeftBound;
    if (resident.bot.y !== y || resident.localMin.vertex.pt.y !== y) {
      return newcomer.isLeftBound;
    }
    if (resident.isLeftBound !== newcomerIsLeft) {
      return newcomerIsLeft;
    }
    if (InternalClipper.isCollinear(ClipperBase.prevPrevVertex(resident).pt, resident.bot, resident.top))
      return true;
    return InternalClipper.crossProductSign(ClipperBase.prevPrevVertex(resident).pt, newcomer.bot, ClipperBase.prevPrevVertex(newcomer).pt) > 0 === newcomerIsLeft;
  }
  isJoined(e) {
    return e.joinWith !== JoinWith.None;
  }
  split(e, currPt) {
    if (e.joinWith === JoinWith.Right) {
      e.joinWith = JoinWith.None;
      e.nextInAEL.joinWith = JoinWith.None;
      this.addLocalMinPoly(e, e.nextInAEL, currPt, true);
    } else {
      e.joinWith = JoinWith.None;
      e.prevInAEL.joinWith = JoinWith.None;
      this.addLocalMinPoly(e.prevInAEL, e, currPt, true);
    }
  }
  setSides(outrec, startEdge, endEdge) {
    outrec.frontEdge = startEdge;
    outrec.backEdge = endEdge;
  }
  findEdgeWithMatchingLocMin(e) {
    let result = e.nextInAEL;
    while (result !== null) {
      if (result.localMin?.equals(e.localMin))
        return result;
      if (!ClipperBase.isHorizontal(result) && !(e.bot.x === result.bot.x && e.bot.y === result.bot.y))
        result = null;
      else
        result = result.nextInAEL;
    }
    result = e.prevInAEL;
    while (result !== null) {
      if (result.localMin?.equals(e.localMin))
        return result;
      if (!ClipperBase.isHorizontal(result) && !(e.bot.x === result.bot.x && e.bot.y === result.bot.y))
        return null;
      result = result.prevInAEL;
    }
    return result;
  }
  addOutPt(ae, pt) {
    const outrec = ae.outrec;
    const toFront = ClipperBase.isFront(ae);
    const opFront = outrec.pts;
    const opBack = opFront.next;
    if (toFront && pt.x === opFront.pt.x && pt.y === opFront.pt.y) {
      return opFront;
    } else if (!toFront && pt.x === opBack.pt.x && pt.y === opBack.pt.y) {
      return opBack;
    }
    const newOp = new OutPt(pt, outrec);
    opBack.prev = newOp;
    newOp.prev = opFront;
    newOp.next = opBack;
    opFront.next = newOp;
    if (toFront)
      outrec.pts = newOp;
    return newOp;
  }
  addLocalMaxPoly(ae1, ae2, pt) {
    if (this.isJoined(ae1))
      this.split(ae1, pt);
    if (this.isJoined(ae2))
      this.split(ae2, pt);
    if (ClipperBase.isFront(ae1) === ClipperBase.isFront(ae2)) {
      if (ClipperBase.isOpenEnd(ae1)) {
        this.swapFrontBackSides(ae1.outrec);
      } else if (ClipperBase.isOpenEnd(ae2)) {
        this.swapFrontBackSides(ae2.outrec);
      } else {
        this.succeeded = false;
        return null;
      }
    }
    const result = this.addOutPt(ae1, pt);
    if (ae1.outrec === ae2.outrec) {
      const outrec = ae1.outrec;
      outrec.pts = result;
      if (this.usingPolytree) {
        const e = ClipperBase.getPrevHotEdge(ae1);
        if (e === null) {
          outrec.owner = null;
        } else {
          this.setOwner(outrec, e.outrec);
        }
      }
      this.uncoupleOutRec(ae1);
    } else if (ClipperBase.isOpen(ae1)) {
      if (ae1.windDx < 0) {
        this.joinOutrecPaths(ae1, ae2);
      } else {
        this.joinOutrecPaths(ae2, ae1);
      }
    } else if (ae1.outrec.idx < ae2.outrec.idx) {
      this.joinOutrecPaths(ae1, ae2);
    } else {
      this.joinOutrecPaths(ae2, ae1);
    }
    return result;
  }
  swapFrontBackSides(outrec) {
    const ae2 = outrec.frontEdge;
    outrec.frontEdge = outrec.backEdge;
    outrec.backEdge = ae2;
    outrec.pts = outrec.pts.next;
  }
  setOwner(outrec, newOwner) {
    while (newOwner.owner !== null && newOwner.owner.pts === null) {
      newOwner.owner = newOwner.owner.owner;
    }
    let tmp = newOwner;
    while (tmp !== null && tmp !== outrec) {
      tmp = tmp.owner;
    }
    if (tmp !== null) {
      newOwner.owner = outrec.owner;
    }
    outrec.owner = newOwner;
  }
  uncoupleOutRec(ae) {
    const outrec = ae.outrec;
    if (outrec === null)
      return;
    outrec.frontEdge.outrec = null;
    outrec.backEdge.outrec = null;
    outrec.frontEdge = null;
    outrec.backEdge = null;
  }
  joinOutrecPaths(ae1, ae2) {
    const p1Start = ae1.outrec.pts;
    const p2Start = ae2.outrec.pts;
    const p1End = p1Start.next;
    const p2End = p2Start.next;
    if (ClipperBase.isFront(ae1)) {
      p2End.prev = p1Start;
      p1Start.next = p2End;
      p2Start.next = p1End;
      p1End.prev = p2Start;
      ae1.outrec.pts = p2Start;
      ae1.outrec.frontEdge = ae2.outrec.frontEdge;
      if (ae1.outrec.frontEdge !== null) {
        ae1.outrec.frontEdge.outrec = ae1.outrec;
      }
    } else {
      p1End.prev = p2Start;
      p2Start.next = p1End;
      p1Start.next = p2End;
      p2End.prev = p1Start;
      ae1.outrec.backEdge = ae2.outrec.backEdge;
      if (ae1.outrec.backEdge !== null) {
        ae1.outrec.backEdge.outrec = ae1.outrec;
      }
    }
    ae2.outrec.frontEdge = null;
    ae2.outrec.backEdge = null;
    ae2.outrec.pts = null;
    this.setOwner(ae2.outrec, ae1.outrec);
    if (ClipperBase.isOpenEnd(ae1)) {
      ae2.outrec.pts = ae1.outrec.pts;
      ae1.outrec.pts = null;
    }
    ae1.outrec = null;
    ae2.outrec = null;
  }
  swapOutrecs(ae1, ae2) {
    const or1 = ae1.outrec;
    const or2 = ae2.outrec;
    if (or1 === or2) {
      const ae = or1.frontEdge;
      or1.frontEdge = or1.backEdge;
      or1.backEdge = ae;
      return;
    }
    if (or1 !== null) {
      if (ae1 === or1.frontEdge) {
        or1.frontEdge = ae2;
      } else {
        or1.backEdge = ae2;
      }
    }
    if (or2 !== null) {
      if (ae2 === or2.frontEdge) {
        or2.frontEdge = ae1;
      } else {
        or2.backEdge = ae1;
      }
    }
    ae1.outrec = or2;
    ae2.outrec = or1;
  }
  disposeIntersectNodes() {
    this.intersectList.length = 0;
  }
  static ptsReallyClose(pt1, pt2) {
    return Math.abs(pt1.x - pt2.x) < 2 && Math.abs(pt1.y - pt2.y) < 2;
  }
  static isVerySmallTriangle(op) {
    return op.next.next === op.prev && (ClipperBase.ptsReallyClose(op.prev.pt, op.next.pt) || ClipperBase.ptsReallyClose(op.pt, op.next.pt) || ClipperBase.ptsReallyClose(op.pt, op.prev.pt));
  }
  static buildPath(op, reverse, isOpen, path4) {
    if (op === null || op.next === op || !isOpen && op.next === op.prev)
      return false;
    path4.length = 0;
    let lastPt;
    let op2;
    if (reverse) {
      lastPt = op.pt;
      op2 = op.prev;
    } else {
      op = op.next;
      lastPt = op.pt;
      op2 = op.next;
    }
    path4.push(lastPt);
    while (op2 !== op) {
      if (!(op2.pt.x === lastPt.x && op2.pt.y === lastPt.y)) {
        lastPt = op2.pt;
        path4.push(lastPt);
      }
      if (reverse) {
        op2 = op2.prev;
      } else {
        op2 = op2.next;
      }
    }
    return path4.length !== 3 || isOpen || !ClipperBase.isVerySmallTriangle(op2);
  }
  buildPaths(solutionClosed, solutionOpen) {
    solutionClosed.length = 0;
    solutionOpen.length = 0;
    let i = 0;
    while (i < this.outrecList.length) {
      const outrec = this.outrecList[i++];
      if (outrec.pts === null)
        continue;
      const path4 = [];
      if (outrec.isOpen) {
        if (ClipperBase.buildPath(outrec.pts, this.reverseSolution, true, path4)) {
          solutionOpen.push(path4);
        }
      } else {
        this.cleanCollinear(outrec);
        if (ClipperBase.buildPath(outrec.pts, this.reverseSolution, false, path4)) {
          solutionClosed.push(path4);
        }
      }
    }
    return true;
  }
  buildTree(polytree, solutionOpen) {
    polytree.clear();
    solutionOpen.length = 0;
    let i = 0;
    while (i < this.outrecList.length) {
      const outrec = this.outrecList[i++];
      if (outrec.pts === null)
        continue;
      if (outrec.isOpen) {
        const openPath = [];
        if (ClipperBase.buildPath(outrec.pts, this.reverseSolution, true, openPath)) {
          solutionOpen.push(openPath);
        }
        continue;
      }
      if (this.checkBounds(outrec)) {
        this.recursiveCheckOwners(outrec, polytree);
      }
    }
  }
  checkBounds(outrec) {
    if (outrec.pts === null)
      return false;
    if (!Rect64Utils.isEmpty(outrec.bounds))
      return true;
    this.cleanCollinear(outrec);
    if (outrec.pts === null || !ClipperBase.buildPath(outrec.pts, this.reverseSolution, false, outrec.path)) {
      return false;
    }
    outrec.bounds = InternalClipper.getBounds(outrec.path);
    return true;
  }
  recursiveCheckOwners(outrec, polypath) {
    if (outrec.polypath !== null || Rect64Utils.isEmpty(outrec.bounds))
      return;
    while (outrec.owner !== null) {
      if (outrec.owner.splits !== null && this.checkSplitOwner(outrec, outrec.owner.splits))
        break;
      if (outrec.owner.pts !== null && this.checkBounds(outrec.owner) && this.containsRect(outrec.owner.bounds, outrec.bounds) && this.path1InsidePath2(outrec.pts, outrec.owner.pts))
        break;
      outrec.owner = outrec.owner.owner;
    }
    if (outrec.owner !== null) {
      if (outrec.owner.polypath === null) {
        this.recursiveCheckOwners(outrec.owner, polypath);
      }
      outrec.polypath = outrec.owner.polypath.addChild(outrec.path);
    } else {
      outrec.polypath = polypath.addChild(outrec.path);
    }
  }
  cleanCollinear(outrec) {
    outrec = this.getRealOutRec(outrec);
    if (outrec === null || outrec.isOpen)
      return;
    if (!this.isValidClosedPath(outrec.pts)) {
      outrec.pts = null;
      return;
    }
    let startOp = outrec.pts;
    let op2 = startOp;
    while (true) {
      if (op2 !== null && InternalClipper.isCollinear(op2.prev.pt, op2.pt, op2.next.pt) && (op2.pt.x === op2.prev.pt.x && op2.pt.y === op2.prev.pt.y || op2.pt.x === op2.next.pt.x && op2.pt.y === op2.next.pt.y || !this.preserveCollinear || InternalClipper.dotProductSign(op2.prev.pt, op2.pt, op2.next.pt) < 0)) {
        if (op2 === outrec.pts) {
          outrec.pts = op2.prev;
        }
        op2 = this.disposeOutPt(op2);
        if (!this.isValidClosedPath(op2)) {
          outrec.pts = null;
          return;
        }
        startOp = op2;
        continue;
      }
      if (op2 === null)
        break;
      op2 = op2.next;
      if (op2 === startOp)
        break;
    }
    this.fixSelfIntersects(outrec);
  }
  isValidClosedPath(op) {
    return op !== null && op.next !== op && (op.next !== op.prev || !ClipperBase.isVerySmallTriangle(op));
  }
  disposeOutPt(op) {
    const result = op.next === op ? null : op.next;
    op.prev.next = op.next;
    op.next.prev = op.prev;
    return result;
  }
  fixSelfIntersects(outrec) {
    let op2 = outrec.pts;
    if (op2.prev === op2.next.next) {
      return;
    }
    while (true) {
      if (op2.next && op2.next.next && this.boundingBoxesOverlap(op2.prev.pt, op2.pt, op2.next.pt, op2.next.next.pt) && InternalClipper.segsIntersect(op2.prev.pt, op2.pt, op2.next.pt, op2.next.next.pt)) {
        if (op2 === outrec.pts || op2.next === outrec.pts) {
          outrec.pts = outrec.pts.prev;
        }
        this.doSplitOp(outrec, op2);
        if (outrec.pts === null)
          return;
        op2 = outrec.pts;
        if (op2.prev === op2.next.next)
          break;
        continue;
      }
      op2 = op2.next;
      if (op2 === outrec.pts)
        break;
    }
  }
  doSplitOp(outrec, splitOp) {
    const prevOp = splitOp.prev;
    const nextNextOp = splitOp.next.next;
    outrec.pts = prevOp;
    const ip = InternalClipper.getLineIntersectPt(prevOp.pt, splitOp.pt, splitOp.next.pt, nextNextOp.pt);
    const doubleArea1 = ClipperBase.areaOutPt(prevOp);
    const absDoubleArea1 = doubleArea1 < B02 ? -doubleArea1 : doubleArea1;
    if (absDoubleArea1 < B42) {
      outrec.pts = null;
      return;
    }
    const doubleArea2 = this.areaTriangle(ip, splitOp.pt, splitOp.next.pt);
    const absDoubleArea2 = doubleArea2 < B02 ? -doubleArea2 : doubleArea2;
    if (ip.x === prevOp.pt.x && ip.y === prevOp.pt.y || ip.x === nextNextOp.pt.x && ip.y === nextNextOp.pt.y) {
      nextNextOp.prev = prevOp;
      prevOp.next = nextNextOp;
    } else {
      const newOp2 = new OutPt(ip, outrec);
      newOp2.prev = prevOp;
      newOp2.next = nextNextOp;
      nextNextOp.prev = newOp2;
      prevOp.next = newOp2;
    }
    if (!(absDoubleArea2 > B22) || !(absDoubleArea2 > absDoubleArea1) && doubleArea2 > B02 !== doubleArea1 > B02)
      return;
    const newOutRec = this.newOutRec();
    newOutRec.owner = outrec.owner;
    splitOp.outrec = newOutRec;
    splitOp.next.outrec = newOutRec;
    const newOp = new OutPt(ip, newOutRec);
    newOp.prev = splitOp.next;
    newOp.next = splitOp;
    newOutRec.pts = newOp;
    splitOp.prev = newOp;
    splitOp.next.next = newOp;
    if (!this.usingPolytree)
      return;
    if (this.path1InsidePath2(prevOp, newOp)) {
      if (newOutRec.splits === null)
        newOutRec.splits = [];
      newOutRec.splits.push(outrec.idx);
    } else {
      if (outrec.splits === null)
        outrec.splits = [];
      outrec.splits.push(newOutRec.idx);
    }
  }
  static areaOutPt(op) {
    const maxCoord = InternalClipper.maxCoordForSafeAreaProduct;
    let area = 0;
    let allSmall = true;
    let op2 = op;
    do {
      const prev = op2.prev;
      const pt = op2.pt;
      if (Math.abs(prev.pt.x) >= maxCoord || Math.abs(prev.pt.y) >= maxCoord || Math.abs(pt.x) >= maxCoord || Math.abs(pt.y) >= maxCoord) {
        allSmall = false;
        break;
      }
      area += (prev.pt.y + pt.y) * (prev.pt.x - pt.x);
      op2 = op2.next;
    } while (op2 !== op);
    if (allSmall) {
      return BigInt(Math.round(area));
    }
    let areaBig = B02;
    op2 = op;
    do {
      const prev = op2.prev;
      if (Number.isSafeInteger(prev.pt.y) && Number.isSafeInteger(op2.pt.y) && Number.isSafeInteger(prev.pt.x) && Number.isSafeInteger(op2.pt.x)) {
        const sumBig = BigInt(prev.pt.y) + BigInt(op2.pt.y);
        const diffBig = BigInt(prev.pt.x) - BigInt(op2.pt.x);
        areaBig += sumBig * diffBig;
      } else {
        const sum = prev.pt.y + op2.pt.y;
        const diff = prev.pt.x - op2.pt.x;
        areaBig += BigInt(Math.round(sum * diff));
      }
      op2 = op2.next;
    } while (op2 !== op);
    return areaBig;
  }
  areaTriangle(pt1, pt2, pt3) {
    const maxCoord = InternalClipper.maxCoordForSafeAreaProduct;
    if (Math.abs(pt1.x) < maxCoord && Math.abs(pt1.y) < maxCoord && Math.abs(pt2.x) < maxCoord && Math.abs(pt2.y) < maxCoord && Math.abs(pt3.x) < maxCoord && Math.abs(pt3.y) < maxCoord) {
      const area2 = (pt3.y + pt1.y) * (pt3.x - pt1.x) + (pt1.y + pt2.y) * (pt1.x - pt2.x) + (pt2.y + pt3.y) * (pt2.x - pt3.x);
      return BigInt(Math.round(area2));
    }
    if (Number.isSafeInteger(pt1.x) && Number.isSafeInteger(pt1.y) && Number.isSafeInteger(pt2.x) && Number.isSafeInteger(pt2.y) && Number.isSafeInteger(pt3.x) && Number.isSafeInteger(pt3.y)) {
      const term1 = (BigInt(pt3.y) + BigInt(pt1.y)) * (BigInt(pt3.x) - BigInt(pt1.x));
      const term2 = (BigInt(pt1.y) + BigInt(pt2.y)) * (BigInt(pt1.x) - BigInt(pt2.x));
      const term3 = (BigInt(pt2.y) + BigInt(pt3.y)) * (BigInt(pt2.x) - BigInt(pt3.x));
      return term1 + term2 + term3;
    }
    const area = (pt3.y + pt1.y) * (pt3.x - pt1.x) + (pt1.y + pt2.y) * (pt1.x - pt2.x) + (pt2.y + pt3.y) * (pt2.x - pt3.x);
    return BigInt(Math.round(area));
  }
  isValidOwner(outRec, testOwner) {
    while (testOwner !== null && testOwner !== outRec) {
      testOwner = testOwner.owner;
    }
    return testOwner === null;
  }
  containsRect(rect, rec) {
    return rec.left >= rect.left && rec.right <= rect.right && rec.top >= rect.top && rec.bottom <= rect.bottom;
  }
  checkSplitOwner(outrec, splits) {
    for (let i = 0;i < splits.length; i++) {
      let split = this.outrecList[splits[i]];
      if (split.pts === null && split.splits !== null && this.checkSplitOwner(outrec, split.splits))
        return true;
      split = this.getRealOutRec(split);
      if (split === null || split === outrec || split.recursiveSplit === outrec)
        continue;
      split.recursiveSplit = outrec;
      if (split.splits !== null && this.checkSplitOwner(outrec, split.splits))
        return true;
      if (!this.checkBounds(split) || !this.containsRect(split.bounds, outrec.bounds) || !this.path1InsidePath2(outrec.pts, split.pts))
        continue;
      if (!this.isValidOwner(outrec, split)) {
        split.owner = outrec.owner;
      }
      outrec.owner = split;
      return true;
    }
    return false;
  }
}

class Clipper64 extends ClipperBase {
  zCallback;
  getZCallback() {
    return this.zCallback;
  }
  addPath(path4, polytype, isOpen = false) {
    super.addPath(path4, polytype, isOpen);
  }
  addReuseableData(reuseableData) {
    super.addReuseableData(reuseableData);
  }
  addPaths(paths, polytype, isOpen = false) {
    super.addPaths(paths, polytype, isOpen);
  }
  addSubject(paths) {
    this.addPaths(paths, PathType.Subject);
  }
  addOpenSubject(paths) {
    this.addPaths(paths, PathType.Subject, true);
  }
  addClip(paths) {
    this.addPaths(paths, PathType.Clip);
  }
  execute(clipType, fillRule, solutionOrTree, openPathsOrSolutionOpen) {
    if (Array.isArray(solutionOrTree)) {
      const solutionClosed = solutionOrTree;
      const solutionOpen = openPathsOrSolutionOpen;
      solutionClosed.length = 0;
      if (solutionOpen)
        solutionOpen.length = 0;
      try {
        this.executeInternal(clipType, fillRule);
        this.buildPaths(solutionClosed, solutionOpen || []);
      } catch {
        this.succeeded = false;
      }
      this.clearSolutionOnly();
      return this.succeeded;
    } else {
      const polytree = solutionOrTree;
      const openPaths = openPathsOrSolutionOpen;
      polytree.clear();
      if (openPaths)
        openPaths.length = 0;
      this.usingPolytree = true;
      try {
        this.executeInternal(clipType, fillRule);
        this.buildTree(polytree, openPaths || []);
      } catch {
        this.succeeded = false;
      }
      this.clearSolutionOnly();
      return this.succeeded;
    }
  }
}

class ClipperD extends ClipperBase {
  zCallback;
  scale;
  invScale;
  constructor(roundingDecimalPrecision = 2) {
    super();
    InternalClipper.checkPrecision(roundingDecimalPrecision);
    this.scale = Math.pow(10, roundingDecimalPrecision);
    this.invScale = 1 / this.scale;
  }
  getZCallback() {
    return this.zCallback;
  }
  scalePathDFromInt(path4, scale) {
    const result = [];
    for (const pt of path4) {
      result.push({
        x: pt.x * scale,
        y: pt.y * scale,
        z: pt.z || 0
      });
    }
    return result;
  }
  buildPathsD(solutionClosed, solutionOpen) {
    solutionClosed.length = 0;
    solutionOpen.length = 0;
    let i = 0;
    while (i < this.outrecList.length) {
      const outrec = this.outrecList[i++];
      if (outrec.pts === null)
        continue;
      const path4 = [];
      if (outrec.isOpen) {
        if (ClipperBase.buildPath(outrec.pts, this.reverseSolution, true, path4)) {
          solutionOpen.push(this.scalePathDFromInt(path4, this.invScale));
        }
      } else {
        this.cleanCollinear(outrec);
        if (ClipperBase.buildPath(outrec.pts, this.reverseSolution, false, path4)) {
          solutionClosed.push(this.scalePathDFromInt(path4, this.invScale));
        }
      }
    }
    return true;
  }
  buildTreeD(polytree, solutionOpen) {
    polytree.clear();
    solutionOpen.length = 0;
    let i = 0;
    while (i < this.outrecList.length) {
      const outrec = this.outrecList[i++];
      if (outrec.pts === null)
        continue;
      if (outrec.isOpen) {
        const openPath = [];
        if (ClipperBase.buildPath(outrec.pts, this.reverseSolution, true, openPath)) {
          solutionOpen.push(this.scalePathDFromInt(openPath, this.invScale));
        }
        continue;
      }
      if (this.checkBounds(outrec)) {
        this.recursiveCheckOwners(outrec, polytree);
      }
    }
  }
  addPath(path4, polytype, isOpen = false) {
    const tmp = [path4];
    this.addPaths(tmp, polytype, isOpen);
  }
  addPaths(paths, polytype, isOpen = false) {
    super.addPaths(Clipper.scalePaths64(paths, this.scale), polytype, isOpen);
  }
  addSubject(path4) {
    this.addPath(path4, PathType.Subject);
  }
  addOpenSubject(path4) {
    this.addPath(path4, PathType.Subject, true);
  }
  addClip(path4) {
    this.addPath(path4, PathType.Clip);
  }
  addSubjectPaths(paths) {
    this.addPaths(paths, PathType.Subject);
  }
  addOpenSubjectPaths(paths) {
    this.addPaths(paths, PathType.Subject, true);
  }
  addClipPaths(paths) {
    this.addPaths(paths, PathType.Clip);
  }
  execute(clipType, fillRule, solutionOrTree, openPathsOrSolutionOpen) {
    if (Array.isArray(solutionOrTree)) {
      const solutionClosed = solutionOrTree;
      const solutionOpen = openPathsOrSolutionOpen;
      const solClosed64 = [];
      const solOpen64 = [];
      solutionClosed.length = 0;
      if (solutionOpen)
        solutionOpen.length = 0;
      let success = true;
      try {
        this.executeInternal(clipType, fillRule);
        this.buildPaths(solClosed64, solOpen64);
      } catch {
        success = false;
      }
      this.clearSolutionOnly();
      if (!success)
        return false;
      for (const path4 of solClosed64) {
        solutionClosed.push(this.scalePathDFromInt(path4, this.invScale));
      }
      if (solutionOpen) {
        for (const path4 of solOpen64) {
          solutionOpen.push(this.scalePathDFromInt(path4, this.invScale));
        }
      }
      return true;
    } else {
      const polytree = solutionOrTree;
      const openPaths = openPathsOrSolutionOpen;
      polytree.clear();
      if (openPaths)
        openPaths.length = 0;
      this.usingPolytree = true;
      polytree.scale = this.scale;
      let success = true;
      try {
        this.executeInternal(clipType, fillRule);
        this.buildTreeD(polytree, openPaths || []);
      } catch {
        success = false;
      }
      this.clearSolutionOnly();
      return success;
    }
  }
}
var Clipper = {
  area(path4) {
    return InternalClipper.area(path4);
  },
  areaD(path4) {
    let a = 0;
    const cnt = path4.length;
    if (cnt < 3)
      return 0;
    let prevPt = path4[cnt - 1];
    for (const pt of path4) {
      a += (prevPt.y + pt.y) * (prevPt.x - pt.x);
      prevPt = pt;
    }
    return a * 0.5;
  },
  scalePath64(path4, scale) {
    const maxAbs = InternalClipper.maxSafeCoordinateForScale(scale);
    const result = [];
    for (const pt of path4) {
      InternalClipper.checkSafeScaleValue(pt.x, maxAbs, "scalePath64");
      InternalClipper.checkSafeScaleValue(pt.y, maxAbs, "scalePath64");
      result.push({
        x: Math.round(pt.x * scale),
        y: Math.round(pt.y * scale)
      });
    }
    return result;
  },
  scalePaths64(paths, scale) {
    const result = [];
    for (const path4 of paths) {
      result.push(Clipper.scalePath64(path4, scale));
    }
    return result;
  },
  scalePathD(path4, scale) {
    const result = [];
    for (const pt of path4) {
      result.push({
        x: pt.x * scale,
        y: pt.y * scale
      });
    }
    return result;
  },
  scalePathsD(paths, scale) {
    const result = [];
    for (const path4 of paths) {
      result.push(Clipper.scalePathD(path4, scale));
    }
    return result;
  }
};

// ../../node_modules/.pnpm/clipper2-ts@2.0.1-15/node_modules/clipper2-ts/dist/Offset.js
var JoinType;
(function(JoinType2) {
  JoinType2[JoinType2["Miter"] = 0] = "Miter";
  JoinType2[JoinType2["Square"] = 1] = "Square";
  JoinType2[JoinType2["Bevel"] = 2] = "Bevel";
  JoinType2[JoinType2["Round"] = 3] = "Round";
})(JoinType || (JoinType = {}));
var EndType;
(function(EndType2) {
  EndType2[EndType2["Polygon"] = 0] = "Polygon";
  EndType2[EndType2["Joined"] = 1] = "Joined";
  EndType2[EndType2["Butt"] = 2] = "Butt";
  EndType2[EndType2["Square"] = 3] = "Square";
  EndType2[EndType2["Round"] = 4] = "Round";
})(EndType || (EndType = {}));

class Group {
  inPaths;
  joinType;
  endType;
  pathsReversed;
  lowestPathIdx;
  constructor(paths, joinType, endType = EndType.Polygon) {
    this.joinType = joinType;
    this.endType = endType;
    const isJoined = endType === EndType.Polygon || endType === EndType.Joined;
    this.inPaths = [];
    for (const path4 of paths) {
      this.inPaths.push(ClipperOffset.stripDuplicates(path4, isJoined));
    }
    if (endType === EndType.Polygon) {
      const lowestInfo = ClipperOffset.getLowestPathInfo(this.inPaths);
      this.lowestPathIdx = lowestInfo.idx;
      this.pathsReversed = this.lowestPathIdx >= 0 && lowestInfo.isNegArea;
    } else {
      this.lowestPathIdx = -1;
      this.pathsReversed = false;
    }
  }
}

class ClipperOffset {
  static Tolerance = 0.000000000001;
  static arc_const = 0.002;
  groupList = [];
  pathOut = [];
  normals = [];
  solution = [];
  solutionTree = null;
  groupDelta = 0;
  delta = 0;
  mitLimSqr = 0;
  stepsPerRad = 0;
  stepSin = 0;
  stepCos = 0;
  joinType = JoinType.Bevel;
  endType = EndType.Polygon;
  arcTolerance = 0;
  mergeGroups = true;
  miterLimit = 2;
  preserveCollinear = false;
  reverseSolution = false;
  zCallback;
  deltaCallback = null;
  constructor(miterLimit = 2, arcTolerance = 0, preserveCollinear = false, reverseSolution = false) {
    this.miterLimit = miterLimit;
    this.arcTolerance = arcTolerance;
    this.mergeGroups = true;
    this.preserveCollinear = preserveCollinear;
    this.reverseSolution = reverseSolution;
  }
  clear() {
    this.groupList.length = 0;
  }
  ZCB = (bot1, top1, bot2, top2, intersectPt) => {
    if ((bot1.z || 0) !== 0 && (bot1.z === bot2.z || bot1.z === top2.z)) {
      intersectPt.z = bot1.z;
    } else if ((bot2.z || 0) !== 0 && bot2.z === top1.z) {
      intersectPt.z = bot2.z;
    } else if ((top1.z || 0) !== 0 && top1.z === top2.z) {
      intersectPt.z = top1.z;
    } else if (this.zCallback) {
      this.zCallback(bot1, top1, bot2, top2, intersectPt);
    }
  };
  addPath(path4, joinType, endType) {
    if (path4.length === 0)
      return;
    const pp = [path4];
    this.addPaths(pp, joinType, endType);
  }
  addPaths(paths, joinType, endType) {
    if (paths.length === 0)
      return;
    this.groupList.push(new Group(paths, joinType, endType));
  }
  calcSolutionCapacity() {
    let result = 0;
    for (const g of this.groupList) {
      result += g.endType === EndType.Joined ? g.inPaths.length * 2 : g.inPaths.length;
    }
    return result;
  }
  checkPathsReversed() {
    let result = false;
    for (const g of this.groupList) {
      if (g.endType === EndType.Polygon) {
        result = g.pathsReversed;
        break;
      }
    }
    return result;
  }
  executeInternal(delta) {
    if (this.groupList.length === 0)
      return;
    if (Math.abs(delta) < 0.5) {
      for (const group of this.groupList) {
        for (const path4 of group.inPaths) {
          this.solution.push(path4);
        }
      }
      return;
    }
    this.delta = delta;
    this.mitLimSqr = this.miterLimit <= 1 ? 2 : 2 / ClipperOffset.sqr(this.miterLimit);
    for (const group of this.groupList) {
      this.doGroupOffset(group);
    }
    if (this.groupList.length === 0)
      return;
    const pathsReversed = this.checkPathsReversed();
    const fillRule = pathsReversed ? FillRule.Negative : FillRule.Positive;
    const c = new Clipper64;
    c.preserveCollinear = this.preserveCollinear;
    c.reverseSolution = this.reverseSolution !== pathsReversed;
    c.zCallback = this.ZCB;
    c.addSubject(this.solution);
    if (this.solutionTree !== null) {
      c.execute(ClipType.Union, fillRule, this.solutionTree);
    } else {
      c.execute(ClipType.Union, fillRule, this.solution);
    }
  }
  execute(delta, solutionOrTree) {
    if (Array.isArray(solutionOrTree)) {
      const solution = solutionOrTree;
      solution.length = 0;
      this.solution = solution;
      this.executeInternal(delta);
    } else {
      const solutionTree = solutionOrTree;
      solutionTree.clear();
      this.solutionTree = solutionTree;
      this.solution = [];
      this.executeInternal(delta);
    }
  }
  executeWithCallback(deltaCallback, solution) {
    this.deltaCallback = deltaCallback;
    this.execute(1, solution);
  }
  static getUnitNormal(pt1, pt2) {
    const dx = pt2.x - pt1.x;
    const dy = pt2.y - pt1.y;
    if (dx === 0 && dy === 0)
      return { x: 0, y: 0 };
    const f = 1 / Math.sqrt(dx * dx + dy * dy);
    return {
      x: dy * f,
      y: -dx * f
    };
  }
  static getLowestPathInfo(paths) {
    let idx = -1;
    let isNegArea = false;
    const botPt = { x: Number.MAX_SAFE_INTEGER, y: Number.MIN_SAFE_INTEGER };
    for (let i = 0;i < paths.length; ++i) {
      let a = Number.MAX_VALUE;
      for (const pt of paths[i]) {
        if (pt.y < botPt.y || pt.y === botPt.y && pt.x >= botPt.x)
          continue;
        if (a === Number.MAX_VALUE) {
          a = ClipperOffset.area(paths[i]);
          if (a === 0)
            break;
          isNegArea = a < 0;
        }
        idx = i;
        botPt.x = pt.x;
        botPt.y = pt.y;
      }
    }
    return { idx, isNegArea };
  }
  static translatePoint(pt, dx, dy) {
    return { x: pt.x + dx, y: pt.y + dy, z: pt.z };
  }
  static reflectPoint(pt, pivot) {
    return { x: pivot.x + (pivot.x - pt.x), y: pivot.y + (pivot.y - pt.y), z: pt.z };
  }
  static almostZero(value, epsilon = 0.001) {
    return Math.abs(value) < epsilon;
  }
  static hypotenuse(x, y) {
    return Math.sqrt(x * x + y * y);
  }
  static normalizeVector(vec) {
    const h = ClipperOffset.hypotenuse(vec.x, vec.y);
    if (ClipperOffset.almostZero(h))
      return { x: 0, y: 0 };
    const inverseHypot = 1 / h;
    return { x: vec.x * inverseHypot, y: vec.y * inverseHypot };
  }
  static getAvgUnitVector(vec1, vec2) {
    return ClipperOffset.normalizeVector({ x: vec1.x + vec2.x, y: vec1.y + vec2.y });
  }
  static intersectPoint(pt1a, pt1b, pt2a, pt2b) {
    if (InternalClipper.isAlmostZero(pt1a.x - pt1b.x)) {
      if (InternalClipper.isAlmostZero(pt2a.x - pt2b.x))
        return { x: 0, y: 0 };
      const m2 = (pt2b.y - pt2a.y) / (pt2b.x - pt2a.x);
      const b2 = pt2a.y - m2 * pt2a.x;
      return { x: pt1a.x, y: m2 * pt1a.x + b2 };
    }
    if (InternalClipper.isAlmostZero(pt2a.x - pt2b.x)) {
      const m1 = (pt1b.y - pt1a.y) / (pt1b.x - pt1a.x);
      const b1 = pt1a.y - m1 * pt1a.x;
      return { x: pt2a.x, y: m1 * pt2a.x + b1 };
    } else {
      const m1 = (pt1b.y - pt1a.y) / (pt1b.x - pt1a.x);
      const b1 = pt1a.y - m1 * pt1a.x;
      const m2 = (pt2b.y - pt2a.y) / (pt2b.x - pt2a.x);
      const b2 = pt2a.y - m2 * pt2a.x;
      if (InternalClipper.isAlmostZero(m1 - m2))
        return { x: 0, y: 0 };
      const x = (b2 - b1) / (m1 - m2);
      return { x, y: m1 * x + b1 };
    }
  }
  getPerpendic(pt, norm) {
    return {
      x: Math.round(pt.x + norm.x * this.groupDelta),
      y: Math.round(pt.y + norm.y * this.groupDelta),
      z: pt.z || 0
    };
  }
  getPerpendicD(pt, norm) {
    return {
      x: pt.x + norm.x * this.groupDelta,
      y: pt.y + norm.y * this.groupDelta,
      z: pt.z || 0
    };
  }
  doBevel(path4, j2, k) {
    let pt1, pt2;
    const pjz = path4[j2].z || 0;
    if (j2 === k) {
      const absDelta = Math.abs(this.groupDelta);
      pt1 = {
        x: Math.round(path4[j2].x - absDelta * this.normals[j2].x),
        y: Math.round(path4[j2].y - absDelta * this.normals[j2].y),
        z: pjz
      };
      pt2 = {
        x: Math.round(path4[j2].x + absDelta * this.normals[j2].x),
        y: Math.round(path4[j2].y + absDelta * this.normals[j2].y),
        z: pjz
      };
    } else {
      pt1 = {
        x: Math.round(path4[j2].x + this.groupDelta * this.normals[k].x),
        y: Math.round(path4[j2].y + this.groupDelta * this.normals[k].y),
        z: pjz
      };
      pt2 = {
        x: Math.round(path4[j2].x + this.groupDelta * this.normals[j2].x),
        y: Math.round(path4[j2].y + this.groupDelta * this.normals[j2].y),
        z: pjz
      };
    }
    this.pathOut.push(pt1);
    this.pathOut.push(pt2);
  }
  doSquare(path4, j2, k) {
    let vec;
    if (j2 === k) {
      vec = { x: this.normals[j2].y, y: -this.normals[j2].x };
    } else {
      vec = ClipperOffset.getAvgUnitVector({ x: -this.normals[k].y, y: this.normals[k].x }, { x: this.normals[j2].y, y: -this.normals[j2].x });
    }
    const absDelta = Math.abs(this.groupDelta);
    let ptQ = { x: path4[j2].x, y: path4[j2].y, z: path4[j2].z || 0 };
    ptQ = ClipperOffset.translatePoint(ptQ, absDelta * vec.x, absDelta * vec.y);
    const pt1 = ClipperOffset.translatePoint(ptQ, this.groupDelta * vec.y, this.groupDelta * -vec.x);
    const pt2 = ClipperOffset.translatePoint(ptQ, this.groupDelta * -vec.y, this.groupDelta * vec.x);
    const pt3 = this.getPerpendicD(path4[k], this.normals[k]);
    if (j2 === k) {
      const pt4 = {
        x: pt3.x + vec.x * this.groupDelta,
        y: pt3.y + vec.y * this.groupDelta
      };
      const pt = ClipperOffset.intersectPoint(pt1, pt2, pt3, pt4);
      pt.z = ptQ.z;
      this.pathOut.push(Point64Utils.fromPointD(ClipperOffset.reflectPoint(pt, ptQ)));
      this.pathOut.push(Point64Utils.fromPointD(pt));
    } else {
      const pt4 = this.getPerpendicD(path4[j2], this.normals[k]);
      const pt = ClipperOffset.intersectPoint(pt1, pt2, pt3, pt4);
      pt.z = ptQ.z;
      this.pathOut.push(Point64Utils.fromPointD(pt));
      this.pathOut.push(Point64Utils.fromPointD(ClipperOffset.reflectPoint(pt, ptQ)));
    }
  }
  doMiter(path4, j2, k, cosA) {
    const q = this.groupDelta / (cosA + 1);
    this.pathOut.push({
      x: Math.round(path4[j2].x + (this.normals[k].x + this.normals[j2].x) * q),
      y: Math.round(path4[j2].y + (this.normals[k].y + this.normals[j2].y) * q),
      z: path4[j2].z || 0
    });
  }
  doRound(path4, j2, k, angle) {
    if (this.deltaCallback !== null) {
      const absDelta = Math.abs(this.groupDelta);
      const arcTol = this.arcTolerance > 0.01 ? this.arcTolerance : absDelta * ClipperOffset.arc_const;
      const stepsPer360 = Math.PI / Math.acos(1 - arcTol / absDelta);
      this.stepSin = Math.sin(2 * Math.PI / stepsPer360);
      this.stepCos = Math.cos(2 * Math.PI / stepsPer360);
      if (this.groupDelta < 0)
        this.stepSin = -this.stepSin;
      this.stepsPerRad = stepsPer360 / (2 * Math.PI);
    }
    const pt = path4[j2];
    const ptz = pt.z || 0;
    let offsetVec = { x: this.normals[k].x * this.groupDelta, y: this.normals[k].y * this.groupDelta };
    if (j2 === k)
      PointDUtils.negate(offsetVec);
    this.pathOut.push({
      x: Math.round(pt.x + offsetVec.x),
      y: Math.round(pt.y + offsetVec.y),
      z: ptz
    });
    const steps = Math.ceil(this.stepsPerRad * Math.abs(angle));
    for (let i = 1;i < steps; i++) {
      offsetVec = {
        x: offsetVec.x * this.stepCos - this.stepSin * offsetVec.y,
        y: offsetVec.x * this.stepSin + offsetVec.y * this.stepCos
      };
      this.pathOut.push({
        x: Math.round(pt.x + offsetVec.x),
        y: Math.round(pt.y + offsetVec.y),
        z: ptz
      });
    }
    this.pathOut.push(this.getPerpendic(path4[j2], this.normals[j2]));
  }
  buildNormals(path4) {
    const cnt = path4.length;
    this.normals.length = 0;
    if (cnt === 0)
      return;
    for (let i = 0;i < cnt - 1; i++) {
      this.normals.push(ClipperOffset.getUnitNormal(path4[i], path4[i + 1]));
    }
    this.normals.push(ClipperOffset.getUnitNormal(path4[cnt - 1], path4[0]));
  }
  offsetPoint(group, path4, j2, k) {
    if (Point64Utils.equals(path4[j2], path4[k]))
      return;
    let sinA = InternalClipper.crossProductD(this.normals[j2], this.normals[k]);
    const cosA = InternalClipper.dotProductD(this.normals[j2], this.normals[k]);
    if (sinA > 1)
      sinA = 1;
    else if (sinA < -1)
      sinA = -1;
    if (this.deltaCallback !== null) {
      this.groupDelta = this.deltaCallback(path4, this.normals, j2, k);
      if (group.pathsReversed)
        this.groupDelta = -this.groupDelta;
    }
    if (Math.abs(this.groupDelta) < ClipperOffset.Tolerance) {
      this.pathOut.push(path4[j2]);
      return;
    }
    if (cosA > -0.999 && sinA * this.groupDelta < 0) {
      this.pathOut.push(this.getPerpendic(path4[j2], this.normals[k]));
      this.pathOut.push(path4[j2]);
      this.pathOut.push(this.getPerpendic(path4[j2], this.normals[j2]));
    } else if (cosA > 0.999 && this.joinType !== JoinType.Round) {
      this.doMiter(path4, j2, k, cosA);
    } else {
      switch (this.joinType) {
        case JoinType.Miter:
          if (cosA > this.mitLimSqr - 1) {
            this.doMiter(path4, j2, k, cosA);
          } else {
            this.doSquare(path4, j2, k);
          }
          break;
        case JoinType.Round:
          this.doRound(path4, j2, k, Math.atan2(sinA, cosA));
          break;
        case JoinType.Bevel:
          this.doBevel(path4, j2, k);
          break;
        default:
          this.doSquare(path4, j2, k);
          break;
      }
    }
  }
  offsetPolygon(group, path4) {
    this.pathOut = [];
    const cnt = path4.length;
    let prev = cnt - 1;
    for (let i = 0;i < cnt; i++) {
      this.offsetPoint(group, path4, i, prev);
      prev = i;
    }
    this.solution.push(this.pathOut);
  }
  offsetOpenJoined(group, path4) {
    this.offsetPolygon(group, path4);
    const reversePath = [...path4].reverse();
    this.buildNormals(reversePath);
    this.offsetPolygon(group, reversePath);
  }
  offsetOpenPath(group, path4) {
    this.pathOut = [];
    const highI = path4.length - 1;
    if (this.deltaCallback !== null) {
      this.groupDelta = this.deltaCallback(path4, this.normals, 0, 0);
    }
    if (Math.abs(this.groupDelta) < ClipperOffset.Tolerance) {
      this.pathOut.push(path4[0]);
    } else {
      switch (this.endType) {
        case EndType.Butt:
          this.doBevel(path4, 0, 0);
          break;
        case EndType.Round:
          this.doRound(path4, 0, 0, Math.PI);
          break;
        default:
          this.doSquare(path4, 0, 0);
          break;
      }
    }
    for (let i = 1, k = 0;i < highI; i++) {
      this.offsetPoint(group, path4, i, k);
      k = i;
    }
    for (let i = highI;i > 0; i--) {
      this.normals[i] = { x: -this.normals[i - 1].x, y: -this.normals[i - 1].y };
    }
    this.normals[0] = this.normals[highI];
    if (this.deltaCallback !== null) {
      this.groupDelta = this.deltaCallback(path4, this.normals, highI, highI);
    }
    if (Math.abs(this.groupDelta) < ClipperOffset.Tolerance) {
      this.pathOut.push(path4[highI]);
    } else {
      switch (this.endType) {
        case EndType.Butt:
          this.doBevel(path4, highI, highI);
          break;
        case EndType.Round:
          this.doRound(path4, highI, highI, Math.PI);
          break;
        default:
          this.doSquare(path4, highI, highI);
          break;
      }
    }
    for (let i = highI - 1, k = highI;i > 0; i--) {
      this.offsetPoint(group, path4, i, k);
      k = i;
    }
    this.solution.push(this.pathOut);
  }
  doGroupOffset(group) {
    if (group.endType === EndType.Polygon) {
      if (group.lowestPathIdx < 0)
        this.delta = Math.abs(this.delta);
      this.groupDelta = group.pathsReversed ? -this.delta : this.delta;
    } else {
      this.groupDelta = Math.abs(this.delta);
    }
    const absDelta = Math.abs(this.groupDelta);
    this.joinType = group.joinType;
    this.endType = group.endType;
    if (group.joinType === JoinType.Round || group.endType === EndType.Round) {
      const arcTol = this.arcTolerance > 0.01 ? this.arcTolerance : absDelta * ClipperOffset.arc_const;
      const stepsPer360 = Math.PI / Math.acos(1 - arcTol / absDelta);
      this.stepSin = Math.sin(2 * Math.PI / stepsPer360);
      this.stepCos = Math.cos(2 * Math.PI / stepsPer360);
      if (this.groupDelta < 0)
        this.stepSin = -this.stepSin;
      this.stepsPerRad = stepsPer360 / (2 * Math.PI);
    }
    for (const pathIn of group.inPaths) {
      this.pathOut = [];
      const cnt = pathIn.length;
      if (cnt === 1) {
        const pt = pathIn[0];
        if (this.deltaCallback !== null) {
          this.groupDelta = this.deltaCallback(pathIn, this.normals, 0, 0);
          if (group.pathsReversed)
            this.groupDelta = -this.groupDelta;
        }
        const ptz = pt.z || 0;
        if (group.endType === EndType.Round) {
          const steps = Math.ceil(this.stepsPerRad * 2 * Math.PI);
          this.pathOut = ClipperOffset.ellipse(pt, Math.abs(this.groupDelta), Math.abs(this.groupDelta), steps);
          if (ptz !== 0)
            for (let i = 0;i < this.pathOut.length; i++)
              this.pathOut[i].z = ptz;
        } else {
          const d = Math.ceil(Math.abs(this.groupDelta));
          const r = { left: pt.x - d, top: pt.y - d, right: pt.x + d, bottom: pt.y + d };
          this.pathOut = [
            { x: r.left, y: r.top, z: ptz },
            { x: r.right, y: r.top, z: ptz },
            { x: r.right, y: r.bottom, z: ptz },
            { x: r.left, y: r.bottom, z: ptz }
          ];
        }
        this.solution.push(this.pathOut);
        continue;
      }
      if (cnt === 2 && group.endType === EndType.Joined) {
        this.endType = group.joinType === JoinType.Round ? EndType.Round : EndType.Square;
      }
      this.buildNormals(pathIn);
      switch (this.endType) {
        case EndType.Polygon:
          this.offsetPolygon(group, pathIn);
          break;
        case EndType.Joined:
          this.offsetOpenJoined(group, pathIn);
          break;
        default:
          this.offsetOpenPath(group, pathIn);
          break;
      }
    }
  }
  static stripDuplicates(path4, isClosedPath) {
    const cnt = path4.length;
    const result = [];
    if (cnt === 0)
      return result;
    let lastPt = path4[0];
    result.push(lastPt);
    for (let i = 1;i < cnt; i++) {
      if (!Point64Utils.equals(lastPt, path4[i])) {
        lastPt = path4[i];
        result.push(lastPt);
      }
    }
    if (isClosedPath && Point64Utils.equals(lastPt, result[0])) {
      result.pop();
    }
    return result;
  }
  static area(path4) {
    return InternalClipper.area(path4);
  }
  static sqr(val) {
    return val * val;
  }
  static ellipse(center, radiusX, radiusY = 0, steps = 0) {
    if (radiusX <= 0)
      return [];
    if (radiusY <= 0)
      radiusY = radiusX;
    if (steps <= 2) {
      steps = Math.ceil(Math.PI * Math.sqrt((radiusX + radiusY) / 2));
    }
    const si = Math.sin(2 * Math.PI / steps);
    const co = Math.cos(2 * Math.PI / steps);
    let dx = co;
    let dy = si;
    const result = [{ x: Math.round(center.x + radiusX), y: center.y }];
    for (let i = 1;i < steps; ++i) {
      result.push({
        x: Math.round(center.x + radiusX * dx),
        y: Math.round(center.y + radiusY * dy)
      });
      const x = dx * co - dy * si;
      dy = dy * co + dx * si;
      dx = x;
    }
    return result;
  }
}
// ../../node_modules/.pnpm/clipper2-ts@2.0.1-15/node_modules/clipper2-ts/dist/Clipper.js
var B23 = BigInt(2);
function intersectD(subject, clip, fillRule, precision = 2) {
  return booleanOpD(ClipType.Intersection, subject, clip, fillRule, precision);
}
function unionD(subject, clipOrFillRule, fillRuleOrPrecision, precision) {
  if (typeof clipOrFillRule === "number") {
    return booleanOpD(ClipType.Union, subject, null, clipOrFillRule);
  } else {
    return booleanOpD(ClipType.Union, subject, clipOrFillRule, fillRuleOrPrecision, precision || 2);
  }
}
function booleanOpD(clipType, subject, clip, fillRule, precision = 2) {
  const solution = [];
  const c = new ClipperD(precision);
  c.addSubjectPaths(subject);
  if (clip !== null) {
    c.addClipPaths(clip);
  }
  c.execute(clipType, fillRule, solution);
  return solution;
}
function inflatePathsD(paths, delta, joinType, endType, miterLimit = 2, precision = 2, arcTolerance = 0) {
  InternalClipper.checkPrecision(precision);
  const scale = Math.pow(10, precision);
  const tmp = scalePaths64(paths, scale);
  const co = new ClipperOffset(miterLimit, scale * arcTolerance);
  co.addPaths(tmp, joinType, endType);
  const solution = [];
  co.execute(delta * scale, solution);
  return scalePathsD(solution, 1 / scale);
}
function areaD(path4) {
  let a = 0;
  const cnt = path4.length;
  if (cnt < 3)
    return 0;
  let prevPt = path4[cnt - 1];
  for (const pt of path4) {
    a += (prevPt.y + pt.y) * (prevPt.x - pt.x);
    prevPt = pt;
  }
  return a * 0.5;
}
function areaPathsD(paths) {
  let a = 0;
  for (const path4 of paths) {
    a += areaD(path4);
  }
  return a;
}
function scalePathD(path4, scale) {
  if (InternalClipper.isAlmostZero(scale - 1))
    return path4;
  const result = [];
  for (const pt of path4) {
    result.push(PointDUtils.scale(pt, scale));
  }
  return result;
}
function scalePathsD(paths, scale) {
  if (InternalClipper.isAlmostZero(scale - 1))
    return paths;
  const result = [];
  for (const path4 of paths) {
    result.push(scalePathD(path4, scale));
  }
  return result;
}
function scalePath64(path4, scale) {
  const maxAbs = InternalClipper.maxSafeCoordinateForScale(scale);
  const result = [];
  for (const pt of path4) {
    InternalClipper.checkSafeScaleValue(pt.x, maxAbs, "scalePath64");
    InternalClipper.checkSafeScaleValue(pt.y, maxAbs, "scalePath64");
    result.push({
      x: Math.round(pt.x * scale),
      y: Math.round(pt.y * scale)
    });
  }
  return result;
}
function scalePaths64(paths, scale) {
  const result = [];
  for (const path4 of paths) {
    result.push(scalePath64(path4, scale));
  }
  return result;
}
function getBoundsPathsD(paths) {
  const result = RectDUtils.createInvalid();
  for (const path4 of paths) {
    for (const pt of path4) {
      if (pt.x < result.left)
        result.left = pt.x;
      if (pt.x > result.right)
        result.right = pt.x;
      if (pt.y < result.top)
        result.top = pt.y;
      if (pt.y > result.bottom)
        result.bottom = pt.y;
    }
  }
  return Math.abs(result.left - Number.MAX_VALUE) < InternalClipper.floatingPointTolerance ? { left: 0, top: 0, right: 0, bottom: 0 } : result;
}
// ../../lib/runtime-core/cascade-tiers/medial-axis-thickening.ts
var SKELETON_ALIGN_IOU_THRESHOLD = 0.5;
var PRECISION = 4;
function pathToPathsD(d) {
  const tokens = d.match(/[a-zA-Z]|-?\d*\.?\d+(?:[eE][+-]?\d+)?/g) ?? [];
  const paths = [];
  let current = [];
  let cursor = 0;
  while (cursor < tokens.length) {
    const cmd = tokens[cursor++];
    if (!/^[a-zA-Z]$/.test(cmd))
      continue;
    const upper = cmd.toUpperCase();
    if (upper === "M") {
      if (current.length > 0)
        paths.push(current);
      current = [];
      while (cursor + 1 < tokens.length && isNum(tokens[cursor]) && isNum(tokens[cursor + 1])) {
        current.push({ x: +tokens[cursor], y: +tokens[cursor + 1] });
        cursor += 2;
      }
    } else if (upper === "L") {
      while (cursor + 1 < tokens.length && isNum(tokens[cursor]) && isNum(tokens[cursor + 1])) {
        current.push({ x: +tokens[cursor], y: +tokens[cursor + 1] });
        cursor += 2;
      }
    } else if (upper === "C") {
      while (cursor + 5 < tokens.length && [0, 1, 2, 3, 4, 5].every((k) => isNum(tokens[cursor + k]))) {
        current.push({ x: +tokens[cursor + 4], y: +tokens[cursor + 5] });
        cursor += 6;
      }
    } else if (upper === "Q") {
      while (cursor + 3 < tokens.length && [0, 1, 2, 3].every((k) => isNum(tokens[cursor + k]))) {
        current.push({ x: +tokens[cursor + 2], y: +tokens[cursor + 3] });
        cursor += 4;
      }
    } else if (upper === "A") {
      while (cursor + 6 < tokens.length && [0, 1, 2, 3, 4, 5, 6].every((k) => isNum(tokens[cursor + k]))) {
        current.push({ x: +tokens[cursor + 5], y: +tokens[cursor + 6] });
        cursor += 7;
      }
    }
  }
  if (current.length > 0)
    paths.push(current);
  return paths;
}
function pathsDToD(paths) {
  if (paths.length === 0)
    return "";
  const parts = [];
  for (const path4 of paths) {
    if (path4.length === 0)
      continue;
    for (let i = 0;i < path4.length; i++) {
      const p = path4[i];
      parts.push(`${i === 0 ? "M" : "L"}${fmt2(p.x)} ${fmt2(p.y)}`);
    }
    parts.push("Z");
  }
  return parts.join(" ");
}
function isNum(token) {
  return token !== undefined && /^-?\d*\.?\d+(?:[eE][+-]?\d+)?$/.test(token);
}
function fmt2(n) {
  if (Number.isInteger(n))
    return String(n);
  const fixed = n.toFixed(3);
  return fixed.replace(/\.?0+$/, "") || "0";
}
function skeletonsAlign(fromCanonical, toCanonical) {
  if (!fromCanonical || !toCanonical)
    return false;
  const srcPaths = pathToPathsD(fromCanonical.d);
  const tgtPaths = pathToPathsD(toCanonical.d);
  if (srcPaths.length === 0 || tgtPaths.length === 0)
    return false;
  const srcBounds = getBoundsPathsD(srcPaths);
  const tgtBounds = getBoundsPathsD(tgtPaths);
  const minX = Math.min(srcBounds.left, tgtBounds.left);
  const minY = Math.min(srcBounds.top, tgtBounds.top);
  const maxX = Math.max(srcBounds.right, tgtBounds.right);
  const maxY = Math.max(srcBounds.bottom, tgtBounds.bottom);
  const diag = Math.hypot(maxX - minX, maxY - minY);
  if (!Number.isFinite(diag) || diag <= 0)
    return false;
  const delta = diag * 0.05;
  const srcInflated = inflatePathsD(srcPaths, delta, JoinType.Round, EndType.Polygon, 2, PRECISION);
  const tgtInflated = inflatePathsD(tgtPaths, delta, JoinType.Round, EndType.Polygon, 2, PRECISION);
  if (srcInflated.length === 0 || tgtInflated.length === 0)
    return false;
  const intersection = intersectD(srcInflated, tgtInflated, FillRule.NonZero, PRECISION);
  const union2 = unionD(srcInflated, tgtInflated, FillRule.NonZero, PRECISION);
  const intersectionArea = Math.abs(areaPathsD(intersection));
  const unionArea = Math.abs(areaPathsD(union2));
  if (unionArea <= 0)
    return false;
  return intersectionArea / unionArea >= SKELETON_ALIGN_IOU_THRESHOLD;
}
function thickenedInterpolator(fromCanonical, toCanonical) {
  if (!fromCanonical || !toCanonical)
    return null;
  const fromD = fromCanonical.d;
  const toD = toCanonical.d;
  const srcPaths = pathToPathsD(fromD);
  const tgtPaths = pathToPathsD(toD);
  if (srcPaths.length === 0 || tgtPaths.length === 0)
    return null;
  const srcBounds = getBoundsPathsD(srcPaths);
  const tgtBounds = getBoundsPathsD(tgtPaths);
  const minX = Math.min(srcBounds.left, tgtBounds.left);
  const minY = Math.min(srcBounds.top, tgtBounds.top);
  const maxX = Math.max(srcBounds.right, tgtBounds.right);
  const maxY = Math.max(srcBounds.bottom, tgtBounds.bottom);
  const deltaMax = Math.hypot(maxX - minX, maxY - minY) * 0.05;
  if (!Number.isFinite(deltaMax) || deltaMax <= 0)
    return null;
  return (t) => {
    if (t <= 0)
      return fromD;
    if (t >= 1)
      return toD;
    if (t < 0.5) {
      const delta = 2 * t * deltaMax;
      const offset = inflatePathsD(srcPaths, delta, JoinType.Round, EndType.Polygon, 2, PRECISION);
      return offset.length > 0 ? pathsDToD(offset) : fromD;
    } else {
      const delta = 2 * (1 - t) * deltaMax;
      const offset = inflatePathsD(tgtPaths, delta, JoinType.Round, EndType.Polygon, 2, PRECISION);
      return offset.length > 0 ? pathsDToD(offset) : toD;
    }
  };
}

// ../../lib/runtime-core/cascade-tiers/draw-coordinated.ts
function resolveDrawCoordinated(input) {
  if (input.taxonomy !== "T7")
    return null;
  const fromCanonical = input.fromTopology.canonical;
  const toCanonical = input.toTopology.canonical;
  const fromD = fromCanonical?.d ?? "";
  const toD = toCanonical?.d ?? "";
  if (!fromD || !toD)
    return null;
  if (skeletonsAlign(fromCanonical, toCanonical)) {
    const grow = thickenedInterpolator(fromCanonical, toCanonical);
    if (grow) {
      return {
        interpolator: grow,
        motion: input.motion,
        distortion: 0.3,
        signal: null
      };
    }
  }
  return {
    interpolator: (t) => t < 0.5 ? fromD : toD,
    motion: input.motion,
    distortion: 0.5,
    signal: null
  };
}

// ../../lib/runtime-core/cascade-fallbacks.ts
var easeOutCubic2 = getEasingFunction("ease-out-cubic");
var easeInOutCubic = getEasingFunction("ease-in-out");
var easeIn = getEasingFunction("ease-in");
var easeOut = getEasingFunction("ease-out");
var FALLBACK_MOTION = {
  "radial-pop": {
    g: easeInOutCubic,
    alpha: easeOutCubic2,
    alphaOffsetRatio: 0
  },
  "scale-pop": {
    g: easeInOutCubic,
    alpha: easeOutCubic2,
    alphaOffsetRatio: 0
  },
  "draw-replace": {
    g: easeInOutCubic,
    alpha: easeOut,
    alphaOffsetRatio: 0
  },
  "directional-replace-up": directional(),
  "directional-replace-down": directional(),
  "directional-replace-left": directional(),
  "directional-replace-right": directional(),
  "directional-replace-toward": directional(),
  "directional-replace-away": directional()
};
function directional() {
  return {
    g: easeInOutCubic,
    alpha: easeIn,
    alphaOffsetRatio: 0.04
  };
}
function fallbackMotion(name) {
  return FALLBACK_MOTION[name] ?? null;
}
function drawReplaceInterpolator(input) {
  const fromD = input.fromTopology.canonical?.d ?? "";
  const toD = input.toTopology.canonical?.d ?? "";
  return (t) => {
    if (t < 0.5)
      return fromD;
    return toD;
  };
}
function radialPopInterpolator(input) {
  return drawReplaceInterpolator(input);
}
function scalePopInterpolator(input) {
  return drawReplaceInterpolator(input);
}
function directionalReplaceInterpolator(input, _name) {
  return drawReplaceInterpolator(input);
}

// ../../lib/runtime-core/cascade-tiers/designed-fallback.ts
function resolveDesignedFallback(input) {
  const fallbackName = pickFallback(input);
  const motion = fallbackMotion(fallbackName) ?? input.motion;
  const interpolator = buildInterpolator(fallbackName, input);
  return {
    interpolator,
    motion,
    distortion: 0,
    signal: {
      kind: "distortion-floor-exceeded",
      tier: "designed-fallback",
      estimate: Number.POSITIVE_INFINITY,
      ceiling: 0,
      fallbackName
    }
  };
}
function pickFallback(input) {
  const fromIsStroke = input.fromTopology.isStrokeOnly || input.fromTopology.openSubpathCount > 0;
  const toIsStroke = input.toTopology.isStrokeOnly || input.toTopology.openSubpathCount > 0;
  if (fromIsStroke || toIsStroke)
    return "draw-replace";
  return "radial-pop";
}
function buildInterpolator(fallbackName, input) {
  switch (fallbackName) {
    case "draw-replace":
      return drawReplaceInterpolator(input);
    case "radial-pop":
      return radialPopInterpolator(input);
    case "scale-pop":
      return scalePopInterpolator(input);
    case "directional-replace-up":
    case "directional-replace-down":
    case "directional-replace-left":
    case "directional-replace-right":
    case "directional-replace-toward":
    case "directional-replace-away":
      return directionalReplaceInterpolator(input, fallbackName);
  }
}

// ../../lib/runtime-core/transition-telemetry.ts
var NOOP_EMITTER = () => {};
var active = NOOP_EMITTER;
function emitResolutionEvent(resolution, meta) {
  active({
    recordedAt: new Date().toISOString(),
    tier: resolution.tier,
    taxonomy: resolution.taxonomy,
    distortion: resolution.distortion,
    signalKind: resolution.signal?.kind ?? null,
    durationMs: meta.durationMs,
    iconSetVersion: meta.iconSetVersion ?? null
  });
}

// ../../lib/runtime-core/cascade.ts
var TIERS = [
  { name: "identity", ceiling: 0, resolve: resolveIdentity },
  { name: "compound-isomorphic", ceiling: 0, resolve: resolveCompoundIsomorphic },
  { name: "intrinsic-strict", ceiling: 0.2, resolve: resolveIntrinsicStrict },
  { name: "hierarchical-match", ceiling: 0.5, resolve: resolveHierarchicalMatch },
  { name: "arap-quality-wrap", ceiling: 0.55, resolve: resolveArapQualityWrap },
  { name: "draw-coordinated", ceiling: 0.6, resolve: resolveDrawCoordinated },
  { name: "designed-fallback", ceiling: Number.POSITIVE_INFINITY, resolve: resolveDesignedFallback }
];
var EMPTY_HINTS = { subpath: [], vertex: [] };
function resolveMorph(from, to, opts = {}) {
  const cadence = opts.cadence ?? "soft";
  if (opts.cache && (!opts.hints || isEmptyHints(opts.hints))) {
    const hit = opts.cache.get(from, to, cadence);
    if (hit)
      return hit;
  }
  const fromTopology = describeLayer(from);
  const toTopology = describeLayer(to);
  const taxonomy = classifyTopologyPair(fromTopology, toTopology);
  const motion = defaultMotionCurves(cadence);
  const hints = opts.hints ?? EMPTY_HINTS;
  const input = {
    from,
    to,
    fromTopology,
    toTopology,
    taxonomy,
    cadence,
    motion,
    hints
  };
  for (const tier of TIERS) {
    const result = tier.resolve(input);
    if (result === null)
      continue;
    if (!Number.isFinite(result.distortion) && tier.name !== "designed-fallback") {
      continue;
    }
    if (result.distortion > tier.ceiling)
      continue;
    const resolution = {
      interpolator: result.interpolator,
      motion: result.motion,
      taxonomy,
      tier: tier.name,
      distortion: result.distortion,
      signal: result.signal
    };
    if (opts.cache && isEmptyHints(hints)) {
      opts.cache.set(from, to, cadence, resolution);
    }
    if (opts.telemetry) {
      emitResolutionEvent(resolution, opts.telemetry);
    }
    return resolution;
  }
  throw new Error("resolveMorph: cascade fell off the end. The designed-fallback " + "tier should always accept. Bug.");
}
function isEmptyHints(hints) {
  return hints.subpath.length === 0 && hints.vertex.length === 0;
}

// ../../lib/runtime-core/cascade-scheduler.ts
function sampleMorph(resolution, t) {
  const tt = clamp013(t);
  const geometryT = geometryProgress(resolution.motion, tt);
  const d = resolution.interpolator(geometryT);
  const alpha = computeAlpha(resolution, tt);
  return { d, alpha };
}
function computeAlpha(resolution, t) {
  if (resolution.tier === "designed-fallback") {
    return computeFallbackAlpha(resolution, t);
  }
  if (resolution.tier === "draw-coordinated") {
    return computeFallbackAlpha(resolution, t);
  }
  return 1;
}
function computeFallbackAlpha(resolution, t) {
  const offset = resolution.motion.alphaOffsetRatio;
  if (t < 0.5) {
    const local2 = t * 2;
    return 1 - resolution.motion.alpha(clamp013(local2));
  }
  const local = (t - 0.5) * 2;
  if (local < offset)
    return 0;
  const denom = 1 - offset;
  if (denom <= 0)
    return resolution.motion.alpha(clamp013(local));
  return resolution.motion.alpha(clamp013((local - offset) / denom));
}
function clamp013(value) {
  if (!Number.isFinite(value))
    return 0;
  if (value <= 0)
    return 0;
  if (value >= 1)
    return 1;
  return value;
}

// ../../lib/runtime-core/cascade-export.ts
function sampleForExport(resolution, options) {
  const frameCount = computeFrameCount(options);
  if (frameCount < 2) {
    throw new Error(`sampleForExport requires frameCount >= 2 (got ${frameCount}; ` + `fps=${options.fps ?? 30}, durationMs=${options.durationMs})`);
  }
  const out = [];
  for (let i = 0;i < frameCount; i++) {
    const t = i / (frameCount - 1);
    const frame = sampleMorph(resolution, t);
    out.push({ t, d: frame.d, alpha: frame.alpha });
  }
  return out;
}
function sampleForCompiledIcon(resolution, durationMs) {
  return sampleForExport(resolution, { frameCount: 16, durationMs });
}
function computeFrameCount(options) {
  if (options.frameCount !== undefined) {
    return Math.max(2, Math.floor(options.frameCount));
  }
  const fps = options.fps ?? 30;
  if (!Number.isFinite(fps) || fps <= 0)
    return 2;
  if (!Number.isFinite(options.durationMs) || options.durationMs <= 0)
    return 2;
  return Math.max(2, Math.ceil(options.durationMs / 1000 * fps) + 1);
}

// ../../lib/runtime-core/resolver-flag.ts
function isResolverV2Enabled() {
  return process.env.NEXT_PUBLIC_HIERO_RESOLVER_V2 === "1";
}

// ../../lib/export/export-compiled-icon.ts
function exportCompiledIcon(project, iconId) {
  const icon = project.icons[iconId];
  if (!icon) {
    throw new Error(`Icon "${iconId}" not found.`);
  }
  const compiledWithoutHash = {
    $schema: COMPILED_ICON_SCHEMA_URI,
    id: icon.id,
    name: icon.name,
    componentName: toComponentName(icon.id),
    meta: {
      category: icon.category ?? "uncategorized",
      tags: [...icon.tags ?? []].sort((a, b) => a.localeCompare(b)),
      updatedAt: project.meta.updatedAt,
      version: project.version,
      contentHash: ""
    },
    variants: buildCompiledVariants(project, icon),
    transitions: buildCompiledTransitions(icon),
    effects: buildCompiledEffects(icon)
  };
  const contentHash = computeContentHash(compiledWithoutHash);
  const compiled = {
    ...compiledWithoutHash,
    meta: {
      ...compiledWithoutHash.meta,
      contentHash
    }
  };
  validateCompiledIconOrThrow(compiled);
  return compiled;
}
function exportCompiledIconFile(project, iconId) {
  const compiled = exportCompiledIcon(project, iconId);
  return {
    path: `${compiled.id}.compiled.json`,
    contents: serializeCompiledJson(compiled),
    compiled
  };
}
function validateCompiledIconOrThrow(value) {
  if (!isCompiledIcon(value)) {
    throw new Error("Malformed CompiledIcon payload.");
  }
}
function serializeCompiledJson(value) {
  return `${JSON.stringify(sortJsonValue2(value), null, 2)}
`;
}
function buildCompiledVariants(project, icon) {
  return Object.keys(icon.variants).sort((a, b) => a.localeCompare(b)).reduce((acc, variantId) => {
    const variant = icon.variants[variantId];
    const modeLayers = buildResolvedLayers(project, variant.layers);
    acc[variantId] = {
      size: variant.size,
      viewBox: [...variant.viewBox],
      layers: { layers: modeLayers.monochrome }
    };
    return acc;
  }, {});
}
function buildResolvedLayers(project, layers) {
  const ordered = Object.keys(layers).sort((a, b) => a.localeCompare(b)).map((layerId) => layers[layerId]).filter((layer) => layer.visible !== false && !layer.isClipMask && Boolean(layer.path?.d));
  return {
    monochrome: ordered.map((layer) => toCompiledLayer(layer, project, "monochrome")),
    hierarchical: ordered.map((layer) => toCompiledLayer(layer, project, "hierarchical")),
    palette: ordered.map((layer) => toCompiledLayer(layer, project, "palette")),
    multicolor: ordered.map((layer) => toCompiledLayer(layer, project, "multicolor"))
  };
}
function toCompiledLayer(layer, project, _mode) {
  const compiled = {
    id: layer.id,
    role: layer.role ?? "primary",
    path: {
      d: layer.path.d,
      fillRule: layer.path?.fillRule
    },
    style: {
      fill: resolveCompiledPaint(layer.style.fill, project),
      fillOpacity: layer.style.fillOpacity ?? 1,
      stroke: resolveCompiledPaint(layer.style.stroke, project),
      strokeOpacity: layer.style.strokeOpacity ?? 1,
      strokeWidth: layer.style.strokeWidth ?? 0,
      lineCap: layer.style.lineCap,
      lineJoin: layer.style.lineJoin
    }
  };
  const transform = toCompiledTransform(layer);
  if (transform) {
    compiled.transform = transform;
  }
  return compiled;
}
function resolveCompiledPaint(paint, project) {
  if (!paint)
    return "none";
  switch (paint.mode) {
    case "currentColor":
      return "currentColor";
    case "fixed":
      return paint.value;
    case "token":
      return project.tokenSet?.colors?.[paint.token] ?? "currentColor";
    case "linearGradient":
    case "radialGradient":
      return "currentColor";
    default:
      return "none";
  }
}
function toCompiledTransform(layer) {
  if (!layer.transform)
    return;
  const x = layer.transform.x ?? 0;
  const y = layer.transform.y ?? 0;
  const rotate = layer.transform.rotate ?? 0;
  const scaleX = layer.transform.scaleX ?? 1;
  const scaleY = layer.transform.scaleY ?? 1;
  if (x === 0 && y === 0 && rotate === 0 && scaleX === 1 && scaleY === 1) {
    return;
  }
  return { x, y, rotate, scaleX, scaleY };
}
function buildCompiledEffects(icon) {
  if (!icon.effects)
    return [];
  return Object.keys(icon.effects).sort((a, b) => a.localeCompare(b)).map((effectId) => toCompiledEffect(icon.effects[effectId])).filter((effect) => effect !== null);
}
function toCompiledEffect(effect) {
  if (effect.kind === "appear" || effect.kind === "disappear") {
    return null;
  }
  const compiled = {
    kind: effect.kind,
    durationMs: effect.durationMs,
    easing: effect.easing ?? "linear"
  };
  if (effect.kind === "draw" && effect.drawConfig) {
    compiled.params = {
      mode: effect.drawConfig.mode,
      ...effect.drawConfig.windowSize !== undefined && { windowSize: effect.drawConfig.windowSize },
      ...effect.drawConfig.initialOffset !== undefined && { initialOffset: effect.drawConfig.initialOffset },
      ...effect.drawConfig.compoundTrimMode !== undefined && { compoundTrimMode: effect.drawConfig.compoundTrimMode }
    };
  }
  return compiled;
}
function computeContentHash(compiled) {
  const canonical = serializeCompiledJson({
    ...compiled,
    meta: {
      ...compiled.meta,
      contentHash: ""
    }
  });
  return createHash("sha256").update(canonical).digest("hex");
}
function toComponentName(iconId) {
  const words = iconId.split(/[^a-zA-Z0-9]+/).filter(Boolean).map((part) => part[0].toUpperCase() + part.slice(1));
  const normalized = words.join("");
  if (!normalized)
    return "IcIcon";
  if (normalized.startsWith("Ic"))
    return normalized;
  return `Ic${normalized}`;
}
function sortJsonValue2(value) {
  if (Array.isArray(value)) {
    return value.map(sortJsonValue2);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined).sort(([left], [right]) => left.localeCompare(right)).map(([key, entry]) => [key, sortJsonValue2(entry)]));
  }
  return value;
}
function buildCompiledTransitions(icon) {
  const transitions = icon.transitions;
  if (!transitions)
    return [];
  const v2 = isResolverV2Enabled();
  if (!v2)
    return [];
  const out = [];
  for (const transition of Object.values(transitions)) {
    if (transition.fromIconId && transition.fromIconId !== icon.id) {
      console.warn(`[export-compiled-icon] skipping cross-icon transition ${transition.id} ` + `for icon "${icon.id}" (fromIconId="${transition.fromIconId}"): ` + `cross-icon emission lands at the package layer, not per-icon JSON.`);
      continue;
    }
    if (transition.toIconId && transition.toIconId !== icon.id) {
      console.warn(`[export-compiled-icon] skipping cross-icon transition ${transition.id} ` + `for icon "${icon.id}" (toIconId="${transition.toIconId}"): ` + `cross-icon emission lands at the package layer, not per-icon JSON.`);
      continue;
    }
    const fromVariant = icon.variants?.[transition.fromVariantId];
    const toVariant = icon.variants?.[transition.toVariantId];
    if (!fromVariant || !toVariant)
      continue;
    const bindings = (transition.layerBindings ?? []).map((binding) => compileBinding(binding, fromVariant, toVariant, transition));
    out.push({
      from: transition.fromVariantId,
      to: transition.toVariantId,
      durationMs: transition.durationMs,
      easing: transition.easing ?? "ease-in-out",
      strategy: compileStrategy(transition.strategy),
      bindings
    });
  }
  out.sort((a, b) => {
    const k1 = `${a.from}->${a.to}`;
    const k2 = `${b.from}->${b.to}`;
    return k1.localeCompare(k2);
  });
  return out;
}
function compileBinding(binding, fromVariant, toVariant, transition) {
  const compiled = {};
  if (binding.fromLayerId)
    compiled.fromLayerId = binding.fromLayerId;
  if (binding.toLayerId)
    compiled.toLayerId = binding.toLayerId;
  if (binding.morph && binding.fromLayerId && binding.toLayerId) {
    const fromLayer = fromVariant.layers?.[binding.fromLayerId];
    const toLayer = toVariant.layers?.[binding.toLayerId];
    const morph = {
      topology: binding.morph.topology ?? "bestGuess"
    };
    if (fromLayer?.path?.d && toLayer?.path?.d) {
      try {
        const resolution = resolveMorph(fromLayer, toLayer, {
          cadence: transition.cadence ?? "soft",
          hints: transition.correspondenceHints
        });
        morph.keyframes = sampleForCompiledIcon(resolution, transition.durationMs);
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        console.warn(`[export-compiled-icon] morph cascade failed for transition ` + `${transition.id} layer pair ` + `"${binding.fromLayerId}" → "${binding.toLayerId}": ${reason}. ` + `Emitting morph block without keyframes — SDK will snap.`);
      }
    }
    compiled.morph = morph;
  }
  return compiled;
}
function compileStrategy(strategy) {
  switch (strategy) {
    case "strictMorph":
      return "strictMorph";
    case "bestGuessMorph":
    case "crossIconMorph":
      return "bestGuessMorph";
    case "replace":
      return "replace";
    case "lineAnimation":
    case "auto":
    default:
      return "track";
  }
}

// ../../lib/export/export-package-manifest.ts
var RENDERING_MODE_ORDER = [
  "monochrome",
  "hierarchical",
  "palette",
  "multicolor"
];
function generatePackageManifest(compiledIcons, options) {
  const schemaVersions = new Set(compiledIcons.map((entry) => getCompiledIconSchemaVersion(entry.compiled.$schema)));
  if (schemaVersions.size > 1) {
    throw new Error(`Compiled icon schema version mismatch: ${[...schemaVersions].sort((a, b) => a.localeCompare(b)).join(", ")}`);
  }
  const iconSchemaVersion = [...schemaVersions][0] ?? "1.0.0";
  const sortedEntries2 = [...compiledIcons].sort((left, right) => left.compiled.id.localeCompare(right.compiled.id));
  const icons = sortedEntries2.reduce((acc, entry) => {
    acc[entry.compiled.id] = toIconEntry(entry.compiled, entry.path);
    return acc;
  }, {});
  const collections = resolveCollections(options);
  const manifest = {
    $schema: PACKAGE_MANIFEST_SCHEMA_URI,
    package: {
      name: options.package.name,
      version: options.package.version,
      builtAt: options.package.builtAt,
      iconSchemaVersion,
      iconCount: compiledIcons.length,
      gitSha: options.package.gitSha,
      gitBranch: options.package.gitBranch
    },
    icons,
    collections
  };
  validatePackageManifestOrThrow(manifest);
  return manifest;
}
function generatePackageManifestFile(compiledIcons, options) {
  const manifest = generatePackageManifest(compiledIcons, options);
  return {
    path: "icons.manifest.json",
    contents: serializePackageManifestJson(manifest),
    manifest
  };
}
function validatePackageManifestOrThrow(value) {
  if (!isPackageManifest(value)) {
    throw new Error("Malformed PackageManifest payload.");
  }
}
function serializePackageManifestJson(value) {
  return `${JSON.stringify(sortJsonValue3(value), null, 2)}
`;
}
function toIconEntry(compiled, compiledPath) {
  const sizes = new Set;
  const states = new Set(["default"]);
  const modes = new Set;
  for (const variant of Object.values(compiled.variants)) {
    sizes.add(variant.size);
    states.add("default");
    for (const mode of RENDERING_MODE_ORDER) {
      modes.add(mode);
    }
  }
  const hasMorphTransition = compiled.transitions.some((transition) => transition.strategy === "strictMorph" || transition.strategy === "bestGuessMorph" || transition.bindings.some((binding) => binding.morph !== undefined));
  return {
    id: compiled.id,
    name: compiled.name,
    componentName: compiled.componentName,
    category: compiled.meta.category,
    tags: [...compiled.meta.tags].sort((a, b) => a.localeCompare(b)),
    version: compiled.meta.version,
    updatedAt: compiled.meta.updatedAt,
    contentHash: compiled.meta.contentHash,
    supportedSizes: [...sizes].sort((a, b) => a - b),
    supportedModes: RENDERING_MODE_ORDER.filter((mode) => modes.has(mode)),
    hasAnimation: compiled.transitions.length > 0 || compiled.effects.length > 0,
    hasMorphTransition,
    compiledPath: toRelativePackagePath(compiledPath)
  };
}
function toRelativePackagePath(path4) {
  return path4.replace(/^\.\//, "").replace(/^\//, "");
}
function resolveCollections(options) {
  if (options.resolveCollections) {
    return options.resolveCollections();
  }
  return options.collections ?? {};
}
function getCompiledIconSchemaVersion(schemaUri) {
  const match = schemaUri.match(/^https:\/\/(?:hiero|icophone)\.dev\/schemas\/compiled-icon\/([^/]+)$/);
  if (!match) {
    throw new Error(`Unexpected compiled icon schema URI: ${schemaUri}`);
  }
  return match[1];
}
function sortJsonValue3(value) {
  if (Array.isArray(value)) {
    return value.map(sortJsonValue3);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined).sort(([left], [right]) => left.localeCompare(right)).map(([key, entry]) => [key, sortJsonValue3(entry)]));
  }
  return value;
}

// ../../lib/export/export-react-components.ts
function generateReactIconComponents(compiledIcons, manifest) {
  const compiledById = new Map(compiledIcons.map((icon) => [icon.id, icon]));
  const files = [];
  const iconIds = Object.keys(manifest.icons).sort((a, b) => a.localeCompare(b));
  for (const iconId of iconIds) {
    const entry = manifest.icons[iconId];
    const compiled = compiledById.get(iconId);
    if (!compiled)
      continue;
    files.push(makeIconMetaFile(entry));
    for (const size of entry.supportedSizes) {
      const variant = findVariantBySize(compiled, size);
      if (!variant)
        continue;
      files.push(makeVariantDataFile(iconId, size, variant));
      files.push(makeSizedComponentFile(entry.componentName, iconId, size));
      files.push(makeSizeEntryFile(entry.componentName, size));
    }
    files.push(makeIconComponentFile(compiled, entry));
    files.push({
      path: `generated/icons/${entry.componentName}/index.ts`,
      contents: `export { default } from './${entry.componentName}';
`
    });
  }
  for (const [collectionId, collection] of Object.entries(manifest.collections)) {
    files.push(makeCollectionEntryFile(collectionId, collection.iconIds, manifest));
  }
  files.push(makeRootIndexFile(manifest));
  files.push(makeCollectionsIndexFile(manifest));
  return {
    files,
    exports: makePackageExports(manifest)
  };
}
function makeIconMetaFile(entry) {
  return {
    path: `generated/icons/${entry.componentName}/meta.ts`,
    contents: `import type { IconComponentMeta } from '@/lib/runtime-sdk';

export const iconMeta: IconComponentMeta = ${serializeCode({
      id: entry.id,
      name: entry.name,
      componentName: entry.componentName,
      schema: "https://hiero.dev/schemas/compiled-icon/1.0.0",
      version: entry.version,
      availableSizes: entry.supportedSizes,
      availableModes: entry.supportedModes
    })};
`
  };
}
function makeVariantDataFile(iconId, size, variant) {
  return {
    path: `generated/icons/${toPascal(iconId)}/variants/${size}.ts`,
    contents: `export const variant${size} = ${serializeCode(variant)} as const;
`
  };
}
function makeSizedComponentFile(componentName, iconId, size) {
  const pascalIconId = toPascal(iconId);
  return {
    path: `generated/icons/${componentName}/sizes/${size}.tsx`,
    contents: `import React, { forwardRef } from 'react';
import type { IconBaseProps } from '@/lib/runtime-sdk';
import { RuntimeIconRenderer } from '@/lib/runtime-sdk';
import { variant${size} } from '../../${pascalIconId}/variants/${size}';

type SizedProps = Omit<IconBaseProps, 'size'> & { size?: ${size} };

const iconData = {
  id: ${JSON.stringify(iconId)},
  name: ${JSON.stringify(componentName)},
  componentName: ${JSON.stringify(componentName)},
  $schema: 'https://hiero.dev/schemas/compiled-icon/1.0.0',
  meta: {
    category: '',
    tags: [],
    updatedAt: '',
    version: '1.0.0',
    contentHash: '',
  },
  variants: {
    '${size}': variant${size},
  },
  transitions: [],
  effects: [],
} as const;

const ${componentName}${size} = forwardRef<SVGSVGElement, SizedProps>(function ${componentName}${size}(props, ref) {
  return <RuntimeIconRenderer ref={ref} icon={iconData as any} size={${size}} {...props} />;
});

export default ${componentName}${size};
`
  };
}
function makeSizeEntryFile(componentName, size) {
  return {
    path: `generated/sizes/${size}/${componentName}.ts`,
    contents: `export { default } from '../../icons/${componentName}/sizes/${size}';
`
  };
}
function makeIconComponentFile(compiled, entry) {
  const sizeUnion = unionOfNumbers(entry.supportedSizes);
  const stateUnion = unionOfStates(compiled);
  const modeUnion = unionOfModes(entry.supportedModes);
  const effectUnion = unionOfAnimateKinds(compiled.effects.map((effect) => effect.kind));
  const variantImports = entry.supportedSizes.map((size) => `import { variant${size} } from '../../${toPascal(entry.id)}/variants/${size}';`).join(`
`);
  const variantMap = `const variants = {
${entry.supportedSizes.map((size) => `  '${size}': variant${size},`).join(`
`)}
} as const;`;
  return {
    path: `generated/icons/${entry.componentName}/${entry.componentName}.tsx`,
    contents: `import React, { forwardRef } from 'react';
import type { IconBaseProps, IconComponentMeta } from '@/lib/runtime-sdk';
import { RuntimeIconRenderer } from '@/lib/runtime-sdk';
import { iconMeta } from './meta';
${variantImports}

type ${entry.componentName}Props = Omit<IconBaseProps, 'size' | 'state' | 'renderingMode' | 'animate'> & {
  size?: ${sizeUnion};
  state?: ${stateUnion};
  renderingMode?: ${modeUnion};
  animate?: ${effectUnion} | null;
};

${variantMap}

const iconData = {
  id: ${JSON.stringify(compiled.id)},
  name: ${JSON.stringify(compiled.name)},
  componentName: ${JSON.stringify(compiled.componentName)},
  $schema: ${JSON.stringify(compiled.$schema)},
  meta: {
    category: ${JSON.stringify(compiled.meta.category)},
    tags: ${serializeCode(compiled.meta.tags)},
    updatedAt: ${JSON.stringify(compiled.meta.updatedAt)},
    version: ${JSON.stringify(compiled.meta.version)},
    contentHash: ${JSON.stringify(compiled.meta.contentHash)},
  },
  variants,
  transitions: ${serializeCode(compiled.transitions)},
  effects: ${serializeCode(compiled.effects)},
} as const;

const ${entry.componentName} = forwardRef<SVGSVGElement, ${entry.componentName}Props>(function ${entry.componentName}(props, ref) {
  return <RuntimeIconRenderer ref={ref} icon={iconData as any} {...props} />;
});

(${entry.componentName} as typeof ${entry.componentName} & { __iconMeta: IconComponentMeta }).__iconMeta = iconMeta;

export default ${entry.componentName};
`
  };
}
function makeCollectionEntryFile(collectionId, iconIds, manifest) {
  const exports = iconIds.map((iconId) => manifest.icons[iconId]).filter(Boolean).map((icon) => `export { default as ${icon.componentName} } from '../icons/${icon.componentName}';`).join(`
`);
  return {
    path: `generated/collections/${collectionId}.ts`,
    contents: `${exports}
`
  };
}
function makeRootIndexFile(manifest) {
  const lines = Object.values(manifest.icons).sort((a, b) => a.componentName.localeCompare(b.componentName)).map((icon) => `export { default as ${icon.componentName} } from './icons/${icon.componentName}';`);
  return {
    path: "generated/index.ts",
    contents: `${lines.join(`
`)}
`
  };
}
function makeCollectionsIndexFile(manifest) {
  const lines = Object.keys(manifest.collections).sort((a, b) => a.localeCompare(b)).map((collectionId) => `export * as ${toPascal(collectionId)} from './${collectionId}';`);
  return {
    path: "generated/collections/index.ts",
    contents: `${lines.join(`
`)}
`
  };
}
function makePackageExports(manifest) {
  const exports = {
    ".": "./generated/index.ts",
    "./collections": "./generated/collections/index.ts"
  };
  for (const icon of Object.values(manifest.icons)) {
    exports[`./icons/${icon.componentName}`] = `./generated/icons/${icon.componentName}/index.ts`;
    for (const size of icon.supportedSizes) {
      exports[`./sizes/${size}/${icon.componentName}`] = `./generated/sizes/${size}/${icon.componentName}.ts`;
    }
  }
  for (const collectionId of Object.keys(manifest.collections)) {
    exports[`./collections/${collectionId}`] = `./generated/collections/${collectionId}.ts`;
  }
  return Object.fromEntries(Object.entries(exports).sort(([left], [right]) => left.localeCompare(right)));
}
function findVariantBySize(compiled, size) {
  return Object.values(compiled.variants).find((variant) => variant.size === size);
}
function unionOfStates(compiled) {
  const states = new Set(["default"]);
  for (const transition of compiled.transitions) {
    if (transition.from)
      states.add(transition.from);
    if (transition.to)
      states.add(transition.to);
  }
  const sorted = [...states].sort((a, b) => {
    if (a === "default")
      return -1;
    if (b === "default")
      return 1;
    return a.localeCompare(b);
  });
  return sorted.map((s) => JSON.stringify(s)).join(" | ");
}
function unionOfNumbers(values) {
  return values.sort((a, b) => a - b).join(" | ");
}
function unionOfModes(values) {
  return values.map((value) => JSON.stringify(value)).join(" | ");
}
function unionOfAnimateKinds(values) {
  const unique = [...new Set(values)].sort((a, b) => a.localeCompare(b));
  if (unique.length === 0) {
    return "never";
  }
  return unique.map((value) => JSON.stringify(value)).join(" | ");
}
function toPascal(value) {
  return value.split(/[^a-zA-Z0-9]+/).filter(Boolean).map((part) => part[0].toUpperCase() + part.slice(1)).join("");
}
function serializeCode(value) {
  return JSON.stringify(value, null, 2);
}

// ../../lib/export/compile-pipeline.ts
function compileProject(project, options) {
  if (!isProject(project)) {
    throw new Error("Invalid project input for compile pipeline.");
  }
  const compiledOutputs = Object.keys(project.icons).sort((a, b) => a.localeCompare(b)).map((iconId) => {
    const output = exportCompiledIconFile(project, iconId);
    if (!isCompiledIcon(output.compiled)) {
      throw new Error(`Invalid compiled output for icon "${iconId}".`);
    }
    return {
      path: `icons/${output.path}`,
      contents: output.contents,
      compiled: output.compiled
    };
  });
  const manifestFile = generatePackageManifestFile(compiledOutputs.map((entry) => ({ path: entry.path, compiled: entry.compiled })), {
    package: options.package
  });
  validatePackageManifestOrThrow(manifestFile.manifest);
  const files = compiledOutputs.map((entry) => ({
    path: entry.path,
    contents: entry.contents
  }));
  files.push({ path: manifestFile.path, contents: manifestFile.contents });
  if (options.previousCompiledIcons) {
    const changeFiles = compiledOutputs.map((entry) => {
      const previous = options.previousCompiledIcons?.[entry.compiled.id];
      if (!previous)
        return null;
      const record = diffCompiledIcons(previous, entry.compiled, {
        publishedAt: options.package.builtAt
      });
      if (!isIconChangeRecord(record)) {
        throw new Error(`Invalid change record for icon "${entry.compiled.id}".`);
      }
      return {
        path: `changes/${entry.compiled.id}.change.json`,
        contents: serializeCanonicalJson(record)
      };
    }).filter(Boolean);
    files.push(...changeFiles);
  }
  if (options.generateReact) {
    const react = generateReactIconComponents(compiledOutputs.map((entry) => entry.compiled), manifestFile.manifest);
    files.push(...react.files);
    files.push({
      path: "package.exports.generated.json",
      contents: serializeCanonicalJson(react.exports)
    });
  }
  files.push({
    path: "README.md",
    contents: generatePackageReadme(options.package.name, options.package.version, compiledOutputs.map((entry) => entry.compiled))
  });
  return {
    files: files.sort((left, right) => left.path.localeCompare(right.path)),
    compiledIcons: compiledOutputs.map((entry) => entry.compiled),
    manifestPath: "icons.manifest.json"
  };
}
function generatePackageReadme(packageName, version, icons) {
  const iconList = icons.map((icon) => `- \`${icon.id}\` — ${icon.name}`).sort().join(`
`);
  const iconCount = icons.length;
  const sampleIcon = icons[0]?.id ?? "icon-name";
  return `# ${packageName}

> ${iconCount} animated, stateful SVG icon${iconCount !== 1 ? "s" : ""} built with [Hiero](https://hiero.dev).

## Install

\`\`\`bash
npm install ${packageName}
\`\`\`

## Quick Start (React)

\`\`\`tsx
import { HieroIcon } from '${packageName}/react';
import icon from '${packageName}/icons/${sampleIcon}.compiled.json';

function App() {
  return <HieroIcon icon={icon} size={24} animate />;
}
\`\`\`

## State Transitions

\`\`\`tsx
<HieroIcon icon={icon} state="active" animate />
\`\`\`

## Effects

\`\`\`tsx
<HieroIcon icon={icon} effect="bounce" />
\`\`\`

## Icons (${iconCount})

${iconList}

---

*v${version} — generated by Hiero*
`;
}
function serializeCanonicalJson(value) {
  return `${JSON.stringify(sortJsonValue4(value), null, 2)}
`;
}
function sortJsonValue4(value) {
  if (Array.isArray(value))
    return value.map(sortJsonValue4);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined).sort(([left], [right]) => left.localeCompare(right)).map(([key, entry]) => [key, sortJsonValue4(entry)]));
  }
  return value;
}

// ../../lib/sync-service/diff-source.ts
function diffSourcePayloads(previous, current) {
  const prevMap = toMap(previous);
  const currMap = toMap(current);
  const filesToWrite = [];
  const filesToDelete = [];
  for (const [path4, contents] of currMap) {
    const prevContents = prevMap.get(path4);
    if (prevContents === undefined) {
      filesToWrite.push({
        path: path4,
        kind: classifyNewFile(path4, currMap),
        iconDir: extractIconDir(path4),
        contents
      });
    } else if (prevContents !== contents) {
      filesToWrite.push({
        path: path4,
        kind: classifyChangedFile(path4),
        iconDir: extractIconDir(path4),
        contents
      });
    }
  }
  for (const [path4] of prevMap) {
    if (!currMap.has(path4)) {
      filesToDelete.push({
        path: path4,
        kind: classifyDeletedFile(path4, currMap),
        iconDir: extractIconDir(path4)
      });
    }
  }
  filesToWrite.sort((a, b) => a.path.localeCompare(b.path));
  filesToDelete.sort((a, b) => a.path.localeCompare(b.path));
  const iconChanges = computeIconChanges(prevMap, currMap);
  return {
    filesToWrite,
    filesToDelete,
    isNoOp: filesToWrite.length === 0 && filesToDelete.length === 0,
    iconChanges
  };
}
function classifyNewFile(path4, currMap) {
  if (path4 === "manifest.json")
    return "manifest-changed";
  const dir = extractIconDir(path4);
  if (!dir)
    return "manifest-changed";
  const iconJsonPath = `icons/${dir}/icon.json`;
  if (path4 === iconJsonPath || currMap.has(iconJsonPath)) {
    return "icon-added";
  }
  return "icon-added";
}
function classifyChangedFile(path4) {
  if (path4 === "manifest.json")
    return "manifest-changed";
  if (path4.endsWith("/preview.svg"))
    return "preview-only";
  if (path4.endsWith("/icon.json"))
    return "icon-updated";
  return "metadata-only";
}
function classifyDeletedFile(path4, currMap) {
  if (path4 === "manifest.json")
    return "manifest-changed";
  const dir = extractIconDir(path4);
  if (!dir)
    return "manifest-changed";
  const iconJsonPath = `icons/${dir}/icon.json`;
  if (!currMap.has(iconJsonPath)) {
    return "icon-removed";
  }
  if (path4.endsWith("/preview.svg"))
    return "preview-only";
  return "icon-updated";
}
function computeIconChanges(prevMap, currMap) {
  const prevDirs = extractAllIconDirs(prevMap);
  const currDirs = extractAllIconDirs(currMap);
  const changes = [];
  for (const dir of currDirs) {
    if (!prevDirs.has(dir)) {
      changes.push({ iconDir: dir, kind: "added" });
    }
  }
  for (const dir of prevDirs) {
    if (!currDirs.has(dir)) {
      changes.push({ iconDir: dir, kind: "removed" });
    }
  }
  for (const dir of currDirs) {
    if (!prevDirs.has(dir))
      continue;
    const iconJsonPath = `icons/${dir}/icon.json`;
    const previewPath = `icons/${dir}/preview.svg`;
    const iconJsonChanged = prevMap.get(iconJsonPath) !== currMap.get(iconJsonPath);
    const previewChanged = prevMap.get(previewPath) !== currMap.get(previewPath);
    if (iconJsonChanged) {
      changes.push({ iconDir: dir, kind: "updated" });
    } else if (previewChanged) {
      changes.push({ iconDir: dir, kind: "preview-only" });
    }
  }
  return changes.sort((a, b) => a.iconDir.localeCompare(b.iconDir));
}
function toMap(files) {
  const map = new Map;
  for (const f of files) {
    map.set(f.path, f.contents);
  }
  return map;
}
function extractIconDir(path4) {
  const match = path4.match(/^icons\/([^/]+)\//);
  return match ? match[1] : null;
}
function extractAllIconDirs(fileMap) {
  const dirs = new Set;
  for (const path4 of fileMap.keys()) {
    const dir = extractIconDir(path4);
    if (dir)
      dirs.add(dir);
  }
  return dirs;
}

// ../../lib/live-sync/output-writer.ts
import { mkdir as mkdir2, writeFile as writeFile2 } from "node:fs/promises";
import path4 from "node:path";
async function writeCompiledToHostTarget(repoRoot, target, files) {
  if (target.runtimeMode === "cache-dir") {
    if (!target.cacheDir) {
      return {
        target,
        writtenFiles: [],
        skipped: true,
        skipReason: "cacheDir is not configured for this host target"
      };
    }
    const cacheDir = path4.resolve(repoRoot, target.cacheDir);
    const writtenFiles = [];
    for (const file of files) {
      const targetPath = path4.join(cacheDir, file.path);
      await mkdir2(path4.dirname(targetPath), { recursive: true });
      await writeFile2(targetPath, file.contents, "utf8");
      writtenFiles.push(file.path);
    }
    return { target, writtenFiles, skipped: false };
  }
  if (target.runtimeMode === "in-memory") {
    return {
      target,
      writtenFiles: [],
      skipped: true,
      skipReason: "in-memory mode: host imports directly, no file writes needed"
    };
  }
  if (target.runtimeMode === "vendored") {
    return {
      target,
      writtenFiles: [],
      skipped: true,
      skipReason: "vendored mode: managed by consumer build step"
    };
  }
  return {
    target,
    writtenFiles: [],
    skipped: true,
    skipReason: `unsupported runtimeMode: ${target.runtimeMode}`
  };
}

// ../../lib/live-sync/incremental-rebuild.ts
async function fullRebuild(repoRoot, config, opts) {
  return runBuild(repoRoot, config, null, opts);
}
async function incrementalRebuild(repoRoot, config, previousSourceFiles, opts) {
  return runBuild(repoRoot, config, previousSourceFiles, opts);
}
async function runBuild(repoRoot, config, previousSourceFiles, opts) {
  const startMs = Date.now();
  const sourceDir = path5.resolve(repoRoot, config.sourceDir);
  const builtAt = opts?.builtAt ?? new Date().toISOString();
  let project;
  try {
    project = await projectFromSourceDir(sourceDir);
  } catch (err) {
    return {
      kind: "error",
      durationMs: Date.now() - startMs,
      error: `Failed to read source directory "${config.sourceDir}": ${err instanceof Error ? err.message : String(err)}`
    };
  }
  let currentPayload;
  try {
    currentPayload = exportSourcePayload(project, { generatedAt: "1970-01-01T00:00:00.000Z" });
  } catch (err) {
    return {
      kind: "error",
      durationMs: Date.now() - startMs,
      error: `Source export failed: ${err instanceof Error ? err.message : String(err)}`
    };
  }
  if (previousSourceFiles !== null) {
    const diff = diffSourcePayloads(previousSourceFiles, currentPayload.files);
    if (diff.isNoOp) {
      return {
        kind: "no-op",
        durationMs: Date.now() - startMs,
        changedIcons: 0,
        sourceFiles: previousSourceFiles
      };
    }
  }
  let compiled;
  try {
    compiled = compileProject(project, {
      package: {
        name: "hiero-live",
        version: "0.0.0",
        builtAt
      }
    });
  } catch (err) {
    return {
      kind: "error",
      durationMs: Date.now() - startMs,
      error: `Compile failed: ${err instanceof Error ? err.message : String(err)}`
    };
  }
  const writtenFiles = [];
  for (const target of config.hostTargets) {
    try {
      const result = await writeCompiledToHostTarget(repoRoot, target, compiled.files);
      if (!result.skipped) {
        writtenFiles.push(...result.writtenFiles);
      }
    } catch (err) {
      return {
        kind: "error",
        durationMs: Date.now() - startMs,
        error: `Write to host target "${target.kind}" failed: ${err instanceof Error ? err.message : String(err)}`
      };
    }
  }
  let changedIcons = compiled.compiledIcons.length;
  if (previousSourceFiles !== null) {
    const diff = diffSourcePayloads(previousSourceFiles, currentPayload.files);
    changedIcons = diff.iconChanges.filter((c) => c.kind === "added" || c.kind === "updated" || c.kind === "removed").length;
  }
  return {
    kind: "success",
    durationMs: Date.now() - startMs,
    changedIcons,
    totalIcons: compiled.compiledIcons.length,
    writtenFiles,
    sourceFiles: currentPayload.files
  };
}

// ../../lib/live-sync/file-watcher.ts
import { watch } from "node:fs";
import path6 from "node:path";
var RELEVANT_EXTENSIONS = new Set([".json", ".svg"]);
var DEFAULT_DEBOUNCE_MS = 100;
function watchSourceDir(sourceDir, onChanged, debounceMs = DEFAULT_DEBOUNCE_MS) {
  let debounceTimer = null;
  let pendingChangedPath = "";
  let watcher = null;
  let isActive = false;
  const fire = (filePath) => {
    if (debounceTimer !== null)
      clearTimeout(debounceTimer);
    pendingChangedPath = filePath;
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      onChanged(pendingChangedPath);
    }, debounceMs);
  };
  try {
    watcher = watch(sourceDir, { recursive: true, persistent: false }, (_event, filename) => {
      if (!filename)
        return;
      const ext = path6.extname(filename).toLowerCase();
      if (!RELEVANT_EXTENSIONS.has(ext))
        return;
      fire(path6.join(sourceDir, filename));
    });
    watcher.on("error", () => {
      handle.close();
    });
    isActive = true;
  } catch {}
  const handle = {
    close() {
      if (debounceTimer !== null) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
      }
      if (watcher) {
        watcher.close();
        watcher = null;
      }
      isActive = false;
    },
    get active() {
      return isActive;
    }
  };
  return handle;
}

// ../../lib/live-sync/dev-server.ts
async function startDevServer(serverConfig) {
  const { repoRoot, hiero: config, port } = serverConfig;
  const state = {
    iconCount: 0,
    lastBuildAt: null,
    lastBuildDurationMs: null,
    watching: false,
    previousSourceFiles: null
  };
  console.log(`[hiero] Starting dev server on port ${port}...`);
  console.log(`[hiero] Source directory: ${path7.resolve(repoRoot, config.sourceDir)}`);
  console.log(`[hiero] Host targets: ${config.hostTargets.map((t) => `${t.kind}(${t.runtimeMode})`).join(", ")}`);
  const initialBuild = await fullRebuild(repoRoot, config);
  applyBuildResult(state, initialBuild);
  if (initialBuild.kind === "success") {
    console.log(`[hiero] Initial build: ${initialBuild.totalIcons} icon(s) in ${initialBuild.durationMs}ms`);
  } else if (initialBuild.kind === "error") {
    console.warn(`[hiero] Initial build failed: ${initialBuild.error}`);
    console.warn(`[hiero] Continuing — server will retry on file change.`);
  }
  const sourceDir = path7.resolve(repoRoot, config.sourceDir);
  const watcher = watchSourceDir(sourceDir, async () => {
    const result = await incrementalRebuild(repoRoot, config, state.previousSourceFiles);
    applyBuildResult(state, result);
    if (result.kind === "success") {
      console.log(`[hiero] Rebuilt ${result.changedIcons} icon(s) in ${result.durationMs}ms`);
    } else if (result.kind === "error") {
      console.warn(`[hiero] Rebuild failed: ${result.error}`);
    }
  });
  state.watching = watcher.active;
  const server = createServer((req, res) => {
    handleRequest(req, res, serverConfig, state);
  });
  await new Promise((resolve, reject) => {
    server.on("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });
  console.log(`[hiero] Listening on http://localhost:${port}`);
  return {
    port,
    async close() {
      watcher.close();
      state.watching = false;
      await new Promise((resolve) => server.close(() => resolve()));
    }
  };
}
async function handleRequest(req, res, serverConfig, state) {
  const { method, url } = req;
  const { repoRoot, hiero: config, apiSecret } = serverConfig;
  const requestOrigin = req.headers["origin"];
  if (requestOrigin) {
    res.setHeader("Access-Control-Allow-Origin", requestOrigin);
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Vary", "Origin");
  if (method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }
  if (method === "POST" && apiSecret) {
    const auth = req.headers["authorization"] ?? "";
    if (auth !== `Bearer ${apiSecret}`) {
      sendJson(res, 401, { error: "Unauthorized" });
      return;
    }
  }
  try {
    if (method === "GET" && url === "/api/status") {
      await handleGetStatus(res, serverConfig, state);
    } else if (method === "GET" && url === "/api/icons") {
      await handleGetIcons(res, state);
    } else if (method === "POST" && url === "/api/source/icons") {
      await handlePostIcons(req, res, repoRoot, config, state);
    } else if (method === "POST" && url === "/api/source/manifest") {
      await handlePostManifest(req, res, repoRoot, config, state);
    } else {
      sendJson(res, 404, { error: "Not found" });
    }
  } catch (err) {
    console.error(`[hiero] Unhandled request error:`, err);
    sendJson(res, 500, { error: "Internal server error" });
  }
}
async function handleGetStatus(res, serverConfig, state) {
  const { repoRoot, hiero: config, port } = serverConfig;
  const status = {
    ok: true,
    repoRoot,
    sourceDir: config.sourceDir,
    iconCount: state.iconCount,
    lastBuildAt: state.lastBuildAt,
    lastBuildDurationMs: state.lastBuildDurationMs,
    watching: state.watching,
    port,
    hostTargets: config.hostTargets.map((t) => ({
      kind: t.kind,
      runtimeMode: t.runtimeMode,
      ...t.cacheDir ? { cacheDir: t.cacheDir } : {}
    })),
    releaseTargets: (config.releaseTargets ?? []).map((t) => {
      if (t.kind === "local-directory") {
        return { kind: t.kind, outputMode: t.outputMode, outputDir: t.outputDir };
      }
      if (t.kind === "git-pr") {
        return {
          kind: t.kind,
          outputMode: t.outputMode,
          owner: t.owner,
          repo: t.repo,
          baseBranch: t.baseBranch,
          ...t.packagePath ? { packagePath: t.packagePath } : {}
        };
      }
      return {
        kind: t.kind,
        outputMode: t.outputMode,
        packageName: t.packageName,
        ...t.registry ? { registry: t.registry } : {},
        ...t.scope ? { scope: t.scope } : {}
      };
    })
  };
  sendJson(res, 200, status);
}
async function handleGetIcons(res, state) {
  const icons = extractIconList(state.previousSourceFiles);
  sendJson(res, 200, { icons, count: icons.length });
}
async function handlePostIcons(req, res, repoRoot, config, state) {
  const body = await readBody(req);
  let parsed;
  try {
    parsed = JSON.parse(body);
  } catch {
    sendJson(res, 400, { error: "Invalid JSON body" });
    return;
  }
  if (!Array.isArray(parsed.files)) {
    sendJson(res, 400, { error: "files must be an array" });
    return;
  }
  const sourceDir = path7.resolve(repoRoot, config.sourceDir);
  for (const file of parsed.files) {
    if (!isValidSourcePath(file.path)) {
      sendJson(res, 400, { error: `Invalid or unsafe source path: ${file.path}` });
      return;
    }
    const targetPath = path7.join(sourceDir, file.path);
    await mkdir3(path7.dirname(targetPath), { recursive: true });
    await writeFile3(targetPath, file.contents, "utf8");
  }
  const result = await incrementalRebuild(repoRoot, config, state.previousSourceFiles);
  applyBuildResult(state, result);
  if (result.kind === "success") {
    console.log(`[hiero] API ingest: ${parsed.files.length} file(s) received, rebuilt ${result.changedIcons} icon(s) in ${result.durationMs}ms`);
  }
  sendJson(res, 200, {
    ok: true,
    filesReceived: parsed.files.length,
    buildResult: result.kind,
    ...result.kind === "success" ? { changedIcons: result.changedIcons, totalIcons: result.totalIcons, durationMs: result.durationMs } : result.kind === "error" ? { error: result.error } : {}
  });
}
async function handlePostManifest(req, res, repoRoot, config, state) {
  const body = await readBody(req);
  let parsed;
  try {
    parsed = JSON.parse(body);
  } catch {
    sendJson(res, 400, { error: "Invalid JSON body" });
    return;
  }
  if (typeof parsed.contents !== "string") {
    sendJson(res, 400, { error: "contents must be a string" });
    return;
  }
  try {
    JSON.parse(parsed.contents);
  } catch {
    sendJson(res, 400, { error: "contents is not valid JSON" });
    return;
  }
  const sourceDir = path7.resolve(repoRoot, config.sourceDir);
  await mkdir3(sourceDir, { recursive: true });
  await writeFile3(path7.join(sourceDir, "manifest.json"), parsed.contents, "utf8");
  const result = await incrementalRebuild(repoRoot, config, state.previousSourceFiles);
  applyBuildResult(state, result);
  sendJson(res, 200, {
    ok: true,
    buildResult: result.kind,
    ...result.kind === "success" ? { changedIcons: result.changedIcons, durationMs: result.durationMs } : result.kind === "error" ? { error: result.error } : {}
  });
}
function applyBuildResult(state, result) {
  if (result.kind === "success") {
    state.iconCount = result.totalIcons;
    state.lastBuildAt = new Date().toISOString();
    state.lastBuildDurationMs = result.durationMs;
    state.previousSourceFiles = result.sourceFiles;
  } else if (result.kind === "no-op") {}
}
function sendJson(res, status, body) {
  const json = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(json)
  });
  res.end(json);
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}
function isValidSourcePath(filePath) {
  if (!filePath || typeof filePath !== "string")
    return false;
  if (path7.isAbsolute(filePath))
    return false;
  if (filePath.includes(".."))
    return false;
  const normalized = filePath.replace(/\\/g, "/");
  return normalized === "manifest.json" || /^icons\/[a-z0-9][a-z0-9-]*[a-z0-9]?\/icon\.json$/.test(normalized) || /^icons\/[a-z0-9][a-z0-9-]*[a-z0-9]?\/preview\.svg$/.test(normalized);
}
function extractIconList(sourceFiles) {
  if (!sourceFiles)
    return [];
  const manifestFile = sourceFiles.find((f) => f.path === "manifest.json");
  if (!manifestFile)
    return [];
  try {
    const manifest = JSON.parse(manifestFile.contents);
    return Object.entries(manifest.icons ?? {}).map(([dirName, entry]) => ({
      id: entry.id,
      name: entry.name,
      dirName,
      variantCount: entry.variantCount,
      sizes: entry.sizes,
      hasTransitions: entry.hasTransitions,
      hasEffects: entry.hasEffects
    }));
  } catch {
    return [];
  }
}

// src/commands/dev.ts
async function runDev(cwd, flags) {
  const configPath = typeof flags["config"] === "string" ? path8.resolve(cwd, flags["config"]) : path8.join(cwd, "hiero.config.ts");
  const rawPort = flags["port"];
  const port = typeof rawPort === "string" && /^\d+$/.test(rawPort) ? parseInt(rawPort, 10) : 4400;
  const apiSecret = typeof flags["secret"] === "string" ? flags["secret"] : undefined;
  if (!existsSync2(configPath)) {
    console.error(`[hiero] Config not found: ${path8.relative(cwd, configPath)}`);
    console.error(`         Run \`hiero init\` to scaffold hiero.config.ts`);
    process.exit(1);
  }
  let config;
  try {
    const rawModule = await import(configPath);
    const result = loadConfig(rawModule.default, configPath);
    if (!result.ok) {
      console.error(`[hiero] Config invalid:
${result.error}`);
      process.exit(1);
    }
    config = result.config;
  } catch (err) {
    console.error(`[hiero] Failed to load config: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
  const server = await startDevServer({
    repoRoot: cwd,
    hiero: config,
    port,
    apiSecret
  });
  const shutdown = async () => {
    console.log(`
[hiero] Shutting down...`);
    await server.close();
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown());
  process.on("SIGTERM", () => void shutdown());
  await new Promise(() => {});
}

// src/commands/build.ts
import path9 from "node:path";
import { existsSync as existsSync3 } from "node:fs";
import { mkdir as mkdir4, writeFile as writeFile4 } from "node:fs/promises";
async function runBuild2(cwd, flags) {
  const configPath = typeof flags["config"] === "string" ? path9.resolve(cwd, flags["config"]) : path9.join(cwd, "hiero.config.ts");
  const outOverride = typeof flags["out"] === "string" ? flags["out"] : undefined;
  if (!existsSync3(configPath)) {
    console.error(`[hiero] Config not found: ${path9.relative(cwd, configPath)}`);
    process.exit(1);
  }
  let config;
  try {
    const rawModule = await import(configPath);
    const result = loadConfig(rawModule.default, configPath);
    if (!result.ok) {
      console.error(`[hiero] Config invalid:
${result.error}`);
      process.exit(1);
    }
    config = result.config;
  } catch (err) {
    console.error(`[hiero] Failed to load config: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
  const releaseTargets = config.releaseTargets ?? [];
  if (releaseTargets.length === 0 && !outOverride) {
    console.error(`[hiero] No releaseTargets configured and --out not provided.
         Add a local-directory target to hiero.config.ts or pass --out <dir>.`);
    process.exit(1);
  }
  const sourceDir = path9.resolve(cwd, config.sourceDir);
  if (!existsSync3(sourceDir)) {
    console.error(`[hiero] Source directory not found: ${config.sourceDir}`);
    console.error(`         Run \`hiero init\` to create it`);
    process.exit(1);
  }
  console.log(`[hiero] Loading source from ${config.sourceDir}...`);
  let project;
  try {
    project = await projectFromSourceDir(sourceDir);
  } catch (err) {
    console.error(`[hiero] Source read failed: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
  const iconCount = Object.keys(project.icons).length;
  if (iconCount === 0) {
    console.warn(`[hiero] Warning: no icons found in ${config.sourceDir}. Build will produce an empty output.`);
  }
  console.log(`[hiero] Compiling ${iconCount} icon(s)...`);
  const builtAt = new Date().toISOString();
  let compiled;
  try {
    compiled = compileProject(project, {
      package: {
        name: "hiero-build",
        version: "0.0.0",
        builtAt
      }
    });
  } catch (err) {
    console.error(`[hiero] Compile failed: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
  const localDirTargets = outOverride ? [{ kind: "local-directory", outputMode: "snapshot", outputDir: outOverride }] : releaseTargets.filter((t) => t.kind === "local-directory");
  for (const target of localDirTargets) {
    const outDir = path9.resolve(cwd, target.outputDir);
    console.log(`[hiero] Writing to ${target.outputDir}...`);
    for (const file of compiled.files) {
      const targetPath = path9.join(outDir, file.path);
      await mkdir4(path9.dirname(targetPath), { recursive: true });
      await writeFile4(targetPath, file.contents, "utf8");
    }
    console.log(`         ${compiled.files.length} file(s) written`);
  }
  for (const target of releaseTargets) {
    if (target.kind === "git-pr") {
      console.log(`
[hiero] git-pr target: ${target.owner}/${target.repo}
         To open a pull request, use the Create PR action in the Hiero editor.`);
    }
    if (target.kind === "npm-registry") {
      console.log(`
[hiero] npm-registry target: ${target.packageName}
         To publish to npm, use the Release action in the Hiero editor.`);
    }
  }
  const elapsedMs = Date.now() - new Date(builtAt).getTime();
  console.log(`
[hiero] Build complete — ${iconCount} icon(s) in ${elapsedMs}ms`);
}

// src/commands/validate.ts
import path10 from "node:path";
import { existsSync as existsSync4 } from "node:fs";
async function runValidate(cwd, flags) {
  const configPath = typeof flags["config"] === "string" ? path10.resolve(cwd, flags["config"]) : path10.join(cwd, "hiero.config.ts");
  let exitCode = 0;
  if (!existsSync4(configPath)) {
    console.error(`[hiero] Config not found: ${path10.relative(cwd, configPath)}`);
    console.error(`         Run \`hiero init\` to scaffold hiero.config.ts`);
    process.exit(1);
  }
  let rawModule;
  try {
    rawModule = await import(configPath);
  } catch (err) {
    console.error(`[hiero] Failed to load config: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
  const loadResult = loadConfig(rawModule.default, configPath);
  if (!loadResult.ok) {
    console.error(`[hiero] Config invalid:
${loadResult.error}`);
    process.exit(1);
  }
  const config = loadResult.config;
  console.log(`[hiero] Config`);
  console.log(`   sourceDir:       ${config.sourceDir}`);
  console.log(`   hostTargets:     ${config.hostTargets.length}`);
  console.log(`   releaseTargets:  ${(config.releaseTargets ?? []).length}`);
  console.log(`   status:          OK`);
  const sourceDir = path10.resolve(cwd, config.sourceDir);
  if (!existsSync4(sourceDir)) {
    console.error(`
[hiero] Source directory not found: ${config.sourceDir}`);
    console.error(`         Run \`hiero init\` to create it`);
    process.exit(1);
  }
  let project;
  try {
    project = await projectFromSourceDir(sourceDir);
  } catch (err) {
    console.error(`
[hiero] Source read failed: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
  const iconCount = Object.keys(project.icons).length;
  if (iconCount > 0) {
    try {
      const payload = exportSourcePayload(project);
      console.log(`
[hiero] Source`);
      console.log(`   icons:   ${iconCount}`);
      console.log(`   files:   ${payload.files.length}`);
      console.log(`   status:  OK`);
    } catch (err) {
      console.error(`
[hiero] Source export failed: ${err instanceof Error ? err.message : String(err)}`);
      exitCode = 1;
    }
  } else {
    console.log(`
[hiero] Source`);
    console.log(`   icons:   0  (no icons — run \`hiero init\` to populate from the editor)`);
    console.log(`   status:  OK`);
  }
  if (exitCode === 0) {
    console.log(`
[hiero] Validation passed`);
  } else {
    console.error(`
[hiero] Validation failed`);
    process.exit(exitCode);
  }
}

// src/bin.ts
function parseFlags(argv) {
  const flags = {};
  for (let i = 0;i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith("--")) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = true;
      }
    }
  }
  return flags;
}
var allArgs = process.argv.slice(2);
var flags = parseFlags(allArgs);
var command = (() => {
  for (let i = 0;i < allArgs.length; i++) {
    const a = allArgs[i];
    if (a.startsWith("--")) {
      const next = allArgs[i + 1];
      if (next !== undefined && !next.startsWith("--"))
        i++;
    } else {
      return a;
    }
  }
  return;
})();
async function main() {
  if (flags["help"] || flags["h"]) {
    printUsage();
    return;
  }
  if (flags["version"] || flags["v"]) {
    const pkg = await Promise.resolve().then(() => __toESM(require_package(), 1)).catch(() => ({ version: "unknown" }));
    console.log(pkg.version);
    return;
  }
  switch (command) {
    case "init":
      await runInit(process.cwd(), flags);
      break;
    case "dev":
      await runDev(process.cwd(), flags);
      break;
    case "build":
      await runBuild2(process.cwd(), flags);
      break;
    case "validate":
      await runValidate(process.cwd(), flags);
      break;
    default:
      if (command) {
        console.error(`[hiero] Unknown command: "${command}"
`);
        printUsage();
        process.exit(1);
      } else {
        printUsage();
      }
  }
}
function printUsage() {
  console.log(`
hiero — repo-native icon authoring by Hiero

Usage:
  hiero <command> [options]

Commands:
  init              Scaffold hiero.config.ts and source directory
  dev               Start live integration dev server (Lane 1)
  build             Deterministic snapshot build (Lane 2)
  validate          Validate config and source files

Options:
  --port <n>        Dev server port (default: 4400)
  --config <path>   Path to hiero.config.ts (default: ./hiero.config.ts)
  --out <path>      Output directory override for build
  --secret <token>  Shared secret for dev server API auth
  --version         Print version
  --help            Show this help
`);
}
main().catch((err) => {
  console.error(`[hiero] ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
