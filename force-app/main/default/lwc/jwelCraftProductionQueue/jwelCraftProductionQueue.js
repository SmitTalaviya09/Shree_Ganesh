// import { LightningElement, track, api } from 'lwc';
// import createProductionBatch   from '@salesforce/apex/JewelryOrderController.createProductionBatch';
// import getPicklistValues       from '@salesforce/apex/JewelryOrderController.getPicklistValues';
// import getItemMeasurementTypes from '@salesforce/apex/JewelryOrderController.getItemMeasurementTypes';
// import getAllOrders from '@salesforce/apex/JewelryOrderController.getAllOrders';

// export default class JwelCraftProductionQueue extends LightningElement {
//     // @api orders   = [];
//     @track orders = [];
//     @api userName = '';
//     @api userRole = '';
//     _poller = null;

//     @track isLoading       = false;
//     @track searchTerm      = '';
//     @track filterColor     = '';
//     @track filterKarat     = '';
//     @track filterOrderDate = '';
//     @track filterDueDate   = '';
//     @track allKaratValues  = [];
//     @track selectedIds     = {};
//     @track showPrintModal  = false;
//     @track allItemCodes    = [];
//     @track slipKarat       = '';
//     @track slipColor       = '';

//     @track slipColumns     = [];
//     @track slipRows        = [];
//     @track slipDraftCells  = {};

//     @track newColCode      = '';
//     @track newColShowPick  = false;
//     @track newColSearch    = '';
//     @track newColFiltered  = [];
//     @track filterCategory = '';
//     @track allCategoryValues = [];
//     @track newColSize = '';

//     connectedCallback() { 
//         this._loadPicklists(); 
//         this._startPolling();
//         console.log('qqqqqq');
//     }
//     disconnectedCallback() {
//         this._stopPolling();
//     }
//     _loadOrders() {
//         var self = this;
//         getAllOrders()
//             .then(function(res) {
//                 var cats = [];
//                 self.orders = (res || []).map(function(o) {
//                     var cat = o.Item_Category__c || '';

//                     if (cat && cats.indexOf(cat) === -1) {
//                         cats.push(cat);
//                     }
//                     return {
//                         id:           o.Id,
//                         code:         o.Order_ID_Ref__c   || '',
//                         customer:     o.Customer_Name__c  || '—',
//                         customerCode: o.Customer_Code__c  || '',
//                         itemCode:     o.Item_Code__c       || '',
//                         color:        o.Color__c           || '',
//                         kar:          o.Karat__c           || '',
//                         size:         o.Size__c            || '—',
//                         qty:          o.Quantity__c        || 0,
//                         qtyUnit:      o.Quantity_Unit__c   || 'Pieces',
//                         fulfilledQty: o.Fulfilled_Qty__c   || 0,
//                         pri:          o.Priority__c        || 'Medium',
//                         status:       o.Current_Stage__c   || '',
//                         due:          o.Order_Date__c      || '',
//                         dueDate:      o.Order_Due_Date__c  || '',
//                         notes:        o.Remark__c          || '',
//                         itemCategory: cat
//                     };
//                     }).sort(function(a, b) {
//                         return (a.itemCode || '').localeCompare(b.itemCode || '', undefined, {
//                             numeric: true,
//                             sensitivity: 'base'
//                         });
//                     });
//                 self.allCategoryValues = cats.sort();
//             })
//             .catch(function(err) {
//                 console.error('Load orders error:', err);
//             });
//     }
//     _startPolling() {
//         var self = this;
//         self._loadOrders();
//         this._poller = setInterval(function() {
//             self._loadOrders(); 
//         }, 60000);
//     }
//     _stopPolling() {
//         if (this._poller) {
//             clearInterval(this._poller);
//             this._poller = null;
//         }
//     }

//     _loadPicklists() {
//         var self = this;
//         getPicklistValues()
//             .then(function(res) {
//                 self.allItemCodes   = res.itemCodes   || [];
//                 self.allKaratValues = res.karatValues || [];
//                 self.newColFiltered = res.itemCodes   || [];
//             })
//             .catch(function() {});
//     }

//     // ── Orders list + filters ──
//     get queueOrders() {
//         var s   = (this.searchTerm  || '').toLowerCase();
//         var col = (this.filterColor || '').toLowerCase();
//         var kar = (this.filterKarat || '').toLowerCase();
//         var od  = this.filterOrderDate || '';
//         var dd  = this.filterDueDate   || '';
//         var cat = (this.filterCategory || '').toLowerCase();

//         return (this.orders || [])
//             .filter(function(o) { return o.status === 'Bag Generate'; })
//             .filter(function(o) {
//                 if (!s) return true;
//                 return (o.code         || '').toLowerCase().includes(s) ||
//                        (o.customer     || '').toLowerCase().includes(s) ||
//                        (o.itemCode     || '').toLowerCase().includes(s) ||
//                        (o.customerCode || '').toLowerCase().includes(s);
//             })
//             .filter(function(o) { return col ? (o.color || '').toLowerCase() === col : true; })
//             .filter(function(o) { return kar ? (o.kar   || '').toLowerCase() === kar : true; })
//             .filter(function(o) {
//                 return cat ? (o.itemCategory || '').toLowerCase().trim() === cat.trim() : true;
//             })
//             .filter(function(o) { return od  ? (o.due   || '').startsWith(od)         : true; })
//             .filter(function(o) { return dd  ? (o.dueDate || '').startsWith(dd)       : true; });
//     }
//     handleNewColSizeInput(e) {
//         this.newColSize = e.target.value;
//     }
//     get queueOrdersMapped() {
//         var self = this;
//         return this.queueOrders.map(function(o) {
//             return Object.assign({}, o, {
//                 isSelected: !!self.selectedIds[o.code],
//                 chkClass:   self.selectedIds[o.code] ? 'chk chk-on' : 'chk',
//                 rowClass:   'order-row' + (self.selectedIds[o.code] ? ' row-selected' : ''),
//                 priClass:   o.pri === 'High' ? 'badge b-h' : o.pri === 'Low' ? 'badge b-l' : 'badge b-m'
//             });
//         });
//     }

//     get totalOrders()   { return this.queueOrders.length; }
//     get hasOrders()     { return this.queueOrders.length > 0; }
//     get selectedCount() {
//         return Object.keys(this.selectedIds)
//             .filter(function(k) { return !!this[k]; }, this.selectedIds).length;
//     }
//     get hasSelected()    { return this.selectedCount > 0; }
//     get selectAllLabel() {
//         return this.selectedCount === this.queueOrders.length && this.queueOrders.length > 0
//             ? 'Deselect All' : 'Select All';
//     }

//     handleSearch(e)          { this.searchTerm      = e.target.value; }
//     handleColorFilter(e)     { this.filterColor     = e.target.value; }
//     handleKaratFilter(e)     { this.filterKarat     = e.target.value; }
//     handleOrderDateFilter(e) { this.filterOrderDate = e.target.value; }
//     handleDueDateFilter(e)   { this.filterDueDate   = e.target.value; }
//     handleClearOrderDate()   { this.filterOrderDate = ''; }
//     handleClearDueDate()     { this.filterDueDate   = ''; }
//     handleCategoryFilter(e) {
//         this.filterCategory = e.target.value;
//     }

//     handleSelectOrder(e) {
//         var code    = e.currentTarget.dataset.code;
//         var updated = Object.assign({}, this.selectedIds);
//         if (updated[code]) { delete updated[code]; } else { updated[code] = true; }
//         this.selectedIds = updated;
//     }

//     handleSelectAll() {
//         var allSel = this.selectedCount === this.queueOrders.length && this.queueOrders.length > 0;
//         if (allSel) { this.selectedIds = {}; return; }
//         var updated = {};
//         this.queueOrders.forEach(function(o) { updated[o.code] = true; });
//         this.selectedIds = updated;
//     }
//     // ✅ Replace this helper function — use it in both handlePrintSelected and handleNewColSelect
//     _unitForType(mType) {
//         if (mType === 'LengthWeight')   return 'g/in';
//         if (mType === 'Pair')           return 'Pair';
//         // if (mType === 'QuantityPair')   return 'pcs+Pair';
//         // if (mType === 'QuantityWeight') return 'pcs+g';
//         return 'Pcs'; // Quantity default
//     }
//     // ── Open slip — build table structure ──
//     handlePrintSelected() {
//         var codes    = Object.keys(this.selectedIds)
//             .filter(function(k) { return !!this[k]; }, this.selectedIds);
//         var selected = this.queueOrders
//             .filter(function(o) { return codes.indexOf(o.code) !== -1; });
//         selected.sort(function(a, b) {
//             var itemCompare = (a.itemCode || '').localeCompare(b.itemCode || '', undefined, {
//                 numeric: true,
//                 sensitivity: 'base'
//             });

