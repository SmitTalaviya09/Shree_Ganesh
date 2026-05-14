import { LightningElement, track, api } from 'lwc';
import getAllocatableOrders from '@salesforce/apex/JewelryOrderController.getAllocatableOrders';
import getAllInventory       from '@salesforce/apex/JewelryOrderController.getAllInventory';
import allocateStock        from '@salesforce/apex/JewelryOrderController.allocateStock';
import getPicklistValues    from '@salesforce/apex/JewelryOrderController.getPicklistValues';
import updateOrderStage     from '@salesforce/apex/JewelryOrderController.updateOrderStage';
import sendToProduction from '@salesforce/apex/JewelryOrderController.sendToProduction';

const PAGE_SIZE = 5000;
const DEPARTMENT_MAP = {
    'Tiklis Department':     ['Round Tikli','MQS Single Tikli','MQS Double Tikli',
                              'Pear Single Tikli','Pear Double Tikli',
                              'Cluster Tikli','Heart Single Tikli','Outer Ring'],
    'Production Department': ['Chaki Post','Screw & Nose Pin','Linking Chain',
                              'Machine Chain','Black Beads','Lock','Hollow Pipe']
};
export default class JwelCraftAllocateStock extends LightningElement {
    @api userName = '';
    @api userRole = '';

    @track isLoading      = false;
    @track allOrders      = [];
    @track displayedCount = PAGE_SIZE;
    @track inventory      = [];
    @track inventoryMap = {};

    // Filters
    @track searchTerm  = '';
    @track filterKarat = '';
    @track filterColor = '';
    @track filterFrom  = '';
    @track filterTo    = '';
    @track allKaratValues = [];

    // Allocation modal
    @track showModal   = false;
    @track showConfirm = false;
    @track isSaving    = false;
    @track activeOrder = null;

    @track allocQty    = '';
    @track allocInches = '';
    @track allocGrams  = '';
    @track allocValid  = true;
    @track allocError  = '';

    // Move to Ready confirm
    @track showMoveReadyConfirm = false;
    @track moveReadyOrder       = null;
    @track isMovingReady        = false;
    @track allocPair   = '';
    @track openActionMenuId = null;
    outsideClickHandler;

    handleAllocPairInput(e) { this.allocPair = e.target.value; }
    systemDueDays = 1;
    @track filterStage = '';
    @track filterCategory = '';

    getSystemDueDate(orderDate) {
        if (!orderDate) return null;

        var d = new Date(orderDate);
        d.setDate(d.getDate() + this.systemDueDays);
        d.setHours(0, 0, 0, 0);

        return d;
    }

