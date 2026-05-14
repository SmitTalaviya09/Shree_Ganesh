import { LightningElement, track, api } from 'lwc';
import getActiveBatches        from '@salesforce/apex/JewelryOrderController.getActiveBatches';
import completeBatch           from '@salesforce/apex/JewelryOrderController.completeBatch';
import getItemMeasurementTypes from '@salesforce/apex/JewelryOrderController.getItemMeasurementTypes';
import revertProductionBatch from '@salesforce/apex/JewelryOrderController.revertProductionBatch';
import deleteRemainingBatch from '@salesforce/apex/JewelryOrderController.deleteRemainingBatch';

export default class JwelCraftProductionBoard extends LightningElement {
    @api userName = '';
    @api userRole = '';

    @track isLoading    = false;
    @track batches      = [];

    // Completion modal
    @track showCompleteModal = false;
    @track showConfirmModal  = false;
    @track isCompleting      = false;
    @track activeBatch       = null;
    @track completionItems   = [];
    @track searchTerm        = '';

    // Tracked input values (avoids DOM querySelector in for:each)
    @track ciQty    = {};
    @track ciInches = {};
    @track ciGrams  = {};
    @track ciPair = {};
    @track showRevertConfirmModal = false;
    @track isReverting = false;
    @track revertBatch = null;
    @track showDeleteConfirmModal = false;
    @track deleteBatch = null;

    connectedCallback() { 
        this._load(); 
        this.startPolling();
        console.log('load');
    }
    disconnectedCallback() {
        if (this.poller) {
            clearInterval(this.poller);
        }
    }
    startPolling() {
        // Initial load already done above, so optional here
        this.poller = setInterval(() => {
            this._load();
        }, 60000); // 60 sec
    }
    handleDeleteBatchDirect(e) {
        var batchId = e.currentTarget.dataset.id;

        this.deleteBatch = this.batches.find(function(b) {
            return b.Id === batchId;
        });

        if (!this.deleteBatch) return;

        this.showDeleteConfirmModal = true;
    }
    handleCloseDeleteConfirm() {
        this.showDeleteConfirmModal = false;
        this.deleteBatch = null;
    }
    _load() {
        this.isLoading = true;
        var self = this;
        getActiveBatches()
            .then(function(res) {
                self.isLoading = false;
                self.batches   = (res || []).map(function(b) {
                    // Parse item codes from comma-separated Item_Code__c
                    var itemCodeList = (b.Item_Code__c || '')
                        .split(',').map(function(s){ return s.trim(); }).filter(Boolean);

                    // Parse item details for the order list dropdown
                    var itemDetails = [];
                    try { itemDetails = JSON.parse(b.Item_Details__c || '[]'); } catch(e) {}

                    // Build order rows from itemDetails
                    // Each custLine = one row; regularQty = one row per item if > 0
                    var orderList = [];
                    // Build order rows from itemDetails
                    var productionQtyList = [];

                    itemDetails.forEach(function(d) {

                        var ic   = d.itemCode || '';
                        var unit = d.unit || 'Pcs';
                        var qty  = Number(d.totalQty || 0);

                        // ✅ Production summary chips
                        if (qty > 0) {
                            productionQtyList.push({
                                key: ic + '-' + (d.size || ''),
                                itemCode: ic,
                                size: d.size || '',
                                qty: qty,
                                unit: unit,
                                label: ic + ' → ' + qty + ' ' + unit
                            });
                        }

                        // Customer lines
                        (d.custLines || []).forEach(function(cl) {
                            orderList.push({
                                id: ic + '-' + cl.customerCode,
                                itemCode: ic,
                                customerCodeLabel: cl.customerCode || '—',
                                remark: cl.remark || '',
                                qty: cl.qty || 0,
                                unit: unit
                            });
                        });

                        // Regular line
                        if ((d.regularQty || 0) > 0) {
                            orderList.push({
                                id: ic + '-regular',
                                itemCode: ic,
                                customerCodeLabel: 'Regular',
                                remark: d.regularRemark || '',
                                qty: d.regularQty,
                                unit: unit
                            });
                        }
                    });

                    var orderCount = orderList.length;
                    return Object.assign({}, b, {
                        slipTitle:        b.Slip_Title__c || (b.Karat__c ? b.Karat__c + 'KT' : '') + (b.Color__c ? '-' + b.Color__c : ''),
                        itemCodeList:     itemCodeList,
                        itemDetails:      itemDetails,
                        orderList:        orderList,
                        productionQtyList: productionQtyList,
                        orderCount:       orderCount,
                        showOrders:       false,
                        toggleLabel:      'Show ' + orderCount + ' orders ▾',
                        createdFormatted: b.CreatedDate
                            ? new Date(b.CreatedDate).toLocaleDateString('en-IN',
                                { day: 'numeric', month: 'short', year: 'numeric' })
                            : ''
                    });
                });
            })
            .catch(function() { self.isLoading = false; });
    }
    handleDeleteRemainingBatch() {
        if (!this.deleteBatch) return;

        this.isCompleting = true;
        var self = this;

        deleteRemainingBatch({
            batchId: this.deleteBatch.Id
        })
        .then(function() {
            self.isCompleting = false;
            self.showDeleteConfirmModal = false;
            self.deleteBatch = null;

            self._toast('🗑', 'Batch deleted', 'Remaining production batch removed');
            self._load();
        })
        .catch(function(err) {
            self.isCompleting = false;
            self._toast('❌', 'Delete failed', (err.body && err.body.message) || err.message || '');
        });
    }
    handleOpenRevert(e) {
        var batchId = e.currentTarget.dataset.id;
        this.revertBatch = this.batches.find(function(b) {
            return b.Id === batchId;
        });

        if (!this.revertBatch) return;

        this.showRevertConfirmModal = true;
    }
    get revertBatchTitle() {
        return this.revertBatch
            ? this.revertBatch.Name + ' · ' + this.revertBatch.slipTitle
            : '';
    }
    handleCloseRevertConfirm() {
        this.showRevertConfirmModal = false;
        this.revertBatch = null;
    }

