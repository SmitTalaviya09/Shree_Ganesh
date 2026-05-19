import { LightningElement, track, api } from 'lwc';
import getClientNewOrders  from '@salesforce/apex/SGFClientPortalController.getClientNewOrders';
import acceptClientOrder   from '@salesforce/apex/SGFClientPortalController.acceptClientOrder';
import rejectClientOrder   from '@salesforce/apex/SGFClientPortalController.rejectClientOrder';

export default class JwelCraftClientOrders extends LightningElement {
    @api userName = '';

    @track isLoading  = false;
    @track orders     = [];
    @track searchTerm = '';

    // Accept
    @track showAcceptModal  = false;
    @track acceptTarget     = null;
    @track acceptEditSize   = '';
    @track acceptEditRemark = '';
    @track isAccepting      = false;
    @track acceptSizeChangedByUser = false;

    // Reject
    @track showRejectModal  = false;
    @track rejectTarget     = null;
    @track rejectReason     = '';
    @track rejectReasonErr  = false;
    @track isRejecting      = false;

    connectedCallback() {
        this._load();
        this.startPolling();
    }
    get acceptRemarkValue() { return this.acceptEditRemark; }
    get acceptRemarkDisplay()  { return this.acceptEditRemark; }
    get acceptSizeDisplay()    { return this.acceptEditSize;   }
    startPolling() {
        this.poller = setInterval(() => {
            this._load();
        }, 60000);
    }
    isValidManualSize(sizeValue) {
        if (!sizeValue) return true; // size is optional — empty is fine
        var pattern = /^\d+\.\d\s+mm$/i;
        return pattern.test(sizeValue.trim());
    }
    _load() {
        this.isLoading = true;
        var self = this;
        getClientNewOrders()
            .then(function(res) {
                self.isLoading = false;
                self.orders = (res || []).map(function(o) {
                    var due = o.Order_Date__c
                        ? new Date(o.Order_Date__c).toLocaleDateString('en-IN',
                            { day: 'numeric', month: 'short', year: 'numeric' })
                        : '—';
                    return {
                        id:        o.Id,
                        code:      o.Order_ID_Ref__c           || '—',
                        client:    o.Customer_Name__c          || '—',
                        gst:       o.Customer_GST_Number__c    || '—',
                        mobile:    o.Customer_Mobile_No__c     || '—',
                        itemCode:  o.Item_Code__c              || '—',
                        color:     o.Color__c                  || '—',
                        karat:     o.Karat__c                  || '—',
                        size:      o.Size__c                   || '',
                        qty:       o.Quantity__c               || 0,
                        unit:      o.Quantity_Unit__c          || 'Pieces',
                        remark:    o.Remark__c                 || '',
                        hasRemark: !!o.Remark__c,
                        orderDate: due,
                        priClass:  o.Priority__c === 'High' ? 'badge b-high'
                                 : o.Priority__c === 'Low'  ? 'badge b-low' : 'badge b-med'
                    };
                });
            })
            .catch(function(err) {
                self.isLoading = false;
                self._toast('❌', 'Error loading orders',
                    (err.body && err.body.message) || err.message || '');
            });
    }

    handleSearch(e)     { this.searchTerm = e.target.value; }
    handleClearSearch() { this.searchTerm = ''; }
    handleRefresh()     { this._load(); }

    get filteredOrders() {
        var s = (this.searchTerm || '').toLowerCase();
        if (!s) return this.orders;
        return this.orders.filter(function(o) {
            return (o.code     || '').toLowerCase().includes(s) ||
                   (o.client   || '').toLowerCase().includes(s) ||
                   (o.gst      || '').toLowerCase().includes(s) ||
                   (o.itemCode || '').toLowerCase().includes(s);
        });
    }

    get hasOrders()     { return this.filteredOrders.length > 0; }
    get totalCount()    { return this.orders.length; }
    get filteredCount() { return this.filteredOrders.length; }

    // ── Accept ──────────────────────────────────────────────────
    handleAcceptClick(e) {
        var id    = e.currentTarget.dataset.id;
        var order = this.orders.find(function(o) { return o.id === id; });
        this.acceptTarget     = order;
        this.acceptEditSize   = order.size   || '';
        this.acceptEditRemark = order.remark || '';
        this.acceptSizeChangedByUser = false;
        this.showAcceptModal  = true;
    }