    getDueMeta(orderDate) {
        var dueDate = this.getSystemDueDate(orderDate);

        if (!dueDate) {
            return {
                rowClass: 'tbl-row',
                dueBadge: '',
                dueBadgeClass: ''
            };
        }

        var today = new Date();
        today.setHours(0, 0, 0, 0);

        if (dueDate < today) {
            return {
                rowClass: 'tbl-row order-overdue',
                dueBadge: 'Overdue',
                dueBadgeClass: 'due-badge due-badge-overdue'
            };
        }

        if (dueDate.getTime() === today.getTime()) {
            return {
                rowClass: 'tbl-row order-due-today',
                dueBadge: 'Due Today',
                dueBadgeClass: 'due-badge due-badge-today'
            };
        }

        return {
            rowClass: 'tbl-row',
            dueBadge: '',
            dueBadgeClass: ''
        };
    }
    connectedCallback() {
        this._load();
        this._loadKarats();
        this._loadInventory();
        this.startPolling();
        this.outsideClickHandler = this.handleOutsideClick.bind(this);
        document.addEventListener('click', this.outsideClickHandler);
    }
    startPolling() {
        // Refresh orders every 5 minutes
        this.orderPoller = setInterval(() => {
            this._load();
        }, 300000); // 5 min

        // Refresh inventory every 5 minutes
        this.inventoryPoller = setInterval(() => {
            this._loadInventory();
        }, 300000); // 5 min
    }
    disconnectedCallback(){
        if (this.orderPoller) {
            clearInterval(this.orderPoller);
        }
        if (this.inventoryPoller) {
            clearInterval(this.inventoryPoller);
        }
        if (this.outsideClickHandler) {
            document.removeEventListener('click', this.outsideClickHandler);
        }
    }
    handleOutsideClick(event) {
        var clickedInsideMenu = event.target.closest('.action-menu-wrap');

        if (!clickedInsideMenu) {
            this.openActionMenuId = null;
        }
    }
    _buildInventoryMap() {
        var map = {};

        (this.inventory || []).forEach(function(inv) {

            var kar = inv.Karat__c
                ? String(inv.Karat__c)
                    .toUpperCase()
                    .replace('KT','')
                    .replace('K','')
                    .trim()
                : '';
            var sizeVal = (inv.Size__c && inv.Size__c !== '—')
                ? String(inv.Size__c).toLowerCase().trim()
                : '';
            var key =
                (inv.Item_Code__c || '').toLowerCase()
                + '|'
                + (inv.Color__c || '').toLowerCase()
                + '|'
                + kar
                // + '|'
                +  '|' + sizeVal;

            

            if (!map[key]) {
                map[key] = {
                    Available_Qty__c:    0,
                    Available_Inches__c: 0,
                    Available_Grams__c:  0,
                    Available_Pair__c:   0
                };
            }

            map[key].Available_Qty__c    += (inv.Available_Qty__c || 0);
            map[key].Available_Inches__c += (inv.Available_Inches__c || 0);
            map[key].Available_Grams__c  += (inv.Available_Grams__c || 0);
            map[key].Available_Pair__c   += (inv.Available_Pair__c || 0);
        });

        this.inventoryMap = map;
    }
    _loadInventory() {

        var self = this;

        getAllInventory()
            .then(function(res) {

                self.inventory = res || [];

                self._buildInventoryMap();

            })
            .catch(function(error) {
                console.error('Inventory Load Error', error);
            });
    }

    // _invFor(itemCode, color, karat,size) {

    //     var kar = karat
    //         ? String(karat)
    //             .toUpperCase()
    //             .replace('KT','')
    //             .replace('K','')
    //             .trim()
    //         : '';

    //     var key =
    //         (itemCode || '').toLowerCase()
    //         + '|'
    //         + (color || '').toLowerCase()
    //         + '|'
    //         + kar
    //         + '|'
    //         + String(size || '').toLowerCase().trim();

    //     return this.inventoryMap[key] || null;
    // }
    _invFor(itemCode, color, karat, size) {
        var kar = karat
            ? String(karat).toUpperCase().replace('KT','').replace('K','').trim()
            : '';

        // Normalize size: treat null, undefined, '—', and '' all as ''
        var normalizedSize = (size && size !== '—')
            ? String(size).toLowerCase().trim()
            : '';

        var key =
            (itemCode || '').toLowerCase()
            + '|' + (color || '').toLowerCase()
            + '|' + kar
            + '|' + normalizedSize;

        return this.inventoryMap[key] || null;
    }

