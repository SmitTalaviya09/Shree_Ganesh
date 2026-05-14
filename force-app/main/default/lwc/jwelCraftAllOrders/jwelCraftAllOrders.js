import { LightningElement, api, track } from 'lwc';
import { formatDate, matClass, badgeClass, priClass } from 'c/jwelCraftUtils';
import getPicklistValues from '@salesforce/apex/JewelryOrderController.getPicklistValues';
import updateOrder from '@salesforce/apex/JewelryOrderController.updateOrder';
import deleteOrder from '@salesforce/apex/JewelryOrderController.deleteOrder';
import getItemMeasurementTypes from '@salesforce/apex/JewelryOrderController.getItemMeasurementTypes'; 
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import getAllOrders        from '@salesforce/apex/JewelryOrderController.getAllOrders';

export default class JwelCraftAllOrders extends LightningElement {
    // @api orders = [];
    @track orders = [];
    @api userRole = '';

    @track searchTerm  = '';
    @track filterKarat  = '';
    @track filterStatus = '';
    @track filterMat    = '';
    @track filterPri    = '';
    @track filterFrom   = '';
    @track filterTo     = '';
    @track showEditModal = false;
    @track showDeleteConfirm = false;
    @track selectedCustomer = '';
    @track editItemCode = '';
    @track editItemCodeLabel = 'Select item…';
    @track editItemCodeClass = 'rpt-placeholder';
    @track allQtyUnits = [];
    @track editQtyUnit = '';
            

    @track allItemCodes = [];

    @track showItemPick = false;
    @track itemPickSearch = '';

    @track filteredItemCodes = [];

    selectedId;
    editStatus = '';
    editMaterial='';
    editKarat='';
    editSize='';
    editQty='';

    // ── Filters ──
    handleSearch(e)      { this.searchTerm   = e.target.value; }
    handleKaratFilter(e) { this.filterKarat = e.target.value; }
    handleStatusFilter(e){ this.filterStatus = e.target.value; }
    handleMatFilter(e)   { this.filterMat    = e.target.value; }
    handlePriFilter(e)   { this.filterPri    = e.target.value; }
    handleFromFilter(e)  { this.filterFrom   = e.target.value; }
    handleToFilter(e)    { this.filterTo     = e.target.value; }
    get hasItemOptions(){
        return this.filteredItemCodes && this.filteredItemCodes.length > 0;
    }


    connectedCallback(){
        this.loadPicklists();
        this.startPolling();
    }
    disconnectedCallback(){
        if (this.poller) {
            clearInterval(this.poller);
        }
    }
    startPolling() {
        this._refreshOrders();

        this.poller = setInterval(() => {
            this._refreshOrders();
        }, 60000);
    }
    get editMaterialOptions() {
        var selectedMat = this.editMaterial || '';

        return [
            'Yellow Gold',
            'White Gold',
            'Rose Gold',
            'Silver'
        ].map(function(m) {
            return {
                label: m,
                value: m,
                selected: m === selectedMat
            };
        });
    }
    _refreshOrders() {
        var self = this;

        // Small delay to allow Big Object indexing to settle after insert
        return new Promise(function(resolve) { setTimeout(resolve, 500); })
            .then(function() {
                return getAllOrders();
            })
            .then(function(data) {
                if (data) {
                    console.log('OUTPUT : data@@',data);
                    self.orders     = data.map(function(rec) { return self._mapFromSObject(rec); });
                }
            })
            .catch(function(err) {
            // self.isLoading = false;
            console.error('REFRESH ERROR', JSON.stringify(err));
            // self.showToast('⚠️', 'Could not refresh orders', 
            //     (err.body && err.body.message) || (err.body && err.body.exceptionType) || err.message || JSON.stringify(err)
            // );
        });
    }
    _mapFromSObject(rec) {
        return {
            id:             rec.Id,
            code:           rec.Order_ID_Ref__c        || rec.Name || '—',
            customer:       rec.Customer_Name__c        || '—',
            customerCode:   rec.Customer_Code__c        || '',
            customerMobile: rec.Customer_Mobile_No__c   || '',
            itemCode:       rec.Item_Code__c            || '',
            color:          rec.Color__c                || '',
            mat:            rec.Color__c                || '',
            kar:            rec.Karat__c ? String(rec.Karat__c) : '',
            size:           rec.Size__c                 || '',
            //qtyUnit:        rec.Quantity_Unit__c || 'Pieces',
            qtyUnit:        rec.Quantity_Unit__c || '-',
            // qty:            rec.Quantity__c             || 0,
            qty:            rec.Pending_Qty__c || 0,
            fulfilledQty:   rec.Fulfilled_Qty__c        || 0,
            pendingQty:     (rec.Quantity__c || 0) - (rec.Fulfilled_Qty__c || 0),
            dispatchStatus: rec.Dispatch_Status__c      || '-',
            pri:            rec.Priority__c             || 'Medium',
            notes:          rec.Remark__c               || '',
            status:         rec.Current_Stage__c        || 'New',
            due:            rec.Order_Date__c           || '',
            dueDate:        rec.Order_Due_Date__c       || '',
            batchRef:       rec.Production_Batch_Ref__c || '',
        };
    }

