import { LightningElement, api, track } from 'lwc';
import { matClass } from 'c/jwelCraftUtils';

export default class JwelCraftDispatchModal extends LightningElement {
    @api order = {};

    @track dispatchQty = 1;
    @track notes = '';

    connectedCallback() {
        this.dispatchQty = this.order ? this.order.qty : 1;
    }

    get matClass()    { return matClass(this.order ? this.order.mat : ''); }
    get leftoverQty() { return Math.max(0, (this.order ? this.order.qty : 0) - this.dispatchQty); }
    get showLeftover(){ return this.leftoverQty > 0; }

    handleQtyChange(e)   { this.dispatchQty = parseInt(e.target.value) || 1; }
    handleNotesChange(e) { this.notes = e.target.value; }

    handleClose() {
        this.dispatchEvent(new CustomEvent('closedispatchmodal', { bubbles: true, composed: true }));
    }

    handleOverlayClick(e) {
        if (e.target === e.currentTarget) this.handleClose();
    }

    handleConfirm() {
        const dq = this.dispatchQty;
        if (!dq || dq < 1 || dq > this.order.qty) return;
        this.dispatchEvent(new CustomEvent('dispatchconfirmed', {
            detail: {
                id:            this.order.id,
                dispatchedQty: dq,
                leftoverQty:   this.leftoverQty,
                notes:         this.notes,
            },
            bubbles: true, composed: true
        }));
    }
}