//             if (itemCompare !== 0) return itemCompare;

//             return (a.size || '').localeCompare(b.size || '', undefined, {
//                 numeric: true,
//                 sensitivity: 'base'
//             });
//         });
//         if (!selected.length) { this._toast('⚠️', 'No orders selected', ''); return; }

//         // Validate same karat + color
//         var firstKar = selected[0].kar;
//         var firstCol = selected[0].color;
//         var mismatch = selected.find(function(o) {
//             return o.kar !== firstKar || o.color !== firstCol;
//         });
//         if (mismatch) {
//             this._toast('❌', 'Karat/Color mismatch',
//                 'All selected orders must have the same Karat and Color');
//             return;
//         }

//         this.slipKarat = firstKar || '';
//         this.slipColor = firstCol || '';

//         // var itemCodes = [];
//         // selected.forEach(function(o) {
//         //     if (o.itemCode && itemCodes.indexOf(o.itemCode) === -1) {
//         //         itemCodes.push(o.itemCode);
//         //     }
//         // });
//         var itemKeys = [];
//         var itemKeyMap = {};

//         selected.forEach(function(o) {
//             var itemCode = o.itemCode || '';
//             var size = o.size || '';
//             var key = itemCode + '__' + size;

//             if (itemCode && itemKeys.indexOf(key) === -1) {
//                 itemKeys.push(key);
//                 itemKeyMap[key] = {
//                     key: key,
//                     itemCode: itemCode,
//                     size: size
//                 };
//             }
//         });
//         itemKeys.sort(function(a, b) {
//             return a.localeCompare(b, undefined, {
//                 numeric: true,
//                 sensitivity: 'base'
//             });
//         });

//         // Build rows — merge by customerCode
//         var customerMap  = {};
//         var regularCells = {};

//         itemKeys.forEach(function(key) {
//             regularCells[key] = 0;
//         });

//         var regularSizes = {};
//         itemKeys.forEach(function(key) {
//             regularSizes[key] = '';
//         });

//         var regularRemarks = {};
//         itemKeys.forEach(function(key) {
//             regularRemarks[key] = [];
//         });

//         var regularOrderIds = {};
//         itemKeys.forEach(function(key) {
//             regularOrderIds[key] = [];
//         });

//         selected.forEach(function(o) {
//             // var ic  = o.itemCode || '';
//             var ic = (o.itemCode || '') + '__' + (o.size || '');
//             var qty = parseInt(o.qty) || 0;
//             var sz  = o.size || '';

//             if (o.customerCode) {
//                 if (!customerMap[o.customerCode]) {
//                     var emptyCells = {};
//                     var emptySizes = {};
//                     itemKeys.forEach(function(c) {
//                         emptyCells[c] = 0;
//                         emptySizes[c] = '';
//                     });
//                     customerMap[o.customerCode] = {
//                         rowKey:       'cust_' + o.customerCode,
//                         customerCode: o.customerCode,
//                         customer:     o.customer || '',
//                         orderIds:     [],
//                         remarks:      [],
//                         isRegular:    false,
//                         cells:        emptyCells,
//                         sizes:        emptySizes
//                     };
//                 }
//                 customerMap[o.customerCode].cells[ic] =
//                     (customerMap[o.customerCode].cells[ic] || 0) + qty;
//                 if (sz) customerMap[o.customerCode].sizes[ic] = sz;
//                 customerMap[o.customerCode].orderIds.push(o.code);
//                 if (o.notes && customerMap[o.customerCode].remarks.indexOf(o.notes) === -1) {
//                     customerMap[o.customerCode].remarks.push(o.notes);
//                 }
//             } else {
//                 // Regular order — accumulate qty
//                 regularCells[ic] = (regularCells[ic] || 0) + qty;
//                 if (sz) regularSizes[ic] = sz;
//                 if (o.notes && regularRemarks[ic].indexOf(o.notes) === -1) {
//                     regularRemarks[ic].push(o.notes);
//                 }
//                 // FIX: collect order ID into regularOrderIds per item code
//                 if (o.code && ic && regularOrderIds[ic].indexOf(o.code) === -1) {
//                     regularOrderIds[ic].push(o.code);
//                 }
//             }
//         });

//         var customerRows = Object.values(customerMap).map(function(r) {
//             return Object.assign({}, r, { remark: r.remarks.join(' · ') });
//         });

//         // FIX: regularRow now carries regularOrderIds
//         var regularRow = {
//             rowKey:          'regular',
//             customerCode:    '',
//             customer:        'Regular',
//             orderIds:        [],
//             regularOrderIds: regularOrderIds,   // { ic: [orderCode, ...] }
//             regularSizes:    regularSizes,
//             remark:          '',
//             regularRemarks:  regularRemarks,
//             isRegular:       true,
//             cells:           Object.assign({}, regularCells)
//         };

//         this.slipRows       = customerRows.concat([regularRow]);
//         this.slipDraftCells = {};
//         // this.slipColumns    = itemCodes.map(function(ic) { return { itemCode: ic, unit: 'Pcs' }; });
//         this.slipColumns = itemKeys.map(function(key) {
//             return {
//                 key: key,
//                 itemCode: itemKeyMap[key].itemCode,
//                 size: itemKeyMap[key].size,
//                 unit: 'Pcs'
//             };
//         });
//         this.newColCode     = '';
//         this.newColShowPick = false;
//         this.newColSearch   = '';
//         var self = this;
//         this.newColFiltered = this.allItemCodes.filter(function(c) {
//             return self.slipColumns.findIndex(function(col) {
//                 return col.itemCode === c;
//             }) === -1;
//         });

        
//         // getItemMeasurementTypes({ itemCodes: itemCodes })
//         getItemMeasurementTypes({
//             itemCodes: this.slipColumns.map(function(c) {
//                 return c.itemCode;
//             })
//         })
//             // .then(function(map) {
//             //     self.slipColumns = self.slipColumns.map(function(col) {
//             //         var raw  = map[col.itemCode] || 'Quantity';
//             //         // var unit = raw === 'LengthWeight' ? 'g/in' : 'Pcs';
//             //         var unit = self._unitForType(raw);
//             //         return Object.assign({}, col, { unit: unit });
//             //     });
//             // })
//             .then(function(map) {
//                 self.slipColumns = self.slipColumns.map(function(col) {
//                     var mType = map[col.itemCode] || 'Quantity';
//                     return Object.assign({}, col, {
//                         measureType: mType,              // ✅ store raw type
//                         unit:        self._unitForType(mType)
//                     });
//                 });
//             })  
//             .catch(function() {});

//         this.showPrintModal = true;
//     }

//     handleClosePrintModal() { this.showPrintModal = false; }

//     get slipTitle() {
//         return (this.slipKarat || '') +
//                (this.slipKarat && this.slipColor ? ' · ' : '') +
//                (this.slipColor || '');
//     }

//     // ── Slip table getters ──
//     _resolveQty(rowKey, ic, committedQty) {
//         var key   = rowKey + '__' + ic;
//         var draft = this.slipDraftCells[key];
//         return draft !== undefined
//             ? (parseInt(draft) || 0)
//             : (parseInt(committedQty) || 0);
//     }

