import { LightningElement, track, api } from 'lwc';
import getAllInventory         from '@salesforce/apex/JewelryOrderController.getAllInventory';
import addStock               from '@salesforce/apex/JewelryOrderController.addStock';
import clearStock             from '@salesforce/apex/JewelryOrderController.clearStock';
import getItemMeasurementTypes from '@salesforce/apex/JewelryOrderController.getItemMeasurementTypes';
import getPicklistValues      from '@salesforce/apex/JewelryOrderController.getPicklistValues';
import getItemCodesByCategory from '@salesforce/apex/JewelryOrderController.getItemCodesByCategory';
import getItemSizeMap from '@salesforce/apex/JewelryOrderController.getItemSizeMap';
import updateInventorySize from '@salesforce/apex/JewelryOrderController.updateInventorySize';

export default class JwelCraftQuickStock extends LightningElement {
    @api userRole = '';
    @api userName = '';

    @track isLoading    = false;
    @track isRefreshing = false;
    @track inventory    = [];

    @track searchTerm  = '';
    @track filterColor = '';
    @track filterKarat = '';

    @track allItemCodes   = [];
    @track allKaratValues = [];

    @track showModal        = false;
    @track isSaving         = false;
    @track f_itemCode       = '';
    @track f_itemPickSearch = '';
    @track f_showItemPick   = false;
    @track f_filteredItems  = [];
    @track f_color          = '';
    @track f_karat          = '';
    @track f_qty            = '';
    @track f_inches         = '';
    @track f_grams          = '';
    @track f_size           = '';
    @track f_measurementType = 'Quantity';

    @track showClearConfirm = false;
    @track isClearing       = false;
    @track clearTargetId    = '';
    @track clearTargetCode  = '';

    @track measurementTypeMap = {};
    @track f_pair = '';
    @track allItemCategoryMap = {};
    @track categoryOptions    = [];
    @track f_category         = '';
    // ── Category picklist fields ──
    @track f_showCatPick     = false;
    @track f_catSearch       = '';
    @track f_filteredCatOpts = [];
    @track f_sizeIsAuto = false;
    @track getItemSizeMap ;
    @track showEditSizeModal = false;
    @track isEditSaving      = false;
    @track es_id             = '';
    @track es_itemCode       = '';
    @track es_color          = '';
    @track es_karat          = '';
    @track es_size           = '';
    @track es_measurementType = '';
    @track es_qty            = '';
    @track es_inches         = '';
    @track es_grams          = '';
    @track es_pair           = '';

    get f_catLabel()   { return this.f_category || 'Select category…'; }
    get f_catClass()   { return this.f_category ? 'pick-val pick-selected' : 'pick-val pick-placeholder'; }
    get hasCatOptions(){ return this.f_filteredCatOpts.length > 0; }
    get filteredCatOptions() { return this.f_filteredCatOpts; }
    get es_qtyDisplay() {
        var mType = this.es_measurementType;
        if (mType === 'LengthWeight') {
            return (this.es_inches || 0) + ' in · ' + (this.es_grams || 0) + ' g';
        }
        if (mType === 'Pair') return (this.es_pair || 0) + ' Pair';
        if (mType === 'QuantityPair') return (this.es_qty || 0) + ' pcs · ' + (this.es_pair || 0) + ' Pair';
        if (mType === 'QuantityWeight') return (this.es_qty || 0) + ' pcs · ' + (this.es_grams || 0) + ' g';
        return (this.es_qty || 0) + ' pcs';
    }
    isValidManualSize(sizeValue) {
        if (!sizeValue) return false;
        var pattern = /^\d+\.\d\s+mm$/i;
        return pattern.test(sizeValue.trim());
    }

    handleOpenEditSize(e) {
        var d = e.currentTarget.dataset;
        this.es_id              = d.id;
        this.es_itemCode        = d.code;
        this.es_color           = d.color;
        this.es_karat           = d.karat;
        this.es_size            = d.size === '—' ? '' : (d.size || '');
        this.es_measurementType = d.mtype || 'Quantity';
        this.es_qty             = d.qty   || 0;
        this.es_inches          = d.inches || 0;
        this.es_grams           = d.grams  || 0;
        this.es_pair            = d.pair   || 0;
        this.showEditSizeModal  = true;
    }

