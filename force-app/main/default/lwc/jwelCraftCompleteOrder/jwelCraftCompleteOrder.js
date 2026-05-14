import { LightningElement, track } from 'lwc';
import { formatDate, matClass } from 'c/jwelCraftUtils';
import getAllOrders from '@salesforce/apex/JewelryOrderController.getAllOrders';
import getCompletedOrders from '@salesforce/apex/JewelryOrderController.getCompletedOrders';

export default class JwelCraftCompleteOrder extends LightningElement {

    @track dispatched = [];
    @track isLoading  = false;

    connectedCallback() {
        this._loadOrders();
    }

    // _loadOrders() {
    //     this.isLoading = true;
    //     var self = this;
    //     getAllOrders()
    //         .then(function(res) {
    //             self.isLoading = false;
    //             self.dispatched = (res || [])
    //                 .filter(function(o) {
    //                     return o.Current_Stage__c === 'Completed' &&
    //                         o.Dispatch_Status__c === 'Completed';
    //                 })
    //                 .map(function(o) {
    //                     var orderedQty    = o.Quantity__c       || 0;
    //                     var dispatchedQty = o.Dispatched_Qty__c || 0;
    //                     var leftoverQty   = Math.max(0, orderedQty - dispatchedQty);
    //                     return {
    //                         id:            o.Id,
    //                         code:          o.Order_ID_Ref__c   || '',
    //                         customer:      o.Customer_Name__c  || '—',
    //                         customerCode:  o.Customer_Code__c  || '',
    //                         mat:           o.Color__c          || '',
    //                         kar:           o.Karat__c          || '',
    //                         qty:           orderedQty,
    //                         dispatchedQty: dispatchedQty,
    //                         leftoverQty:   leftoverQty,
    //                         due:           o.Order_Date__c     || '',
    //                         dueDate:       o.Order_Due_Date__c || '',
    //                         dispatchDate:  o.Order_Due_Date__c
    //                             ? new Date(o.Order_Due_Date__c).toLocaleDateString('en-IN',
    //                                 { day: 'numeric', month: 'short', year: 'numeric' })
    //                             : '—',
    //                         status:        o.Current_Stage__c  || ''
    //                     };
    //                 });
    //         })
    //         .catch(function() { self.isLoading = false; });
    // }
    // _loadOrders() {
    //     this.isLoading = true;
    //     const self = this;

    //     getCompletedOrders()
    //         .then(function(res) {
    //             self.isLoading = false;

    //             // Filter only Completed + Dispatched orders
    //             self.dispatched = (res || [])
    //                 .filter(o => o.status === 'Completed' && o.dispatchedQty > 0)
    //                 .map((o, idx) => {
    //                     const orderedQty = o.qty || 0;
    //                     const dispatchedQty = o.dispatchedQty || 0;
    //                     const leftoverQty = Math.max(0, orderedQty - dispatchedQty);

    //                     return {
    //                         id:            o.orderId,
    //                         srNo:          idx + 1,
    //                         code:          o.orderId        || '—',
    //                         customer:      o.customerName   || '—',
    //                         customerCode:  o.customerCode   || '',
    //                         itemCode:      o.itemCode       || '',
    //                         color:         o.color          || '',
    //                         kar:           o.karat          || '',
    //                         size:          o.size           || '—',
    //                         qty:           orderedQty,
    //                         dispatchedQty: dispatchedQty,
    //                         leftoverQty:   leftoverQty,
    //                         status:        o.status         || '—',
    //                         priority:      o.priority       || 'Medium',
    //                         remark:        o.remark         || '',
    //                         orderDate:     o.orderDate
    //                             ? new Date(o.orderDate).toLocaleDateString('en-IN',
    //                                 { day: 'numeric', month: 'short', year: 'numeric' })
    //                             : '—',
    //                         dispatchDate:  o.dispatchDate
    //                             ? new Date(o.dispatchDate).toLocaleDateString('en-IN',
    //                                 { day: 'numeric', month: 'short', year: 'numeric' })
    //                             : '—'
    //                     };
    //                 });
    //         })
    //         .catch(function(err) {
    //             self.isLoading = false;
    //             console.error('getCompletedOrders error:', err);
    //         });
    // }
    _loadOrders() {
    this.isLoading = true;
    const self = this;

    getCompletedOrders()
        .then(res => {
            self.isLoading = false;

            self.dispatched = (res || [])
                .filter(o => o.status === 'Completed' && o.dispatchedQty > 0)
                .map((o, idx) => {
                    const orderedQty = o.quantity || 0;           // Quantity__c
                    const dispatchedQty = o.dispatchedQty || 0;  // Dispatched_Quantity__c
                    const leftoverQty = Math.max(0, orderedQty - dispatchedQty);

                    return {
                        id:            o.orderId,
                        srNo:          idx + 1,
                        code:          o.orderId || '—',
                        customer:      o.customerName || '—',
                        customerCode:  o.customerCode || '',
                        itemCode:      o.itemCode || '—',
                        mat:           o.color || '—',           // Color__c
                        kar:           o.karat || '—',           // Karat__c
                        qty:           orderedQty,               // Ordered Qty
                        dispatchedQty: dispatchedQty,           // Dispatched Qty
                        leftoverQty:   leftoverQty,              // Leftover = Qty - Dispatched
                        hasLeftover:   leftoverQty > 0,
                        status:        o.status || '—',
                        priority:      o.priority || 'Medium',
                        remark:        o.remark || '',
                        orderDate:     o.orderDate
                            ? new Date(o.orderDate).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})
                            : '—',
                        dispatchDate:  o.dispatchDate
                            ? new Date(o.dispatchDate).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})
                            : '—'
                    };
                });

            // Optional: sort by dispatchDate descending
            self.dispatched.sort((a, b) => new Date(b.dispatchDate) - new Date(a.dispatchDate));
        })
        .catch(err => {
            self.isLoading = false;
            console.error('getCompletedOrders error:', err);
        });
}
    get hasDispatched() { return this.dispatched && this.dispatched.length > 0; }

    get dispatchedRows() {
        return [...(this.dispatched || [])].reverse().map(o => ({
            ...o,
            karDisplay:   o.kar || '—',
            dueFormatted: formatDate(o.due),
            matClass:     matClass(o.mat),
            hasLeftover:  o.leftoverQty > 0
        }));
    }
}