//     get slipRowsMapped() {
//         var self = this;
//         var cols = this.slipColumns;
//         return this.slipRows.map(function(row) {
//             var cellList = cols.map(function(col) {
//                 // var ic  = col.itemCode;
//                 var ic = col.key;
//                 var qty = self._resolveQty(row.rowKey, ic, row.cells[ic]);
//                 var sz  = row.isRegular
//                 ? (row.regularSizes && row.regularSizes[ic] ? row.regularSizes[ic] : '')
//                 : (row.sizes        && row.sizes[ic]        ? row.sizes[ic]        : '');
//                 // return { itemCode: ic, unit: col.unit, qty: qty,size: sz, key: row.rowKey + '_' + ic };
//                 return {
//                     itemCode: col.itemCode,
//                     size: col.size,
//                     unit: col.unit,
//                     qty: qty,
//                     key: row.rowKey + '_' + ic,
//                     colKey: ic
//                 };
//             });
//             return Object.assign({}, row, {
//                 cellList: cellList,
//                 trClass:  row.isRegular ? 'slip-tr slip-tr-regular' : 'slip-tr'
//             });
//         });
//     }
//     get slipColTotals() {
//         var self = this;
//         var totals = {};

//         this.slipColumns.forEach(function(col) {
//             var key = col.key;
//             totals[key] = self.slipRows.reduce(function(s, row) {
//                 return s + self._resolveQty(row.rowKey, key, row.cells[key]);
//             }, 0);
//         });

//         return totals;
//     }
//     get slipTotalsMapped() {
//         var totals = this.slipColTotals;

//         return this.slipColumns.map(function(col) {
//             return {
//                 itemCode: col.itemCode,
//                 size: col.size,
//                 unit: col.unit,
//                 total: totals[col.key] || 0,
//                 key: 'tot_' + col.key
//             };
//         });
//     }


//     get slipGrandTotal() {
//         return Object.values(this.slipColTotals)
//             .reduce(function(s, v) { return s + v; }, 0);
//     }

//     handleCellInput(e) {
//         var rowKey = e.currentTarget.dataset.rowkey;
//         var ic     = e.currentTarget.dataset.ic;
//         var val    = e.target.value;
//         var key    = rowKey + '__' + ic;
//         var updated = Object.assign({}, this.slipDraftCells);
//         updated[key] = val;
//         this.slipDraftCells = updated;
//     }

//     // ── Add / Remove column ──
//     handleNewColPickFocus()       { this.newColShowPick = true; }
//     handleNewColDropdownClick(e)  { e.stopPropagation(); }

//     handleNewColSearch(e) {
//         var s = (e.target.value || '').toLowerCase();
//         this.newColSearch = e.target.value;
//         var existing = this.slipColumns.map(function(c) { return c.itemCode; });
//         this.newColFiltered = this.allItemCodes
//     .filter(function(c) { return !s || c.toLowerCase().includes(s); });
//         this.newColShowPick = true;
//     }

//     // handleNewColSelect(e) {
//     //     var ic   = e.currentTarget.dataset.value;
//     //     var self = this;
//     //     this.newColCode     = ic;
//     //     this.newColSearch   = ic;
//     //     this.newColShowPick = false;

//     //     getItemMeasurementTypes({ itemCodes: [ic] })
//     //         .then(function(map) {
//     //             var raw  = map[ic] || 'Quantity';
//     //             // var unit = raw === 'LengthWeight' ? 'g/in' : 'Pcs';
//     //             var unit = self._unitForType(raw);
//     //             self.slipColumns = self.slipColumns.concat([{ itemCode: ic,measureType: mType, unit: unit }]);
//     //             self.slipRows = self.slipRows.map(function(row) {
//     //                 var newCells = Object.assign({}, row.cells);
//     //                 newCells[ic] = 0;
//     //                 // FIX: also add empty regularOrderIds entry for new column
//     //                 var newRegOids = Object.assign({}, row.regularOrderIds || {});
//     //                 if (row.isRegular) newRegOids[ic] = newRegOids[ic] || [];
//     //                 return Object.assign({}, row, { cells: newCells, regularOrderIds: newRegOids });
//     //             });
//     //             self.newColCode     = '';
//     //             self.newColSearch   = '';
//     //             self.newColFiltered = self.allItemCodes.filter(function(c) {
//     //                 return self.slipColumns.findIndex(function(col) {
//     //                     return col.itemCode === c;
//     //                 }) === -1;
//     //             });
//     //         })
//     //         .catch(function() { self._toast('❌', 'Could not fetch unit for item', ic); });
//     // }
//     handleNewColSelect(e) {
//         if (!this.newColSize || !this.newColSize.trim()) {
//             this._toast('⚠️', 'Size required', 'Please enter size before adding item');
//             return;
//         }
//         var ic   = e.currentTarget.dataset.value;
//         var self = this;
//         this.newColCode     = ic;
//         this.newColSearch   = ic;
//         this.newColShowPick = false;

//         getItemMeasurementTypes({ itemCodes: [ic] })
//             .then(function(map) {
//                 var raw  = map[ic] || 'Quantity';          // ✅ raw = the type string
//                 var unit = self._unitForType(raw);

//                 var size = (self.newColSize || '').trim();
//                 var key = ic + '__' + size;

//                 self.slipColumns = self.slipColumns.concat([{
//                     key: key,
//                     itemCode: ic,
//                     size: size,
//                     measureType: raw,
//                     unit: unit
//                 }]);

//                 self.slipRows = self.slipRows.map(function(row) {
//                     var newCells   = Object.assign({}, row.cells);
//                     var newRegOids = Object.assign({}, row.regularOrderIds || {});
//                     newCells[key] = 0;
//                     if (row.isRegular) newRegOids[key] = newRegOids[key] || [];
//                     return Object.assign({}, row, { cells: newCells, regularOrderIds: newRegOids });
//                 });
//                 self.newColSize = '';
//                 self.newColCode     = '';
//                 self.newColSearch   = '';
//                 self.newColFiltered = self.allItemCodes.filter(function(c) {
//                     return self.slipColumns.findIndex(function(col) {
//                         return col.itemCode === c;
//                     }) === -1;
//                 });
//             })
//             .catch(function(err) {
//                 self._toast('❌', 'Could not fetch unit for item', ic);
//             });
//     }

//     get newColLabel()      { return this.newColCode || 'Select item…'; }
//     get newColLabelClass() {
//         return this.newColCode ? 'pick-val pick-selected' : 'pick-val pick-placeholder';
//     }
//     get newColHasOptions() { return this.newColFiltered.length > 0; }

//     handleRemoveColumn(e) {
//         var key = e.currentTarget.dataset.ic;
//         var self = this;

//         this.slipColumns = this.slipColumns.filter(function(c) {
//             return c.key !== key;
//         });

//         this.slipRows = this.slipRows.map(function(row) {
//             var newCells = Object.assign({}, row.cells);
//             var newRegOids = Object.assign({}, row.regularOrderIds || {});

//             delete newCells[key];
//             delete newRegOids[key];

//             return Object.assign({}, row, {
//                 cells: newCells,
//                 regularOrderIds: newRegOids
//             });
//         });

//         var updated = {};
//         var suffix = '__' + key;

//         Object.keys(this.slipDraftCells).forEach(function(k) {
//             if (!k.endsWith(suffix)) {
//                 updated[k] = self.slipDraftCells[k];
//             }
//         });

//         this.slipDraftCells = updated;

//         this.newColFiltered = this.allItemCodes.filter(function(c) {
//             return self.slipColumns.findIndex(function(col) {
//                 return col.itemCode === c;
//             }) === -1;
//         });
//     }

//     // ── Confirm & create batch ──
//     // handleConfirmPrint() {
//     //     var self        = this;
//     //     var allOrderIds = [];
//     //     var itemDetails = [];
//     //     var grandTotal  = 0;
//     //     var totals      = this.slipColTotals;
//     //     var cellSz = (row.sizes && row.sizes[ic]) ? row.sizes[ic] : '';

//     //     this.slipColumns.forEach(function(col) {
//     //         var ic            = col.itemCode;
//     //         var custLines     = [];
//     //         var regularQty    = 0;
//     //         var regularRemark = '';

//     //         self.slipRows.forEach(function(row) {
//     //             var qty = self._resolveQty(row.rowKey, ic, row.cells[ic]);
//     //             if (qty === 0) return;

//     //             if (row.isRegular) {
//     //                 regularQty += qty;
//     //                 regularRemark = (row.regularRemarks && row.regularRemarks[ic])
//     //                     ? row.regularRemarks[ic].join(' · ') : '';

