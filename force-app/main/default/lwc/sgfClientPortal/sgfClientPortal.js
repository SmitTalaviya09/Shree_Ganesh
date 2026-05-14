import { LightningElement, track } from 'lwc';
import verifyClient                  from '@salesforce/apex/SGFClientPortalController.verifyClient';
import placeClientOrders             from '@salesforce/apex/SGFClientPortalController.placeClientOrders';
import getClientPicklistValues       from '@salesforce/apex/SGFClientPortalController.getClientPicklistValues';
import getClientItemMeasurementTypes from '@salesforce/apex/SGFClientPortalController.getClientItemMeasurementTypes';
import getMyOrders                   from '@salesforce/apex/SGFClientPortalController.getMyOrders';
import getClientItemCodesByCategory from '@salesforce/apex/SGFClientPortalController.getClientItemCodesByCategory';
import getClientItemSizeMap         from '@salesforce/apex/SGFClientPortalController.getClientItemSizeMap';
import shreeganesh_Logo from '@salesforce/resourceUrl/shreeganesh_Logo';
import CATALOGUE_PDF from '@salesforce/resourceUrl/SGFCatalogue';

var UNIT_MAP = {
    'Quantity':       ['Pieces'],
    'LengthWeight':   ['Inches', 'Grams'],
    'Pair':           ['Pair'],
    'QuantityPair':   ['Pieces', 'Pair'],
    'QuantityWeight': ['Pieces', 'Grams'],
    'LengthQuantity' : ['Inches', 'Pieces'],
    'Weight' : ['Grams']
};
var DEFAULT_UNIT = {
    'Quantity': 'Pieces', 'LengthWeight': 'Inches',
    'Pair': 'Pair', 'QuantityPair': 'Pieces', 'QuantityWeight': 'Pieces','LengthQuantity': 'Inches' ,'Weight' : 'Grams'
};
var STEP_MAP = { 'Pieces': '1', 'Pair': '1', 'Inches': '0.01', 'Grams': '0.001' };
var SIZE_OPTIONS_BY_ITEM = {
    Breslet: ['1.0 mm','1.1 mm','1.2 mm','1.3 mm','1.4 mm','1.5 mm','1.6 mm','1.7 mm','1.8 mm','1.9 mm','2.0 mm','2.5 mm','3.0 mm','3.5 mm'],
    Ring:     ['1.0 mm','1.1 mm','1.2 mm','1.3 mm','1.4 mm','1.5 mm','1.6 mm','1.7 mm','1.8 mm','1.9 mm','2.0 mm','2.5 mm'],
    Neklesh: ['1.5 mm','2.0 mm','2.5 mm']
};

// Static color options with gradient swatches
var COLOR_OPTIONS = [
    { value: 'Yellow Gold', label: 'Yellow Gold', swatchStyle: 'background:linear-gradient(135deg,#f5c842,#c8960c)' },
    { value: 'White Gold',  label: 'White Gold',  swatchStyle: 'background:linear-gradient(135deg,#e8e8e8,#aaaaaa)' },
    { value: 'Rose Gold',   label: 'Rose Gold',   swatchStyle: 'background:linear-gradient(135deg,#f4a98a,#c96a3a)' },
    { value: 'Silver',      label: 'Silver',      swatchStyle: 'background:linear-gradient(135deg,#d0d0d0,#808080)' }
];
var SESSION_KEY = 'sgf_client_portal_session';
var SESSION_HOURS = 12;

export default class SgfClientPortal extends LightningElement {

    // Screens: 'login' | 'app'
    @track screen    = 'login';
    @track activeTab = 'order';  // 'order' | 'myorders'

    // Login
    @track loginGst    = '';
    @track loginMobile = '';
    @track loginError  = '';
    @track isVerifying = false;

    // Session
    @track clientName   = '';
    @track clientGst    = '';
    @track clientMobile = '';

    // Picklists
    @track allItemCodes   = [];
    @track allKaratValues = [];
    @track allQtyUnits    = [];

    // Order lines
    @track orderLines   = [];
    @track isSubmitting = false;

    // Flow state: 'form' | 'preview' | 'confirm'
    @track orderFlowState = 'form';

    // Confirmation
    @track confirmedOrders = [];

    // My Orders
    @track myOrders        = [];
    @track myOrdersLoading = false;

    // Toast
    @track toastMsg  = '';
    @track toastType = '';
    @track showToast = false;
    @track gemIcon = shreeganesh_Logo;
    pollingInterval;
    // Category + Size maps
    allItemCategoryMap = {};   // { 'Rings': ['RING-001', ...], ... }
    allItemSizeMap     = {};   // { 'RING-001': '7', ... }
    @track categoryOptions = [];

    // ════════════ SCREEN GETTERS ════════════
    get isLoginScreen()     { return this.screen === 'login'; }
    get isAppScreen()       { return this.screen === 'app'; }
    get isTabOrder()        { return this.activeTab === 'order'; }
    get isTabMyOrders()     { return this.activeTab === 'myorders'; }
    get showPreview()       { return this.orderFlowState === 'preview'; }
    get showConfirmation()  { return this.orderFlowState === 'confirm'; }
    // Hide form when preview OR confirm is showing
    get showPreviewOrConfirm() { return this.orderFlowState === 'preview' || this.orderFlowState === 'confirm'; }

    get tabOrderClass()    { return 'tab-btn' + (this.activeTab === 'order'    ? ' tab-active' : ''); }
    get tabMyOrdersClass() { return 'tab-btn' + (this.activeTab === 'myorders' ? ' tab-active' : ''); }
    get toastClass()       { return 'toast toast-' + this.toastType; }
    get verifyBtnLabel()   { return this.isVerifying  ? 'Verifying…'      : 'Verify & Continue →'; }
    get submitBtnLabel()   { return this.isSubmitting ? 'Processing…'     : '👁 Preview Order'; }
    get hasLines()         { return this.orderLines.length > 0; }
    get hasMyOrders()      { return this.myOrders.length > 0; }
    get totalQty() {
        return this.orderLines.reduce(function(s, l) { return s + (parseFloat(l.quantity) || 0); }, 0);
    }

    // Color options exposed to template (static)
    get colorOptions() {
        return COLOR_OPTIONS;
    }
    getAllowedSizesForItem(itemCode) {

        var code = (itemCode || '').toLowerCase();

        if (code.includes('breslet')) {
            return SIZE_OPTIONS_BY_ITEM.Breslet;
        }

        if (code.includes('ring')) {
            return SIZE_OPTIONS_BY_ITEM.Ring;
        }

        if (code.includes('neklesh')) {
            return SIZE_OPTIONS_BY_ITEM.Neklesh;
        }

        return [];
    }

    buildSizeOptions(sizes, selectedValue) {

        return (sizes || []).map(function(s) {
            return {
                value: s,
                label: s,
                selected: s === selectedValue
            };
        });
    }

