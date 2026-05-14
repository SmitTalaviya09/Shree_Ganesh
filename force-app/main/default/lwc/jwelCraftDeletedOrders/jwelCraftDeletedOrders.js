import { LightningElement, track } from 'lwc';
import getAllOrders from '@salesforce/apex/JewelryOrderController.getAllOrders';
import deleteAnyOrderRecord from '@salesforce/apex/JewelryOrderController.deleteAnyOrderRecord';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

export default class JwelCraftDeletedOrders extends LightningElement {
    @track orders = [];
    @track isLoading = false;
    @track showConfirm = false;
    @track selectedOrder = null;
    @track searchCustomer = '';
    @track searchItemCode = '';
    @track filterColor = '';
    @track filterKarat = '';

    get filteredOrders() {
        let customer = (this.searchCustomer || '').toLowerCase();
        let itemCode = (this.searchItemCode || '').toLowerCase();
        let color = this.filterColor || '';
        let karat = this.filterKarat || '';

        return (this.orders || []).filter((o) => {
            let matchCustomer = !customer || (o.customer || '').toLowerCase().includes(customer);
            let matchItemCode = !itemCode || (o.itemCode || '').toLowerCase().includes(itemCode);
            let matchColor = !color || o.color === color;
            let matchKarat = !karat || o.karat === karat;

            return matchCustomer && matchItemCode && matchColor && matchKarat;
        });
    }

    get hasOrders() {
        return this.filteredOrders && this.filteredOrders.length > 0;
    }

    handleCustomerSearch(event) {
        this.searchCustomer = event.target.value;
    }

    handleItemCodeSearch(event) {
        this.searchItemCode = event.target.value;
    }

    handleColorFilter(event) {
        this.filterColor = event.target.value;
    }

    handleKaratFilter(event) {
        this.filterKarat = event.target.value;
    }

    clearFilters() {
        this.searchCustomer = '';
        this.searchItemCode = '';
        this.filterColor = '';
        this.filterKarat = '';
    }

    connectedCallback() {
        this.loadOrders();
    }

    get hasOrders() {
        return this.orders && this.orders.length > 0;
    }

    loadOrders() {
        this.isLoading = true;

        getAllOrders()
            .then((res) => {
                this.orders = (res || []).map((o) => ({
                    id: o.Id,
                    customer: o.Customer_Name__c || '—',
                    customerCode: o.Customer_Code__c || '',
                    itemCode: o.Item_Code__c || '—',
                    size: o.Size__c || '—',
                    color: o.Color__c || '—',
                    karat: o.Karat__c || '—',
                    quantity: o.Quantity__c || 0,
                    unit: o.Quantity_Unit__c || 'Pieces',
                    stage: o.Current_Stage__c || '—',
                    orderDate: o.Order_Date__c
                        ? new Date(o.Order_Date__c).toLocaleString('en-IN')
                        : '—'
                }));
            })
            .catch((err) => {
                this.showToast('Error', this.getErrorMessage(err), 'error');
            })
            .finally(() => {
                this.isLoading = false;
            });
    }

    handleDeleteClick(event) {
        event.preventDefault();
        event.stopPropagation();

        const id = event.currentTarget.dataset.recordId;
        console.log('DELETE CLICK ID:', id);

        const order = this.orders.find((o) => o.id === id);

        if (!order) {
            this.showToast('Error', 'Selected order not found', 'error');
            return;
        }

        this.selectedOrder = { ...order };
        this.showConfirm = true;

        console.log('MODAL OPEN:', this.showConfirm, this.selectedOrder);
    }

    cancelDelete() {
        this.showConfirm = false;
        this.selectedOrder = null;
    }

    confirmDelete() {
        if (!this.selectedOrder || !this.selectedOrder.id) {
            this.showToast('Error', 'No order selected', 'error');
            return;
        }

        const deleteId = this.selectedOrder.id;

        this.isLoading = true;

        deleteAnyOrderRecord({ recordId: deleteId })
            .then(() => {
                this.orders = this.orders.filter((o) => o.id !== deleteId);
                this.showConfirm = false;
                this.selectedOrder = null;

                this.showToast('Success', 'Order deleted successfully', 'success');

                return this.loadOrders();
            })
            .catch((err) => {
                this.showToast('Delete failed', this.getErrorMessage(err), 'error');
            })
            .finally(() => {
                this.isLoading = false;
            });
    }

    getErrorMessage(error) {
        if (error && error.body && error.body.message) {
            return error.body.message;
        }

        if (error && error.message) {
            return error.message;
        }

        return 'Something went wrong';
    }

    showToast(title, message, variant) {
        this.dispatchEvent(
            new ShowToastEvent({
                title: title,
                message: message,
                variant: variant
            })
        );
    }
}