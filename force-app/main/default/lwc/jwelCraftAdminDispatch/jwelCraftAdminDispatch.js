import { LightningElement, track, api } from 'lwc';
import markOrderCompleted from '@salesforce/apex/JewelryOrderController.markOrderCompleted';
import getAllOrders from '@salesforce/apex/JewelryOrderController.getAllOrders';
import cancelOrder from '@salesforce/apex/JewelryOrderController.cancelOrder';

export default class JwelCraftAdminDispatch extends LightningElement {
    @api userName = '';

    @track orders = [];
    @track searchTerm = '';
    @track filterStatus = '';
    @track selectedIds = {};
    @track isLoading = false;
    @track showCancelConfirm = false;
    @track cancelTarget = null;
    @track isCancelling = false;

    get cancelTargetCode() {
        return this.cancelTarget ? this.cancelTarget.code : '';
    }
    connectedCallback() {
        this._loadOrders();
        this.startPolling();
    }

    startPolling() {
        this.poller = setInterval(() => {
            this._loadOrders();
        }, 60000);
    }

    disconnectedCallback() {
        if (this.poller) {
            clearInterval(this.poller);
        }
    }

    _loadOrders() {
        this.isLoading = true;
        var self = this;

        getAllOrders()
            .then(function(res) {
                self.isLoading = false;

                self.orders = (res || []).map(function(o) {
                    return {
                        id: o.Id,
                        code: o.Order_ID_Ref__c || '',
                        customer: o.Customer_Name__c || '—',
                        customerCode: o.Customer_Code__c || '',
                        customerMobile: o.Customer_Mobile_No__c || '',
                        itemCode: o.Item_Code__c || '',
                        itemCategory: o.Item_Category__c || '',
                        color: o.Color__c || '',
                        kar: o.Karat__c || '',
                        size: o.Size__c || '—',
                        qty: o.Quantity__c || 0,
                        qtyUnit: o.Quantity_Unit__c || 'Pieces',
                        fulfilledQty: o.Fulfilled_Qty__c || 0,
                        pendingQty: o.Pending_Qty__c || 0,
                        dispatchedQty: o.Dispatched_Qty__c || 0,
                        dispatchStatus: o.Dispatch_Status__c || '',
                        status: o.Current_Stage__c || '',
                        pri: o.Priority__c || 'Medium',
                        remark: o.Remark__c || '',
                        orderDate: o.Order_Date__c || '',
                        dueDate: o.Order_Due_Date__c || '',
                        dispatchDate: o.Order_Date__c
                            ? new Date(o.Order_Date__c).toLocaleDateString('en-IN', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric'
                            })
                            : '—'
                    };
                });
            })
            .catch(function() {
                self.isLoading = false;
            });
    }

    get dispatchedOrders() {
        return (this.orders || [])
            .filter(function(o) {
                return o.status === 'Dispatched';
            })
            .map(function(o) {
                var ds = o.dispatchStatus || 'Fully Dispatched';

                var statusClass = ds === 'Partially Dispatched'
                    ? 'badge ds-partial'
                    : 'badge ds-full';

                var priClass = o.pri === 'High'
                    ? 'badge b-h'
                    : o.pri === 'Low'
                        ? 'badge b-l'
                        : 'badge b-m';

                var colorKarat = [o.color, o.kar].filter(Boolean).join(' · ') || '—';

                return Object.assign({}, o, {
                    dispatchStatus: ds,
                    statusClass: statusClass,
                    priClass: priClass,
                    colorKarat: colorKarat,
                    qtyUnit: o.qtyUnit || 'Pcs',
                    isSelected: !!this.selectedIds[o.code],
                    chkClass: this.selectedIds[o.code] ? 'chk chk-on' : 'chk',
                    rowClass: 'tbl-row'
                        + (this.selectedIds[o.code] ? ' row-selected' : '')
                        + (ds === 'Partially Dispatched' ? ' row-partial' : '')
                });
            }, this);
    }

    get filteredOrders() {
        var list = this.dispatchedOrders;
        var s = (this.searchTerm || '').toLowerCase();
        var st = this.filterStatus;

        if (s) {
            list = list.filter(function(o) {
                return (o.code || '').toLowerCase().includes(s)
                    || (o.customer || '').toLowerCase().includes(s)
                    || (o.customerCode || '').toLowerCase().includes(s)
                    || (o.customerMobile || '').toLowerCase().includes(s)
                    || (o.itemCode || '').toLowerCase().includes(s)
                    || (o.remark || '').toLowerCase().includes(s);
            });
        }

        if (st) {
            list = list.filter(function(o) {
                return o.dispatchStatus === st;
            });
        }

        return list;
    }

    get hasOrders() {
        return this.filteredOrders.length > 0;
    }

    get partialCount() {
        return this.dispatchedOrders.filter(function(o) {
            return o.dispatchStatus === 'Partially Dispatched';
        }).length;
    }

    get fullyCount() {
        return this.dispatchedOrders.filter(function(o) {
            return o.dispatchStatus === 'Fully Dispatched';
        }).length;
    }

    get selectedCount() {
        return Object.keys(this.selectedIds).filter(function(k) {
            return !!this[k];
        }, this.selectedIds).length;
    }

    get hasSelected() {
        return this.selectedCount > 0;
    }

    get hasActiveFilters() {
        return !!(this.searchTerm || this.filterStatus);
    }

    get allVisibleSelected() {
        var visible = this.filteredOrders;
        return visible.length > 0 && visible.every(function(o) {
            return !!this[o.code];
        }, this.selectedIds);
    }
    handleCancelClick(e) {
        e.stopPropagation();

        var id = e.currentTarget.dataset.id;
        var code = e.currentTarget.dataset.code;

        var target = (this.orders || []).find(function(o) {
            return o.id === id || o.code === code;
        });

        this.cancelTarget = target || {
            id: id,
            code: code
        };

        this.showCancelConfirm = true;
    }

    handleCancelAbort() {
        this.showCancelConfirm = false;
        this.cancelTarget = null;
        this.isCancelling = false;
    }

    handleCancelConfirm() {
        if (!this.cancelTarget || !this.cancelTarget.code) {
            this._toast('❌', 'Cancel failed', 'Order not found');
            return;
        }

        this.isCancelling = true;
        var self = this;

        cancelOrder({
            orderId: this.cancelTarget.code,
            changedBy: this.userName || ''
        })
        .then(function() {
            self.isCancelling = false;
            self.showCancelConfirm = false;

            var cancelledCode = self.cancelTarget.code;
            self.cancelTarget = null;

            self._toast('✅', 'Order cancelled', cancelledCode);
            self._loadOrders();
        })
        .catch(function(err) {
            self.isCancelling = false;
            self._toast(
                '❌',
                'Cancel failed',
                (err.body && err.body.message) || err.message || ''
            );
        });
    }
    handleSearch(e) {
        this.searchTerm = e.target.value;
    }

    handleStatusFilter(e) {
        this.filterStatus = e.target.value;
    }

    handleSelectAll() {
        var updated = Object.assign({}, this.selectedIds);

        if (this.allVisibleSelected) {
            this.filteredOrders.forEach(function(o) {
                delete updated[o.code];
            });
        } else {
            this.filteredOrders.forEach(function(o) {
                updated[o.code] = true;
            });
        }

        this.selectedIds = updated;
    }

    handleRowSelect(e) {
        e.stopPropagation();

        var code = e.currentTarget.dataset.code;
        var updated = Object.assign({}, this.selectedIds);

        if (updated[code]) {
            delete updated[code];
        } else {
            updated[code] = true;
        }

        this.selectedIds = updated;
    }

    handleMarkComplete(e) {
        e.stopPropagation();

        var code = e.currentTarget.dataset.code;
        var self = this;

        this.isLoading = true;

        markOrderCompleted({
            orderIds: [code],
            changedBy: this.userName || ''
        })
            .then(function() {
                self.isLoading = false;
                self._toast('✅', 'Order marked as completed', code);
                self._loadOrders();
            })
            .catch(function(err) {
                self.isLoading = false;
                self._toast('❌', 'Error', (err.body && err.body.message) || err.message || '');
            });
    }

    handleBulkComplete() {
        var codes = Object.keys(this.selectedIds).filter(function(k) {
            return !!this[k];
        }, this.selectedIds);

        if (!codes.length) return;

        this.isLoading = true;
        var self = this;

        markOrderCompleted({
            orderIds: codes,
            changedBy: this.userName || ''
        })
            .then(function() {
                self.isLoading = false;
                self.selectedIds = {};
                self._toast('✅', codes.length + ' order(s) marked as completed', '');
                self._loadOrders();
            })
            .catch(function(err) {
                self.isLoading = false;
                self._toast('❌', 'Bulk complete failed', (err.body && err.body.message) || err.message || '');
            });
    }

    _toast(icon, msg, sub) {
        this.dispatchEvent(new CustomEvent('showtoast', {
            bubbles: true,
            composed: true,
            detail: {
                icon: icon,
                message: msg,
                subMessage: sub
            }
        }));
    }
}