    connectedCallback() {
        const style = document.createElement('style');
                    style.innerText = `
                    .cCenterPanel.slds-m-top--x-large.slds-p-horizontal--medium{
                        margin: 0px !important;
                        padding: 0px !important;
                        max-width: unset !important;
                    }
                    .slds-col--padded.contentRegion.comm-layout-column{
                        padding: 0px !important;
                    }
                
                `;
                     setTimeout(() => {
                        this.template.querySelector('.overrideStyle').appendChild(style);
                    }, 200);
                this.restoreClientSession();
    }
    // ════════════ LOGIN ════════════
    handleGstInput(e)    { this.loginGst    = e.target.value; this.loginError = ''; }
    handleMobileInput(e) { this.loginMobile = e.target.value; this.loginError = ''; }
    handleDownloadCatalogue() {
        var a = document.createElement('a');
        a.href     = CATALOGUE_PDF;           // resolved Salesforce CDN URL
        a.download = 'SGF_Catalogue.pdf';     // filename shown in browser Save-As
        a.target   = '_blank';                // fallback: opens in new tab if download blocked
        a.rel      = 'noopener noreferrer';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }
    isValidManualSize(sizeValue) {
        if (!sizeValue) return false;
        // Only accepts: 5.0 mm, 5.1 mm, 21.0 mm
        var pattern = /^\d+\.\d\s+mm$/i;
        return pattern.test(sizeValue.trim());
    }
    handleVerify() {
        if (!this.loginGst.trim() || !this.loginMobile.trim()) {
            this.loginError = 'Please enter both GST Number and Mobile Number.';
            return;
        }
        this.isVerifying = true;
        var self = this;
        verifyClient({ gstNumber: this.loginGst.trim(), mobileNo: this.loginMobile.trim() })
            .then(function(res) {
                self.isVerifying = false;
                if (!res.verified) { self.loginError = res.message; return; }
                self.clientName   = res.clientName;
                self.clientGst    = res.gstNumber;
                self.clientMobile = res.mobileNo;
                self.saveClientSession();
                self._loadPicklists();
            })
            .catch(function(err) {
                self.isVerifying = false;
                self.loginError  = (err.body && err.body.message) || 'Verification failed. Try again.';
            });
    }
    saveClientSession() {
        var expiresAt = new Date().getTime() + (SESSION_HOURS * 60 * 60 * 1000);

        var data = {
            clientName: this.clientName,
            clientGst: this.clientGst,
            clientMobile: this.clientMobile,
            expiresAt: expiresAt
        };

        localStorage.setItem(SESSION_KEY, JSON.stringify(data));
    }

    restoreClientSession() {
        var raw = localStorage.getItem(SESSION_KEY);

        if (!raw) {
            return;
        }

        try {
            var data = JSON.parse(raw);
            var now = new Date().getTime();

            if (!data.expiresAt || now > data.expiresAt) {
                localStorage.removeItem(SESSION_KEY);
                return;
            }

            this.clientName = data.clientName || '';
            this.clientGst = data.clientGst || '';
            this.clientMobile = data.clientMobile || '';

            if (this.clientGst && this.clientMobile) {
                this._loadPicklists();
            }

        } catch (e) {
            localStorage.removeItem(SESSION_KEY);
        }
    }

    clearClientSession() {
        localStorage.removeItem(SESSION_KEY);
    }
    // _loadPicklists() {
    //     var self = this;
    //     // Load category map
    //     getClientItemCodesByCategory()
    //         .then(function(res) {
    //             self.allItemCategoryMap = res || {};
    //             self.categoryOptions    = Object.keys(res || {});
    //         })
    //         .catch(function() {});

    //     getClientItemSizeMap()
    //         .then(function(res) {
    //             self.allItemSizeMap = res || {};
    //         })
    //         .catch(function() {});

    //     getClientPicklistValues()
    //         .then(function(res) {
    //             self.allItemCodes   = res.itemCodes   || [];
    //             self.allKaratValues = res.karatValues || [];
    //             self.allQtyUnits    = res.qtyUnits    || ['Pieces'];
    //             self.screen         = 'app';
    //             self.activeTab      = 'order';
    //             self.orderFlowState = 'form';
    //             self._addLine();
    //         })
    //         .catch(function() {
    //             self.screen         = 'app';
    //             self.activeTab      = 'order';
    //             self.orderFlowState = 'form';
    //             self._addLine();
    //         });
    // }
    _loadPicklists() {
    var self = this;

    // ✅ Load all 3 in parallel, then set screen ready
    // var p1 = getClientItemCodesByCategory()
    //     .then(function(res) {
    //         self.allItemCategoryMap = res || {};
    //         self.categoryOptions    = Object.keys(res || {});
    //     })
    //     .catch(function() {});
    var p1 = getClientItemCodesByCategory()
    .then(function(res) {
        self.allItemCategoryMap = res || {};

        if (!self.allItemCategoryMap['Uncategorized']) {
            self.allItemCategoryMap['Uncategorized'] = [];
        }

        self.categoryOptions = Object.keys(self.allItemCategoryMap).sort();
    })
    .catch(function() {});

    // ✅ getItemSizeMap — wait for this before screen shows
    var p2 = getClientItemSizeMap()
        .then(function(res) {
            self.allItemSizeMap = res || {};
            console.log('Size map loaded:', JSON.stringify(self.allItemSizeMap));
        })
        .catch(function() {});

    var p3 = getClientPicklistValues()
        .then(function(res) {
            self.allItemCodes   = res.itemCodes   || [];
            // ✅ Filter out 9K from karat values
            self.allKaratValues = (res.karatValues || []).filter(function(k) {
                return k !== '9K';
            });
            self.allQtyUnits    = res.qtyUnits    || ['Pieces'];
        })
        .catch(function() {});

    // ✅ Wait for ALL to finish before showing app
    Promise.all([p1, p2, p3])
        .then(function() {
            self.screen         = 'app';
            self.activeTab      = 'order';
            self.orderFlowState = 'form';
            self._addLine();
        })
        .catch(function() {
            self.screen         = 'app';
            self.activeTab      = 'order';
            self.orderFlowState = 'form';
            self._addLine();
        });
}

    // ════════════ TABS ════════════
    // handleTabOrder() {
    //     this.activeTab = 'order';
    //     if (this.orderFlowState === 'confirm') {
    //         this.orderFlowState = 'form';
    //     }
    // }
    handleTabOrder() {
        this.activeTab = 'order';
        this.stopPolling(); 

        if (this.orderFlowState === 'confirm') {
            this.orderFlowState = 'form';
        }
    }
    disconnectedCallback() {
        this.stopPolling();
    }
    handleTabMyOrders() {
        this.activeTab = 'myorders';
        this._loadMyOrders();
        this.startPolling();
    }
    startPolling() {
        // Avoid duplicate intervals
        if (this.pollingInterval) return;

        this.pollingInterval = setInterval(() => {
            if (this.activeTab === 'myorders') {
                this._loadMyOrders();
            }
        }, 60000); // ⏱ refresh every 10 sec (adjust as needed)
    }