    loadPicklists(){
        var self = this;

        getPicklistValues()
        .then(function(result){

            self.allItemCodes = result.itemCodes || [];

            self.filteredItemCodes = self.allItemCodes;
            self.allQtyUnits = result.qtyUnits || [];

        })
        .catch(function(error){
            console.error('Picklist load error',error);
        });
    }
    clearFilters() {
        this.searchTerm = this.filterKarat = this.filterStatus = this.filterMat =
        this.filterPri  = this.filterFrom   = this.filterTo = '';
    }
    toggleMenu(event) {
        const id = event.currentTarget.dataset.id;

        this.orders = this.orders.map(o => ({
            ...o,
            showMenu: o.id == id ? !o.showMenu : false
        }));
    }
    handleQtyUnitChange(event){
        this.editQtyUnit = event.target.value;
    }
    handleItemPickFocus(){

    this.showItemPick = !this.showItemPick;

    if(this.showItemPick){
        this.filteredItemCodes = [...this.allItemCodes];
    }
}
validateEditFields(){

    if(!this.editItemCode){
        this.showToast('Validation','Item Code is required','error');
        return false;
    }

    if(!this.editMaterial){
        this.showToast('Validation','Material is required','error');
        return false;
    }

    if(!this.editQty){
        this.showToast('Validation','Quantity is required','error');
        return false;
    }

    return true;
}
// handleEdit(event){

//     const id = event.currentTarget.dataset.id;

//     const order = this.orders.find(o => o.id == id);

//     if(order.status !== 'New'){
//         this.showToast('Error','Only NEW orders can be edited','error');
//         return;
//     }

//     this.selectedId = id;

//     // Load values in modal
//     this.editItemCode = order.itemCode;
//     this.editItemCodeLabel = order.itemCode;
//     this.editItemCodeClass = 'rpt-selected';

//     this.editMaterial = order.mat;
//     this.editKarat = order.kar;
//     this.editSize = order.size;
//     this.editQty = order.qty;
//     this.editQtyUnit = order.qtyUnit;
//     this.editQtyUnit = order.qtyUnit || 'Pieces';

//     console.log('editQtyUnit loaded as:', this.editQtyUnit);
//     this.showEditModal = true;
// }
// ✅ Returns qtyUnit options with correct selected state for edit modal
get editQtyUnitOptions() {
    return (this.allQtyUnits || []).map(u => ({
        label:    u,
        value:    u,
        selected: u === this.editQtyUnit  // ✅ marks correct option as selected
    }));
}
handleEdit(event) {
    const id    = event.currentTarget.dataset.id;
    const order = this.orders.find(o => o.id == id);

    if (order.status !== 'New' && order.status !== 'Client New') {
        this.showToast('Error', 'Only NEW & Client New orders can be edited', 'error');
        return;
    }

    this.selectedId = id;

    // Load values in modal
    this.editItemCode      = order.itemCode;
    this.editItemCodeLabel = order.itemCode;
    this.editItemCodeClass = 'rpt-selected';
    this.editMaterial      = order.mat;
    this.editKarat         = order.kar;
    this.editSize          = order.size;
    this.editQty           = order.qty;
    this.editQtyUnit       = order.qtyUnit || 'Pieces';

    // ✅ Open modal first
    this.showEditModal = true;

    // ✅ Force select to show correct value AFTER DOM renders
    // because allQtyUnits loads async and select may render before value binds
    var self = this;
    var targetUnit = order.qtyUnit || 'Pieces';

    setTimeout(function() {
        var sel = self.template.querySelector('select.edit-input[value]');
        // Find the Types select specifically by querying all selects
        var allSelects = self.template.querySelectorAll('.edit-modal select.edit-input');
        // Types select is the 3rd select (Material, Karat, Types, ...)
        allSelects.forEach(function(selectEl) {
            if (selectEl.value !== undefined) {
                // Check if this select has our unit options
                var hasUnitOption = Array.from(selectEl.options)
                    .some(function(opt) { 
                        return opt.value === 'Pieces' || 
                               opt.value === 'Inches' || 
                               opt.value === 'Grams'; 
                    });
                if (hasUnitOption) {
                    selectEl.value = targetUnit; // ✅ force correct value
                }
            }
        });
    }, 0);
}
handleItemPickSearch(event){

    const search = event.target.value.toLowerCase();

    this.itemPickSearch = event.target.value;

    this.filteredItemCodes = this.allItemCodes.filter(code =>
        code.toLowerCase().includes(search)
    );
}
handleItemCodeSelect(event){

    const value = event.currentTarget.dataset.value;

    this.editItemCode = value;
    this.editItemCodeLabel = value;
    this.editItemCodeClass = 'rpt-selected';

    this.showItemPick = false;
    this.itemPickSearch = '';
}
handleItemCodeChange(e){
    this.editItemCode = e.target.value;
}

handleMaterialChange(e){
    this.editMaterial = e.target.value;
}

handleKaratChange(e){
    this.editKarat = e.target.value;
}

handleSizeChange(e){
    this.editSize = e.target.value;
}

handleQtyChange(e){
    this.editQty = e.target.value;
}

handleStatusChange(event){
    this.editStatus = event.target.value;
}

closeEdit(){
    this.showEditModal = false;
}

// saveEdit(){

//     if(!this.validateEditFields()){
//         return;
//     }

//     updateOrder({
//         recordId: this.selectedId,
//         itemCode: this.editItemCode,
//         color: this.editMaterial,
//         karat: this.editKarat,
//         size: this.editSize,
//         quantity: this.editQty,
//         qtyUnit:this.editQtyUnit
//     })
//     .then(()=>{

//         // Update UI immediately
//         this.orders = this.orders.map(o=>{
//             if(o.id == this.selectedId){
//                 return{
//                     ...o,
//                     itemCode:this.editItemCode,
//                     mat:this.editMaterial,
//                     kar:this.editKarat,
//                     size:this.editSize,
//                     qty:this.editQty
//                 };
//             }
//             return o;
//         });

//         this.showToast(
//         'Success',
//         'Order updated successfully',
//         'success'
//     );

//     this.showEditModal=false;

//     })
//     .catch(error=>{
//         alert(error.body.message);
//     });
// }
    saveEdit() {
    // ── Step 1: Basic field validation (your existing logic unchanged) ──
    if (!this.validateEditFields()) {
        return;
    }

    // ── Step 2: Validate qtyUnit vs Measurement_Type for this item code ──
    var self = this;

    getItemMeasurementTypes({ itemCodes: [this.editItemCode] })
    .then(function(typeMap) {

        // var mType        = typeMap[self.editItemCode] || 'Quantity';
        // var selectedUnit = (self.editQtyUnit || '').trim();
        // var unitError    = null;

        // if (mType === 'Quantity') {
        //     // Only Pieces allowed
        //     if (selectedUnit !== 'Pieces') {
        //         unitError = '"' + self.editItemCode + '" only allows Pieces. '
        //                   + 'You selected "' + selectedUnit + '"';
        //     }
        // } else if (mType === 'LengthWeight') {
        //     // Only Inches or Grams allowed
        //     if (selectedUnit !== 'Inches' && selectedUnit !== 'Grams') {
        //         unitError = '"' + self.editItemCode + '" only allows Inches or Grams. '
        //                   + 'You selected "' + selectedUnit + '"';
        //     }
        // }
        var allowedUnits = {
            'Quantity':       ['Pieces'],
            'LengthWeight':   ['Inches', 'Grams'],
            'Pair':           ['Pair'],
            'QuantityPair':   ['Pieces', 'Pair'],
            'QuantityWeight': ['Pieces', 'Grams']
        };

        var mType        = typeMap[self.editItemCode] || 'Quantity';
        var selectedUnit = (self.editQtyUnit || '').trim();
        var allowed      = allowedUnits[mType] || ['Pieces'];
        var unitError    = null;

        if (!allowed.includes(selectedUnit)) {
            unitError = '"' + self.editItemCode + '" type "' + mType + '" only allows: '
                    + allowed.join(' or ') + '. You selected "' + selectedUnit + '"';
        }

        // ── Step 3: If wrong unit — show error and STOP ──
        if (unitError) {
            self.showToast('Wrong Unit Selected', unitError, 'error');
            return;
        }

        // ── Step 4: All valid — call Apex updateOrder ──
        updateOrder({
            recordId: self.selectedId,
            itemCode: self.editItemCode,
            color:    self.editMaterial,
            karat:    self.editKarat,
            size:     self.editSize,
            quantity: self.editQty,
            qtyUnit:  self.editQtyUnit
        })
        .then(() => {
            // ── Update UI immediately (your existing logic unchanged) ──
            self.orders = self.orders.map(o => {
                if (o.id == self.selectedId) {
                    return {
                        ...o,
                        itemCode: self.editItemCode,
                        mat:      self.editMaterial,
                        kar:      self.editKarat,
                        size:     self.editSize,
                        qty:      self.editQty,
                        qtyUnit:  self.editQtyUnit  // ✅ also update qtyUnit in UI
                    };
                }
                return o;
            });

            self.showToast('Success', 'Order updated successfully', 'success');
            self.showEditModal = false;
        })
        .catch(error => {
            self.showToast('Error', error.body ? error.body.message : 'Update failed', 'error');
        });
    })
    .catch(function(err) {
        self.showToast('Error', 
            (err.body && err.body.message) || 'Could not load item configuration', 
            'error'
        );
    });
}
handleDeleteClick(event){

    const id = event.currentTarget.dataset.id;
    const order = this.orders.find(o => o.id == id);

    const allowedStatus = ['New','Stock Check','Bag Generate'];

    if(!allowedStatus.includes(order.status)){
        this.showToast(
            'Not Allowed',
            'This record cannot be deleted.',
            'warning'
        );
        return;
    }

    this.selectedId = id;
    this.selectedCustomer = order.customer;

    this.showDeleteConfirm = true;
}

cancelDelete(){
    this.showDeleteConfirm = false;
}
confirmDelete(){

    deleteOrder({ recordId: this.selectedId })
    .then(()=>{
        // Remove record from UI
        this.orders = this.orders.filter(o => o.id !== this.selectedId);
        this.showDeleteConfirm = false;
        this.showToast(
            'Success',
            'Order deleted successfully',
            'success'
        );
    })
    .catch(error=>{
        this.showToast(
            'Error',
            error.body ? error.body.message : 'Delete failed',
            'error'
        );
    });
}
    get filteredOrders() {
        console.log('All ORDERS : ', this.orders);
        const q = this.searchTerm.toLowerCase();
        var hiddenStages = ['Cancelled', 'Completed', 'Dispatched', 'Client New', 'Rejected'];
        return (this.orders || [])
            .filter(o => {
                // if (o.status === 'Cancelled' || o.status === 'Completed' || o.status === 'Dispatched') return false;
                if (hiddenStages.includes(o.status)) return false;
                if (q && !o.code.toLowerCase().includes(q) && !o.customer.toLowerCase().includes(q)) return false;
                if (this.filterKarat && o.kar !== this.filterKarat) return false;
                if (this.filterStatus && o.status !== this.filterStatus) return false;
                if (this.filterMat    && o.mat    !== this.filterMat)    return false;
                if (this.filterPri    && o.pri    !== this.filterPri)    return false;
                if (this.filterFrom   && o.due    <   this.filterFrom)   return false;
                if (this.filterTo     && o.due    >   this.filterTo)     return false;
                return true;
            })
            .map(o => ({
                ...o,
                karDisplay:     o.kar || '—',
                dueFormatted:   formatDate(o.due),
                dueDateFormatted:   formatDate(o.dueDate),
                qtyDisplay: this.formatQty(o.qty, o.qtyUnit),
                matClass:       matClass(o.mat),
                badgeClass:     badgeClass(o.status),
                priClass:       priClass(o.pri),
                showMoveToStock: o.status === 'New',
                showMarkReady:  o.status === 'In Production',
                showDispatch:   o.status === 'Ready',
            }));
    }