    handleCloseAccept() {
        this.showAcceptModal  = false;
        this.acceptTarget     = null;
        this.acceptEditSize   = '';
        this.acceptEditRemark = '';
    }

    handleAcceptSizeInput(e)   { this.acceptEditSize   = e.target.value; this.acceptSizeChangedByUser = false;}
    handleAcceptRemarkInput(e) { this.acceptEditRemark = e.target.value; }

    handleConfirmAccept() {
        if (!this.acceptTarget) return;

        // Size validation
        var size = (this.acceptEditSize || '').trim();
        if (this.acceptSizeChangedByUser && size && !this.isValidManualSize(size)) {
            this._toast('❌', 'Invalid Size Format', 'Allowed: 5.0 mm, 5.1 mm, 21.0 mm');
            return;
        }

        this.isAccepting = true;
        var self = this;
        acceptClientOrder({
            orderId:   this.acceptTarget.code,
            changedBy: this.userName || '',
            newSize:   size,
            newRemark: (this.acceptEditRemark || '').trim()
        })
        .then(function() {
            self.isAccepting     = false;
            self.showAcceptModal = false;
            self._toast('✅', 'Order accepted',
                self.acceptTarget.code + ' → moved to New');
            self.acceptTarget     = null;
            self.acceptEditSize   = '';
            self.acceptEditRemark = '';
            self._load();
            self.dispatchEvent(new CustomEvent('refreshorders', {
                bubbles: true, composed: true
            }));
        })
        .catch(function(err) {
            self.isAccepting = false;
            self._toast('❌', 'Error',
                (err.body && err.body.message) || err.message || '');
        });
    }

    // Getters for accept modal
    get acceptOrderCode()    { return this.acceptTarget ? this.acceptTarget.code  : ''; }
    get acceptClientName()   { return this.acceptTarget ? this.acceptTarget.client: ''; }
    get acceptEditColor()    { return this.acceptTarget ? this.acceptTarget.color : '—'; }
    get acceptEditKarat()    { return this.acceptTarget ? this.acceptTarget.karat : '—'; }
    get acceptEditQtyDisplay() {
        if (!this.acceptTarget) return '';
        return (this.acceptTarget.qty || 0) + ' ' + (this.acceptTarget.unit || 'Pieces');
    }

    // ── Reject ──────────────────────────────────────────────────
    handleRejectClick(e) {
        var id = e.currentTarget.dataset.id;
        this.rejectTarget    = this.orders.find(function(o) { return o.id === id; });
        this.rejectReason    = '';
        this.rejectReasonErr = false;
        this.showRejectModal = true;
    }

    handleCloseReject() {
        this.showRejectModal = false;
        this.rejectTarget    = null;
    }

    handleReasonInput(e) {
        this.rejectReason    = e.target.value;
        this.rejectReasonErr = false;
    }

    handleConfirmReject() {
        if (!this.rejectTarget) return;
        this.isRejecting = true;
        var self = this;
        rejectClientOrder({
            orderId:   this.rejectTarget.code,
            reason:    this.rejectReason.trim(),
            changedBy: this.userName || ''
        })
        .then(function() {
            self.isRejecting     = false;
            self.showRejectModal = false;
            self._toast('🚫', 'Order rejected', self.rejectTarget.code);
            self.rejectTarget = null;
            self.rejectReason = '';
            self._load();
            self.dispatchEvent(new CustomEvent('refreshorders', {
                bubbles: true, composed: true
            }));
        })
        .catch(function(err) {
            self.isRejecting = false;
            self._toast('❌', 'Error',
                (err.body && err.body.message) || err.message || '');
        });
    }

    get rejectOrderCode()  { return this.rejectTarget ? this.rejectTarget.code   : ''; }
    get rejectClientName() { return this.rejectTarget ? this.rejectTarget.client : ''; }
    get reasonInputClass() {
        return this.rejectReasonErr ? 'reason-input reason-err' : 'reason-input';
    }
    get acceptItemCode() {
        return this.acceptTarget ? this.acceptTarget.itemCode : '';
    }

    _toast(icon, msg, sub) {
        this.dispatchEvent(new CustomEvent('showtoast', {
            bubbles: true, composed: true,
            detail: { icon, message: msg, subMessage: sub }
        }));
    }
}