    stopPolling() {
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
        }
    }
    // ════════════ MY ORDERS ════════════
    _loadMyOrders() {
        this.myOrdersLoading = true;
        var self = this;
        getMyOrders({ gstNumber: this.clientGst, mobileNo: this.clientMobile })
            .then(function(res) {
                self.myOrdersLoading = false;
                self.myOrders = (res || []).map(function(o, idx) {
                    var stage      = (o.Current_Stage__c || '').trim();
                    // var isRejected = stage === 'Rejected';
                    // var isPending  = stage === 'Pending Review' || stage === 'Client New' || stage === '';
                    // var statusClass = isRejected ? 'status-badge status-rejected'
                    //                 : isPending  ? 'status-badge status-pending'
                    //                 :              'status-badge status-accepted';
                    var rowClass  = isRejected ? 'tr-rejected' : '';
                    var uiStatus = '';
                    var isRejected = false;
                    if (stage === 'Rejected') {
                        uiStatus = 'Rejected';
                        isRejected = true;
                    } else if (stage === 'Completed') {
                        uiStatus = 'Completed';
                    } else if (stage === 'Pending Review' || stage === 'Client New' || stage === '') {
                        uiStatus = 'Pending Review';
                    } else {
                        uiStatus = 'Accepted';  // ✅ everything else
                    }

                    var statusClass =
                        uiStatus === 'Rejected' ? 'status-badge status-rejected' :
                        uiStatus === 'Pending Review' ? 'status-badge status-pending' :
                        uiStatus === 'Completed' ? 'status-badge status-completed' :
                        'status-badge status-accepted';
                    var cardClass = isRejected ? 'mo-card card-rejected' : 'mo-card';
                    var orderDate = o.Order_Date__c
                        ? new Date(o.Order_Date__c).toLocaleDateString('en-IN',
                            { day: 'numeric', month: 'short', year: 'numeric' })
                        : '—';
                    return {
                        id: o.Id, srNo: idx + 1,
                        code: o.Order_ID_Ref__c || '—', itemCode: o.Item_Code__c || '—',
                        color: o.Color__c || '—', karat: o.Karat__c || '—',
                        qty: o.Quantity__c || 0, unit: o.Quantity_Unit__c || 'Pieces',
                        orderDate: orderDate, stage: stage,
                        // statusLabel: stage || 'Unknown',
                        statusLabel: uiStatus,
                        statusClass: statusClass, rowClass: rowClass, cardClass: cardClass,
                        isRejected: isRejected,
                        reason: (o.Rejection_Reason__c || 'No reason provided.').trim()
                    };
                });
            })
            .catch(function() {
                self.myOrdersLoading = false;
                self._toast('error', 'Could not load orders. Please try again.');
            });
    }

    // ════════════ ORDER FORM ════════════
    _newLine() {
        var num      = this.orderLines.length + 1;
        // var defKarat = this.allKaratValues.length ? this.allKaratValues[0] : '';
        var defKarat = '';
        return {
            id:               'ln-' + Date.now() + '-' + num,
            num:              num,
            category:           '',
            catLabel:           'Select category…',
            catClass:           'pick-placeholder',
            catTriggerClass:    'pick-trigger',
            showCatPick:        false,
            catSearch:          '',
            filteredCatOptions: this.categoryOptions,
            hasCatOptions:      this.categoryOptions.length > 0,
            itemCode:         '',
            itemLabel:        'Select item…',
            itemClass:        'pick-placeholder',
            itemTriggerClass: 'pick-trigger',
            showPick:         false,
            pickSearch:       '',
            // filteredItems:    this.allItemCodes,
            filteredItems:    [], 
            hasItems:         this.allItemCodes.length > 0,
            color:            '',
            showColorPick:    false,
            colorTriggerClass:'pick-trigger',
            colorError:       false,
            karat:            '',
            showKaratPick:    false,
            karatTriggerClass:'pick-trigger',
            karatError:       false,
            // size:             '',
            size:             '',
            sizeOptions:       [],
            hasSizeOptions:    false,
            sizeIsAuto:       false,
            sizeInputClass:     'inp',
            measureType:      '',
            qtyUnitOptions:   [],
            qtyUnit:          '',
            qtyStep:          '1',
            quantity:         '',
            qtyError:         false,
            qtyInputClass:    'inp inp-qty',
            priority:         'Medium',
            dueDate:          '',
            remark:           '',
            // Preview display helpers
            sizeDisplay:      '—',
            dueDateDisplay:   '—',
            remarkDisplay:    '—',
            priorityClass:    'pv-priority-med'
        };
    }
    // ── Category picklist open/close (toggle) ──
    handleCatPickOpen(e) {
        e.stopPropagation();
        var id   = e.currentTarget.dataset.id;
        var self = this;

        this.orderLines = this.orderLines.map(function(l) {
            if (l.id === id) {
                var isOpen = l.showCatPick;
                if (isOpen) return Object.assign({}, l, { showCatPick: false });

                return Object.assign({}, l, {
                    showCatPick:        true,
                    showPick:           false,
                    showColorPick:      false,
                    showKaratPick:      false,
                    catSearch:          '',
                    filteredCatOptions: self.categoryOptions,
                    hasCatOptions:      self.categoryOptions.length > 0
                });
            }
            return Object.assign({}, l, {
                showCatPick: false, showPick: false,
                showColorPick: false, showKaratPick: false
            });
        });
    }

    // ── Category search ──
    handleCatSearch(e) {
        var id   = e.target.dataset.id;
        var s    = (e.target.value || '').toLowerCase();
        var self = this;

        var filtered = s
            ? this.categoryOptions.filter(function(c) { return c.toLowerCase().includes(s); })
            : this.categoryOptions;

        this.orderLines = this.orderLines.map(function(l) {
            if (l.id !== id) return l;
            return Object.assign({}, l, {
                catSearch:          e.target.value,
                filteredCatOptions: filtered,
                hasCatOptions:      filtered.length > 0
            });
        });
    }

    // ── Category selected ──
    // handleCatSelect(e) {
    //     var id       = e.currentTarget.dataset.id;
    //     var category = e.currentTarget.dataset.value;
    //     var self     = this;

    //     var itemsInCat = category ? (self.allItemCategoryMap[category] || []) : [];

    //     this.orderLines = this.orderLines.map(function(l) {
    //         if (l.id !== id) return l;
    //         return Object.assign({}, l, {
    //             // Category updated
    //             category:           category,
    //             catLabel:           category,
    //             catClass:           'pick-selected',
    //             catTriggerClass:    'pick-trigger pick-trigger-selected',
    //             showCatPick:        false,
    //             catSearch:          '',
    //             // Reset item code
    //             itemCode:           '',
    //             itemLabel:          'Select item…',
    //             itemClass:          'pick-placeholder',
    //             itemTriggerClass:   'pick-trigger',
    //             showPick:           false,
    //             filteredItems:      itemsInCat,
    //             hasItems:           itemsInCat.length > 0,
    //             // Reset size
    //             size:               '',
    //             sizeIsAuto:         false,
    //             // Reset other fields
    //             color:              '',
    //             colorTriggerClass:  'pick-trigger',
    //             colorError:         false,
    //             karat:              '',
    //             karatTriggerClass:  'pick-trigger',
    //             karatError:         false,
    //             qtyUnitOptions:     [],
    //             qtyUnit:            '',
    //             quantity:           '',
    //             qtyError:           false,
    //             qtyInputClass:      'inp inp-qty',
    //             measureType:        '',
    //             sizeInputClass: 'inp'
    //         });
    //     });
    // }
    handleCatSelect(e) {
        var id       = e.currentTarget.dataset.id;
        var category = e.currentTarget.dataset.value;
        var self     = this;

        // ✅ Get item codes for selected category (including Uncategorized)
        var itemsInCat = category
            ? (self.allItemCategoryMap[category] || [])
            : [];

        this.orderLines = this.orderLines.map(function(l) {
            if (l.id !== id) return l;

            var u = Object.assign({}, l, {
                // ── Category update ──
                category:           category,
                catLabel:           category,
                catClass:           'pick-selected',
                catTriggerClass:    'pick-trigger pick-trigger-selected',
                showCatPick:        false,
                catSearch:          '',

                // ── Reset item ──
                itemCode:           '',
                itemLabel:          'Select item…',
                itemClass:          'pick-placeholder',
                itemTriggerClass:   'pick-trigger',
                showPick:           false,
                filteredItems:      itemsInCat,
                hasItems:           itemsInCat.length > 0,
                size:               '',
                sizeIsAuto:         false,
                sizeInputClass:     'inp',
                sizeOptions:       [],
                hasSizeOptions:    false,
                // ── Reset dependent fields ──
                qtyUnitOptions:     [],
                qtyUnit:            '',
                quantity:           '',
                measureType:        '',
                qtyStep:            '1',
                qtyError:           false,
                qtyInputClass:      'inp inp-qty'
            });

            // ✅ IMPORTANT: If user already typed size → try auto match again
            if (u.size) {
                var matches = self.getMatchingClientItemCodes(category, u.size);

                if (matches.length === 1) {
                    var matchedCode = matches[0];
                    var fullSize    = self.allItemSizeMap[matchedCode] || '';

                    u.itemCode = matchedCode;
                    u.itemLabel = matchedCode;
                    u.itemClass = 'pick-selected';
                    u.filteredItems = [matchedCode];
                    u.hasItems = true;

                    if (fullSize) {
                        u.size = fullSize;
                        u.sizeIsAuto = true;
                        u.sizeInputClass = 'inp inp-auto';
                    }
                }
            }

            return u;
        });
    }
    normalizeSize(sizeValue) {
        if (!sizeValue) {
            return '';
        }

        var txt = String(sizeValue).toLowerCase().trim();
        txt = txt.replace(/mm/g, '');
        txt = txt.replace(/\s*x\s*/g, ' x ');
        txt = txt.replace(/\(\s*/g, '(');
        txt = txt.replace(/\s*\)/g, ')');
        txt = txt.replace(/\s+/g, ' ').trim();

        return txt;
    }

    getSizeFirstPart(sizeValue) {
        var normalized = this.normalizeSize(sizeValue);
        if (!normalized) {
            return '';
        }

        return normalized.split(' x ')[0].trim();
    }

    getMatchingClientItemCodes(category, size) {
    var self = this;

    if (!category || !size) {
        return [];
    }

    var normalizedInput = self.normalizeSize(size);
    var inputFirstPart  = self.getSizeFirstPart(size);
    var itemCodes       = self.allItemCategoryMap[category] || [];

    // 1. Exact full match first
    var exactMatches = itemCodes.filter(function(code) {
        var metadataSize = self.allItemSizeMap[code] || '';
        return self.normalizeSize(metadataSize) === normalizedInput;
    });

    if (exactMatches.length) {
        return exactMatches;
    }

    // 2. If no exact match, try first-part match only
    var partialMatches = itemCodes.filter(function(code) {
        var metadataSize = self.allItemSizeMap[code] || '';
        var metadataFirstPart = self.getSizeFirstPart(metadataSize);
        return metadataFirstPart === inputFirstPart;
    });

    return partialMatches;
}
handleSizeTyping(e) {
    var id  = e.target.dataset.id;
    var val = e.target.value;

    this.orderLines = this.orderLines.map(function(l) {
        if (l.id !== id) return l;

        return Object.assign({}, l, {
            size: val,
            sizeIsAuto: false,
            sizeInputClass: 'inp'
        });
    });
}
// handleSizeCommit(e) {
//     var id   = e.target.dataset.id;
//     var val  = e.target.value;
//     var self = this;
//     var matchedCodeToLoad = '';