//     //                 // FIX: collect order IDs from regular orders for this item code
//     //                 var regIds = (row.regularOrderIds && row.regularOrderIds[ic]) || [];
//     //                 regIds.forEach(function(oid) {
//     //                     if (oid && allOrderIds.indexOf(oid) === -1) {
//     //                         allOrderIds.push(oid);
//     //                     }
//     //                 });

//     //             } else {
//     //                 custLines.push({
//     //                     customerCode: row.customerCode,
//     //                     qty:          qty,
//     //                     size:         cellSz,
//     //                     remark:       row.remark || '',
//     //                     orderId:      row.orderIds[0] || ''
//     //                 });
//     //                 (row.orderIds || []).forEach(function(oid) {
//     //                     if (oid && allOrderIds.indexOf(oid) === -1) {
//     //                         allOrderIds.push(oid);
//     //                     }
//     //                 });
//     //             }
//     //         });

//     //         var totalQty = totals[ic] || 0;
//     //         grandTotal  += totalQty;
//     //         var regRow      = self.slipRows.find(function(r) { return r.isRegular; });
//     //         var regularSize = regRow && regRow.regularSizes && regRow.regularSizes[ic]
//     //             ? regRow.regularSizes[ic] : '';

//     //         itemDetails.push({
//     //             itemCode:      ic,
//     //             custLines:     custLines,
//     //             regularQty:    regularQty,
//     //             regularRemark: regularRemark,
//     //             regularSize:   regularSize,
//     //             totalQty:      totalQty,
//     //             unit:          col.unit,
//     //             measureType:   col.measureType || 'Quantity',
//     //             orderIds:      custLines.map(function(l) { return l.orderId; })
//     //         });
//     //     });

//     //     if (grandTotal === 0) {
//     //         this._toast('⚠️', 'Nothing to print', 'All quantities are zero'); return;
//     //     }

//     //     var batchData = {
//     //         slipTitle:   this.slipTitle,
//     //         color:       this.slipColor,
//     //         karat:       this.slipKarat,
//     //         totalQty:    grandTotal,
//     //         orderIds:    allOrderIds,   // now includes regular order IDs
//     //         itemDetails: itemDetails
//     //     };

//     //     this.isLoading = true;
//     //     var self = this;

//     //     createProductionBatch({ batchData: batchData, changedBy: this.userName || '' })
//     //         .then(function(result) {
//     //             self.isLoading      = false;
//     //             self.showPrintModal = false;
//     //             self.selectedIds    = {};
//     //             self.slipDraftCells = {};
//     //             self.slipRows       = [];
//     //             self.slipColumns    = [];
//     //             var batchId   = result.id   || '';
//     //             var batchName = result.name || '';
//     //             self._openPrintWindow(batchId);
//     //             self._toast('✅', 'Batch created · Slip opening', batchName);
//     //             self.dispatchEvent(new CustomEvent('batchcreated', {
//     //                 bubbles: true, composed: true,
//     //                 detail: { batchNumbers: [batchName] }
//     //             }));
//     //             self.dispatchEvent(new CustomEvent('refreshorders', {
//     //                 bubbles: true, composed: true
//     //             }));
//     //             self._loadOrders();
//     //         })
//     //         .catch(function(err) {
//     //             self.isLoading = false;
//     //             self._toast('❌', 'Error', (err.body && err.body.message) || err.message || '');
//     //         });
//     // }
//     handleConfirmPrint() {
//         var self        = this;
//         var allOrderIds = [];
//         var itemDetails = [];
//         var grandTotal  = 0;
//         var totals      = this.slipColTotals;

//         // ✅ REMOVED: var cellSz = ... (was declared outside loop — wrong)

//         this.slipColumns.forEach(function(col) {
//             // var ic            = col.itemCode;
//             var ic = col.key;
//             var itemCode = col.itemCode;
//             var custLines     = [];
//             var regularQty    = 0;
//             var regularRemark = '';

//             self.slipRows.forEach(function(row) {
//                 var qty = self._resolveQty(row.rowKey, ic, row.cells[ic]);
//                 if (qty === 0) return;

//                 if (row.isRegular) {
//                     regularQty += qty;
//                     regularRemark = (row.regularRemarks && row.regularRemarks[ic])
//                         ? row.regularRemarks[ic].join(' · ') : '';

//                     var regIds = (row.regularOrderIds && row.regularOrderIds[ic]) || [];
//                     regIds.forEach(function(oid) {
//                         if (oid && allOrderIds.indexOf(oid) === -1) {
//                             allOrderIds.push(oid);
//                         }
//                     });

//                 } else {
//                     // ✅ FIXED — cellSz now correctly inside loop where row is defined
//                     var cellSz = (row.sizes && row.sizes[ic]) ? row.sizes[ic] : '';

//                     custLines.push({
//                         customerCode: row.customerCode,
//                         qty:          qty,
//                         size:         cellSz || col.size || '',        // ✅ now has correct value
//                         remark:       row.remark || '',
//                         orderId:      row.orderIds[0] || ''
//                     });

//                     (row.orderIds || []).forEach(function(oid) {
//                         if (oid && allOrderIds.indexOf(oid) === -1) {
//                             allOrderIds.push(oid);
//                         }
//                     });
//                 }
//             });

//             var totalQty    = totals[ic] || 0;
//             grandTotal     += totalQty;

//             // ✅ regularSize also correctly resolved here
//             var regRow      = self.slipRows.find(function(r) { return r.isRegular; });
//             var regularSize = regRow && regRow.regularSizes && regRow.regularSizes[ic]
//                 ? regRow.regularSizes[ic] 
//                 : (col.size || '');

//             itemDetails.push({
//                 itemCode: itemCode,
//                 size: col.size  || '',
//                 custLines:     custLines,
//                 regularQty:    regularQty,
//                 regularRemark: regularRemark,
//                 regularSize:   regularSize,   // ✅ correct
//                 totalQty:      totalQty,
//                 unit:          col.unit,
//                 measureType:   col.measureType || 'Quantity',
//                 orderIds:      custLines.map(function(l) { return l.orderId; })
//             });
//         });

//         if (grandTotal === 0) {
//             this._toast('⚠️', 'Nothing to print', 'All quantities are zero');
//             return;
//         }

//         var batchData = {
//             slipTitle:   this.slipTitle,
//             color:       this.slipColor,
//             karat:       this.slipKarat,
//             totalQty:    grandTotal,
//             orderIds:    allOrderIds,
//             itemDetails: itemDetails
//         };

//         this.isLoading = true;

//         createProductionBatch({ batchData: batchData, changedBy: this.userName || '' })
//             .then(function(result) {
//                 self.isLoading      = false;
//                 self.showPrintModal = false;
//                 self.selectedIds    = {};
//                 self.slipDraftCells = {};
//                 self.slipRows       = [];
//                 self.slipColumns    = [];
//                 var batchId   = result.id   || '';
//                 var batchName = result.name || '';
//                 self._openPrintWindow(batchId);
//                 self._toast('✅', 'Batch created · Slip opening', batchName);
//                 self.dispatchEvent(new CustomEvent('batchcreated', {
//                     bubbles: true, composed: true,
//                     detail: { batchNumbers: [batchName] }
//                 }));
//                 self.dispatchEvent(new CustomEvent('refreshorders', {
//                     bubbles: true, composed: true
//                 }));
//                 self._loadOrders();
//             })
//             .catch(function(err) {
//                 self.isLoading = false;
//                 self._toast('❌', 'Error', (err.body && err.body.message) || err.message || '');
//             });
//     }

//     _openPrintWindow(batchId) {
//         if (!batchId) { this._toast('⚠️', 'Cannot open slip', 'No batch ID returned'); return; }
//         var url = '/apex/JwelCraftProductionSlip?batchId=' + batchId
//                 + '&title=' + encodeURIComponent(this.slipTitle);
//         window.open(url, '_blank', 'width=700,height=600,toolbar=0,menubar=0,location=0');
//     }