    _load() {
        this.isLoading = true;
        var self = this;
        var hiddenStages = ['Dispatched', 'Completed', 'Cancelled', 'Rejected', 'Ready'];
        getAllocatableOrders()
            .then(function(res) {
                self.isLoading    = false;
                self.allOrders    = (res || [])
                .filter(function(o) {
                    return !hiddenStages.includes(o.Current_Stage__c || '');
                })
                .map(function(o) {
                    var total      = o.Quantity__c      || 0;
                    var fulfilled  = o.Fulfilled_Qty__c || 0;
                    var pending    = Math.max(0, total - fulfilled);
                    // var unit       = o.Quantity_Unit__c || 'Pieces';
                    // var isLW       = unit === 'Inches' || unit === 'Grams';
                    var unit   = o.Quantity_Unit__c || 'Pieces';
                    var isLW   = unit === 'Inches' || unit === 'Grams';
                    var isPair = unit === 'Pair';
                    var isQP   = unit === 'QuantityPair';
                    var isQW   = unit === 'QuantityWeight';
                    var pct        = total > 0 ? Math.round((fulfilled / total) * 100) : 0;
                    var stage      = o.Current_Stage__c || 'New';
                    var stageClass = 'stage-pill sp-' + stage.toLowerCase().replace(/ /g,'-');
                    var priClass   = o.Priority__c === 'High' ? 'badge b-h'
                                   : o.Priority__c === 'Low'  ? 'badge b-l' : 'badge b-m';
                    var due        = o.Order_Date__c
                        ? new Date(o.Order_Date__c).toLocaleDateString('en-IN',
                            { day:'numeric', month:'short', year:'numeric' })
                        : '';
                    var dueMeta = self.getDueMeta(o.Order_Date__c);
                    return {
                        id:             o.Id,
                        code:           o.Order_ID_Ref__c || o.Name || '—',
                        customer:       o.Customer_Name__c || '—',
                        itemCategory: o.Item_Category__c || '',
                        customerCode:   o.Customer_Code__c || '',
                        itemCode:       o.Item_Code__c     || '',
                        color:          o.Color__c         || '',
                        karat:          o.Karat__c         || '',
                        size:           o.Size__c          || '—',
                        sizeDisplay:    o.Size__c          || '—',
                        total:          total,
                        fulfilled:      fulfilled,
                        pending:        pending,
                        unit:           unit,
                        isLW:           isLW,
                        isPair:         isPair,   // ✅ ADD
                        isQP:           isQP,     // ✅ ADD
                        isQW:           isQW,
                        pct:            pct,
                        priority:       o.Priority__c      || 'Medium',
                        remark:         o.Remark__c        || '',
                        stage:          stage,
                        isPartialReady: stage === 'Partially Ready',
                        dateRaw:        o.Order_Date__c    || '',
                        dueFormatted:   due,
                        stageClass,
                        priClass,
                        progressClass:  pct === 0   ? 'prog-bar pb-none'
                                      : pct >= 100  ? 'prog-bar pb-full' : 'prog-bar pb-part',
                        progressStyle:  'width:' + pct + '%',
                        hasPending:     pending > 0,
                        rowClass: dueMeta.rowClass,
                        dueBadge: dueMeta.dueBadge,
                        dueBadgeClass: dueMeta.dueBadgeClass
                    };
                });
                self.displayedCount = PAGE_SIZE;
            })
            .catch(function() { self.isLoading = false; });
    }
    handleCategoryFilter(e) {
        this.filterCategory = e.target.value;
        this.displayedCount = PAGE_SIZE;
    }

    handleClearCategory() {
        this.filterCategory = '';
        this.displayedCount = PAGE_SIZE;
    }
    // get categoryOptions() {
    //     var cats = [];

    //     (this.allOrders || []).forEach(function(o) {
    //         if (o.itemCategory && cats.indexOf(o.itemCategory) === -1) {
    //             cats.push(o.itemCategory);
    //         }
    //     });

    //     return cats.sort();
    // }
    get categoryOptions() {
        return ['Tiklis Department', 'Production Department'];
    }

    get categoryFilterClass() {
        return 'fi-wrap' + (this.filterCategory ? ' fi-active' : '');
    }
    _loadKarats() {
        var self = this;
        getPicklistValues()
            .then(function(res) { self.allKaratValues = res.karatValues || []; })
            .catch(function() {});
    }

    // ── Filters ──
    handleSearch(e)      { this.searchTerm  = e.target.value; this.displayedCount = PAGE_SIZE; }
    handleKaratFilter(e) { this.filterKarat = e.target.value; this.displayedCount = PAGE_SIZE; }
    handleColorFilter(e) { this.filterColor = e.target.value; this.displayedCount = PAGE_SIZE; }
    handleFromFilter(e)  { this.filterFrom  = e.target.value; this.displayedCount = PAGE_SIZE; }
    handleToFilter(e)    { this.filterTo    = e.target.value; this.displayedCount = PAGE_SIZE; }
    handleClearKarat()   { this.filterKarat = ''; }
    handleClearColor()   { this.filterColor = ''; }
    handleStageFilter(e) {
        this.filterStage = e.target.value;
        this.displayedCount = PAGE_SIZE;
    }

