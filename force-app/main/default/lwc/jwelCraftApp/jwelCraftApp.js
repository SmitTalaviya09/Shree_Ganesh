import { LightningElement, track, wire } from 'lwc';
import getAllOrders        from '@salesforce/apex/JewelryOrderController.getAllOrders';
import getAllInventory     from '@salesforce/apex/JewelryOrderController.getAllInventory';
import updateOrderStage   from '@salesforce/apex/JewelryOrderController.updateOrderStage';
import dispatchOrder      from '@salesforce/apex/JewelryOrderController.dispatchOrder';
import shreeganesh_Logo from '@salesforce/resourceUrl/shreeganesh_Logo';
import CATALOGUE_PDF from '@salesforce/resourceUrl/SGFCatalogue';

export default class JwelCraftApp extends LightningElement {

    // ── Google Fonts ──
    _fontsLoaded = false;
    renderedCallback() {
        if (this._fontsLoaded) return;
        this._fontsLoaded = true;
        const link = document.createElement('link');
        link.rel   = 'stylesheet';
        link.href  = 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,400&family=Outfit:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap';
        document.head.appendChild(link);
    }

    // ── Auth ──
    @track isLoggedIn  = false;
    @track currentUser = null;
    @track gemIcon = shreeganesh_Logo;

    get userName()    { return this.currentUser ? this.currentUser.fullName : ''; }
    get userRole()    { return this.currentUser ? this.currentUser.role : ''; }
    get userInitials(){ return this.userName ? this.userName.split(' ').map(function(p){return p[0];}).join('').toUpperCase().slice(0,2) : '??'; }
    get isManager()   { return this.currentUser && (this.currentUser.role === 'Manager' || this.currentUser.role === 'Admin'); }
    get isAdmin() {
        return this.currentUser && this.currentUser.role === 'Admin';
    }
    get isOrderCreator() { return this.currentUser && (this.currentUser.role === 'Order Creator' || this.isManager); }
    get isStockManager()    { return this.currentUser && (this.currentUser.role === 'Stock Manager'); }
    get isProductionWorker(){ return this.currentUser && (this.currentUser.role === 'Craftsman'); }
    get canCreateOrders()   { return this.currentUser && (this.currentUser.role === 'Dispatcher' || this.isManager || this.currentUser.role === 'Order Creator'); }
    get isProduction()   { return this.currentUser && (this.currentUser.role === 'Production' || this.isManager); }
    get canViewOverview() { return this.currentUser && ( this.currentUser.role === 'Order Creator' || this.currentUser.role === 'Stock Manager' || this.isManager); }
    handleDeletedOrders() {
        this._navigate('deleted-orders');
    }

    get showDeletedOrders() {
        return this.activeTab === 'deleted-orders';
    }

    get deletedOrdersNavClass() {
        return this._navClass('deleted-orders');
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
        try {
            var saved = localStorage.getItem('jwelcraft_user');
            if (saved) {
                var parsed = JSON.parse(saved);
                if ((Date.now() - (parsed._loginTime || 0)) < 24 * 3600000) {
                    this.currentUser = parsed;
                    this.isLoggedIn  = true;
                    this._refreshOrders();
                    const role = this.currentUser.role;

                    if (role === 'Order Creator' || role === 'Stock Manager' || role === 'Manager' || role === 'Admin') {
                        this.activeTab = 'dashboard';
                    } 
                    else if (role === 'Craftsman') {
                        this.activeTab = 'prod-board';
                    } 
                    else {
                        this.activeTab = 'stockcheck';
                    }
                } else { localStorage.removeItem('jwelcraft_user'); }
            }
        } catch(e) {}
         
    }
    handleDownloadCatalogue() {
        var a = document.createElement('a');
        a.href     = CATALOGUE_PDF;           // resolved Salesforce CDN URL
        a.download = 'SGF_Catalogue.pdf';     // filename shown in browser Save-As
        a.target   = '_blank';                // fallback: opens in new tab if download blocked
        a.rel      = 'noopener noreferrer';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }
    // handleLoginSuccess(e) {
    //     this.currentUser = e.detail;
    //     this.isLoggedIn  = true;
    //     try { localStorage.setItem('jwelcraft_user', JSON.stringify(Object.assign({}, e.detail, { _loginTime: Date.now() }))); } catch(e2) {}
    //     this._refreshOrders();
    // }