//     _toast(icon, msg, sub) {
//         this.dispatchEvent(new CustomEvent('showtoast', {
//             bubbles: true, composed: true,
//             detail: { icon, message: msg, subMessage: sub }
//         }));
//     }
// }
import { LightningElement, track, api } from 'lwc';
import createProductionBatch   from '@salesforce/apex/JewelryOrderController.createProductionBatch';
import getPicklistValues       from '@salesforce/apex/JewelryOrderController.getPicklistValues';
import getItemMeasurementTypes from '@salesforce/apex/JewelryOrderController.getItemMeasurementTypes';
import getAllOrders from '@salesforce/apex/JewelryOrderController.getAllOrders';
import getItemSizeMap from '@salesforce/apex/JewelryOrderController.getItemSizeMap';

export default class JwelCraftProductionQueue extends LightningElement {
    // @api orders   = [];
    @track orders = [];
    @api userName = '';
    @api userRole = '';
    _poller = null;

    @track isLoading       = false;
    @track searchTerm      = '';
    @track filterColor     = '';
    @track filterKarat     = '';
    @track filterOrderDate = '';
    @track filterDueDate   = '';
    @track allKaratValues  = [];
    @track selectedIds     = {};
    @track showPrintModal  = false;
    @track allItemCodes    = [];
    @track slipKarat       = '';
    @track slipColor       = '';

    @track slipColumns     = [];
    @track slipRows        = [];
    @track slipDraftCells  = {};

    @track newColCode      = '';
    @track newColShowPick  = false;
    @track newColSearch    = '';
    @track newColFiltered  = [];
    @track filterCategory = '';
    @track allCategoryValues = [];
    @track newColSize = '';
    @track itemSizeMap = {};
    @track newColSizeError = '';
    @track newColSizeAutoFilled = false;

    connectedCallback() { 
        this._loadPicklists(); 
        this._startPolling();
        console.log('qqqqqq');
    }
    disconnectedCallback() {
        this._stopPolling();
    }
    _loadOrders() {
        var self = this;
        getAllOrders()
            .then(function(res) {
                var cats = [];
                self.orders = (res || []).map(function(o) {
                    var cat = o.Item_Category__c || '';

                    if (cat && cats.indexOf(cat) === -1) {
                        cats.push(cat);
                    }
                    return {
                        id:           o.Id,
                        code:         o.Order_ID_Ref__c   || '',
                        customer:     o.Customer_Name__c  || '—',
                        customerCode: o.Customer_Code__c  || '',
                        itemCode:     o.Item_Code__c       || '',
                        color:        o.Color__c           || '',
                        kar:          o.Karat__c           || '',
                        size:         o.Size__c            || '—',
                        qty:          o.Quantity__c        || 0,
                        qtyUnit:      o.Quantity_Unit__c   || 'Pieces',
                        fulfilledQty: o.Fulfilled_Qty__c   || 0,
                        pri:          o.Priority__c        || 'Medium',
                        status:       o.Current_Stage__c   || '',
                        due:          o.Order_Date__c      || '',
                        dueDate:      o.Order_Due_Date__c  || '',
                        notes:        o.Remark__c          || '',
                        itemCategory: cat
                    };
                    }).sort(function(a, b) {
                        return (a.itemCode || '').localeCompare(b.itemCode || '', undefined, {
                            numeric: true,
                            sensitivity: 'base'
                        });
                    });
                self.allCategoryValues = cats.sort();
            })
            .catch(function(err) {
                console.error('Load orders error:', err);
            });
    }
    _startPolling() {
        var self = this;
        self._loadOrders();
        this._poller = setInterval(function() {
            self._loadOrders(); 
        }, 60000);
    }
    _stopPolling() {
        if (this._poller) {
            clearInterval(this._poller);
            this._poller = null;
        }
    }

    _loadPicklists() {
        var self = this;
        getPicklistValues()
            .then(function(res) {
                self.allItemCodes   = res.itemCodes   || [];
                self.allKaratValues = res.karatValues || [];
                self.newColFiltered = res.itemCodes   || [];
            })
            .catch(function() {});
        getItemSizeMap()
            .then(function(res) { self.itemSizeMap = res || {}; })
            .catch(function() {});
    }

    // ── Orders list + filters ──
    get queueOrders() {
        var s   = (this.searchTerm  || '').toLowerCase();
        var col = (this.filterColor || '').toLowerCase();
        var kar = (this.filterKarat || '').toLowerCase();
        var od  = this.filterOrderDate || '';
        var dd  = this.filterDueDate   || '';
        var cat = (this.filterCategory || '').toLowerCase();

        return (this.orders || [])
            .filter(function(o) { return o.status === 'Bag Generate'; })
            .filter(function(o) {
                if (!s) return true;
                return (o.code         || '').toLowerCase().includes(s) ||
                       (o.customer     || '').toLowerCase().includes(s) ||
                       (o.itemCode     || '').toLowerCase().includes(s) ||
                       (o.customerCode || '').toLowerCase().includes(s);
            })
            .filter(function(o) { return col ? (o.color || '').toLowerCase() === col : true; })
            .filter(function(o) { return kar ? (o.kar   || '').toLowerCase() === kar : true; })
            .filter(function(o) {
                return cat ? (o.itemCategory || '').toLowerCase().trim() === cat.trim() : true;
            })
            .filter(function(o) { return od  ? (o.due   || '').startsWith(od)         : true; })
            .filter(function(o) { return dd  ? (o.dueDate || '').startsWith(dd)       : true; });
    }
    // handleNewColSizeInput(e) {
    //     this.newColSize           = e.target.value;
    //     this.newColSizeAutoFilled = false;
    //     this.newColSizeError      = this.newColSize.trim() ? '' : this.newColSizeError;
    // }
    handleNewColSizeInput(e) {
        this.newColSize           = e.target.value;
        this.newColSizeAutoFilled = false;
        // Clear error while user is still typing
        this.newColSizeError      = '';
    }

    handleNewColSizeBlur(e) {
        var val = (e.target.value || '').trim();
        if (!val) { this.newColSizeError = ''; return; }

        var pattern = /^\d+\.\d\s+mm$/i;
        if (!pattern.test(val)) {
            this.newColSizeError = 'Allowed: 5.0 mm, 5.1 mm, 21.0 mm';
        } else {
            this.newColSizeError = '';
        }
    }
    get queueOrdersMapped() {
        var self = this;
        return this.queueOrders.map(function(o) {
            return Object.assign({}, o, {
                isSelected: !!self.selectedIds[o.code],
                chkClass:   self.selectedIds[o.code] ? 'chk chk-on' : 'chk',
                rowClass:   'order-row' + (self.selectedIds[o.code] ? ' row-selected' : ''),
                priClass:   o.pri === 'High' ? 'badge b-h' : o.pri === 'Low' ? 'badge b-l' : 'badge b-m'
            });
        });
    }

    get totalOrders()   { return this.queueOrders.length; }
    get hasOrders()     { return this.queueOrders.length > 0; }
    get selectedCount() {
        return Object.keys(this.selectedIds)
            .filter(function(k) { return !!this[k]; }, this.selectedIds).length;
    }
    get hasSelected()    { return this.selectedCount > 0; }
    get selectAllLabel() {
        return this.selectedCount === this.queueOrders.length && this.queueOrders.length > 0
            ? 'Deselect All' : 'Select All';
    }

    handleSearch(e)          { this.searchTerm      = e.target.value; }
    handleColorFilter(e)     { this.filterColor     = e.target.value; }
    handleKaratFilter(e)     { this.filterKarat     = e.target.value; }
    handleOrderDateFilter(e) { this.filterOrderDate = e.target.value; }
    handleDueDateFilter(e)   { this.filterDueDate   = e.target.value; }
    handleClearOrderDate()   { this.filterOrderDate = ''; }
    handleClearDueDate()     { this.filterDueDate   = ''; }
    handleCategoryFilter(e) {
        this.filterCategory = e.target.value;
    }

    handleSelectOrder(e) {
        var code    = e.currentTarget.dataset.code;
        var updated = Object.assign({}, this.selectedIds);
        if (updated[code]) { delete updated[code]; } else { updated[code] = true; }
        this.selectedIds = updated;
    }