    handleClearStage() {
        this.filterStage = '';
        this.displayedCount = PAGE_SIZE;
    }
    get stageOptions() {
        var stages = [];

        (this.allOrders || []).forEach(function(o) {
            if (o.stage && stages.indexOf(o.stage) === -1) {
                stages.push(o.stage);
            }
        });

        return stages.sort();
    }
    clearFilters() {
        this.searchTerm = ''; this.filterKarat = ''; this.filterColor = '';
        this.filterFrom = ''; this.filterTo = '' ; this.filterStage = '';
        this.displayedCount = PAGE_SIZE; this.filterCategory = '';
    }
    get stageFilterClass() {
        return 'fi-wrap' + (this.filterStage ? ' fi-active' : '');
    }
    get hasActiveFilters() {
        return !!(this.searchTerm || this.filterKarat || this.filterColor ||
                  this.filterStage || this.filterCategory || this.filterFrom || this.filterTo);
    }
    get colorFilterClass() { return 'fi-wrap' + (this.filterColor ? ' fi-active' : ''); }
    get karatFilterClass() { return 'fi-wrap' + (this.filterKarat ? ' fi-active' : ''); }

    get filteredOrders() {
        var s   = (this.searchTerm  || '').toLowerCase();
        var col = (this.filterColor || '').toLowerCase();
        var cat = (this.filterCategory || '').toLowerCase();
        var kar = (this.filterKarat || '').toLowerCase();
        var stg = (this.filterStage || '').toLowerCase();
        var frm = this.filterFrom;
        var to  = this.filterTo;

        return this.allOrders.filter(function(o) {
            if (s && !(o.code         || '').toLowerCase().includes(s) &&
                     !(o.customer     || '').toLowerCase().includes(s) &&
                     !(o.customerCode || '').toLowerCase().includes(s) &&
                     !(o.itemCode     || '').toLowerCase().includes(s)) return false;
            if (col && (o.color  || '').toLowerCase() !== col) return false;
            // if (cat && String(o.itemCategory || '').toLowerCase() !== cat) return false;
            // AFTER
            if (cat) {
                // Find the matching department key (case-insensitive)
                var deptKey = Object.keys(DEPARTMENT_MAP).find(function(k) {
                    return k.toLowerCase() === cat;
                });
                var allowedCats = deptKey ? DEPARTMENT_MAP[deptKey] : [];
                if (allowedCats.indexOf(o.itemCategory) === -1) return false;
            }
            if (kar && String(o.karat || '').toLowerCase() !== kar) return false;
            if (stg && String(o.stage || '').toLowerCase() !== stg) return false;
            var d = o.dateRaw ? o.dateRaw.substring(0,10) : '';
            if (frm && d && d < frm) return false;
            if (to  && d && d > to)  return false;
            return true;
        });
    }

    // get visibleOrders()   { return this.filteredOrders.slice(0, this.displayedCount); }
    // get visibleOrders() { return this.filteredOrders; }
    // get visibleOrders() {
    //     var self = this;

    //     return this.filteredOrders.map(function(o) {
    //         var inv = self._invFor(o.itemCode, o.color, o.karat);

    //         var stockDisplay = 'No stock';
    //         var stockPillClass = 'stock-pill sp-none';

    //         if (inv) {
    //             if (o.isLW) {
    //                 var inches = inv.Available_Inches__c || 0;
    //                 var grams = inv.Available_Grams__c || 0;

    //                 if (inches > 0 || grams > 0) {
    //                     var parts = [];
    //                     if (inches > 0) parts.push(parseFloat(inches).toFixed(2) + ' in');
    //                     if (grams > 0) parts.push(parseFloat(grams).toFixed(3) + ' g');

    //                     stockDisplay = parts.join(' · ');
    //                     stockPillClass = 'stock-pill sp-ok';
    //                 }
    //             } else if (o.isPair) {
    //                 var pairQty = inv.Available_Pair__c || 0;
    //                 stockDisplay = pairQty + ' Pair';
    //                 stockPillClass = pairQty > 0 ? 'stock-pill sp-ok' : 'stock-pill sp-none';
    //             } else if (o.isQP) {
    //                 var qpQty = inv.Available_Qty__c || 0;
    //                 var qpPair = inv.Available_Pair__c || 0;
    //                 stockDisplay = qpQty + ' pcs · ' + qpPair + ' Pair';
    //                 stockPillClass = (qpQty > 0 || qpPair > 0) ? 'stock-pill sp-ok' : 'stock-pill sp-none';
    //             } else if (o.isQW) {
    //                 var qwQty = inv.Available_Qty__c || 0;
    //                 var qwGrams = inv.Available_Grams__c || 0;
    //                 stockDisplay = qwQty + ' pcs · ' + parseFloat(qwGrams).toFixed(3) + ' g';
    //                 stockPillClass = qwQty > 0 ? 'stock-pill sp-ok' : 'stock-pill sp-none';
    //             } else {
    //                 var qty = inv.Available_Qty__c || 0;
    //                 stockDisplay = qty + ' pcs';
    //                 stockPillClass = qty > 0 ? 'stock-pill sp-ok' : 'stock-pill sp-none';
    //             }
    //         }