    handleCloseEditSize() {
        this.showEditSizeModal = false;
        this.es_id = '';
    }

    handleEsSizeInput(e) {
        this.es_size = e.target.value;
    }

    handleSaveEditSize() {
        // Optional: validate format
        var size = this.es_size;
        if (size && !this.isValidManualSize(size)) {
            this._toast('❌', 'Invalid Size Format', 'Allowed: 5.0 mm, 5.1 mm, 21.0 mm');
            return;
        }

        this.isEditSaving = true;
        var self = this;

        updateInventorySize({
            inventoryId: this.es_id,
            size: size || ''
        })
        .then(function() {
            self.isEditSaving      = false;
            self.showEditSizeModal = false;
            self._toast('✅', 'Size updated', self.es_itemCode + ' → ' + (size || 'cleared'));

            // Refresh inventory list
            getAllInventory()
                .then(function(res) {
                    self.inventory = res || [];
                    var codes = [...new Set((res || []).map(function(i) { return i.Item_Code__c; }))];
                    if (codes.length > 0) {
                        getItemMeasurementTypes({ itemCodes: codes })
                            .then(function(map) { self.measurementTypeMap = map || {}; })
                            .catch(function() {});
                    }
                })
                .catch(function() {});
        })
        .catch(function(err) {
            self.isEditSaving = false;
            self._toast('❌', 'Error', (err.body && err.body.message) || err.message || '');
        });
    }
    normalizeSize(sizeValue) {
        if (!sizeValue) return '';
        var txt = String(sizeValue).toLowerCase().trim();
        txt = txt.replace(/mm/g, '');
        txt = txt.replace(/\s*x\s*/g, ' x ');
        txt = txt.replace(/\(\s*/g, '(');
        txt = txt.replace(/\s*\)/g, ')');
        txt = txt.replace(/\s+/g, ' ').trim();
        var parts = txt.split(' x ');
        parts = parts.map(function(part) {
            var suffix = '';
            var bracketIndex = part.indexOf('(');
            if (bracketIndex !== -1) {
                suffix = part.substring(bracketIndex);
                part = part.substring(0, bracketIndex);
            }
            var num = parseFloat(part);
            if (!isNaN(num) && String(part).match(/^[0-9.]+$/)) {
                return String(num) + suffix;
            }
            return part + suffix;
        });
        return parts.join(' x ');
    }
    handleCatPickFocus() {
        if (this.f_showCatPick) {
            this.f_showCatPick = false;
            return;
        }
        this.f_showCatPick     = !this.f_showCatPick;
        this.f_catSearch       = '';
        this.f_filteredCatOpts = this.categoryOptions;
    }

    handleCatSearch(e) {
        var s = (e.target.value || '').toLowerCase();
        this.f_catSearch = e.target.value;
        this.f_filteredCatOpts = s
            ? this.categoryOptions.filter(function(c) { return c.toLowerCase().includes(s); })
            : this.categoryOptions;
    }

    handleCategorySelect(e) {
        var cat = e.currentTarget.dataset.value;
        this.f_category      = cat;
        this.f_showCatPick   = false;
        this.f_catSearch     = '';

        // ✅ Reset item code and filter items by new category
        this.f_itemCode        = '';
        this.f_itemPickSearch  = '';
        this.f_measurementType = 'Quantity';
        this.f_qty    = '';
        this.f_inches = '';
        this.f_grams  = '';
        this.f_pair   = '';

        this.f_filteredItems = cat
            ? (this.allItemCategoryMap[cat] || [])
            : this.allItemCodes;
    }

    handlePairInput(e) { this.f_pair = e.target.value; }

    connectedCallback() {
        this._load();
        this._loadPicklists();
        this.startPolling();
    }
    startPolling() {
        // Initial load already done above, so optional here
        // this.poller = setInterval(() => {
        //     this._load();
        // }, 60000); // 60 sec
    }

