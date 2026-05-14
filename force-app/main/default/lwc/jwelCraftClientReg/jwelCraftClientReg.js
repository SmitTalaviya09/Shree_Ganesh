import { LightningElement, track } from 'lwc';
import getAllClientRegistrations from '@salesforce/apex/SGFClientPortalController.getAllClientRegistrations';
import saveClientRegistration   from '@salesforce/apex/SGFClientPortalController.saveClientRegistration';
import deleteClientRegistration from '@salesforce/apex/SGFClientPortalController.deleteClientRegistration';

export default class JwelCraftClientReg extends LightningElement {

    @track isLoading  = false;
    @track clients    = [];
    @track searchTerm = '';

    // Modal
    @track showModal         = false;
    @track isSaving          = false;
    @track isEditMode        = false;
    @track f_id              = '';
    @track f_name            = '';
    @track f_customerCode    = '';
    @track f_gst             = '';
    @track f_mobile          = '';
    @track f_nameErr         = false;
    @track f_customerCodeErr = false;
    @track f_gstErr          = false;
    @track f_mobErr          = false;

    // Delete confirm
    @track showDeleteConfirm = false;
    @track deleteTarget      = null;
    @track isDeleting        = false;

    connectedCallback() { this._load(); }

    _load() {
        this.isLoading = true;
        var self = this;
        getAllClientRegistrations()
            .then(function(res) {
                self.isLoading = false;
                self.clients   = (res || []).map(function(r) {
                    var created = r.CreatedDate
                        ? new Date(r.CreatedDate).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric'
                        })
                        : '';
                    return {
                        id:           r.Id,
                        name:         r.Client_Name__c   || '—',
                        customerCode: r.Customer_Code__c || '—',
                        gst:          r.GST_Number__c    || '—',
                        mobile:       r.Client_Mobile__c || '—',
                        created:      created
                    };
                });
            })
            .catch(function(err) {
                self.isLoading = false;
                self._toast(
                    '❌',
                    'Error loading clients',
                    (err.body && err.body.message) || err.message || ''
                );
            });
    }

    handleSearch(e) {
        this.searchTerm = e.target.value;
    }

    handleClearSearch() {
        this.searchTerm = '';
    }

    get filteredClients() {
        var s = (this.searchTerm || '').toLowerCase();
        if (!s) return this.clients;

        return this.clients.filter(function(c) {
            return (c.name || '').toLowerCase().includes(s) ||
                   (c.customerCode || '').toLowerCase().includes(s) ||
                   (c.gst || '').toLowerCase().includes(s) ||
                   (c.mobile || '').toLowerCase().includes(s);
        });
    }

    get hasClients() {
        return this.filteredClients.length > 0;
    }

    get totalCount() {
        return this.clients.length;
    }

    get filteredCount() {
        return this.filteredClients.length;
    }

    handleOpenAdd() {
        this.isEditMode        = false;
        this.f_id              = '';
        this.f_name            = '';
        this.f_customerCode    = '';
        this.f_gst             = '';
        this.f_mobile          = '';
        this.f_nameErr         = false;
        this.f_customerCodeErr = false;
        this.f_gstErr          = false;
        this.f_mobErr          = false;
        this.showModal         = true;
    }

    handleEdit(e) {
        var id = e.currentTarget.dataset.id;
        var c  = this.clients.find(function(x) { return x.id === id; });
        if (!c) return;

        this.isEditMode        = true;
        this.f_id              = c.id;
        this.f_name            = c.name === '—' ? '' : c.name;
        this.f_customerCode    = c.customerCode === '—' ? '' : c.customerCode;
        this.f_gst             = c.gst === '—' ? '' : c.gst;
        this.f_mobile          = c.mobile === '—' ? '' : c.mobile;
        this.f_nameErr         = false;
        this.f_customerCodeErr = false;
        this.f_gstErr          = false;
        this.f_mobErr          = false;
        this.showModal         = true;
    }

    handleCloseModal() {
        this.showModal = false;
    }

    handleNameInput(e) {
        this.f_name = e.target.value;
        this.f_nameErr = false;
    }

    handleCustomerCodeInput(e) {
        this.f_customerCode = e.target.value;
        this.f_customerCodeErr = false;
    }

    handleGstInput(e) {
        this.f_gst = e.target.value;
        this.f_gstErr = false;
    }

    handleMobileInput(e) {
        this.f_mobile = e.target.value;
        this.f_mobErr = false;
    }

    get modalTitle() {
        return this.isEditMode ? '✏️ Edit Client' : '➕ Add Client';
    }

    get saveBtnLabel() {
        return this.isSaving ? 'Saving…' : (this.isEditMode ? 'Update' : 'Add Client');
    }

    handleSave() {
        this.f_nameErr         = !this.f_name || !this.f_name.trim();
        this.f_customerCodeErr = !this.f_customerCode || !this.f_customerCode.trim();
        this.f_gstErr          = !this.f_gst || !this.f_gst.trim();
        this.f_mobErr          = !this.f_mobile || !this.f_mobile.trim();

        if (this.f_nameErr || this.f_customerCodeErr || this.f_gstErr || this.f_mobErr) {
            this._toast('❌', 'All fields are required', '');
            return;
        }

        this.isSaving = true;
        var self = this;

        saveClientRegistration({
            recordId:     this.f_id || null,
            clientName:   this.f_name.trim(),
            gstNumber:    this.f_gst.trim(),
            mobileNo:     this.f_mobile.trim(),
            customerCode: this.f_customerCode.trim()
        })
        .then(function() {
            self.isSaving  = false;
            self.showModal = false;
            self._toast('✅', self.isEditMode ? 'Client updated' : 'Client added', '');
            self._load();
        })
        .catch(function(err) {
            self.isSaving = false;
            self._toast('❌', 'Error', (err.body && err.body.message) || err.message || '');
        });
    }

    handleDeleteClick(e) {
        var id = e.currentTarget.dataset.id;
        this.deleteTarget = this.clients.find(function(c) {
            return c.id === id;
        });
        this.showDeleteConfirm = true;
    }

    handleCancelDelete() {
        this.showDeleteConfirm = false;
        this.deleteTarget = null;
    }

    handleConfirmDelete() {
        if (!this.deleteTarget) return;

        this.isDeleting = true;
        var self = this;

        deleteClientRegistration({ recordId: this.deleteTarget.id })
            .then(function() {
                self.isDeleting = false;
                self.showDeleteConfirm = false;
                self._toast('🗑', 'Client removed', self.deleteTarget.name);
                self.deleteTarget = null;
                self._load();
            })
            .catch(function(err) {
                self.isDeleting = false;
                self._toast('❌', 'Error', (err.body && err.body.message) || err.message || '');
            });
    }

    get deleteTargetName() {
        return this.deleteTarget ? this.deleteTarget.name : '';
    }

    get nameInputClass() {
        return this.f_nameErr ? 'mf-input mf-err' : 'mf-input';
    }

    get codeInputClass() {
        return this.f_customerCodeErr ? 'mf-input mf-err' : 'mf-input';
    }

    get gstInputClass() {
        return this.f_gstErr ? 'mf-input mf-err' : 'mf-input';
    }

    get mobInputClass() {
        return this.f_mobErr ? 'mf-input mf-err' : 'mf-input';
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