    //         return Object.assign({}, o, {
    //             stockDisplay: stockDisplay,
    //             stockPillClass: stockPillClass
    //         });
    //     });
    // }
    get visibleOrders() {
        var self = this;

        return this.filteredOrders.map(function(o) {
            var inv = self._invFor(o.itemCode, o.color, o.karat, o.size);

            var stockDisplay = 'No stock';
            var stockPillClass = 'stock-pill sp-none';

            if (inv) {
                if (o.isLW) {
                    var inches = inv.Available_Inches__c || 0;
                    var grams = inv.Available_Grams__c || 0;

                    if (inches > 0 || grams > 0) {
                        var parts = [];
                        if (inches > 0) parts.push(parseFloat(inches).toFixed(2) + ' in');
                        if (grams > 0) parts.push(parseFloat(grams).toFixed(3) + ' g');
                        stockDisplay = parts.join(' · ');
                        stockPillClass = 'stock-pill sp-ok';
                    }
                } else if (o.isPair) {
                    var pairQty = inv.Available_Pair__c || 0;
                    stockDisplay = pairQty + ' Pair';
                    stockPillClass = pairQty > 0 ? 'stock-pill sp-ok' : 'stock-pill sp-none';
                } else if (o.isQP) {
                    var qpQty = inv.Available_Qty__c || 0;
                    var qpPair = inv.Available_Pair__c || 0;
                    stockDisplay = qpQty + ' pcs · ' + qpPair + ' Pair';
                    stockPillClass = (qpQty > 0 || qpPair > 0) ? 'stock-pill sp-ok' : 'stock-pill sp-none';
                } else if (o.isQW) {
                    var qwQty = inv.Available_Qty__c || 0;
                    var qwGrams = inv.Available_Grams__c || 0;
                    stockDisplay = qwQty + ' pcs · ' + parseFloat(qwGrams || 0).toFixed(3) + ' g';
                    stockPillClass = (qwQty > 0 || qwGrams > 0) ? 'stock-pill sp-ok' : 'stock-pill sp-none';
                } else {
                    var qty = inv.Available_Qty__c || 0;
                    stockDisplay = qty + ' pcs';
                    stockPillClass = qty > 0 ? 'stock-pill sp-ok' : 'stock-pill sp-none';
                }
            }

            return Object.assign({}, o, {
                stockDisplay: stockDisplay,
                stockPillClass: stockPillClass,
                isActionMenuOpen: self.openActionMenuId === o.id
            });
        });
    }
    get totalCount()      { return this.allOrders.length; }
    get filteredCount()   { return this.filteredOrders.length; }
    get hasMore()         { return this.displayedCount < this.filteredOrders.length; }
    get remainingCount()  { return this.filteredOrders.length - this.displayedCount; }
    get hasOrders()       { return this.visibleOrders.length > 0; }
    handleActionMenuToggle(e) {
        e.stopPropagation();
        var rowId = e.currentTarget.dataset.id;
        this.openActionMenuId = this.openActionMenuId === rowId ? null : rowId;
    }

    handleActionMenuClose() {
        this.openActionMenuId = null;
    }

    handleSendToProduction(e) {
        var code = e.currentTarget.dataset.id;
        var self = this;

        this.isLoading = true;
        this.openActionMenuId = null;

        sendToProduction({
            orderId: code,
            changedBy: this.userName || ''
        })
        .then(function(res) {
            self.isLoading = false;

            self._toast(
                '✅',
                'Sent to Production',
                (res && res.message) ? res.message : 'Order moved successfully'
            );

            self._load();
            self._loadInventory();
        })
        .catch(function(err) {
            self.isLoading = false;
            self._toast(
                '❌',
                'Error',
                (err.body && err.body.message) || err.message || ''
            );
        });
    }
    handleLoadMore() {
        this.displayedCount = Math.min(
            this.displayedCount + PAGE_SIZE,
            this.filteredOrders.length
        );
    }