    handleConfirmRevert() {
        if (!this.revertBatch) return;

        this.isReverting = true;
        var self = this;

        revertProductionBatch({
            batchId: this.revertBatch.Id,
            changedBy: this.userName || ''
        })
        .then(function() {
            self.isReverting = false;
            self.showRevertConfirmModal = false;
            self.revertBatch = null;

            self._toast('✅', 'Batch reverted', 'Orders moved back to Bag Generate');

            self.dispatchEvent(new CustomEvent('refreshorders', {
                bubbles: true,
                composed: true
            }));

            self._load();
        })
        .catch(function(err) {
            self.isReverting = false;
            self._toast('❌', 'Error', (err.body && err.body.message) || err.message || '');
        });
    }
    handleSearch(e) { this.searchTerm = e.target.value; }
    handleClearSearch() { this.searchTerm = ''; }

    get filteredBatches() {
        var s = (this.searchTerm || '').toLowerCase();
        if (!s) return this.batches;
        return this.batches.filter(function(b) {
            return (b.Name        || '').toLowerCase().includes(s) ||
                   (b.slipTitle   || '').toLowerCase().includes(s) ||
                   (b.Item_Code__c|| '').toLowerCase().includes(s);
        });
    }

    get hasBatches()       { return this.filteredBatches.length > 0; }
    get activeBatchCount() { return this.batches.length; }
    get totalPcs()         {
        return this.batches.reduce(function(s, b){ return s + (b.Total_Qty__c || 0); }, 0);
    }

    // ── Toggle order list ────────────────────────────────────────
    handleToggleOrders(e) {
        var id = e.currentTarget.dataset.id;
        this.batches = this.batches.map(function(b) {
            if (b.Id !== id) return b;
            var next = !b.showOrders;
            return Object.assign({}, b, {
                showOrders:  next,
                toggleLabel: next
                    ? 'Hide orders ▴'
                    : 'Show ' + b.orderCount + ' orders ▾'
            });
        });
    }