    disconnectedCallback() {
        if (this.poller) {
            clearInterval(this.poller);
        }
    }
    _load() {
        this.isLoading = true;
        var self = this;
        getAllInventory()
            .then(function(res) {
                console.log("result:",res);
                self.isLoading = false;
                self.inventory = res || [];
                var codes = [...new Set((res || []).map(function(i) { return i.Item_Code__c; }))];
                if (codes.length > 0) {
                    getItemMeasurementTypes({ itemCodes: codes })
                        .then(function(map) { self.measurementTypeMap = map || {}; })
                        .catch(function() {});
                }
            })
            .catch(function() { self.isLoading = false; });
    }

    _loadPicklists() {
        var self = this;
        getPicklistValues()
            .then(function(res) {
                self.allItemCodes    = res.itemCodes   || [];
                self.allKaratValues  = res.karatValues || ['9','10','14','18','22','24'];
                self.f_filteredItems = res.itemCodes   || [];
            })
            .catch(function() {
                self.allKaratValues = ['9','10','14','18','22','24'];
            });
        getItemCodesByCategory()  // or your existing getItemCodesByCategory import
            .then(function(res) {
                self.allItemCategoryMap = res || {};
                self.categoryOptions    = Object.keys(res || {});
            })
            .catch(function() {});
        getItemSizeMap()
            .then(function(res) {
                self.allItemSizeMap = res || {};
            })
            .catch(function() {});
    }
    handleCategoryChange(e) {
        this.f_category      = e.target.value;
        this.f_itemCode      = '';
        this.f_itemPickSearch = '';
        this.f_measurementType = 'Quantity';
        this.f_qty    = '';
        this.f_inches = '';
        this.f_grams  = '';
        this.f_pair   = '';

        // ✅ Filter item codes by selected category
        var filtered = this.f_category
            ? (this.allItemCategoryMap[this.f_category] || [])
            : this.allItemCodes;
        this.f_filteredItems = filtered;
    }

    handleRefresh() {
        this.isRefreshing = true;
        var self = this;
        getAllInventory()
            .then(function(res) {
                self.isRefreshing = false;
                self.inventory = res || [];
                var codes = [...new Set((res || []).map(function(i) { return i.Item_Code__c; }))];
                if (codes.length > 0) {
                    getItemMeasurementTypes({ itemCodes: codes })
                        .then(function(map) { self.measurementTypeMap = map || {}; })
                        .catch(function() {});
                }
            })
            .catch(function() { self.isRefreshing = false; });
    }

    get canAddStock() {
        return this.userRole === 'Admin' || this.userRole === 'Manager';
    }

    handleSearch(e)          { this.searchTerm  = e.target.value; }
    handleColorFilter(e)     { this.filterColor = e.target.value; }
    handleKaratFilter(e)     { this.filterKarat = e.target.value; }
    handleClearSearch()      { this.searchTerm  = ''; }
    handleClearColorFilter() { this.filterColor = ''; }
    handleClearKaratFilter() { this.filterKarat = ''; }
    handleClearAllFilters()  { this.searchTerm = ''; this.filterColor = ''; this.filterKarat = ''; }

    get hasActiveFilters() { return !!(this.searchTerm || this.filterColor || this.filterKarat); }
    get colorFilterClass() { return 'tb-filter-wrap' + (this.filterColor ? ' filter-active' : ''); }
    get karatFilterClass() { return 'tb-filter-wrap' + (this.filterKarat ? ' filter-active' : ''); }
    get refreshBtnClass()  { return 'btn-refresh'    + (this.isRefreshing ? ' refreshing' : ''); }
    get refreshIconClass() { return 'refresh-icon'   + (this.isRefreshing ? ' spinning' : ''); }