    handleRefresh() { this._load(); this._loadInventory(); }

    // ── Open allocation modal ──
    handleAllocate(e) {
        var id    = e.currentTarget.dataset.id;
        var order = this.allOrders.find(function(o){ return o.id === id; });
        if (!order) return;

        var inv = this._invFor(order.itemCode, order.color, order.karat,order.size);
        if (!inv) {
            this._toast('⚠️', 'No inventory available',
                order.itemCode + ' · ' + order.color + ' · ' + order.karat + ' — no matching stock found');
            return;
        }

        // var isLW = order.isLW;
        // if (!isLW && !(inv.Available_Qty__c > 0)) {
        //     this._toast('⚠️', 'No stock available',
        //         'Available qty is 0 for ' + order.itemCode);
        //     return;
        // }
        // if (isLW && !((inv.Available_Inches__c || 0) > 0 || (inv.Available_Grams__c || 0) > 0)) {
        //     this._toast('⚠️', 'No stock available',
        //         'No inches or grams available for ' + order.itemCode);
        //     return;
        // }
        if (order.isLW) {
            if (!((inv.Available_Inches__c || 0) > 0 || (inv.Available_Grams__c || 0) > 0)) {
                this._toast('⚠️', 'No stock available', 'No inches or grams for ' + order.itemCode);
                return;
            }
        } else if (order.isPair) {
            if (!((inv.Available_Pair__c || 0) > 0)) {
                this._toast('⚠️', 'No stock available', 'No Pair stock for ' + order.itemCode);
                return;
            }
        } else if (order.isQP) {
            if (!((inv.Available_Qty__c || 0) > 0 || (inv.Available_Pair__c || 0) > 0)) {
                this._toast('⚠️', 'No stock available', 'No Pieces or Pair stock for ' + order.itemCode);
                return;
            }
        } else if (order.isQW) {
            if (!((inv.Available_Qty__c || 0) > 0)) {
                this._toast('⚠️', 'No stock available', 'No Pieces stock for ' + order.itemCode);
                return;
            }
        } else {
            if (!((inv.Available_Qty__c || 0) > 0)) {
                this._toast('⚠️', 'No stock available', 'Available qty is 0 for ' + order.itemCode);
                return;
            }
        }

        this.activeOrder = Object.assign({}, order, {
            availQty:    inv.Available_Qty__c    || 0,
            availInches: inv.Available_Inches__c || 0,
            availGrams:  inv.Available_Grams__c  || 0,
            availPair:   inv.Available_Pair__c   || 0
        });
        this.allocQty    = '';
        this.allocInches = '';
        this.allocGrams  = '';
        this.allocPair   = '';
        this.allocValid  = true;
        this.allocError  = '';
        this.showModal   = true;
        this.showConfirm = false;
    }

    handleCloseModal()   { this.showModal   = false; this.activeOrder = null; }
    handleCloseConfirm() { this.showConfirm = false; }
    handleBackToForm()   { this.showConfirm = false; this.showModal   = true; }

    handleAllocQtyInput(e)    { this.allocQty    = e.target.value; }
    handleAllocInchesInput(e) { this.allocInches = e.target.value; }
    handleAllocGramsInput(e)  { this.allocGrams  = e.target.value; }

    get activeIsLW() { return this.activeOrder && this.activeOrder.isLW; }
    get activeIsPair() { return this.activeOrder && this.activeOrder.isPair; }
    get activeIsQP()   { return this.activeOrder && this.activeOrder.isQP; }
    get activeIsQW()   { return this.activeOrder && this.activeOrder.isQW; }
    get activeIsQty()  { return this.activeOrder && !this.activeOrder.isLW
                            && !this.activeOrder.isPair && !this.activeOrder.isQP
                            && !this.activeOrder.isQW; }

    // handleProceedToConfirm() {
    //     if (!this.activeOrder) return;
    //     this.allocValid = true;
    //     this.allocError = '';