//     this.orderLines = this.orderLines.map(function(l) {
//         if (l.id !== id) return l;

//         var u = Object.assign({}, l);

//         u.size = val;
//         u.sizeIsAuto = false;
//         u.sizeInputClass = 'inp';

//         var matches = self.getMatchingClientItemCodes(u.category, val);

//         if (matches.length === 1) {
//             var matchedCode = matches[0];
//             var fullSize = self.allItemSizeMap[matchedCode] || '';

//             u.itemCode = matchedCode;
//             u.itemLabel = matchedCode;
//             u.itemClass = 'pick-selected';
//             u.itemTriggerClass = 'pick-trigger';
//             u.filteredItems = [matchedCode];
//             u.hasItems = true;

//             if (fullSize) {
//                 u.size = fullSize;
//                 u.sizeIsAuto = true;
//                 u.sizeInputClass = 'inp inp-auto';
//             }

//             u.qtyUnitOptions = [];
//             u.qtyUnit = '';
//             u.quantity = '';
//             u.measureType = '';
//             u.qtyStep = '1';
//             u.qtyError = false;
//             u.qtyInputClass = 'inp inp-qty';

//             matchedCodeToLoad = matchedCode;

//         } else if (matches.length > 1) {
//             u.itemCode = '';
//             u.itemLabel = 'Select item…';
//             u.itemClass = 'pick-placeholder';
//             u.itemTriggerClass = 'pick-trigger';
//             u.filteredItems = matches;
//             u.hasItems = true;

//         } else {
//             u.itemCode = '';
//             u.itemLabel = 'Select item…';
//             u.itemClass = 'pick-placeholder';
//             u.itemTriggerClass = 'pick-trigger';
//             u.filteredItems = u.category ? (self.allItemCategoryMap[u.category] || []) : [];
//             u.hasItems = u.filteredItems.length > 0;
//         }

//         return u;
//     });

//     if (matchedCodeToLoad) {
//         getClientItemMeasurementTypes({ itemCodes: [matchedCodeToLoad] })
//             .then(function(map) {
//                 var mType   = map[matchedCodeToLoad] || 'Quantity';
//                 var units   = (UNIT_MAP[mType] || ['Pieces']).map(function(u) {
//                     return { value: u, label: u };
//                 });
//                 var defUnit = DEFAULT_UNIT[mType] || units[0].value;

