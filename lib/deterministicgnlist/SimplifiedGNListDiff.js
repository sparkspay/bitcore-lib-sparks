/* eslint-disable */
// TODO: Remove previous line and work through linting issues at next edit

'use strict';
var BufferReader = require('../encoding/bufferreader');
var BufferWriter = require('../encoding/bufferwriter');
var BufferUtil = require('../util/buffer');
var _ = require('lodash');
var isHexString = require('../util/js').isHexa;

var SimplifiedGNListEntry = require('./SimplifiedGNListEntry');
var PartialMerkleTree = require('./PartialMerkleTree');
var Transaction = require('../transaction');
var constants = require('../constants');

/**
 * @param {Buffer|Object|string} [arg] - A Buffer, JSON string, or Object representing a MnListDiff
 * @param {string} [network]
 * @class {SimplifiedGNListDiff}
 * @property {string} baseBlockHash - sha256
 * @property {string} blockHash - sha256
 * @property {PartialMerkleTree} cbTxMerkleTree;
 * @property {Transaction} cbTx;
 * @property {Array<string>} deletedGNs - sha256 hashes of deleted GNs
 * @property {Array<SimplifiedGNListEntry>} gnList
 * @property {string} merkleRootGNList - merkle root of the whole gn list
 */
function SimplifiedGNListDiff(arg, network) {
  if (arg) {
    if (arg instanceof SimplifiedGNListDiff) {
      return arg.copy();
    } else if (BufferUtil.isBuffer(arg)) {
      return SimplifiedGNListDiff.fromBuffer(arg, network);
    } else if (_.isObject(arg)) {
      return SimplifiedGNListDiff.fromObject(arg, network);
    } else if (isHexString(arg)) {
      return SimplifiedGNListDiff.fromHexString(arg, network);
    } else {
      throw new TypeError('Unrecognized argument passed to SimplifiedGNListDiff constructor');
    }
  }
}

/**
 * Creates MnListDiff from a Buffer.
 * @param {Buffer} buffer
 * @param {string} [network]
 * @return {SimplifiedGNListDiff}
 */
SimplifiedGNListDiff.fromBuffer = function fromBuffer(buffer, network) {
  var bufferReader = new BufferReader(Buffer.from(buffer));
  var data = {};

  data.baseBlockHash = bufferReader.read(constants.SHA256_HASH_SIZE).reverse().toString('hex');
  data.blockHash = bufferReader.read(constants.SHA256_HASH_SIZE).reverse().toString('hex');

  data.cbTxMerkleTree = PartialMerkleTree.fromBufferReader(bufferReader);
  data.cbTx = new Transaction().fromBufferReader(bufferReader);

  var deletedGNsCount = bufferReader.readVarintNum();
  data.deletedGNs = [];
  for (var i = 0; i < deletedGNsCount; i++) {
    data.deletedGNs.push(bufferReader.read(constants.SHA256_HASH_SIZE).reverse().toString('hex'));
  }

  var gnListSize = bufferReader.readVarintNum();
  data.gnList = [];
  for (var i = 0; i < gnListSize; i++) {
    data.gnList.push(SimplifiedGNListEntry.fromBuffer(bufferReader.read(constants.SML_ENTRY_SIZE), network));
  }

  data.merkleRootGNList = data.cbTx.extraPayload.merkleRootGNList;
  return this.fromObject(data, network);
};

/**
 * @param {string} hexString
 * @param {string} [network]
 * @return {SimplifiedGNListDiff}
 */
SimplifiedGNListDiff.fromHexString = function fromHexString(hexString, network) {
  return SimplifiedGNListDiff.fromBuffer(Buffer.from(hexString, 'hex'), network);
};

/**
 * Serializes gnlist diff to a Buffer
 * @return {Buffer}
 */
SimplifiedGNListDiff.prototype.toBuffer = function toBuffer() {
  var bufferWriter = new BufferWriter();

  bufferWriter.write(Buffer.from(this.baseBlockHash, 'hex').reverse());
  bufferWriter.write(Buffer.from(this.blockHash, 'hex').reverse());

  bufferWriter.write(this.cbTxMerkleTree.toBuffer());
  bufferWriter.write(this.cbTx.toBuffer());

  bufferWriter.writeVarintNum(this.deletedGNs.length);
  this.deletedGNs.forEach(function (deleteGNHash) {
    bufferWriter.write(Buffer.from(deleteGNHash, 'hex').reverse());
  });

  bufferWriter.writeVarintNum(this.gnList.length);
  this.gnList.forEach(function (simplifiedGNListEntry) {
    bufferWriter.write(simplifiedGNListEntry.toBuffer());
  });

  return bufferWriter.toBuffer();
};

/**
 * Creates GNListDiff from object
 * @param obj
 * @param {string} [network]
 * @return {SimplifiedGNListDiff}
 */
SimplifiedGNListDiff.fromObject = function fromObject(obj, network) {
  var simplifiedGNListDiff = new SimplifiedGNListDiff();

  simplifiedGNListDiff.baseBlockHash = obj.baseBlockHash;
  simplifiedGNListDiff.blockHash = obj.blockHash;

  /* cbTxMerkleRoot start */
  simplifiedGNListDiff.cbTxMerkleTree = new PartialMerkleTree(obj.cbTxMerkleTree);
  /* cbTxMerkleRoot stop */

  simplifiedGNListDiff.cbTx = new Transaction(obj.cbTx);
  // Copy array of strings
  simplifiedGNListDiff.deletedGNs = obj.deletedGNs.slice();
  simplifiedGNListDiff.gnList = obj.gnList.map(function (SMLEntry) {
    return new SimplifiedGNListEntry(SMLEntry, network);
  });
  simplifiedGNListDiff.merkleRootGNList = obj.merkleRootGNList;

  simplifiedGNListDiff.network = network;

  return simplifiedGNListDiff;
};

SimplifiedGNListDiff.prototype.toObject = function toObject() {
  var obj = {};
  obj.baseBlockHash = this.baseBlockHash;
  obj.blockHash = this.blockHash;

  /* cbTxMerkleRoot start */
  obj.cbTxMerkleTree = this.cbTxMerkleTree.toString();
  /* cbTxMerkleRoot stop */

  obj.cbTx = this.cbTx.serialize(true);
  // Copy array of strings
  obj.deletedGNs = this.deletedGNs.slice();
  obj.gnList = this.gnList.map(function (SMLEntry) {
    return SMLEntry.toObject();
  });
  obj.merkleRootGNList = this.merkleRootGNList;

  return obj;
};

SimplifiedGNListDiff.prototype.copy = function copy() {
  return SimplifiedGNListDiff.fromBuffer(this.toBuffer(), this.network);
};

module.exports = SimplifiedGNListDiff;