    //     if (!this.activeOrder.isLW) {
    //         var qty = parseFloat(this.allocQty);
    //         if (!qty || qty <= 0) {
    //             this.allocValid = false;
    //             this.allocError = 'Enter a valid quantity';
    //             return;
    //         }
    //         if (qty > this.activeOrder.pending) {
    //             this.allocValid = false;
    //             this.allocError = 'Cannot exceed pending qty (' + this.activeOrder.pending + ')';
    //             return;
    //         }
    //     } else {
    //         var inches = parseFloat(this.allocInches);
    //         var grams  = parseFloat(this.allocGrams);
    //         if (isNaN(inches) || inches < 0 || isNaN(grams) || grams < 0) {
    //             this.allocValid = false;
    //             this.allocError = 'Enter valid inches and grams';
    //             return;
    //         }
    //     }
    //     this.showModal   = false;
    //     this.showConfirm = true;
    // }
    handleProceedToConfirm() {
        if (!this.activeOrder) return;
        this.allocValid = true;
        this.allocError = '';
        var o = this.activeOrder;

        if (o.isLW) {
            var inches = parseFloat(this.allocInches) || 0;
            var grams  = parseFloat(this.allocGrams)  || 0;
            if (inches < 0 || grams < 0 || (inches === 0 && grams === 0)) {
                this.allocValid = false;
                this.allocError = 'Enter valid inches and/or grams';
                return;
            }

        } else if (o.isPair) {
            var pair = parseFloat(this.allocPair) || 0;
            if (pair <= 0) {
                this.allocValid = false;
                this.allocError = 'Enter a valid Pair quantity';
                return;
            }
            if (pair > o.pending) {
                this.allocValid = false;
                this.allocError = 'Cannot exceed pending (' + o.pending + ' Pair)';
                return;
            }

        } else if (o.isQP) {
            var qtyQP  = parseFloat(this.allocQty)  || 0;
            var pairQP = parseFloat(this.allocPair) || 0;
            if (qtyQP <= 0 && pairQP <= 0) {
                this.allocValid = false;
                this.allocError = 'Enter Pieces and/or Pair quantity';
                return;
            }

        } else if (o.isQW) {
            var qtyQW = parseFloat(this.allocQty) || 0;
            if (qtyQW <= 0) {
                this.allocValid = false;
                this.allocError = 'Enter a valid Pieces quantity';
                return;
            }
            if (qtyQW > o.pending) {
                this.allocValid = false;
                this.allocError = 'Cannot exceed pending (' + o.pending + ')';
                return;
            }

        } else {
            // Quantity — Pieces
            var qty = parseFloat(this.allocQty) || 0;
            if (qty <= 0) {
                this.allocValid = false;
                this.allocError = 'Enter a valid quantity';
                return;
            }
            if (qty > o.pending) {
                this.allocValid = false;
                this.allocError = 'Cannot exceed pending qty (' + o.pending + ')';
                return;
            }
        }

        this.showModal   = false;
        this.showConfirm = true;
    }

    // handleConfirmAllocate() {
    //     if (!this.activeOrder) return;
    //     this.isSaving = true;
    //     var self  = this;
    //     var qty    = this.activeOrder.isLW ? null : parseFloat(this.allocQty);
    //     var inches = this.activeOrder.isLW ? parseFloat(this.allocInches) : null;
    //     var grams  = this.activeOrder.isLW ? parseFloat(this.allocGrams)  : null;

    //     allocateStock({
    //         orderId:        this.activeOrder.code,
    //         allocateQty:    qty,
    //         allocateInches: inches,
    //         allocateGrams:  grams,
    //         changedBy:      this.userName || ''
    //     })
    //     .then(function(res) {
    //         self.isSaving    = false;
    //         self.showConfirm = false;
    //         self.activeOrder = null;
    //         var label = res.isReady ? '→ Ready' : '→ Partially Ready';
    //         self._toast('✅', 'Stock allocated ' + label, '');
    //         self._load();
    //         self._loadInventory();
    //     })
    //     .catch(function(err) {
    //         self.isSaving = false;
    //         self._toast('❌', 'Error', (err.body && err.body.message) || err.message || '');
    //     });
    // }
    handleConfirmAllocate() {
        if (!this.activeOrder) return;
        this.isSaving = true;
        var self  = this;
        var o     = this.activeOrder;

        allocateStock({
            orderId:        o.code,
            allocateQty:    o.isLW || o.isPair ? null : (parseFloat(this.allocQty) || null),
            allocateInches: o.isLW  ? (parseFloat(this.allocInches) || null) : null,
            allocateGrams:  (o.isLW || o.isQW) ? (parseFloat(this.allocGrams) || null) : null,
            allocatePair:   (o.isPair || o.isQP) ? (parseFloat(this.allocPair) || null) : null,
            changedBy:      this.userName || ''
        })
        .then(function(res) {
            self.isSaving    = false;
            self.showConfirm = false;
            self.activeOrder = null;
            var label = res.isReady ? '→ Ready' : '→ Partially Ready';
            self._toast('✅', 'Stock allocated ' + label, '');
            self._load();
            self._loadInventory();
        })
        .catch(function(err) {
            self.isSaving = false;
            self._toast('❌', 'Error', (err.body && err.body.message) || err.message || '');
        });
    }