    get filteredInventory() {
        var s     = (this.searchTerm  || '').toLowerCase();
        var col   = (this.filterColor || '').toLowerCase();
        var kar   = (this.filterKarat || '').toLowerCase();
        var list  = this.inventory;
        var mtMap = this.measurementTypeMap;

        if (s)   list = list.filter(function(i) {
            return (i.Item_Code__c || '').toLowerCase().includes(s) ||
                   (i.Color__c     || '').toLowerCase().includes(s) ||
                   String(i.Karat__c || '').includes(s);
        });
        if (col) list = list.filter(function(i) {
            return (i.Color__c || '').toLowerCase() === col;
        });
        if (kar) list = list.filter(function(i) {
            return String(i.Karat__c || '').toLowerCase() === kar;
        });

        // return list.map(function(i) {
        //     var measurementType = mtMap[i.Item_Code__c] || 'Quantity';
        //     var isQtyType       = measurementType !== 'LengthWeight';
        //     var isLWType        = measurementType === 'LengthWeight';
        //     var baseQty         = isLWType ? (i.Available_Grams__c || 0) : (i.Available_Qty__c || 0);
        //     var qty             = baseQty;
        //     var stockStatus     = qty === 0 ? 'Out of Stock' : qty < 10 ? 'Low Stock' : 'In Stock';
        //     var statusClass     = qty === 0 ? 'badge b-none'      : qty < 10 ? 'badge b-low'      : 'badge b-ok';
        //     var qtyClass        = qty === 0 ? 'qty-val qty-zero'  : qty < 10 ? 'qty-val qty-low'  : 'qty-val qty-ok';
        //     var rowClass        = 'st-row'  + (qty === 0 ? ' row-empty' : qty < 10 ? ' row-low' : '');
        //     var sizeLabel       = i.Size__c || '—';
        //     return Object.assign({}, i, {
        //         stockStatus, statusClass, qtyClass, rowClass,
        //         sizeLabel, measurementType, isQtyType, isLWType
        //     });
        // });
        return list.map(function(i) {
            var mType = mtMap[i.Item_Code__c] || 'Quantity';

            // ✅ Correct type flags
            var isQtyType  = mType === 'Quantity';
            var isLWType   = mType === 'LengthWeight';
            var isPairType = mType === 'Pair';
            var isQPType   = mType === 'QuantityPair';
            var isQWType   = mType === 'QuantityWeight';
            var isWeightType = mType === 'Weight';
            var isLQType     = mType === 'LengthQuantity';
            

            // ✅ Base qty for row coloring — pick most relevant field
            // var baseQty = 0;
            // if (isLWType)       baseQty = (i.Available_Grams__c  || 0) + (i.Available_Inches__c || 0);
            // else if (isPairType) baseQty = (i.Available_Pair__c  || 0);
            // else if (isQPType)   baseQty = (i.Available_Qty__c   || 0) + (i.Available_Pair__c   || 0);
            // else if (isQWType)   baseQty = (i.Available_Qty__c   || 0);
            
            // else                 baseQty = (i.Available_Qty__c   || 0);
            var baseQty = 0;
            if (isLWType) {
                baseQty = (i.Available_Grams__c || 0) + (i.Available_Inches__c || 0);
            }
            else if (isWeightType) {
                baseQty = (i.Available_Grams__c || 0);
            }
            else if (isLQType) {
                baseQty = (i.Available_Inches__c || 0) + (i.Available_Qty__c || 0);
            }
            else if (isPairType) {
                baseQty = (i.Available_Pair__c || 0);
            }
            else if (isQPType) {
                baseQty = (i.Available_Qty__c || 0) + (i.Available_Pair__c || 0);
            }
            else if (isQWType) {
                baseQty = (i.Available_Qty__c || 0) + (i.Available_Grams__c || 0);
            }
            else {
                baseQty = (i.Available_Qty__c || 0);
            }

            var stockStatus = baseQty === 0 ? 'Out of Stock' : baseQty < 10 ? 'Low Stock' : 'In Stock';
            var statusClass = baseQty === 0 ? 'badge b-none'     : baseQty < 10 ? 'badge b-low'     : 'badge b-ok';
            var qtyClass    = baseQty === 0 ? 'qty-val qty-zero' : baseQty < 10 ? 'qty-val qty-low' : 'qty-val qty-ok';
            var rowClass    = 'st-row' + (baseQty === 0 ? ' row-empty' : baseQty < 10 ? ' row-low' : '');
            var sizeLabel   = i.Size__c || '—';

            return Object.assign({}, i, {
                stockStatus, statusClass, qtyClass, rowClass, sizeLabel,
                measurementType: mType,
                isQtyType, isLWType, isPairType, isQPType, isQWType,isWeightType,isLQType
            });
        });
    }

