import { LightningElement, api } from 'lwc';

export default class JwelCraftToast extends LightningElement {
    @api message    = '';
    @api subMessage = '';
    @api icon       = '✅';
    @api isVisible  = false;

    get toastClass() { return `toast${this.isVisible ? ' show' : ''}`; }
}