    // get confirmQtyLabel() {
    //     if (!this.activeOrder) return '';
    //     if (this.activeOrder.isLW) {
    //         return (this.allocInches || '0') + ' in · ' + (this.allocGrams || '0') + ' g';
    //     }
    //     return this.allocQty + ' ' + this.activeOrder.unit;
    // }
    get confirmQtyLabel() {
        if (!this.activeOrder) return '';
        var o = this.activeOrder;
        if (o.isLW)   return (this.allocInches || '0') + ' in · ' + (this.allocGrams || '0') + ' g';
        if (o.isPair) return (this.allocPair   || '0') + ' Pair';
        if (o.isQP)   return (this.allocQty   || '0') + ' pcs · ' + (this.allocPair || '0') + ' Pair';
        if (o.isQW)   return (this.allocQty   || '0') + ' pcs · ' + (this.allocGrams || '0') + ' g';
        return (this.allocQty || '0') + ' ' + o.unit;
    }
    get confirmOrderCode()  { return this.activeOrder ? this.activeOrder.code     : ''; }
    get confirmItemCode()   { return this.activeOrder ? this.activeOrder.itemCode : ''; }
    // get confirmWillBeReady() {
    //     if (!this.activeOrder || this.activeOrder.isLW) return false;
    //     return parseFloat(this.allocQty) >= this.activeOrder.pending;
    // }
    get confirmWillBeReady() {
        if (!this.activeOrder) return false;
        var o = this.activeOrder;
        if (o.isLW) return false; // LW — can't predict
        if (o.isPair) return (parseFloat(this.allocPair) || 0) >= o.pending;
        return (parseFloat(this.allocQty) || 0) >= o.pending;
    }

    // ── Move Partially Ready → Ready ──────────────────────────
    handleMoveToReady(e) {
        var id    = e.currentTarget.dataset.id;
        var order = this.allOrders.find(function(o){ return o.id === id; });
        if (!order || order.stage !== 'Partially Ready') return;
        this.moveReadyOrder       = order;
        this.showMoveReadyConfirm = true;
    }

    handleCloseMoveReady()   { this.showMoveReadyConfirm = false; this.moveReadyOrder = null; }

    handleConfirmMoveReady() {
        if (!this.moveReadyOrder) return;
        this.isMovingReady = true;
        var self = this;
        updateOrderStage({
            orderId:      this.moveReadyOrder.code,
            customerName: this.moveReadyOrder.customer || '',
            // newStage:     'Ready',
            newStage:     'Dispatched',
            changedBy:    this.userName || ''
        })
        .then(function() {
            self.isMovingReady        = false;
            self.showMoveReadyConfirm = false;
            self.moveReadyOrder       = null;
            self._toast('✅', 'Order moved to Ready', '');
            self._load();
        })
        .catch(function(err) {
            self.isMovingReady = false;
            self._toast('❌', 'Error', (err.body && err.body.message) || err.message || '');
        });
    }

    get moveReadyOrderCode() { return this.moveReadyOrder ? this.moveReadyOrder.code    : ''; }
    get moveReadyPending()   { return this.moveReadyOrder ? this.moveReadyOrder.pending  : 0; }
    get moveReadyUnit()      { return this.moveReadyOrder ? this.moveReadyOrder.unit     : ''; }
    get moveReadyFulfilled() { return this.moveReadyOrder ? this.moveReadyOrder.fulfilled: 0; }

    _toast(icon, msg, sub) {
        this.dispatchEvent(new CustomEvent('showtoast', {
            bubbles: true, composed: true,
            detail: { icon, message: msg, subMessage: sub }
        }));
    }
}