    // ── Open completion modal ────────────────────────────────────
    handleOpenComplete(e) {
        var batchId = e.currentTarget.dataset.id;
        this.activeBatch = this.batches.find(function(b) {
            return b.Id === batchId;
        });

        if (!this.activeBatch) return;

        var itemDetails = this.activeBatch.itemDetails || [];

        var itemCodes = [...new Set(itemDetails.map(function(d) {
            return d.itemCode;
        }).filter(Boolean))];

        if (!itemCodes.length) return;

        this.ciQty = {};
        this.ciInches = {};
        this.ciGrams = {};
        this.ciPair = {};

        var self = this;

        getItemMeasurementTypes({ itemCodes: itemCodes })
            .then(function(types) {
                self.completionItems = itemDetails.map(function(detail, index) {
                    var ic = detail.itemCode || '';
                    var size = detail.size || detail.regularSize || '';
                    var rowKey = ic + '__' + size + '__' + index;
                    var mType = detail.measureType || types[ic] || 'Quantity';
                    var totalQty = Number(detail.totalQty || 0);

                    return {
                        rowKey: rowKey,
                        itemCode: ic,
                        size: size,
                        measureType: mType,
                        measureLabel: self._measureLabel(mType),

                        isQty: mType === 'Quantity',
                        isWeight: mType === 'Weight',
                        isLQ: mType === 'LengthQuantity',
                        isLW: mType === 'LengthWeight',
                        isPair: mType === 'Pair',
                        isQP: mType === 'QuantityPair',
                        isQW: mType === 'QuantityWeight',

                        totalQty: totalQty,

                        qty: '',
                        inches: '',
                        grams: '',
                        pair: '',

                        remainingQty: totalQty,
                        remainingLabel: totalQty,

                        valid: true,
                        rowClass: 'ci-row'
                    };
                });

                self.showCompleteModal = true;
            })
            .catch(function(err) {
                console.error('getItemMeasurementTypes error:', err);
                self._toast('❌', 'Error', 'Unable to open completion screen');
            });
    }
    _measureLabel(mType) {
        if (mType === 'Weight')         return 'Grams';
        if (mType === 'LengthQuantity') return 'Inches + Pieces';
        if (mType === 'LengthWeight')   return 'Inches + Grams';
        if (mType === 'Pair')           return 'Pair';
        if (mType === 'QuantityPair')   return 'Pieces + Pair';
        if (mType === 'QuantityWeight') return 'Pieces + Grams';
        return 'Pieces';
    }
    _unitForType(mType) {
        if (mType === 'LengthWeight')   return 'g/in';
        if (mType === 'Pair')           return 'Pair';
        if (mType === 'QuantityPair')   return 'pcs+Pair';
        if (mType === 'QuantityWeight') return 'pcs+g';
        return 'Pcs';
    }
    handlePairInput(e) {
        // var ic = e.target.dataset.ic;
        var ic = e.target.dataset.key;
        var updated = Object.assign({}, this.ciPair);
        updated[ic] = e.target.value;
        this.ciPair = updated;
        this._syncToItems();
    }

    get activeBatchTitle() {
        return this.activeBatch ? this.activeBatch.slipTitle : '';
    }

    handleCloseComplete()  {
        this.showCompleteModal = false;
        this.activeBatch = null;
    }
    handleCloseConfirm()   { this.showConfirmModal = false; }
    handleBackToForm()     {
        this.showConfirmModal  = false;
        this.showCompleteModal = true;
    }

    // ── Input handlers — tracked in maps (safe inside for:each) ──
    handleQtyInput(e) {
        var key = e.target.dataset.key;
        var updated = Object.assign({}, this.ciQty);
        updated[key] = e.target.value;
        this.ciQty = updated;
        this._syncToItems();
    }

    handleInchesInput(e) {
        var key = e.target.dataset.key;
        var updated = Object.assign({}, this.ciInches);
        updated[key] = e.target.value;
        this.ciInches = updated;
        this._syncToItems();
    }

    handleGramsInput(e) {
        var key = e.target.dataset.key;
        var updated = Object.assign({}, this.ciGrams);
        updated[key] = e.target.value;
        this.ciGrams = updated;
        this._syncToItems();
    }

    handlePairInput(e) {
        var key = e.target.dataset.key;
        var updated = Object.assign({}, this.ciPair);
        updated[key] = e.target.value;
        this.ciPair = updated;
        this._syncToItems();
    }

    // _syncToItems() {
    //     var self = this;
    //     // this.completionItems = this.completionItems.map(function(ci) {
    //     //     return Object.assign({}, ci, {
    //     //         qty:    self.ciQty[ci.rowKey]    !== undefined ? self.ciQty[ci.rowKey]    : ci.qty,
    //     //         inches: self.ciInches[ci.rowKey] !== undefined ? self.ciInches[ci.rowKey] : ci.inches,
    //     //         grams:  self.ciGrams[ci.rowKey]  !== undefined ? self.ciGrams[ci.rowKey]  : ci.grams,
    //     //         pair:   self.ciPair[ci.rowKey]   !== undefined ? self.ciPair[ci.rowKey]   : ci.pair
    //     //     });
    //     // });
    //     this.completionItems = itemDetails.map(function(d) {

