import { LightningElement, track } from 'lwc';
import { formatDate, matClass } from 'c/jwelCraftUtils';
import getCompletedOrders from '@salesforce/apex/JewelryOrderController.getCompletedOrders';

export default class JwelCraftCompleteOrder extends LightningElement {

    @track dispatched = [];
    @track isLoading = false;

    searchKey = '';
    colorFilter = '';
    karatFilter = '';

    connectedCallback() {
        this._loadOrders();
    }

    _loadOrders() {
        this.isLoading = true;

        getCompletedOrders()
            .then(res => {
                this.dispatched = (res || [])
                    .filter(o => o.status === 'Completed' && o.dispatchedQty > 0)
                    .map((o, idx) => {
                        const orderedQty = Number(o.quantity || 0);
                        const dispatchedQty = Number(o.dispatchedQty || 0);
                        const leftoverQty = Math.max(0, orderedQty - dispatchedQty);

                        return {
                            id: o.orderId,
                            srNo: idx + 1,
                            code: o.orderId || '—',
                            customer: o.customerName || '—',
                            customerCode: o.customerCode || '',
                            itemCode: o.itemCode || '—',
                            mat: o.color || '—',
                            kar: o.karat || '—',
                            qty: orderedQty,
                            dispatchedQty,
                            leftoverQty,
                            hasLeftover: leftoverQty > 0,
                            status: o.status || '—',
                            priority: o.priority || 'Medium',
                            remark: o.remark || '',
                            orderDate: o.orderDate
                                ? new Date(o.orderDate).toLocaleDateString('en-IN', {
                                      day: 'numeric',
                                      month: 'short',
                                      year: 'numeric'
                                  })
                                : '—',
                            dispatchDateRaw: o.dispatchDate,
                            dispatchDate: o.dispatchDate
                                ? new Date(o.dispatchDate).toLocaleDateString('en-IN', {
                                      day: 'numeric',
                                      month: 'short',
                                      year: 'numeric'
                                  })
                                : '—'
                        };
                    });

                this.dispatched.sort((a, b) => {
                    return new Date(b.dispatchDateRaw || 0) - new Date(a.dispatchDateRaw || 0);
                });
            })
            .catch(err => {
                console.error('getCompletedOrders error:', err);
            })
            .finally(() => {
                this.isLoading = false;
            });
    }

    handleSearch(event) {
        this.searchKey = event.target.value || '';
    }

    handleColorFilter(event) {
        this.colorFilter = event.target.value || '';
    }

    handleKaratFilter(event) {
        this.karatFilter = event.target.value || '';
    }

    clearFilters() {
        this.searchKey = '';
        this.colorFilter = '';
        this.karatFilter = '';

        const inputs = this.template.querySelectorAll('.fribbon input, .fribbon select');
        inputs.forEach(el => {
            el.value = '';
        });
    }

    get hasDispatched() {
        return this.filteredDispatched.length > 0;
    }

    get colorOptions() {
        return [...new Set(
            (this.dispatched || [])
                .map(o => o.mat)
                .filter(v => v && v !== '—')
        )].sort();
    }

    get karatOptions() {
        return [...new Set(
            (this.dispatched || [])
                .map(o => o.kar)
                .filter(v => v && v !== '—')
        )].sort();
    }

    get filteredDispatched() {
        const key = (this.searchKey || '').toLowerCase().trim();
        const color = this.colorFilter;
        const karat = this.karatFilter;

        return (this.dispatched || []).filter(o => {
            const searchMatch =
                !key ||
                (o.customer || '').toLowerCase().includes(key) ||
                (o.itemCode || '').toLowerCase().includes(key);

            const colorMatch = !color || o.mat === color;
            const karatMatch = !karat || o.kar === karat;

            return searchMatch && colorMatch && karatMatch;
        });
    }

    get dispatchedRows() {
        return [...this.filteredDispatched].map(o => ({
            ...o,
            karDisplay: o.kar || '—',
            dueFormatted: formatDate(o.due),
            matClass: matClass(o.mat),
            hasLeftover: o.leftoverQty > 0
        }));
    }
}