    get hasItems()     { return this.filteredInventory.length > 0; }
    get totalItems()   { return this.inventory.length; }
    get inStockCount() {
        var mtMap = this.measurementTypeMap;
        return this.inventory.filter(function(i) {
            var mType = mtMap[i.Item_Code__c] || 'Quantity';
            if (mType === 'LengthWeight') {
                return (i.Available_Inches__c || 0) > 0 || (i.Available_Grams__c || 0) > 0;
            }
            if (mType === 'Pair') {
                return (i.Available_Pair__c || 0) > 0;
            }
            if (mType === 'QuantityPair') {
                return (i.Available_Qty__c || 0) > 0 || (i.Available_Pair__c || 0) > 0;
            }
            if (mType === 'QuantityWeight') {
                return (i.Available_Qty__c || 0) > 0;
            }
            if (mType === 'Weight') {
                return (i.Available_Grams__c || 0) > 0;
            }

            if (mType === 'LengthQuantity') {
                return (i.Available_Inches__c || 0) > 0 ||
                    (i.Available_Qty__c || 0) > 0;
            }
            return (i.Available_Qty__c || 0) > 0;
        }).length;
    }

    // ── Clear Stock ──
    handleClearStock(e) {
        this.clearTargetId   = e.currentTarget.dataset.id;
        this.clearTargetCode = e.currentTarget.dataset.code;
        this.showClearConfirm = true;
    }
    handleCancelClear() {
        this.showClearConfirm = false;
        this.clearTargetId = ''; this.clearTargetCode = '';
    }
    handleConfirmClear() {
        this.isClearing = true;
        var self = this;
        clearStock({ inventoryId: this.clearTargetId })
            .then(function() {
                self.isClearing = false; self.showClearConfirm = false;
                self._toast('🗑', 'Stock cleared', self.clearTargetCode);
                self.clearTargetId = ''; self.clearTargetCode = '';
                getAllInventory().then(function(res){ self.inventory = res || []; }).catch(function(){});
            })
            .catch(function(err) {
                self.isClearing = false;
                self._toast('❌', 'Error', (err.body && err.body.message) || err.message || '');
            });
    }

    // ── Add Stock Modal ──
    handleOpenModal() {
        this.f_category      = '';
        this.f_itemCode       = '';
        this.f_itemPickSearch = '';
        this.f_showItemPick   = false;
        this.f_filteredItems  = this.allItemCodes;
        this.f_color          = 'Yellow Gold';
        this.f_karat          = '';
        this.f_qty            = '';
        this.f_inches         = '';
        this.f_grams          = '';
        this.f_pair            = ''; 
        this.f_size           = '';
        this.f_measurementType = 'Quantity';
        this.showModal        = true;
    }

    handleCloseModal()     { this.showModal = false; }
    handleColorChange(e)   { this.f_color  = e.target.value; }
    handleKaratChange(e)   { this.f_karat  = e.target.value; }
    handleQtyInput(e)      { this.f_qty    = e.target.value; }
    handleInchesInput(e)   { this.f_inches = e.target.value; }
    handleGramsInput(e)    { this.f_grams  = e.target.value; }
    // handleSizeInput(e)     { this.f_size   = e.target.value; }
    handleSizeInput(e) {
        this.f_size      = e.target.value;
        this.f_sizeIsAuto = false;   // user is typing manually
    }
    handleSizeBlur(e) {
        var val = e.target.value;
        if (!val) return;
        if (this.f_sizeIsAuto) return;   // auto-filled, skip validation

        if (!this.isValidManualSize(val)) {
            this._toast(
                '❌',
                'Invalid Size Format',
                'Allowed: 5.0 mm, 5.1 mm, 21.0 mm'
            );
        }
    }
    handleDropdownClick(e) { e.stopPropagation(); }