//                 self.orderLines = self.orderLines.map(function(l) {
//                     if (l.id !== id) return l;
//                     return Object.assign({}, l, {
//                         measureType:    mType,
//                         qtyUnitOptions: units,
//                         qtyUnit:        defUnit,
//                         qtyStep:        STEP_MAP[defUnit] || '1',
//                         quantity:       '',
//                         qtyError:       false,
//                         qtyInputClass:  'inp inp-qty',
//                         karat:          l.karat || (self.allKaratValues[0] || '')
//                     });
//                 });
//             })
//             .catch(function() {
//                 self.orderLines = self.orderLines.map(function(l) {
//                     if (l.id !== id) return l;
//                     return Object.assign({}, l, {
//                         measureType:    'Quantity',
//                         qtyUnitOptions: [{ value: 'Pieces', label: 'Pieces' }],
//                         qtyUnit:        'Pieces',
//                         qtyStep:        '1'
//                     });
//                 });
//             });
//     }
// }
handleSizeCommit(e) {
    var id   = e.target.dataset.id;
    var val  = e.target.value;
    var self = this;
    var matchedCodeToLoad = '';

    this.orderLines = this.orderLines.map(function(l) {
        if (l.id !== id) return l;

        var u = Object.assign({}, l);

        u.size = val;
        u.sizeIsAuto = false;
        u.sizeInputClass = 'inp';

        // ✅ IMPORTANT FIX:
        // If item code is already selected, do not clear/re-match item code.
        if (u.itemCode) {
            if (u.hasSizeOptions) {
                u.sizeOptions = self.buildSizeOptions(
                    self.getAllowedSizesForItem(u.itemCode),
                    val
                );
            }
            return u;
        }

        var matches = self.getMatchingClientItemCodes(u.category, val);

        if (matches.length === 1) {
            var matchedCode = matches[0];
            var fullSize = self.allItemSizeMap[matchedCode] || '';

            u.itemCode = matchedCode;
            u.itemLabel = matchedCode;
            u.itemClass = 'pick-selected';
            u.itemTriggerClass = 'pick-trigger';
            u.filteredItems = [matchedCode];
            u.hasItems = true;

            if (fullSize) {
                u.size = fullSize;
                u.sizeIsAuto = true;
                u.sizeInputClass = 'inp inp-auto';
            }

            u.qtyUnitOptions = [];
            u.qtyUnit = '';
            u.quantity = '';
            u.measureType = '';
            u.qtyStep = '1';
            u.qtyError = false;
            u.qtyInputClass = 'inp inp-qty';

            matchedCodeToLoad = matchedCode;

        } else if (matches.length > 1) {
            u.itemCode = '';
            u.itemLabel = 'Select item…';
            u.itemClass = 'pick-placeholder';
            u.itemTriggerClass = 'pick-trigger';
            u.filteredItems = matches;
            u.hasItems = true;

        } else {
            u.itemCode = '';
            u.itemLabel = 'Select item…';
            u.itemClass = 'pick-placeholder';
            u.itemTriggerClass = 'pick-trigger';
            u.filteredItems = u.category ? (self.allItemCategoryMap[u.category] || []) : [];
            u.hasItems = u.filteredItems.length > 0;
            // ✅ Show validation toast if size format is invalid
            if (val && !self.isValidManualSize(val)) {
                self._toast('error', 'Invalid Size Format — Allowed: 5.0 mm, 5.1 mm, 21.0 mm');
            }
        }

        return u;
    });

    if (matchedCodeToLoad) {
        getClientItemMeasurementTypes({ itemCodes: [matchedCodeToLoad] })
            .then(function(map) {
                var mType   = map[matchedCodeToLoad] || 'Quantity';
                var units   = (UNIT_MAP[mType] || ['Pieces']).map(function(u) {
                    return { value: u, label: u };
                });
                var defUnit = DEFAULT_UNIT[mType] || units[0].value;

                self.orderLines = self.orderLines.map(function(l) {
                    if (l.id !== id) return l;
                    return Object.assign({}, l, {
                        measureType:    mType,
                        qtyUnitOptions: units,
                        qtyUnit:        defUnit,
                        qtyStep:        STEP_MAP[defUnit] || '1',
                        quantity:       '',
                        qtyError:       false,
                        qtyInputClass:  'inp inp-qty',
                        karat:          l.karat || (self.allKaratValues[0] || '')
                    });
                });
            })
            .catch(function() {});
    }
}
    _addLine() { this.orderLines = [...this.orderLines, this._newLine()]; }
    handleAddLine() { this._addLine(); }

    handleRemoveLine(e) {
        var id = e.currentTarget.dataset.id;
        this.orderLines = this.orderLines
            .filter(function(l) { return l.id !== id; })
            .map(function(l, i) { return Object.assign({}, l, { num: i + 1 }); });
    }

    // ── GLOBAL CLICK — close all dropdowns ──
    handleGlobalClick() {
        var anyOpen = this.orderLines.some(function(l) {
            return l.showPick || l.showColorPick || l.showKaratPick || l.showCatPick;
        });
        if (anyOpen) {
            this.orderLines = this.orderLines.map(function(l) {
                return Object.assign({}, l, { showPick: false, showColorPick: false, showKaratPick: false, showCatPick: false });
            });
        }
    }

    // ── Item picklist ──
    // handlePickFocus(e) {
    //     e.stopPropagation();
    //     var id = e.currentTarget.dataset.id, self = this;
    //     this.orderLines = this.orderLines.map(function(l) {
    //         if (l.id === id) return Object.assign({}, l, {
    //             showPick: !l.showPick, showColorPick: false, showKaratPick: false,
    //             pickSearch: '', filteredItems: self.allItemCodes, hasItems: self.allItemCodes.length > 0
    //         });
    //         return Object.assign({}, l, { showPick: false, showColorPick: false, showKaratPick: false });
    //     });
    // }
    // handlePickFocus(e) {
    //     e.stopPropagation();
    //     var id   = e.currentTarget.dataset.id;
    //     var self = this;

    //     this.orderLines = this.orderLines.map(function(l) {
    //         if (l.id === id) {
    //             var isOpen = l.showPick;
    //             if (isOpen) return Object.assign({}, l, { showPick: false });

    //             // Use category-filtered list if category selected, else all
    //             var items = l.category
    //                 ? (self.allItemCategoryMap[l.category] || [])
    //                 : self.allItemCodes;

    //             return Object.assign({}, l, {
    //                 showPick: true, showCatPick: false,
    //                 showColorPick: false, showKaratPick: false,
    //                 pickSearch: '', filteredItems: items, hasItems: items.length > 0
    //             });
    //         }
    //         return Object.assign({}, l, {
    //             showPick: false, showCatPick: false,
    //             showColorPick: false, showKaratPick: false
    //         });
    //     });
    // }
    handlePickFocus(e) {
        e.stopPropagation();
        var id   = e.currentTarget.dataset.id;
        var self = this;

        this.orderLines = this.orderLines.map(function(l) {
            if (l.id === id) {
                var isOpen = l.showPick;
                if (isOpen) return Object.assign({}, l, { showPick: false });

                var items = [];
                if (l.category && l.size) {
                    items = self.getMatchingClientItemCodes(l.category, l.size);
                    if (!items.length) {
                        items = self.allItemCategoryMap[l.category] || [];
                    }
                } else {
                    items = l.category
                        ? (self.allItemCategoryMap[l.category] || [])
                        : self.allItemCodes;
                }

                return Object.assign({}, l, {
                    showPick: true,
                    showCatPick: false,
                    showColorPick: false,
                    showKaratPick: false,
                    pickSearch: '',
                    filteredItems: items,
                    hasItems: items.length > 0
                });
            }
            return Object.assign({}, l, {
                showPick: false,
                showCatPick: false,
                showColorPick: false,
                showKaratPick: false
            });
        });
    }
    // handlePickSearch(e) {
    //     var id = e.target.dataset.id, s = (e.target.value || '').toLowerCase(), self = this;
    //     var filtered = s ? this.allItemCodes.filter(function(c) { return c.toLowerCase().includes(s); }) : this.allItemCodes;
    //     this.orderLines = this.orderLines.map(function(l) {
    //         if (l.id !== id) return l;
    //         return Object.assign({}, l, { pickSearch: e.target.value, filteredItems: filtered, hasItems: filtered.length > 0 });
    //     });
    // }
    handlePickSearch(e) {
        var id   = e.target.dataset.id;
        var s    = (e.target.value || '').toLowerCase();
        var self = this;

        this.orderLines = this.orderLines.map(function(l) {
            if (l.id !== id) return l;
            // var base     = l.category
            //     ? (self.allItemCategoryMap[l.category] || [])
            //     : self.allItemCodes;
            var base = [];
            if (l.category && l.size) {
                base = self.getMatchingClientItemCodes(l.category, l.size);
                if (!base.length) {
                    base = l.category
                        ? (self.allItemCategoryMap[l.category] || [])
                        : self.allItemCodes;
                }
            } else {
                base = l.category
                    ? (self.allItemCategoryMap[l.category] || [])
                    : self.allItemCodes;
            }
            var filtered = s
                ? base.filter(function(c) { return c.toLowerCase().includes(s); })
                : base;
            return Object.assign({}, l, {
                pickSearch: e.target.value, filteredItems: filtered, hasItems: filtered.length > 0
            });
        });
    }
    handleDropdownClick(e) { e.stopPropagation(); }

    handleItemSelect(e) {
    var id   = e.currentTarget.dataset.id;
    var val  = e.currentTarget.dataset.value;
    var self = this;

    // ✅ Lookup size from map
    var autoSize    = (self.allItemSizeMap && self.allItemSizeMap[val]) || '';
    var allowedSizes  = self.getAllowedSizesForItem(val);
    var hasSizeOption = allowedSizes.length > 0;
    var hasAutoSize   = autoSize !== '' && !hasSizeOption;

    this.orderLines = this.orderLines.map(function(l) {
        if (l.id !== id) return l;
        return Object.assign({}, l, {
            itemCode:         val,
            itemLabel:        val,
            itemClass:        'pick-selected',
            itemTriggerClass: 'pick-trigger',
            showPick:         false,
            pickSearch:       '',
            qtyUnitOptions:   [],
            qtyUnit:          '',
            quantity:         '',
            measureType:      '',
            // ✅ These two were swapped/wrong before:
            size:             hasSizeOption ? '' : autoSize,               // actual size value e.g. "5.0 mm"
            sizeIsAuto:       hasAutoSize,             // ✅ boolean true/false
            sizeInputClass:   hasAutoSize ? 'inp inp-auto' : 'inp',  // ✅ CSS class string
            sizeOptions:      self.buildSizeOptions(allowedSizes, ''),
            hasSizeOptions:   hasSizeOption
        });
    });

    getClientItemMeasurementTypes({ itemCodes: [val] })
        .then(function(map) {
            var mType   = map[val] || 'Quantity';
            var units   = (UNIT_MAP[mType] || ['Pieces']).map(function(u) {
                return { value: u, label: u };
            });
            var defUnit = DEFAULT_UNIT[mType] || units[0].value;
            self.orderLines = self.orderLines.map(function(l) {
                if (l.id !== id) return l;
                return Object.assign({}, l, {
                    measureType:    mType,
                    qtyUnitOptions: units,
                    qtyUnit:        defUnit,
                    qtyStep:        STEP_MAP[defUnit] || '1',
                    quantity:       '',
                    qtyError:       false,
                    karat:          l.karat || (self.allKaratValues[0] || '')
                });
            });
        })
        .catch(function() {
            self.orderLines = self.orderLines.map(function(l) {
                if (l.id !== id) return l;
                return Object.assign({}, l, {
                    measureType:    'Quantity',
                    qtyUnitOptions: [{ value: 'Pieces', label: 'Pieces' }],
                    qtyUnit:        'Pieces',
                    qtyStep:        '1'
                });
            });
        });
}

    // ── Color picklist ──
    handleColorPickOpen(e) {
        e.stopPropagation();
        var id = e.currentTarget.dataset.id;
        this.orderLines = this.orderLines.map(function(l) {
            if (l.id === id) return Object.assign({}, l, {
                showColorPick: !l.showColorPick, showPick: false, showKaratPick: false
            });
            return Object.assign({}, l, { showPick: false, showColorPick: false, showKaratPick: false });
        });
    }
    handleColorSelect(e) {
        var id = e.currentTarget.dataset.id, val = e.currentTarget.dataset.value;
        this.orderLines = this.orderLines.map(function(l) {
            if (l.id !== id) return l;
            return Object.assign({}, l, {
                color: val, showColorPick: false, colorError: false,
                colorTriggerClass: 'pick-trigger'
            });
        });
    }

    // ── Karat picklist ──
    handleKaratPickOpen(e) {
        e.stopPropagation();
        var id = e.currentTarget.dataset.id;
        this.orderLines = this.orderLines.map(function(l) {
            if (l.id === id) return Object.assign({}, l, {
                showKaratPick: !l.showKaratPick, showPick: false, showColorPick: false
            });
            return Object.assign({}, l, { showPick: false, showColorPick: false, showKaratPick: false });
        });
    }
    handleKaratSelect(e) {
        var id = e.currentTarget.dataset.id, val = e.currentTarget.dataset.value;
        this.orderLines = this.orderLines.map(function(l) {
            if (l.id !== id) return l;
            return Object.assign({}, l, {
                karat: val, showKaratPick: false, karatError: false,
                karatTriggerClass: 'pick-trigger'
            });
        });
    }

    // ── Field change ──
    // handleLineChange(e) {
    //     var id = e.target.dataset.id, field = e.target.dataset.field, val = e.target.value;
    //     this.orderLines = this.orderLines.map(function(l) {
    //         if (l.id !== id) return l;
    //         var u = Object.assign({}, l);
    //         if (field === 'qtyUnit') {
    //             u.qtyUnit = val; u.quantity = ''; u.qtyError = false;
    //             u.qtyInputClass = 'inp inp-qty'; u.qtyStep = STEP_MAP[val] || '1';
    //         } else if (field === 'quantity') {
    //             u.quantity = val;
    //             var p = parseFloat(val);
    //             u.qtyError = !val || isNaN(p) || p <= 0;
    //             u.qtyInputClass = u.qtyError ? 'inp inp-qty inp-err' : 'inp inp-qty';
    //         } else {
    //             u[field] = val;
    //         }
    //         return u;
    //     });
    // }
    // handleLineChange(e) {
    //     var id    = e.target.dataset.id;
    //     var field = e.target.dataset.field;
    //     var val   = e.target.value;
    //     var self  = this;

    //     this.orderLines = this.orderLines.map(function(l) {
    //         if (l.id !== id) return l;

    //         var u = Object.assign({}, l);

    //         if (field === 'qtyUnit') {
    //             u.qtyUnit = val;
    //             u.quantity = '';
    //             u.qtyError = false;
    //             u.qtyInputClass = 'inp inp-qty';
    //             u.qtyStep = STEP_MAP[val] || '1';

    //         } else if (field === 'quantity') {
    //             u.quantity = val;
    //             var p = parseFloat(val);
    //             u.qtyError = !val || isNaN(p) || p <= 0;
    //             u.qtyInputClass = u.qtyError ? 'inp inp-qty inp-err' : 'inp inp-qty';

    //         } else 
    //         if (field === 'size') {
    //             var currentLine = this.orderLines.find(function(l) {
    //                 return l.id === id;
    //             });

    //             if (currentLine && currentLine.itemCode) {
    //                 getClientItemMeasurementTypes({ itemCodes: [currentLine.itemCode] })
    //                     .then(function(map) {
    //                         var mType   = map[currentLine.itemCode] || 'Quantity';
    //                         var units   = (UNIT_MAP[mType] || ['Pieces']).map(function(u) {
    //                             return { value: u, label: u };
    //                         });
    //                         var defUnit = DEFAULT_UNIT[mType] || units[0].value;

    //                         self.orderLines = self.orderLines.map(function(l) {
    //                             if (l.id !== id) return l;
    //                             return Object.assign({}, l, {
    //                                 measureType:    mType,
    //                                 qtyUnitOptions: units,
    //                                 qtyUnit:        defUnit,
    //                                 qtyStep:        STEP_MAP[defUnit] || '1',
    //                                 quantity:       '',
    //                                 qtyError:       false,
    //                                 qtyInputClass:  'inp inp-qty',
    //                                 karat:          l.karat || (self.allKaratValues[0] || '')
    //                             });
    //                         });
    //                     })
    //                     .catch(function() {
    //                         self.orderLines = self.orderLines.map(function(l) {
    //                             if (l.id !== id) return l;
    //                             return Object.assign({}, l, {
    //                                 measureType:    'Quantity',
    //                                 qtyUnitOptions: [{ value: 'Pieces', label: 'Pieces' }],
    //                                 qtyUnit:        'Pieces',
    //                                 qtyStep:        '1'
    //                             });
    //                         });
    //                     });
    //             }
    //         }
    //         else {
    //             u[field] = val;
    //         }

    //         return u;
    //     });
    // }
    handleLineChange(e) {
    var id    = e.target.dataset.id;
    var field = e.target.dataset.field;
    var val   = e.target.value;
    var self  = this;
    var matchedCodeToLoad = '';

    this.orderLines = this.orderLines.map(function(l) {
        if (l.id !== id) return l;

        var u = Object.assign({}, l);

        if (field === 'qtyUnit') {
            u.qtyUnit = val;
            u.quantity = '';
            u.qtyError = false;
            u.qtyInputClass = 'inp inp-qty';
            u.qtyStep = STEP_MAP[val] || '1';

        } else if (field === 'quantity') {
            u.quantity = val;
            var p = parseFloat(val);
            u.qtyError = !val || isNaN(p) || p <= 0;
            u.qtyInputClass = u.qtyError ? 'inp inp-qty inp-err' : 'inp inp-qty';

        } else if (field === 'size') {
            u.size = val;
            u.sizeIsAuto = false;
            u.sizeInputClass = 'inp';

            var matches = self.getMatchingClientItemCodes(u.category, val);

            if (matches.length === 1) {
                var matchedCode = matches[0];
                var fullSize = self.allItemSizeMap[matchedCode] || '';

                u.itemCode = matchedCode;
                u.itemLabel = matchedCode;
                u.itemClass = 'pick-selected';
                u.itemTriggerClass = 'pick-trigger';
                u.filteredItems = [matchedCode];
                u.hasItems = true;

                if (fullSize) {
                    u.size = fullSize;
                    u.sizeIsAuto = true;
                    u.sizeInputClass = 'inp inp-auto';
                }

                u.qtyUnitOptions = [];
                u.qtyUnit = '';
                u.quantity = '';
                u.measureType = '';
                u.qtyStep = '1';
                u.qtyError = false;
                u.qtyInputClass = 'inp inp-qty';

                matchedCodeToLoad = matchedCode;

            } else if (matches.length > 1) {
                u.itemCode = '';
                u.itemLabel = 'Select item…';
                u.itemClass = 'pick-placeholder';
                u.itemTriggerClass = 'pick-trigger';
                u.filteredItems = matches;
                u.hasItems = true;

                u.qtyUnitOptions = [];
                u.qtyUnit = '';
                u.quantity = '';
                u.measureType = '';
                u.qtyStep = '1';

            } else {
                u.itemCode = '';
                u.itemLabel = 'Select item…';
                u.itemClass = 'pick-placeholder';
                u.itemTriggerClass = 'pick-trigger';
                u.filteredItems = u.category ? (self.allItemCategoryMap[u.category] || []) : [];
                u.hasItems = u.filteredItems.length > 0;

                u.qtyUnitOptions = [];
                u.qtyUnit = '';
                u.quantity = '';
                u.measureType = '';
                u.qtyStep = '1';
            }

        } else {
            u[field] = val;
        }

        return u;
    });

    // load qty unit options after auto item selection from size
    if (field === 'size' && matchedCodeToLoad) {
        getClientItemMeasurementTypes({ itemCodes: [matchedCodeToLoad] })
            .then(function(map) {
                var mType   = map[matchedCodeToLoad] || 'Quantity';
                var units   = (UNIT_MAP[mType] || ['Pieces']).map(function(u) {
                    return { value: u, label: u };
                });
                var defUnit = DEFAULT_UNIT[mType] || units[0].value;

                self.orderLines = self.orderLines.map(function(l) {
                    if (l.id !== id) return l;
                    return Object.assign({}, l, {
                        measureType:    mType,
                        qtyUnitOptions: units,
                        qtyUnit:        defUnit,
                        qtyStep:        STEP_MAP[defUnit] || '1',
                        quantity:       '',
                        qtyError:       false,
                        qtyInputClass:  'inp inp-qty',
                        karat:          l.karat || (self.allKaratValues[0] || '')
                    });
                });
            })
            .catch(function() {
                self.orderLines = self.orderLines.map(function(l) {
                    if (l.id !== id) return l;
                    return Object.assign({}, l, {
                        measureType:    'Quantity',
                        qtyUnitOptions: [{ value: 'Pieces', label: 'Pieces' }],
                        qtyUnit:        'Pieces',
                        qtyStep:        '1'
                    });
                });
            });
    }
}

    // ── Enrich lines with display helpers for preview ──
    _enrichForPreview(lines) {
        return lines.map(function(l) {
            var pc = l.priority === 'High' ? 'pv-priority-high'
                   : l.priority === 'Low'  ? 'pv-priority-low'
                   :                         'pv-priority-med';
            return Object.assign({}, l, {
                sizeDisplay:    l.size     || '—',
                dueDateDisplay: l.dueDate  || '—',
                remarkDisplay:  l.remark   || '—',
                priorityClass:  pc
            });
        });
    }

    // ════════════ STEP 1: VALIDATE → SHOW PREVIEW (no backend) ════════════
    handleSubmitOrders() {
        var self = this;
        var invalidSizeLine = this.orderLines.find(function(l) {
        if (l.sizeIsAuto) return false;
        if (l.size && !self.isValidManualSize(l.size)) return true;
            return false;
        });

        if (invalidSizeLine) {
            this._toast('error',
                'Line ' + invalidSizeLine.num + ': Invalid size — Allowed: 5.0 mm, 5.1 mm, 21.0 mm');
            return;
        }

        // ✅ Check ambiguous size (size typed but multiple item codes match, none selected)
        var ambiguousLine = this.orderLines.find(function(l) {
            return l.size && l.category && !l.itemCode
                && l.filteredItems && l.filteredItems.length > 1;
        });

        if (ambiguousLine) {
            this._toast('error',
                'Line ' + ambiguousLine.num + ': Size is ambiguous — select item code manually');
            return;
        }
        var hasErr = false;
        this.orderLines = this.orderLines.map(function(l) {
            if (!l.itemCode) return l;
            var u = Object.assign({}, l);
            var p = parseFloat(l.quantity);
            u.catError   = !l.category;
            u.itemError  = !l.itemCode;
            u.qtyError   = !l.quantity || isNaN(p) || p <= 0;
            u.colorError = !l.color;
            u.karatError = !l.karat;
            u.catTriggerClass   = u.catError   ? 'pick-trigger pick-trig-err' : 'pick-trigger pick-trigger-selected';
            u.itemTriggerClass  = u.itemError  ? 'pick-trigger pick-trig-err' : 'pick-trigger';
            u.qtyInputClass      = u.qtyError   ? 'inp inp-qty inp-err'        : 'inp inp-qty';
            u.colorTriggerClass  = u.colorError  ? 'pick-trigger pick-trig-err' : 'pick-trigger';
            u.karatTriggerClass  = u.karatError  ? 'pick-trigger pick-trig-err' : 'pick-trigger';
            if (u.catError || u.itemError || u.qtyError || u.colorError || u.karatError) hasErr = true;
            return u;
        });

        var valid = this.orderLines.filter(function(l) {
            return l.itemCode && parseFloat(l.quantity) > 0 && l.color && l.karat;
        });

        if (!valid.length) { this._toast('error', 'Add at least one complete order line'); return; }
        if (hasErr)        { this._toast('error', 'Fill in all required fields'); return; }

        // Enrich lines with display helpers and show preview — NO backend call
        this.orderLines     = this._enrichForPreview(this.orderLines);
        this.orderFlowState = 'preview';
    }

    // ════════════ STEP 2a: BACK TO EDIT (prepopulated) ════════════
    handlePreviewBack() {
        // Simply go back to form — orderLines still has all values intact
        this.orderFlowState = 'form';
    }

    // ════════════ STEP 2b: CONFIRM → BACKEND SAVE ════════════
    handleConfirmOrder() {
        this.isSubmitting = true;
        var self  = this;
        var lines = this.orderLines.map(function(l) {
            return {
                itemCode: l.itemCode, color: l.color, karat: l.karat,
                size: l.size || '', qtyUnit: l.qtyUnit || 'Pieces',
                quantity: parseFloat(l.quantity), priority: l.priority || 'Medium',
                dueDate: l.dueDate || '', remark: l.remark || '',category: l.category || ''
            };
        });
        placeClientOrders({
            clientName: this.clientName, gstNumber: this.clientGst,
            mobileNo:   this.clientMobile, orderLines: lines
        })
        .then(function(ids) {
            self.isSubmitting    = false;
            // self.confirmedOrders = ids;
            self.confirmedOrders = self.orderLines.map(function(l, idx) {
                return {
                    num:       idx + 1,
                    itemCode:  l.itemCode,
                    quantity:  l.quantity,
                    unit:      l.qtyUnit  || 'Pieces',
                    color:     l.color    || '—',
                    karat:     l.karat    || '—',
                    size:      l.size     || '—'
                };
            });
            self.orderFlowState  = 'confirm';
            self.orderLines      = [];
        })
        .catch(function(err) {
            self.isSubmitting = false;
            self._toast('error', (err.body && err.body.message) || 'Could not place orders. Try again.');
        });
    }

    handlePlaceAnother() {
        this.confirmedOrders = [];
        this.orderFlowState  = 'form';
        this._addLine();
    }
    handleViewMyOrders() {
        this.confirmedOrders = [];
        this.orderFlowState  = 'form';
        this.activeTab       = 'myorders';
        this._loadMyOrders();
    }

    // ════════════ DOWNLOAD ════════════
    // handleDownloadPdf() {
    //     var html = this._buildPdfContent();
    //     var blob = new Blob([html], { type: 'text/html' });
    //     var url  = URL.createObjectURL(blob);
    //     var a    = document.createElement('a');
    //     a.href = url;
    //     a.download = 'OrderConfirmation_' + this.clientName.replace(/\s/g, '_') + '.html';
    //     document.body.appendChild(a); a.click(); document.body.removeChild(a);
    //     URL.revokeObjectURL(url);
    // }
    handleDownloadPdf() {
        const client = encodeURIComponent(this.clientName);
        const gst = encodeURIComponent(this.clientGst);

        const orders = encodeURIComponent(JSON.stringify(this.confirmedOrders));

        const url = `/apex/SGF_OrderConfirmationPDF?client=${client}&gst=${gst}&orders=${orders}`;

        window.open(url, '_blank');
    }

    _buildPdfContent() {
        var orders = this.confirmedOrders;
        var client = this.clientName;
        var gst    = this.clientGst;
        var date   = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
        var rows = orders.map(function(o) {
            return '<tr><td>' + o.orderCode + '</td><td>' + o.itemCode +
                   '</td><td style="text-align:right">' + o.quantity +
                   '</td><td>' + o.unit + '</td><td>Client New</td></tr>';
        }).join('');
        return '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Order Confirmation — ' + client + '</title>' +
            '<style>body{font-family:Arial,sans-serif;margin:40px;color:#1c1408}' +
            'h1{font-size:22px;margin-bottom:4px}.sub{color:#8a7050;font-size:13px;margin-bottom:24px}' +
            '.info{background:#faf5e8;border:1px solid #e4d5b0;border-radius:8px;padding:16px;margin-bottom:20px}' +
            '.info p{margin:4px 0;font-size:14px}' +
            'table{width:100%;border-collapse:collapse;margin-top:16px}' +
            'th{background:#1c1408;color:#f0c040;padding:10px 14px;text-align:left;font-size:12px}' +
            'td{padding:9px 14px;border-bottom:1px solid #e4d5b0;font-size:13px}' +
            'tr:nth-child(even) td{background:#faf5e8}' +
            '.footer{margin-top:32px;font-size:11px;color:#8a7050;text-align:center}' +
            '@media print{body{margin:20px}}</style></head><body>' +
            '<h1>Order Confirmation</h1><p class="sub">Shree Ganesh Finding · Client Portal</p>' +
            '<div class="info"><p><strong>Client:</strong> ' + client + '</p>' +
            '<p><strong>GST:</strong> ' + gst + '</p>' +
            '<p><strong>Date:</strong> ' + date + '</p>' +
            '<p><strong>Total Orders:</strong> ' + orders.length + '</p></div>' +
            '<table><thead><tr><th>Order Code</th><th>Item</th><th>Qty</th><th>Unit</th><th>Status</th></tr></thead>' +
            '<tbody>' + rows + '</tbody></table>' +
            '<p class="footer">Thank you for your order. Our team will process it shortly.<br>Contact Shree Ganesh Finding for queries.</p>' +
            '<script>window.onload=function(){window.print();}<\/script></body></html>';
    }

    // _buildPdfContent() {
    //     var orders = this.confirmedOrders, client = this.clientName, gst = this.clientGst;
    //     var date   = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
    //     var rows   = orders.map(function(id) {
    //         return '<tr><td>' + id + '</td><td style="color:#7a5200;font-weight:700;text-align:center">Pending Review</td></tr>';
    //     }).join('');
    //     return '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Order Confirmation</title>'
    //         + '<style>body{font-family:Arial,sans-serif;margin:40px;color:#1c1408}'
    //         + 'h1{font-size:22px;color:#b8860b}p.sub{color:#8a7050;font-size:13px;margin-bottom:20px}'
    //         + '.info{background:#faf5e8;border:1px solid #e4d5b0;border-radius:8px;padding:14px;margin-bottom:16px}'
    //         + '.info p{margin:3px 0;font-size:14px}table{width:100%;border-collapse:collapse}'
    //         + 'th{background:#1c1408;color:#f0c040;padding:9px 13px;text-align:left;font-size:12px}'
    //         + 'td{padding:8px 13px;border-bottom:1px solid #e4d5b0;font-size:13px}'
    //         + 'tr:nth-child(even)td{background:#faf5e8}'
    //         + '.note{margin-top:24px;font-size:12px;color:#8a7050;text-align:center}'
    //         + '</style></head><body>'
    //         + '<h1>Order Confirmation</h1><p class="sub">Shree Ganesh Finding · Client Portal</p>'
    //         + '<div class="info"><p><strong>Client:</strong> ' + client + '</p>'
    //         + '<p><strong>GST:</strong> ' + gst + '</p>'
    //         + '<p><strong>Date:</strong> ' + date + '</p>'
    //         + '<p><strong>Orders:</strong> ' + orders.length + '</p></div>'
    //         + '<table><thead><tr><th>Order ID</th><th>Status</th></tr></thead>'
    //         + '<tbody>' + rows + '</tbody></table>'
    //         + '<p class="note">For queries contact Shree Ganesh Finding.</p>'
    //         + '<script>window.onload=function(){window.print();}<\/script>'
    //         + '</body></html>';
    // }

    // ════════════ LOGOUT ════════════
    handleLogout() {
        this.clearClientSession();
        this.screen = 'login'; this.loginGst = ''; this.loginMobile = '';
        this.loginError = ''; this.clientName = ''; this.clientGst = '';
        this.clientMobile = ''; this.orderLines = []; this.myOrders = [];
        this.confirmedOrders = []; this.orderFlowState = 'form'; this.activeTab = 'order';
    }

    // ════════════ TOAST ════════════
    _toast(type, msg) {
        this.toastType = type; this.toastMsg = msg; this.showToast = true;
        var self = this;
        setTimeout(function() { self.showToast = false; }, 4200);
    }
    handleCloseToast() { this.showToast = false; }
}