    handleLoginSuccess(e) {
        this.currentUser = e.detail;
        this.isLoggedIn  = true;

        try {
            localStorage.setItem(
                'jwelcraft_user',
                JSON.stringify({ ...e.detail, _loginTime: Date.now() })
            );
        } catch(e2) {}

        // Set default tab based on role
        if (this.canViewOverview) {
            this.activeTab = 'dashboard';
        } else if (this.isProductionWorker) {
            this.activeTab = 'prod-board';
        } else {
            this.activeTab = 'stockcheck';
        }

        this._refreshOrders();
    }

    handleLogout() {
        try { localStorage.removeItem('jwelcraft_user'); } catch(e) {}
        this.isLoggedIn = false; this.currentUser = null;
        this.activeTab = 'dashboard'; this.orders = [];
    }

    get todayDate() {
        return new Date().toLocaleDateString('en-IN', { weekday:'long', day:'numeric', month:'long', year:'numeric' });
    }

    // ── Navigation ──
    @track activeTab   = 'dashboard';
    @track sidebarOpen = false;

    get sidebarClass() { return 'sidebar' + (this.sidebarOpen ? ' open' : ''); }
    handleToggleSidebar() { this.sidebarOpen = !this.sidebarOpen; }
    handleCloseSidebar()  { this.sidebarOpen = false; }
    _navigate(tab)        { this.activeTab = tab; this.sidebarOpen = false; }

    handleDashboard()       { this._navigate('dashboard'); }
    handleAllOrders()       { this._navigate('orders'); }
    handleNewOrder()        { this._navigate('new-order'); }
    handleStockCheck()      { this._navigate('stockcheck'); }
    handleProductionQueue() { this._navigate('prod-queue'); }
    handleProductionBoard() { this._navigate('prod-board'); }
    handleProductionBoardWhite() { this._navigate('prod-board-white'); }
    handleQuickStock()      { this._navigate('quick-stock'); }
    handleReady()           { this._navigate('ready'); }
    handleDispatched()      { this._navigate('admin-dispatch'); }
    // handleInventory()       { this._navigate('inventory'); }
    handleUserMgmt()        { this._navigate('users'); }
    handleClientReg()       { this._navigate('client-reg'); }
    handleClientOrders()    { this._navigate('client-orders'); }
    handleAllocateStock()   { this._navigate('allocate-stock'); }
    handleChildNavigate(e)  { this._navigate(e.detail.tab); }
    handleCompleteOrder()   {this._navigate('complete-order');}

    get showDashboard()     { return this.activeTab === 'dashboard'; }
    get showAllOrders()     { return this.activeTab === 'orders'; }
    get showNewOrder()      { return this.activeTab === 'new-order'; }
    get showStockCheck()    { return this.activeTab === 'stockcheck'; }
    get showProdQueue()     { return this.activeTab === 'prod-queue'; }
    get showProdBoard()     { return this.activeTab === 'prod-board'; }
    get showProdBoardWhite() { return this.activeTab === 'prod-board-white'; }
    get showQuickStock()    { return this.activeTab === 'quick-stock'; }
    get showReady()         { return this.activeTab === 'ready'; }
    get showAdminDispatch() { return this.activeTab === 'admin-dispatch'; }
    get showAllocateStock()  { return this.activeTab === 'allocate-stock'; }
    get showInventory()     { return this.activeTab === 'inventory'; }
    get showUserMgmt()      { return this.activeTab === 'users'; }
    get showClientReg()     { return this.activeTab === 'client-reg'; }
    get showClientOrders()  { return this.activeTab === 'client-orders'; }
    get showCompleteOrder() { return this.activeTab === 'complete-order';}