    handleSelectAll() {
        var allSel = this.selectedCount === this.queueOrders.length && this.queueOrders.length > 0;
        if (allSel) { this.selectedIds = {}; return; }
        var updated = {};
        this.queueOrders.forEach(function(o) { updated[o.code] = true; });
        this.selectedIds = updated;
    }
    // ✅ Replace this helper function — use it in both handlePrintSelected and handleNewColSelect
    _unitForType(mType) {
        if (mType === 'LengthWeight')   return 'g/in';
        if (mType === 'Pair')           return 'Pair';
        if (mType === 'Weight')          return 'g';
        // if (mType === 'QuantityPair')   return 'pcs+Pair';
        // if (mType === 'QuantityWeight') return 'pcs+g';
        return 'Pcs'; // Quantity default
    }
    // ── Open slip — build table structure ──
    handlePrintSelected() {
        var codes    = Object.keys(this.selectedIds)
            .filter(function(k) { return !!this[k]; }, this.selectedIds);
        var selected = this.queueOrders
            .filter(function(o) { return codes.indexOf(o.code) !== -1; });
        selected.sort(function(a, b) {
            var itemCompare = (a.itemCode || '').localeCompare(b.itemCode || '', undefined, {
                numeric: true,
                sensitivity: 'base'
            });

            if (itemCompare !== 0) return itemCompare;

            return (a.size || '').localeCompare(b.size || '', undefined, {
                numeric: true,
                sensitivity: 'base'
            });
        });
        if (!selected.length) { this._toast('⚠️', 'No orders selected', ''); return; }

        // Validate same karat + color
        var firstKar = selected[0].kar;
        var firstCol = selected[0].color;
        var mismatch = selected.find(function(o) {
            return o.kar !== firstKar || o.color !== firstCol;
        });
        if (mismatch) {
            this._toast('❌', 'Karat/Color mismatch',
                'All selected orders must have the same Karat and Color');
            return;
        }

        this.slipKarat = firstKar || '';
        this.slipColor = firstCol || '';

        // var itemCodes = [];
        // selected.forEach(function(o) {
        //     if (o.itemCode && itemCodes.indexOf(o.itemCode) === -1) {
        //         itemCodes.push(o.itemCode);
        //     }
        // });
        var itemKeys = [];
        var itemKeyMap = {};

        selected.forEach(function(o) {
            var itemCode = o.itemCode || '';
            var size = o.size || '';
            var key = itemCode + '__' + size;

            if (itemCode && itemKeys.indexOf(key) === -1) {
                itemKeys.push(key);
                itemKeyMap[key] = {
                    key: key,
                    itemCode: itemCode,
                    size: size
                };
            }
        });
        itemKeys.sort(function(a, b) {
            return a.localeCompare(b, undefined, {
                numeric: true,
                sensitivity: 'base'
            });
        });

        // Build rows — merge by customerCode
        var customerMap  = {};
        var regularCells = {};

        itemKeys.forEach(function(key) {
            regularCells[key] = 0;
        });

        var regularSizes = {};
        itemKeys.forEach(function(key) {
            regularSizes[key] = '';
        });

        var regularRemarks = {};
        itemKeys.forEach(function(key) {
            regularRemarks[key] = [];
        });

        var regularOrderIds = {};
        itemKeys.forEach(function(key) {
            regularOrderIds[key] = [];
        });

        selected.forEach(function(o) {
            // var ic  = o.itemCode || '';
            var ic = (o.itemCode || '') + '__' + (o.size || '');
            var qty = parseInt(o.qty) || 0;
            var sz  = o.size || '';

            if (o.customerCode) {
                if (!customerMap[o.customerCode]) {
                    var emptyCells = {};
                    var emptySizes = {};
                    itemKeys.forEach(function(c) {
                        emptyCells[c] = 0;
                        emptySizes[c] = '';
                    });
                    customerMap[o.customerCode] = {
                        rowKey:       'cust_' + o.customerCode,
                        customerCode: o.customerCode,
                        customer:     o.customer || '',
                        orderIds:     [],
                        remarks:      [],
                        isRegular:    false,
                        cells:        emptyCells,
                        sizes:        emptySizes
                    };
                }
                customerMap[o.customerCode].cells[ic] =
                    (customerMap[o.customerCode].cells[ic] || 0) + qty;
                if (sz) customerMap[o.customerCode].sizes[ic] = sz;
                customerMap[o.customerCode].orderIds.push(o.code);
                if (o.notes && customerMap[o.customerCode].remarks.indexOf(o.notes) === -1) {
                    customerMap[o.customerCode].remarks.push(o.notes);
                }
            } else {
                // Regular order — accumulate qty
                regularCells[ic] = (regularCells[ic] || 0) + qty;
                if (sz) regularSizes[ic] = sz;
                if (o.notes && regularRemarks[ic].indexOf(o.notes) === -1) {
                    regularRemarks[ic].push(o.notes);
                }
                // FIX: collect order ID into regularOrderIds per item code
                if (o.code && ic && regularOrderIds[ic].indexOf(o.code) === -1) {
                    regularOrderIds[ic].push(o.code);
                }
            }
        });

        var customerRows = Object.values(customerMap).map(function(r) {
            return Object.assign({}, r, { remark: r.remarks.join(' · ') });
        });

        // FIX: regularRow now carries regularOrderIds
        var regularRow = {
            rowKey:          'regular',
            customerCode:    '',
            customer:        'Regular',
            orderIds:        [],
            regularOrderIds: regularOrderIds,   // { ic: [orderCode, ...] }
            regularSizes:    regularSizes,
            remark:          '',
            regularRemarks:  regularRemarks,
            isRegular:       true,
            cells:           Object.assign({}, regularCells)
        };

        this.slipRows       = customerRows.concat([regularRow]);
        this.slipDraftCells = {};
        // this.slipColumns    = itemCodes.map(function(ic) { return { itemCode: ic, unit: 'Pcs' }; });
        this.slipColumns = itemKeys.map(function(key) {
            return {
                key: key,
                itemCode: itemKeyMap[key].itemCode,
                size: itemKeyMap[key].size,
                unit: 'Pcs'
            };
        });
        this.newColCode     = '';
        this.newColShowPick = false;
        this.newColSearch   = '';
        var self = this;
        this.newColFiltered = this.allItemCodes.filter(function(c) {
            return self.slipColumns.findIndex(function(col) {
                return col.itemCode === c;
            }) === -1;
        });

        
        // getItemMeasurementTypes({ itemCodes: itemCodes })
        getItemMeasurementTypes({
            itemCodes: this.slipColumns.map(function(c) {
                return c.itemCode;
            })
        })
            // .then(function(map) {
            //     self.slipColumns = self.slipColumns.map(function(col) {
            //         var raw  = map[col.itemCode] || 'Quantity';
            //         // var unit = raw === 'LengthWeight' ? 'g/in' : 'Pcs';
            //         var unit = self._unitForType(raw);
            //         return Object.assign({}, col, { unit: unit });
            //     });
            // })
            .then(function(map) {
                self.slipColumns = self.slipColumns.map(function(col) {
                    var mType = map[col.itemCode] || 'Quantity';
                    return Object.assign({}, col, {
                        measureType: mType,              // ✅ store raw type
                        unit:        self._unitForType(mType)
                    });
                });
            })  
            .catch(function() {});

        this.showPrintModal = true;
    }

    handleClosePrintModal() { this.showPrintModal = false; }

    get slipTitle() {
        return (this.slipKarat || '') +
               (this.slipKarat && this.slipColor ? ' · ' : '') +
               (this.slipColor || '');
    }

    // ── Slip table getters ──
    _resolveQty(rowKey, ic, committedQty) {
        var key   = rowKey + '__' + ic;
        var draft = this.slipDraftCells[key];
        return draft !== undefined
            ? (parseInt(draft) || 0)
            : (parseInt(committedQty) || 0);
    }