    handleItemPickFocus() {
        if (this.f_showItemPick) {
            this.f_showItemPick = false;
            return;
        }
        var filtered = this.f_category
        ? (this.allItemCategoryMap[this.f_category] || [])
        : this.allItemCodes;
        this.f_showItemPick  = true;
        this.f_filteredItems = filtered;
    }
    // handleItemPickSearch(e) {
    //     var s = (e.target.value || '').toLowerCase();
    //     this.f_itemPickSearch = e.target.value;
    //     this.f_filteredItems  = s
    //         ? this.allItemCodes.filter(function(c){ return c.toLowerCase().includes(s); })
    //         : this.allItemCodes;
    //     this.f_showItemPick = true;
    // }
    handleItemPickSearch(e) {
        var s = (e.target.value || '').toLowerCase();
        this.f_itemPickSearch = e.target.value;
        var base = this.f_category
            ? (this.allItemCategoryMap[this.f_category] || [])
            : this.allItemCodes;
        this.f_filteredItems = s
            ? base.filter(function(c) { return c.toLowerCase().includes(s); })
            : base;
        this.f_showItemPick = true;
    }
//     handleItemCodeSelect(e) {
//         // In handleOpenModal
// this.f_pair = '';

// // In handleItemCodeSelect
// this.f_qty = ''; this.f_inches = ''; this.f_grams = ''; this.f_pair = '';
//         this.f_itemCode        = e.currentTarget.dataset.value;
//         this.f_itemPickSearch  = e.currentTarget.dataset.value;
//         this.f_showItemPick    = false;
//         // Set measurement type from mdt — default Quantity if not found
//         this.f_measurementType = this.measurementTypeMap[this.f_itemCode] || 'Quantity';
//         // Reset qty fields when item changes
//         this.f_qty = ''; this.f_inches = ''; this.f_grams = '';
//     }
    handleItemCodeSelect(e) {
        var self = this;
        this.f_itemCode       = e.currentTarget.dataset.value;
        this.f_itemPickSearch = e.currentTarget.dataset.value;
        this.f_showItemPick   = false;
        this.f_qty    = '';
        this.f_inches = '';
        this.f_grams  = '';
        this.f_pair   = '';

        // ✅ Auto-fill size from allItemSizeMap (same as OrderEntry)
        var autoSize = this.allItemSizeMap[this.f_itemCode] || '';
        if (autoSize) {
            this.f_size      = autoSize;
            this.f_sizeIsAuto = true;
        } else {
            this.f_sizeIsAuto = false;
            // don't clear existing manual size
        }

        getItemMeasurementTypes({ itemCodes: [this.f_itemCode] })
            .then(function(typeMap) {
                self.f_measurementType = typeMap[self.f_itemCode] || 'Quantity';
            })
            .catch(function() {
                self.f_measurementType = 'Quantity';
            });
    }

    get f_itemCodeLabel()  { return this.f_itemCode || 'Select item code…'; }
    get f_itemCodeClass()  { return this.f_itemCode ? 'pick-val pick-selected' : 'pick-val pick-placeholder'; }
    get f_hasItemOptions() { return this.f_filteredItems.length > 0; }
    // Show correct input fields based on measurement type
    // ✅ Replace these 2 getters
    get f_isLW()        { return this.f_measurementType === 'LengthWeight'; }
    get f_isQty()       { return this.f_measurementType === 'Quantity'; }
    get f_isPair()      { return this.f_measurementType === 'Pair'; }
    get f_isQP()        { return this.f_measurementType === 'QuantityPair'; }
    get f_isQW()        { return this.f_measurementType === 'QuantityWeight'; }
    get f_isWeight()    { return this.f_measurementType === 'Weight'; }
    get f_isLQ()        { return this.f_measurementType === 'LengthQuantity'; }

