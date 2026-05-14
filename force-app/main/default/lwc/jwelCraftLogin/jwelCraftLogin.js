import { LightningElement, track } from 'lwc';
import login from '@salesforce/apex/JwelAuthController.login';
import shreeganesh_Logo from '@salesforce/resourceUrl/shreeganesh_Logo';

export default class JwelCraftLogin extends LightningElement {

    @track loginId   = '';
    @track password  = '';
    @track showPass  = false;
    @track isLoading = false;
    @track errorMsg  = '';
    @track shake     = false;
    @track gemIcon = shreeganesh_Logo;

    get eyeIcon()       { return this.showPass ? '🙈' : '👁️'; }
    get inputType()     { return this.showPass ? 'text' : 'password'; }
    get formClass()     { return 'login-card' + (this.shake ? ' shake' : ''); }
    get hasError()      { return !!this.errorMsg; }

    handleLoginId(e)   { this.loginId  = e.target.value; this.errorMsg = ''; }
    handlePassword(e)  { this.password = e.target.value; this.errorMsg = ''; }
    toggleShowPass()   { this.showPass = !this.showPass; }

    handleKeyDown(e) {
        if (e.key === 'Enter') this.handleLogin();
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

                
    }

    handleLogin() {
        if (!this.loginId.trim() || !this.password) {
            this._showError('Please enter both Login ID and Password.');
            return;
        }
        this.isLoading = true;
        this.errorMsg  = '';

        login({ loginId: this.loginId.trim(), password: this.password })
            .then(result => {
                this.isLoading = false;
                if (result.success) {
                    // Fire loginSuccess event up to parent App
                    this.dispatchEvent(new CustomEvent('loginsuccess', {
                        detail: {
                            userId:   result.userId,
                            fullName: result.fullName,
                            role:     result.role,
                            loginId:  result.loginId,
                        },
                        bubbles: true, composed: true
                    }));
                } else {
                    this._showError(result.message);
                }
            })
            .catch(err => {
                this.isLoading = false;
                this._showError('Connection error. Please try again.');
            });
    }

    _showError(msg) {
        this.errorMsg = msg;
        this.shake = true;
        setTimeout(() => { this.shake = false; }, 600);
    }
}