import { LightningElement, track } from 'lwc';
import getAllUsers   from '@salesforce/apex/JwelAuthController.getAllUsers';
import createUser   from '@salesforce/apex/JwelAuthController.createUser';
import toggleActive from '@salesforce/apex/JwelAuthController.toggleUserActive';

export default class JwelCraftUserMgmt extends LightningElement {

    @track users       = [];
    @track showForm    = false;
    @track isLoading   = false;
    @track isFetching  = false;
    @track formError   = '';
    @track formSuccess = '';
    @track showPass    = false;

    @track newFullName = '';
    @track newLoginId  = '';
    @track newPassword = '';
    @track newRole     = 'Manager';

    get eyeIcon()    { return this.showPass ? '🙈' : '👁️'; }
    get inputType()  { return this.showPass ? 'text' : 'password'; }
    get hasError()   { return !!this.formError; }
    get hasSuccess() { return !!this.formSuccess; }
    get hasUsers()   { return this.users.length > 0; }

    // Load users on component mount — imperative, never cached
    connectedCallback() { this._loadUsers(); }

    _loadUsers() {
        this.isFetching = true;
        getAllUsers()
            .then(data => {
                this.isFetching = false;
                this.users = this._mapUsers(data || []);
            })
            .catch(err => {
                this.isFetching = false;
                console.error('Failed to load users', err);
            });
    }

    _mapUsers(data) {
        return data.map((u, idx) => ({
            ...u,
            rowNum: idx + 1,
            lastLoginDisplay: u.Last_Login__c
                ? new Date(u.Last_Login__c).toLocaleString('en-IN', {
                    day:'numeric', month:'short', year:'numeric',
                    hour:'2-digit', minute:'2-digit'
                  })
                : 'Never',
            statusClass:  u.Is_Active__c ? 'status-active'  : 'status-inactive',
            statusLabel:  u.Is_Active__c ? '● Active'       : '● Inactive',
            toggleLabel:  u.Is_Active__c ? 'Deactivate'     : 'Activate',
            toggleClass:  u.Is_Active__c ? 'btn-deactivate' : 'btn-activate',
            roleClass:    u.Role__c === 'Manager' ? 'role-mgr'
                        : u.Role__c === 'Craftsman' ? 'role-craft' : 'role-disp',
        }));
    }

    handleNewFullName(e) { this.newFullName = e.target.value; this.formError = ''; }
    handleNewLoginId(e)  { this.newLoginId  = e.target.value; this.formError = ''; }
    handleNewPassword(e) { this.newPassword = e.target.value; this.formError = ''; }
    handleNewRole(e)     { this.newRole     = e.target.value; }
    toggleShowPass()     { this.showPass = !this.showPass; }
    handleShowForm()     { this.showForm = true; this.formError = ''; this.formSuccess = ''; }
    handleCancelForm()   { this.showForm = false; this._clearForm(); }

    handleCreateUser() {
        if (!this.newFullName || !this.newLoginId || !this.newPassword || !this.newRole) {
            this.formError = 'All fields are required.';
            return;
        }
        this.isLoading = true;
        this.formError = '';
        createUser({
            fullName: this.newFullName,
            loginId:  this.newLoginId,
            password: this.newPassword,
            role:     this.newRole,
        })
        .then(result => {
            this.isLoading = false;
            if (result.success) {
                this.formSuccess = `User "${this.newFullName}" created successfully!`;
                this.showForm = false;
                this._clearForm();
                this._loadUsers();   // fresh fetch
            } else {
                this.formError = result.message;
            }
        })
        .catch(err => {
            this.isLoading = false;
            this.formError = 'Error: ' + (err.body && err.body.message ? err.body.message : err.message);
        });
    }

    // ── Toggle active — OPTIMISTIC: update UI instantly, then confirm with Apex ──
    handleToggleActive(e) {
        const uid      = e.currentTarget.dataset.uid;
        const isActive = e.currentTarget.dataset.active === 'true';
        const newState = !isActive;

        // 1. Update UI immediately — no waiting
        this.users = this.users.map(u => {
            if (u.Id !== uid) return u;
            return {
                ...u,
                Is_Active__c: newState,
                statusClass:  newState ? 'status-active'  : 'status-inactive',
                statusLabel:  newState ? '● Active'       : '● Inactive',
                toggleLabel:  newState ? 'Deactivate'     : 'Activate',
                toggleClass:  newState ? 'btn-deactivate' : 'btn-activate',
            };
        });

        // 2. Persist to Salesforce in background
        toggleActive({ userId: uid, isActive: newState })
            .then(success => {
                if (!success) {
                    // Revert if Apex failed
                    this.users = this.users.map(u => {
                        if (u.Id !== uid) return u;
                        return {
                            ...u,
                            Is_Active__c: isActive,
                            statusClass:  isActive ? 'status-active'  : 'status-inactive',
                            statusLabel:  isActive ? '● Active'       : '● Inactive',
                            toggleLabel:  isActive ? 'Deactivate'     : 'Activate',
                            toggleClass:  isActive ? 'btn-deactivate' : 'btn-activate',
                        };
                    });
                }
            })
            .catch(() => {
                // Revert on error too
                this.users = this.users.map(u => {
                    if (u.Id !== uid) return u;
                    return {
                        ...u,
                        Is_Active__c: isActive,
                        statusClass:  isActive ? 'status-active'  : 'status-inactive',
                        statusLabel:  isActive ? '● Active'       : '● Inactive',
                        toggleLabel:  isActive ? 'Deactivate'     : 'Activate',
                        toggleClass:  isActive ? 'btn-deactivate' : 'btn-activate',
                    };
                });
            });
    }

    _clearForm() {
        this.newFullName = '';
        this.newLoginId  = '';
        this.newPassword = '';
        this.newRole     = 'Manager';
        this.showPass    = false;
    }
}