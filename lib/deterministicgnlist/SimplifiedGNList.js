/* eslint-disable */

var merkleUtils = require('../util/merkletree');
var SimplifiedGNListDiff = require('./SimplifiedGNListDiff');
var constants = require('../constants');
var Transaction = require('../transaction');

var getMerkleTree = merkleUtils.getMerkleTree;
var getMerkleRoot = merkleUtils.getMerkleRoot;

function SimplifiedGNList(simplifiedGNListDiff) {
  this.baseBlockHash = constants.NULL_HASH;
  this.blockHash = constants.NULL_HASH;
  /**
   * Note that this property contains ALL guardiannodes, including banned ones.
   * Use getValidGuardiannodesList() method to get the list of only valid nodes.
   * This in needed for merkleRootNMList calculation
   * @type {SimplifiedGNListEntry[]}
   */
  this.gnList = [];
  /**
   * This property contains only valid, not PoSe-banned nodes.
   * @type {SimplifiedGNListEntry[]}
   */
  this.validGNs = [];
  this.merkleRootGNList = constants.NULL_HASH;
  this.lastDiffMerkleRootGNList = constants.NULL_HASH;
  this.cbTx = null;
  this.cbTxMerkleTree = null;
  if (simplifiedGNListDiff) {
    this.applyDiff(simplifiedGNListDiff);
  }
}

/**
 *
 * @param {SimplifiedGNListDiff|Buffer|string|Object} simplifiedGNListDiff - GNList diff. Can be serialized or parsed
 */
SimplifiedGNList.prototype.applyDiff = function applyDiff(simplifiedGNListDiff) {
  // This will copy instance of SimplifiedGNListDiff or create a new instance if serialized data is passed
  var diff = new SimplifiedGNListDiff(simplifiedGNListDiff);

  if (this.baseBlockHash === constants.NULL_HASH) {
    /* If the base block hash is a null hash, then this is the first time we apply any diff.
    * If we apply diff to the list for the first time, than diff's base block hash would be the base block hash
    * for the whole list.
    * */
    this.baseBlockHash = diff.baseBlockHash;
  }

  this.blockHash = diff.blockHash;

  this.deleteGNs(diff.deletedGNs);
  this.addOrUpdateGNs(diff.gnList);

  this.lastDiffMerkleRootGNList = diff.merkleRootGNList || constants.NULL_HASH;
  this.merkleRootGNList = this.calculateMerkleRoot();

  if (!this.verify()) {
    throw new Error("Merkle root from the diff doesn't match calculated merkle root after diff is applied");
  }

  this.cbTx = new Transaction(diff.cbTx);
  this.cbTxMerkleTree = diff.cbTxMerkleTree.copy();

  this.validGNs = this.gnList.filter(function (smlEntry) {
    return smlEntry.isValid;
  });
};

/**
 * @private
 * Adds GNs to the GN list
 * @param {SimplifiedGNListEntry[]} gnListEntries
 */
SimplifiedGNList.prototype.addOrUpdateGNs = function addGNs(gnListEntries) {
  var newGNListEntries = gnListEntries.map(function (gnListEntry) {
    return gnListEntry.copy();
  });
  newGNListEntries.forEach(function (newGNListEntry) {
    var indexOfOldEntry = this.gnList.findIndex(function (oldGNListEntry) {
      return oldGNListEntry.proRegTxHash === newGNListEntry.proRegTxHash;
    });
    if (indexOfOldEntry > -1) {
      this.gnList[indexOfOldEntry] = newGNListEntry;
    } else {
      return this.gnList.push(newGNListEntry);
    }
  }, this);
};

/**
 * @private
 * Deletes GNs from the GN list
 * @param {string[]} proRegTxHashes - list of proRegTxHashes to delete from GNList
 */
SimplifiedGNList.prototype.deleteGNs = function deleteGN(proRegTxHashes) {
  proRegTxHashes.forEach(function (proRegTxHash) {
    var gnIndex = this.gnList.findIndex(function (GN) {
      return GN.proRegTxHash === proRegTxHash;
    });
    if (gnIndex > -1) {
      this.gnList.splice(gnIndex, 1);
    }
  }, this);
};

/**
 * Compares merkle root from the most recent diff applied matches the merkle root of the list
 * @returns {boolean}
 */
SimplifiedGNList.prototype.verify = function verify() {
  return this.calculateMerkleRoot() === this.lastDiffMerkleRootGNList;
};

/**
 * @private
 * Sorts GN List in deterministic order
 */
SimplifiedGNList.prototype.sort = function sort() {
  this.gnList.sort(function (a, b) {
    return Buffer.compare(Buffer.from(a.proRegTxHash, 'hex').reverse(), Buffer.from(b.proRegTxHash, 'hex').reverse());
  });
};

/**
 * Calculates merkle root of the GN list
 * @returns {string}
 */
SimplifiedGNList.prototype.calculateMerkleRoot = function calculateMerkleRoot() {
  if (this.gnList.length < 1) {
    return constants.NULL_HASH;
  }
  this.sort();
  var sortedEntryHashes = this.gnList.map(
    function (gnListEntry) {
      return gnListEntry.calculateHash();
    }
  );
  return getMerkleRoot(getMerkleTree(sortedEntryHashes)).reverse().toString('hex');
};

/**
 * Returns a list of valid guardiannodes
 * @returns {SimplifiedGNListEntry[]}
 */
SimplifiedGNList.prototype.getValidGuardiannodesList = function getValidGuardiannodes() {
  return this.validGNs;
};

/**
 * Converts simplified GN list to simplified GN list diff that can be used to serialize data
 * to json, buffer, or a hex string
 * @param {string} [network]
 */
SimplifiedGNList.prototype.toSimplifiedGNListDiff = function toSimplifiedGNListDiff(network) {
  if (!this.cbTx || !this.cbTxMerkleTree) {
    throw new Error("Can't convert GN list to diff - cbTx is missing");
  }
  return SimplifiedGNListDiff.fromObject({
    baseBlockHash: this.baseBlockHash,
    blockHash: this.blockHash,
    cbTx: new Transaction(this.cbTx),
    cbTxMerkleTree: this.cbTxMerkleTree,
    // Always empty, as simplified GN list doesn't have a deleted gn list
    deletedGNs: [],
    gnList: this.gnList,
    merkleRootGNList: this.merkleRootGNList
  }, network);
};

module.exports = SimplifiedGNList;