    //         var totalQty = Number(d.totalQty || 0);

    //         return {
    //             itemCode: d.itemCode || '',
    //             measureType: d.measureType || 'Quantity',
    //             size: d.size || '',
    //             totalQty: totalQty,

    //             qty: 0,
    //             inches: 0,
    //             grams: 0,
    //             pair: 0,

    //             remainingQty: totalQty,
    //             remainingLabel: totalQty
    //         };
    //     });
    // }
    _syncToItems() {
        var self = this;

        this.completionItems = this.completionItems.map(function(ci) {

            var updated = Object.assign({}, ci, {
                qty:    self.ciQty[ci.rowKey]    !== undefined ? self.ciQty[ci.rowKey]    : ci.qty,
                inches: self.ciInches[ci.rowKey] !== undefined ? self.ciInches[ci.rowKey] : ci.inches,
                grams:  self.ciGrams[ci.rowKey]  !== undefined ? self.ciGrams[ci.rowKey]  : ci.grams,
                pair:   self.ciPair[ci.rowKey]   !== undefined ? self.ciPair[ci.rowKey]   : ci.pair
            });

            var entered = 0;

            if (updated.measureType === 'LengthWeight') {
                entered = Math.max(
                    parseFloat(updated.inches || 0),
                    parseFloat(updated.grams || 0)
                );
            } else if (updated.measureType === 'LengthQuantity') {
                var inchVal = parseFloat(updated.inches || 0);
                var qtyVal  = parseFloat(updated.qty || 0);
                entered = Math.max(inchVal, qtyVal);
            } else if (updated.measureType === 'Weight') {
                entered = parseFloat(updated.grams || 0);
            } else if (updated.measureType === 'Pair') {
                entered = parseFloat(updated.pair || 0);
            } else if (updated.measureType === 'QuantityPair') {

                var qtyVal  = parseFloat(updated.qty || 0);
                var pairVal = parseFloat(updated.pair || 0);

                entered = qtyVal + pairVal;

            } else {
                entered = parseFloat(updated.qty || 0);
            }

            updated.remainingQty = Math.max(
                0,
                parseFloat(updated.totalQty || 0) - entered
            );

            updated.remainingLabel = updated.remainingQty;

            return updated;
        });
    }

    // ── Validate then show confirm ───────────────────────────────   
    // Old code
    // handleProceedToConfirm() {
    //     var valid = true;

    //     this.completionItems = this.completionItems.map(function(ci) {
    //         var ok   = true;
    //         var mType = ci.measureType || 'Quantity';

    //         if (mType === 'Quantity') {
    //             // Pieces must be > 0
    //             if (!ci.qty || parseFloat(ci.qty) <= 0) ok = false;

    //         } else if (mType === 'LengthWeight') {
    //             // At least one of inches or grams must be > 0
    //             var inch = parseFloat(ci.inches) || 0;
    //             var gram = parseFloat(ci.grams)  || 0;
    //             if (inch <= 0 && gram <= 0) ok = false;

    //         } else if (mType === 'Pair') {
    //             // Pair qty must be > 0
    //             if (!ci.pair || parseFloat(ci.pair) <= 0) ok = false;

    //         } else if (mType === 'QuantityPair') {
    //             // Both pieces and pair must be > 0
    //             // ✅ At least ONE of Pieces or Pair must be > 0
    //             var hasPieces = ci.qty  && parseFloat(ci.qty)  > 0;
    //             var hasPair   = ci.pair && parseFloat(ci.pair) > 0;
    //             if (!hasPieces && !hasPair) ok = false;

    //         } else if (mType === 'QuantityWeight') {
    //             // Both pieces and grams must be > 0
    //             // if (!ci.qty   || parseFloat(ci.qty)   <= 0) ok = false;
    //             // if (!ci.grams || parseFloat(ci.grams) <= 0) ok = false;
    //             if (!ci.qty || parseFloat(ci.qty) <= 0) ok = false;
    //         }

