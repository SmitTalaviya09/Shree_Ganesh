// import { LightningElement, api } from 'lwc';
// import { formatDate, matClass } from 'c/jwelCraftUtils';

// export default class JwelCraftDispatched extends LightningElement {
//     @api dispatched = [];

//     get hasDispatched() { return this.dispatched && this.dispatched.length > 0; }

//     get dispatchedRows() {
//         return [...(this.dispatched || [])].reverse().map(o => ({
//             ...o,
//             karDisplay:   o.kar || '—',
//             dueFormatted: formatDate(o.due),
//             matClass:     matClass(o.mat),
//             hasLeftover:  o.leftoverQty > 0,
//         }));
//     }
// }
import { LightningElement, track } from 'lwc';
import { formatDate, matClass } from 'c/jwelCraftUtils';
import getAllOrders from '@salesforce/apex/JewelryOrderController.getAllOrders';

export default class JwelCraftDispatched extends LightningElement {

    @track dispatched = [];
    @track isLoading  = false;

    connectedCallback() {
        this._loadOrders();
    }

    _loadOrders() {
        this.isLoading = true;
        var self = this;
        getAllOrders()
            .then(function(res) {
                self.isLoading = false;
                self.dispatched = (res || [])
                    .filter(function(o) {
                        return o.Current_Stage__c === 'Dispatched';
                    })
                    .map(function(o) {
                        var orderedQty    = o.Quantity__c       || 0;
                        var dispatchedQty = o.Dispatched_Qty__c || 0;
                        var leftoverQty   = Math.max(0, orderedQty - dispatchedQty);
                        return {
                            id:            o.Id,
                            code:          o.Order_ID_Ref__c   || '',
                            customer:      o.Customer_Name__c  || '—',
                            customerCode:  o.Customer_Code__c  || '',
                            mat:           o.Color__c          || '',
                            kar:           o.Karat__c          || '',
                            qty:           orderedQty,
                            dispatchedQty: dispatchedQty,
                            leftoverQty:   leftoverQty,
                            due:           o.Order_Date__c     || '',
                            dueDate:       o.Order_Due_Date__c || '',
                            dispatchDate:  o.Order_Due_Date__c
                                ? new Date(o.Order_Due_Date__c).toLocaleDateString('en-IN',
                                    { day: 'numeric', month: 'short', year: 'numeric' })
                                : '—',
                            status:        o.Current_Stage__c  || ''
                        };
                    });
            })
            .catch(function() { self.isLoading = false; });
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