    // handleSaveStock() {
    //     if (!this.f_itemCode) { this._toast('❌', 'Item Code required', ''); return; }
    //     if (!this.f_karat)    { this._toast('❌', 'Karat required', '');     return; }
 
    //     var isLW   = this.f_measurementType === 'LengthWeight';
    //     var inches = parseFloat(this.f_inches) || 0;
    //     var grams  = parseFloat(this.f_grams)  || 0;
    //     var qty    = parseFloat(this.f_qty)    || 0;
 
    //     if (isLW) {
    //         if (inches <= 0 && grams <= 0) {
    //             this._toast('❌', 'Enter inches and/or grams', ''); return;
    //         }
    //     } else {
    //         if (qty <= 0) {
    //             this._toast('❌', 'Enter a valid Qty', ''); return;
    //         }
    //     }
 
    //     this.isSaving = true;
    //     var self = this;
 
    //     addStock({
    //         itemCode:  this.f_itemCode,
    //         color:     this.f_color || 'Yellow Gold',
    //         karat:     this.f_karat,
    //         qty:       isLW ? null : qty,       // pass null for LW — Apex ignores it
    //         inches:    isLW ? inches : null,
    //         grams:     isLW ? grams  : null,
    //         size:      this.f_size || '',
    //         changedBy: this.userName || ''
    //     })
    //     .then(function() {
    //         self.isSaving  = false;
    //         self.showModal = false;
    //         var detail = isLW
    //             ? (inches + ' in · ' + grams + ' g')
    //             : (qty + ' pcs');
    //         self._toast('✅', 'Stock added', self.f_itemCode + ' · ' + detail);
    //         getAllInventory()
    //             .then(function(res){ self.inventory = res || []; })
    //             .catch(function(){});
    //     })
    //     .catch(function(err) {
    //         self.isSaving = false;
    //         self._toast('❌', 'Error', (err.body && err.body.message) || err.message || '');
    //     });
    // }
    isEmpty(val) {
        return val === '' || val === null || val === undefined;
    }
    // Old code
    // handleSaveStock() {
    //     if (!this.f_itemCode) { this._toast('❌', 'Item Code required', ''); return; }
    //     if (!this.f_karat)    { this._toast('❌', 'Karat required', '');     return; }

    //     var mType  = this.f_measurementType;
    //     var qty    = parseFloat(this.f_qty)    || 0;
    //     var inches = parseFloat(this.f_inches) || 0;
    //     var grams  = parseFloat(this.f_grams)  || 0;
    //     var pair   = parseFloat(this.f_pair)   || 0;

    //     // ✅ Validation per type
    //     if (mType === 'LengthWeight') {
    //         if (inches <= 0 && grams <= 0) {
    //             this._toast('❌', 'Enter inches and/or grams', ''); return;
    //         }
    //     } else if (mType === 'Pair') {
    //         if (pair <= 0) {
    //             this._toast('❌', 'Enter a valid Pair qty', ''); return;
    //         }
    //     } else if (mType === 'QuantityPair') {
    //         if (qty <= 0 && pair <= 0) {
    //             this._toast('❌', 'Enter Pieces and/or Pair qty', ''); return;
    //         }
    //     } else if (mType === 'QuantityWeight') {
    //         if (qty <= 0) {
    //             this._toast('❌', 'Enter a valid Qty', ''); return;
    //         }
    //     } else {
    //         // Quantity
    //         if (qty <= 0) {
    //             this._toast('❌', 'Enter a valid Qty', ''); return;
    //         }
    //     }

    //     this.isSaving = true;
    //     var self = this;