    _navClass(tab) { return 'sb-item' + (this.activeTab === tab ? ' on' : ''); }
    get dashboardNavClass()     { return this._navClass('dashboard'); }
    get ordersNavClass()        { return this._navClass('orders'); }
    get newOrderNavClass()      { return this._navClass('new-order'); }
    get stockCheckNavClass()    { return this._navClass('stockcheck'); }
    get prodQueueNavClass()     { return this._navClass('prod-queue'); }
    get prodBoardNavClass()     { return this._navClass('prod-board'); }
    get prodBoardWhiteNavClass() { return this._navClass('prod-board-white'); }
    get quickStockNavClass()    { return this._navClass('quick-stock'); }
    get readyNavClass()         { return this._navClass('ready'); }
    get adminDispatchNavClass() { return this._navClass('admin-dispatch'); }
    get allocateStockNavClass()  { return this._navClass('allocate-stock'); }
    get inventoryNavClass()     { return this._navClass('inventory'); }
    get userMgmtNavClass()      { return this._navClass('users'); }
    get clientRegNavClass()     { return this._navClass('client-reg'); }
    get showClientOrders()  { return this.activeTab === 'client-orders'; }
    get completeOrderNavClass() { return this._navClass('complete-order');}

    // Mobile nav
    get mnDashClass()    { return 'mn-item' + (this.activeTab === 'dashboard'  ? ' on' : ''); }
    get mnOrdersClass()  { return 'mn-item' + (this.activeTab === 'orders'     ? ' on' : ''); }
    get mnNewClass()     { return 'mn-item' + (this.activeTab === 'new-order'  ? ' on' : ''); }
    get mnProdClass()    { return 'mn-item' + (this.activeTab === 'prod-board' ? ' on' : ''); }
    get counts() {
        return {
            total:        this.orders.length,
            stockCheck:   this.stockCheckOrders.length,
            prodQueue:    this.prodQueueOrders.length,
            inProduction: this.productionOrders.length,
            ready:        this.readyOrders.length,
            dispatched:   this.dispatchedOrders.length,
            clientNew:    this.orders.filter(function(o){ return o.status === 'Client New'; }).length,
        };
    }

    // ── Orders ──
    @track orders    = [];
    @track inventory = [];
    @track isLoading = false;

    get stockCheckOrders()  { return this.orders.filter(function(o){ return o.status === 'New' || o.status === 'Stock Check' || o.status === 'Partially Ready'; }); }
    get prodQueueOrders()   { return this.orders.filter(function(o){ return o.status === 'Bag Generate'; }); }
    get productionQOrders() { return this.orders.filter(function(o){ return o.status === 'Bag Generate'; }); }
    get productionOrders()  { return this.orders.filter(function(o){ return o.status === 'In Production'; }); }
    get readyOrders()       { return this.orders.filter(function(o){ return o.status === 'Ready' || o.status === 'Partially Ready'; }); }
    get dispatchedOrders()  { return this.orders.filter(function(o){ return o.status === 'Dispatched'; }); }
    get dispatched()        { return this.dispatchedOrders; }

    get counts() {
        return {
            total:       this.orders.length,
            stockCheck:  this.stockCheckOrders.length,
            prodQueue:   this.prodQueueOrders.length,
            inProduction: this.productionOrders.length,
            ready:       this.readyOrders.length,
            dispatched:  this.dispatchedOrders.length,
        };
    }

    // Mobile bottom nav — role-specific 4th button
    get mnRoleClass()  {
        var tab = this.isProductionWorker ? 'prod-board' : 'stockcheck';
        return 'mn-item' + (this.activeTab === tab ? ' on' : '');
    }
    get mnRoleIcon()  { return this.isProductionWorker ? '🏭' : '🔍'; }
    get mnRoleLabel() { return this.isProductionWorker ? 'Board' : 'Stock'; }
    handleRoleAction() {
        if (this.isProductionWorker) { this._navigate('prod-board'); }
        else { this._navigate('stockcheck'); }
    }

    // Child toast handler (from components that use onshowtoast)
    handleChildToast(e) {
        var d = e.detail;
        this.showToast(d.icon, d.message, d.subMessage);
    }

    // @wire(getAllOrders)
    // wiredOrders({ error, data }) {
    //     if (data) {
    //         this.orders = data.map(this._mapFromSObject.bind(this));
    //     } else if (error) {
    //         this.showToast('❌', 'Error loading orders', (error.body && error.body.message) || '');
    //     }
    // }