    get hasFilteredOrders() { return this.filteredOrders.length > 0; }

    // ── Action Handlers (fire events UP to parent) ──
    handleSelectAll(e) {
        this.template.querySelectorAll('input[type="checkbox"].cb:not(:first-child)').forEach(cb => { cb.checked = e.target.checked; });
    }

    handleMoveToStock(e) {
        this._fireStatus(e, 'Stock Check');
    }
    handleMarkReady(e) {
        this._fireStatus(e, 'Ready');
    }
    handleDispatch(e) {
        const id = parseInt(e.currentTarget.dataset.id);
        // Navigate parent to Ready tab; parent will open dispatch modal via ready child
        this.dispatchEvent(new CustomEvent('navigate', { detail: { tab: 'ready' }, bubbles: true, composed: true }));
    }
    handleDelete(e) {
        const id = parseInt(e.currentTarget.dataset.id);
        this.dispatchEvent(new CustomEvent('deleteorder', { detail: { id }, bubbles: true, composed: true }));
    }

    _fireStatus(e, newStatus) {
        const id = parseInt(e.currentTarget.dataset.id);
        this.dispatchEvent(new CustomEvent('statuschange', { detail: { id, newStatus }, bubbles: true, composed: true }));
    }

    formatQty(qty, unit){

        if(!qty) return '—';

        if(unit === 'Pieces'){
            return `${parseInt(qty)} Pieces`;
        }

        if(unit === 'Grams'){
            return `${parseFloat(qty).toFixed(3)} Grams`;
        }

        if(unit === 'Inches'){
            return `${parseFloat(qty).toFixed(3)} Inches`;
        }

        return `${qty} ${unit}`;
    }
    showToast(title,message,variant){

        const evt = new ShowToastEvent({
            title:title,
            message:message,
            variant:variant
        });

        this.dispatchEvent(evt);
    }
}