    get slipRowsMapped() {
        var self = this;
        var cols = this.slipColumns;
        return this.slipRows.map(function(row) {
            var cellList = cols.map(function(col) {
                // var ic  = col.itemCode;
                var ic = col.key;
                var qty = self._resolveQty(row.rowKey, ic, row.cells[ic]);
                var sz  = row.isRegular
                ? (row.regularSizes && row.regularSizes[ic] ? row.regularSizes[ic] : '')
                : (row.sizes        && row.sizes[ic]        ? row.sizes[ic]        : '');
                // return { itemCode: ic, unit: col.unit, qty: qty,size: sz, key: row.rowKey + '_' + ic };
                return {
                    itemCode: col.itemCode,
                    size: col.size,
                    unit: col.unit,
                    qty: qty,
                    key: row.rowKey + '_' + ic,
                    colKey: ic
                };
            });
            return Object.assign({}, row, {
                cellList: cellList,
                trClass:  row.isRegular ? 'slip-tr slip-tr-regular' : 'slip-tr'
            });
        });
    }
    get slipColTotals() {
        var self = this;
        var totals = {};

        this.slipColumns.forEach(function(col) {
            var key = col.key;
            totals[key] = self.slipRows.reduce(function(s, row) {
                return s + self._resolveQty(row.rowKey, key, row.cells[key]);
            }, 0);
        });

        return totals;
    }
    get slipTotalsMapped() {
        var totals = this.slipColTotals;

        return this.slipColumns.map(function(col) {
            return {
                itemCode: col.itemCode,
                size: col.size,
                unit: col.unit,
                total: totals[col.key] || 0,
                key: 'tot_' + col.key
            };
        });
    }


    get slipGrandTotal() {
        return Object.values(this.slipColTotals)
            .reduce(function(s, v) { return s + v; }, 0);
    }

    handleCellInput(e) {
        var rowKey = e.currentTarget.dataset.rowkey;
        var ic     = e.currentTarget.dataset.ic;
        var val    = e.target.value;
        var key    = rowKey + '__' + ic;
        var updated = Object.assign({}, this.slipDraftCells);
        updated[key] = val;
        this.slipDraftCells = updated;
    }

    // ── Add / Remove column ──
    handleNewColPickFocus() {
        this.newColShowPick   = true;
        this.newColSizeError  = '';
    }
    get canAddColumn() {
        return !!(this.newColCode && this.newColSize && this.newColSize.trim());
    }
    handleNewColDropdownClick(e)  { e.stopPropagation(); }

    handleNewColSearch(e) {
        var s = (e.target.value || '').toLowerCase();
        this.newColSearch = e.target.value;
        var existing = this.slipColumns.map(function(c) { return c.itemCode; });
        this.newColFiltered = this.allItemCodes
    .filter(function(c) { return !s || c.toLowerCase().includes(s); });
        this.newColShowPick = true;
    }

    // handleNewColSelect(e) {
    //     var ic   = e.currentTarget.dataset.value;
    //     var self = this;
    //     this.newColCode     = ic;
    //     this.newColSearch   = ic;
    //     this.newColShowPick = false;

    //     getItemMeasurementTypes({ itemCodes: [ic] })
    //         .then(function(map) {
    //             var raw  = map[ic] || 'Quantity';
    //             // var unit = raw === 'LengthWeight' ? 'g/in' : 'Pcs';
    //             var unit = self._unitForType(raw);
    //             self.slipColumns = self.slipColumns.concat([{ itemCode: ic,measureType: mType, unit: unit }]);
    //             self.slipRows = self.slipRows.map(function(row) {
    //                 var newCells = Object.assign({}, row.cells);
    //                 newCells[ic] = 0;
    //                 // FIX: also add empty regularOrderIds entry for new column
    //                 var newRegOids = Object.assign({}, row.regularOrderIds || {});
    //                 if (row.isRegular) newRegOids[ic] = newRegOids[ic] || [];
    //                 return Object.assign({}, row, { cells: newCells, regularOrderIds: newRegOids });
    //             });
    //             self.newColCode     = '';
    //             self.newColSearch   = '';
    //             self.newColFiltered = self.allItemCodes.filter(function(c) {
    //                 return self.slipColumns.findIndex(function(col) {
    //                     return col.itemCode === c;
    //                 }) === -1;
    //             });
    //         })
    //         .catch(function() { self._toast('❌', 'Could not fetch unit for item', ic); });
    // }
    handleNewColSelect(e) {
    var ic   = e.currentTarget.dataset.value;
    var self = this;
    this.newColCode      = ic;
    this.newColSearch    = ic;
    this.newColShowPick  = false;
    this.newColSizeError = '';

    var autoSize = this.itemSizeMap[ic] || '';
    if (autoSize) {
        this.newColSize           = autoSize;
        this.newColSizeAutoFilled = true;
        // Auto-add immediately since we have size
        this._addColumnWithItem(ic, autoSize);
    } else {
        this.newColSize           = '';
        this.newColSizeAutoFilled = false;
        this.newColSizeError      = 'No size configured for "' + ic + '". Enter size and click ＋ Add.';
    }
}

handleAddColumnManual() {
    if (!this.newColCode) {
        this._toast('⚠️', 'Select an item first', '');
        return;
    }
    var val = (this.newColSize || '').trim();
    // if (!val) {
    //     this.newColSizeError = 'Size is required before adding.';
    //     return;
    // }
    if (val) {
    // ✅ Validate format before adding column
        var pattern = /^\d+\.\d\s+mm$/i;
        if (!pattern.test(val)) {
            this.newColSizeError = 'Allowed: 5.0 mm, 5.1 mm, 21.0 mm';
            return;   // ← stops here, column not added
        }
    }

    this.newColSizeError = '';
    this._addColumnWithItem(this.newColCode, val);
}

_addColumnWithItem(ic, size) {
    var self = this;
    getItemMeasurementTypes({ itemCodes: [ic] })
        .then(function(map) {
            var raw  = map[ic] || 'Quantity';
            var unit = self._unitForType(raw);
            var key  = ic + '__' + size;

            // Avoid duplicate column
            if (self.slipColumns.find(function(c) { return c.key === key; })) {
                self._toast('⚠️', 'Column already exists', ic + ' · ' + size);
                return;
            }

            self.slipColumns = self.slipColumns.concat([{
                key: key, itemCode: ic, size: size,
                measureType: raw, unit: unit
            }]);

            self.slipRows = self.slipRows.map(function(row) {
                var newCells   = Object.assign({}, row.cells);
                var newRegOids = Object.assign({}, row.regularOrderIds || {});
                newCells[key] = 0;
                if (row.isRegular) newRegOids[key] = newRegOids[key] || [];
                return Object.assign({}, row, {
                    cells: newCells, regularOrderIds: newRegOids
                });
            });

            self.newColSize           = '';
            self.newColCode           = '';
            self.newColSearch         = '';
            self.newColSizeAutoFilled = false;
            self.newColSizeError      = '';
            self.newColFiltered = self.allItemCodes.filter(function(c) {
                return self.slipColumns.findIndex(function(col) {
                    return col.itemCode === c;
                }) === -1;
            });
        })
        .catch(function() {
            self._toast('❌', 'Could not fetch unit for item', ic);
        });
}

    get newColLabel()      { return this.newColCode || 'Select item…'; }
    get newColLabelClass() {
        return this.newColCode ? 'pick-val pick-selected' : 'pick-val pick-placeholder';
    }
    get newColHasOptions() { return this.newColFiltered.length > 0; }

    handleRemoveColumn(e) {
        var key = e.currentTarget.dataset.ic;
        var self = this;

        this.slipColumns = this.slipColumns.filter(function(c) {
            return c.key !== key;
        });

        this.slipRows = this.slipRows.map(function(row) {
            var newCells = Object.assign({}, row.cells);
            var newRegOids = Object.assign({}, row.regularOrderIds || {});

            delete newCells[key];
            delete newRegOids[key];

            return Object.assign({}, row, {
                cells: newCells,
                regularOrderIds: newRegOids
            });
        });

        var updated = {};
        var suffix = '__' + key;

        Object.keys(this.slipDraftCells).forEach(function(k) {
            if (!k.endsWith(suffix)) {
                updated[k] = self.slipDraftCells[k];
            }
        });

        this.slipDraftCells = updated;

        this.newColFiltered = this.allItemCodes.filter(function(c) {
            return self.slipColumns.findIndex(function(col) {
                return col.itemCode === c;
            }) === -1;
        });
    }

    // ── Confirm & create batch ──
    // handleConfirmPrint() {
    //     var self        = this;
    //     var allOrderIds = [];
    //     var itemDetails = [];
    //     var grandTotal  = 0;
    //     var totals      = this.slipColTotals;
    //     var cellSz = (row.sizes && row.sizes[ic]) ? row.sizes[ic] : '';