    //     addStock({
    //         itemCode:  this.f_itemCode,
    //         color:     this.f_color || 'Yellow Gold',
    //         karat:     this.f_karat,
    //         qty:       qty    > 0 ? qty    : 0,
    //         inches:    inches > 0 ? inches : 0,
    //         grams:     grams  > 0 ? grams  : 0,
    //         pair:      pair   > 0 ? pair   : 0,  // ✅ pass pair
    //         size:      this.f_size || '',
    //         changedBy: this.userName || ''
    //     })
    //     .then(function() {
    //         self.isSaving  = false;
    //         self.showModal = false;
    //         self._toast('✅', 'Stock added', self.f_itemCode);
    //         getAllInventory()
    //             .then(function(res){ self.inventory = res || []; })
    //             .catch(function(){});
    //     })
    //     .catch(function(err) {
    //         self.isSaving = false;
    //         self._toast('❌', 'Error', (err.body && err.body.message) || err.message || '');
    //     });
    // }
    // New code
    handleSaveStock() {
        if (!this.f_itemCode) { this._toast('❌', 'Item Code required', ''); return; }
        if (!this.f_karat)    { this._toast('❌', 'Karat required', ''); return; }

        if (this.f_size && !this.f_sizeIsAuto && !this.isValidManualSize(this.f_size)) {
            this._toast(
                '❌',
                'Invalid Size Format',
                'Allowed: 5.0 mm, 5.1 mm, 21.0 mm'
            );
            return;  // ← stops here, nothing gets saved
        }
        
        var mType  = this.f_measurementType;
        var qty    = parseFloat(this.f_qty)    || 0;
        var inches = parseFloat(this.f_inches) || 0;
        var grams  = parseFloat(this.f_grams)  || 0;
        var pair   = parseFloat(this.f_pair)   || 0;

        // ✅ STRICT VALIDATION (ALL REQUIRED > 0)
        if (mType === 'LengthWeight') {
            if (inches <= 0 || grams <= 0) {
                this._toast('❌', 'Both Inches and Grams must be greater than 0', '');
                return;
            }
        } 
        else if (mType === 'Pair') {
            if (pair <= 0) {
                this._toast('❌', 'Pair must be greater than 0', '');
                return;
            }
        } 
        else if (mType === 'QuantityPair') {
            if (qty <= 0 && pair <= 0) {
                this._toast('❌', 'Enter Pieces and/or Pair qty', '');
                return;
            }
        } 
        else if (mType === 'QuantityWeight') {
            if (qty <= 0 || grams <= 0) {
                this._toast('❌', 'Both Qty and Grams must be greater than 0', '');
                return;
            }
        } 
        else if (mType === 'Weight') {
            if (grams <= 0) {
                this._toast('❌', 'Grams must be greater than 0', '');
                return;
            }
        }
        else if (mType === 'LengthQuantity') {
            if (inches <= 0 || qty <= 0) {
                this._toast('❌', 'Both Inches and Pieces must be greater than 0', '');
                return;
            }
        }
        else {
            // Quantity
            if (qty <= 0) {
                this._toast('❌', 'Qty must be greater than 0', '');
                return;
            }
        }

        this.isSaving = true;
        var self = this;

        addStock({
            itemCode:  this.f_itemCode,
            color:     this.f_color || 'Yellow Gold',
            karat:     this.f_karat,
            qty:       qty,
            inches:    inches,
            grams:     grams,
            pair:      pair,
            size:      this.f_size || '',
            changedBy: this.userName || ''
        })
        .then(function() {
            self.isSaving  = false;
            self.showModal = false;
            self._toast('✅', 'Stock added', self.f_itemCode);
            getAllInventory()
                .then(function(res){ self.inventory = res || []; 
                    var codes = [...new Set((res || []).map(function(i) {
                        return i.Item_Code__c;
                    }))];
                    if (codes.length > 0) {
                        getItemMeasurementTypes({ itemCodes: codes })
                            .then(function(map) { self.measurementTypeMap = map || {}; })
                            .catch(function() {});
                    }
                })
                .catch(function(){});
        })
        .catch(function(err) {
            self.isSaving = false;
            self._toast('❌', 'Error', (err.body && err.body.message) || err.message || '');
        });
    }

    _toast(icon, msg, sub) {
        this.dispatchEvent(new CustomEvent('showtoast', {
            bubbles: true, composed: true,
            detail: { icon, message: msg, subMessage: sub }
        }));
    }
}