    //         if (!ok) valid = false;
    //         return Object.assign({}, ci, {
    //             valid:    ok,
    //             rowClass: ok ? 'ci-row' : 'ci-row ci-invalid'
    //         });
    //     });

    //     if (!valid) {
    //         this._toast('❌', 'Fill all required quantities', 'Check highlighted fields');
    //         return;
    //     }
    //     this.showCompleteModal = false;
    //     this.showConfirmModal  = true;
    // }

    // new code
    handleProceedToConfirm() {
        let hasAnyCompleted = false;
        let valid = true;

        this.completionItems = this.completionItems.map(ci => {
            let ok = true;

            const qty   = parseFloat(ci.qty)    || 0;
            const inch  = parseFloat(ci.inches) || 0;
            const gram  = parseFloat(ci.grams)  || 0;
            const pair  = parseFloat(ci.pair)   || 0;

            const hasValue = qty > 0 || inch > 0 || gram > 0 || pair > 0;

            if (hasValue) {
                hasAnyCompleted = true;

                if (ci.isLW) {
                    ok = inch > 0 && gram > 0;
                }
                if (ci.isLQ) {
                    ok = inch > 0 && qty > 0;
                }
                if (ci.isWeight) {
                    ok = gram > 0;
                }

                if (ci.isQW) {
                    ok = qty > 0;
                    if (ci.grams && gram <= 0) {
                        ok = false;
                    }
                }
                if (ci.isQP) {
                    ok = qty > 0 || pair > 0;
                }
            }

            if (!ok) valid = false;

            return {
                ...ci,
                valid: ok,
                rowClass: ok ? 'ci-row' : 'ci-row ci-invalid'
            };
        });

        if (!hasAnyCompleted) {
            this._toast('❌', 'Enter quantity', 'Enter quantity for at least one item');
            return;
        }

        if (!valid) {
            this._toast('❌', 'Invalid quantity', 'Check highlighted fields');
            return;
        }

        this.showCompleteModal = false;
        this.showConfirmModal  = true;
    }

    // ── Confirm complete ─────────────────────────────────────────
    handleConfirmComplete() {
        if (!this.activeBatch || !this.activeBatch.Id) {
            this._toast('❌', 'Error', 'No active batch selected');
            return;
        }
        var payload = this.completionItems
        .filter(function(ci) {
            return (parseFloat(ci.qty) || 0) > 0 ||
                (parseFloat(ci.inches) || 0) > 0 ||
                (parseFloat(ci.grams) || 0) > 0 ||
                (parseFloat(ci.pair) || 0) > 0;
        })
        .map(function(ci) {
            return {
                itemCode:    ci.itemCode,
                size: ci.size,
                measureType: ci.measureType,
                qty: ci.qty !== '' ? (parseFloat(ci.qty) || 0) : 0,
                inches: ci.inches !== '' ? (parseFloat(ci.inches) || 0) : 0,
                grams: ci.grams !== '' ? (parseFloat(ci.grams) || 0) : 0,
                pair: ci.pair !== '' ? (parseFloat(ci.pair) || 0) : 0
            };
        });
        console.log('PAYLOAD:', JSON.stringify(payload));

        this.isCompleting = true;
        var self = this;
        console.log('this.activeBatch.Id-->',this.activeBatch.Id);
        console.log('payload-->',JSON.stringify(payload));
        console.log('payload-->',this.userName);
        completeBatch({
            batchId:             this.activeBatch.Id,
            completionItemsJson: JSON.stringify(payload),
            changedBy:           this.userName || ''
        })
        .then(function() {
            self.isCompleting     = false;
            self.showConfirmModal = false;
            self.activeBatch      = null;
            self.ciQty    = {};
            self.ciInches = {};
            self.ciGrams  = {};
            self.ciPair   = {};
            self._toast('✅', 'Batch completed', 'Inventory updated');
            self.dispatchEvent(new CustomEvent('batchcompleted', { bubbles: true, composed: true }));
            self.dispatchEvent(new CustomEvent('refreshorders',  { bubbles: true, composed: true }));
            self._load();
        })
        .catch(function(err) {
            self.isCompleting = false;
            self._toast('❌', 'Error', (err.body && err.body.message) || err.message || '');
        });
    }

    _toast(icon, msg, sub) {
        this.dispatchEvent(new CustomEvent('showtoast', { bubbles: true, composed: true,
            detail: { icon, message: msg, subMessage: sub } }));
    }
}