    //     this.slipColumns.forEach(function(col) {
    //         var ic            = col.itemCode;
    //         var custLines     = [];
    //         var regularQty    = 0;
    //         var regularRemark = '';

    //         self.slipRows.forEach(function(row) {
    //             var qty = self._resolveQty(row.rowKey, ic, row.cells[ic]);
    //             if (qty === 0) return;

    //             if (row.isRegular) {
    //                 regularQty += qty;
    //                 regularRemark = (row.regularRemarks && row.regularRemarks[ic])
    //                     ? row.regularRemarks[ic].join(' · ') : '';

    //                 // FIX: collect order IDs from regular orders for this item code
    //                 var regIds = (row.regularOrderIds && row.regularOrderIds[ic]) || [];
    //                 regIds.forEach(function(oid) {
    //                     if (oid && allOrderIds.indexOf(oid) === -1) {
    //                         allOrderIds.push(oid);
    //                     }
    //                 });

    //             } else {
    //                 custLines.push({
    //                     customerCode: row.customerCode,
    //                     qty:          qty,
    //                     size:         cellSz,
    //                     remark:       row.remark || '',
    //                     orderId:      row.orderIds[0] || ''
    //                 });
    //                 (row.orderIds || []).forEach(function(oid) {
    //                     if (oid && allOrderIds.indexOf(oid) === -1) {
    //                         allOrderIds.push(oid);
    //                     }
    //                 });
    //             }
    //         });

    //         var totalQty = totals[ic] || 0;
    //         grandTotal  += totalQty;
    //         var regRow      = self.slipRows.find(function(r) { return r.isRegular; });
    //         var regularSize = regRow && regRow.regularSizes && regRow.regularSizes[ic]
    //             ? regRow.regularSizes[ic] : '';

    //         itemDetails.push({
    //             itemCode:      ic,
    //             custLines:     custLines,
    //             regularQty:    regularQty,
    //             regularRemark: regularRemark,
    //             regularSize:   regularSize,
    //             totalQty:      totalQty,
    //             unit:          col.unit,
    //             measureType:   col.measureType || 'Quantity',
    //             orderIds:      custLines.map(function(l) { return l.orderId; })
    //         });
    //     });

    //     if (grandTotal === 0) {
    //         this._toast('⚠️', 'Nothing to print', 'All quantities are zero'); return;
    //     }

    //     var batchData = {
    //         slipTitle:   this.slipTitle,
    //         color:       this.slipColor,
    //         karat:       this.slipKarat,
    //         totalQty:    grandTotal,
    //         orderIds:    allOrderIds,   // now includes regular order IDs
    //         itemDetails: itemDetails
    //     };

    //     this.isLoading = true;
    //     var self = this;

    //     createProductionBatch({ batchData: batchData, changedBy: this.userName || '' })
    //         .then(function(result) {
    //             self.isLoading      = false;
    //             self.showPrintModal = false;
    //             self.selectedIds    = {};
    //             self.slipDraftCells = {};
    //             self.slipRows       = [];
    //             self.slipColumns    = [];
    //             var batchId   = result.id   || '';
    //             var batchName = result.name || '';
    //             self._openPrintWindow(batchId);
    //             self._toast('✅', 'Batch created · Slip opening', batchName);
    //             self.dispatchEvent(new CustomEvent('batchcreated', {
    //                 bubbles: true, composed: true,
    //                 detail: { batchNumbers: [batchName] }
    //             }));
    //             self.dispatchEvent(new CustomEvent('refreshorders', {
    //                 bubbles: true, composed: true
    //             }));
    //             self._loadOrders();
    //         })
    //         .catch(function(err) {
    //             self.isLoading = false;
    //             self._toast('❌', 'Error', (err.body && err.body.message) || err.message || '');
    //         });
    // }
    handleConfirmPrint() {
        var self        = this;
        var allOrderIds = [];
        var itemDetails = [];
        var grandTotal  = 0;
        var totals      = this.slipColTotals;

        // ✅ REMOVED: var cellSz = ... (was declared outside loop — wrong)

        this.slipColumns.forEach(function(col) {
            // var ic            = col.itemCode;
            var ic = col.key;
            var itemCode = col.itemCode;
            var custLines     = [];
            var regularQty    = 0;
            var regularRemark = '';

            self.slipRows.forEach(function(row) {
                var qty = self._resolveQty(row.rowKey, ic, row.cells[ic]);
                if (qty === 0) return;

                if (row.isRegular) {
                    regularQty += qty;
                    regularRemark = (row.regularRemarks && row.regularRemarks[ic])
                        ? row.regularRemarks[ic].join(' · ') : '';

                    var regIds = (row.regularOrderIds && row.regularOrderIds[ic]) || [];
                    regIds.forEach(function(oid) {
                        if (oid && allOrderIds.indexOf(oid) === -1) {
                            allOrderIds.push(oid);
                        }
                    });

                } else {
                    // ✅ FIXED — cellSz now correctly inside loop where row is defined
                    var cellSz = (row.sizes && row.sizes[ic]) ? row.sizes[ic] : '';

                    custLines.push({
                        customerCode: row.customerCode,
                        qty:          qty,
                        size:         cellSz || col.size || '',        // ✅ now has correct value
                        remark:       row.remark || '',
                        orderId:      row.orderIds[0] || ''
                    });

                    (row.orderIds || []).forEach(function(oid) {
                        if (oid && allOrderIds.indexOf(oid) === -1) {
                            allOrderIds.push(oid);
                        }
                    });
                }
            });

            var totalQty    = totals[ic] || 0;
            grandTotal     += totalQty;

            // ✅ regularSize also correctly resolved here
            var regRow      = self.slipRows.find(function(r) { return r.isRegular; });
            var regularSize = regRow && regRow.regularSizes && regRow.regularSizes[ic]
                ? regRow.regularSizes[ic] 
                : (col.size || '');

            itemDetails.push({
                itemCode: itemCode,
                size: col.size  || '',
                custLines:     custLines,
                regularQty:    regularQty,
                regularRemark: regularRemark,
                regularSize:   regularSize,   // ✅ correct
                totalQty:      totalQty,
                unit:          col.unit,
                measureType:   col.measureType || 'Quantity',
                orderIds:      custLines.map(function(l) { return l.orderId; })
            });
        });

        if (grandTotal === 0) {
            this._toast('⚠️', 'Nothing to print', 'All quantities are zero');
            return;
        }

        var batchData = {
            slipTitle:   this.slipTitle,
            color:       this.slipColor,
            karat:       this.slipKarat,
            totalQty:    grandTotal,
            orderIds:    allOrderIds,
            itemDetails: itemDetails
        };

        this.isLoading = true;

        createProductionBatch({ batchData: batchData, changedBy: this.userName || '' })
            .then(function(result) {
                self.isLoading      = false;
                self.showPrintModal = false;
                self.selectedIds    = {};
                self.slipDraftCells = {};
                self.slipRows       = [];
                self.slipColumns    = [];
                var batchId   = result.id   || '';
                var batchName = result.name || '';
                self._openPrintWindow(batchId);
                self._toast('✅', 'Batch created · Slip opening', batchName);
                self.dispatchEvent(new CustomEvent('batchcreated', {
                    bubbles: true, composed: true,
                    detail: { batchNumbers: [batchName] }
                }));
                self.dispatchEvent(new CustomEvent('refreshorders', {
                    bubbles: true, composed: true
                }));
                self._loadOrders();
            })
            .catch(function(err) {
                self.isLoading = false;
                self._toast('❌', 'Error', (err.body && err.body.message) || err.message || '');
            });
    }

    _openPrintWindow(batchId) {
        if (!batchId) { this._toast('⚠️', 'Cannot open slip', 'No batch ID returned'); return; }
        var url = '/apex/JwelCraftProductionSlip?batchId=' + batchId
                + '&title=' + encodeURIComponent(this.slipTitle);
        window.open(url, '_blank', 'width=700,height=600,toolbar=0,menubar=0,location=0');
    }

    _toast(icon, msg, sub) {
        this.dispatchEvent(new CustomEvent('showtoast', {
            bubbles: true, composed: true,
            detail: { icon, message: msg, subMessage: sub }
        }));
    }
}