    // _refreshOrders() {
    //     var self = this;
    //     getAllOrders().then(function(data) {
    //         self.orders = (data || []).map(self._mapFromSObject.bind(self));
    //     }).catch(function() {});
    //     getAllInventory().then(function(data) {
    //         self.inventory = data || [];
    //     }).catch(function() {});
    // }
    _refreshOrders() {
        var self = this;
        self.isLoading = true;

        // Small delay to allow Big Object indexing to settle after insert
        return new Promise(function(resolve) { setTimeout(resolve, 2000); })
            .then(function() {
                return getAllOrders();
            })
            .then(function(data) {
                if (data) {
                    self.orders     = data.map(function(rec) { return self._mapFromSObject(rec); });
                    self.dispatched = self.orders.filter(function(o) { return o.status === 'Dispatched'; });
                }
                self.isLoading = false;
            })
            .catch(function(err) {
    self.isLoading = false;
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
            mat:            rec.Color__c                || 'Yellow Gold',
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

    // ── Toast ──
    @track toastVisible = false; @track toastMessage = ''; @track toastSubMessage = ''; @track toastIcon = '';
    _toastTimer = null;
    showToast(icon, message, sub, ms) {
        if (ms === undefined) ms = 3500;
        clearTimeout(this._toastTimer);
        this.toastIcon = icon; this.toastMessage = message; this.toastSubMessage = sub || '';
        this.toastVisible = true;
        this._toastTimer = setTimeout(function() {}, ms);
        var self = this;
        this._toastTimer = setTimeout(function() { self.toastVisible = false; }, ms);
    }

    // Toast from child (showtoast event)
    handleShowToast(e) {
        var d = e.detail;
        this.showToast(d.icon, d.message, d.subMessage);
    }

    // ── Refresh from children ──
    handleRefreshOrders() { this._refreshOrders(); }

    // ── New orders saved (from OrderEntry) ──
    handleOrdersSaved(e) {
        var d = e.detail;
        this.showToast('✅', d.count + ' order(s) placed for ' + d.customerName, 'Moved to Stock Check');
        this._refreshOrders();
        var self = this;
        setTimeout(function() { self._navigate('orders'); }, 1200);
    }

    // ── Status change (from stock check / other children) ──
    handleStatusChange(e) {
        var id = e.detail.id, newStatus = e.detail.newStatus;
        this.orders = this.orders.map(function(o) {
            return o.id === id ? Object.assign({}, o, { status: newStatus }) : o;
        });
    }

    // ── Stock used (StockCheck) ──
    handleStockUsed(e) {
        var d = e.detail;
        // Update original order → Ready
        this.orders = this.orders.map(function(o) {
            return o.id === d.id ? Object.assign({}, o, { status: 'Ready', qty: d.fulfilledQty }) : o;
        });
        // If partial, will be loaded fresh from Apex on next refresh
        this._refreshOrders();
    }

    // ── Dispatch order (from Ready screen) ──
    handleDispatchOrder(e) {
        var d     = e.detail;
        var id    = d.id;
        var code  = d.orderId || (this.orders.find(function(o){ return o.id === id; }) || {}).code;
        var dQty  = d.dispatchedQty;
        if (!code) return;
        var self = this;
        dispatchOrder({ orderId: code, dispatchedQty: dQty, changedBy: this.userName || '' })
            .then(function() {
                self.showToast('🚚', 'Order dispatched', dQty + ' pcs · ' + code);
                self._refreshOrders();
            })
            .catch(function(err) {
                self.showToast('❌', 'Dispatch error', (err.body && err.body.message) || err.message || '');
            });
    }

    // ── Order completed (admin dispatch) ──
    handleOrderCompleted(e) {
        this._refreshOrders();
        this.showToast('✅', 'Order marked completed', e.detail.code);
    }

    // ── Batch created / completed ──
    handleBatchCreated()   { this._refreshOrders(); }
    handleBatchCompleted() { this._refreshOrders(); }

    // ── Delete (local only) ──
    handleDeleteOrder(e) {
        var id = e.detail.id;
        this.orders = this.orders.filter(function(o){ return o.id !== id; });
        this.showToast('🗑️', 'Order removed from view', 'Big Object records are permanent');
    }
}