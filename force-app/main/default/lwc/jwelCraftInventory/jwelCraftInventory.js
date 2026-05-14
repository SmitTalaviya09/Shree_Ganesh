import { LightningElement, api, track } from 'lwc';

const MAT_COLORS = {
    'Yellow Gold': '#b8860b',
    'White Gold':  '#8899bb',
    'Rose Gold':   '#c97060',
    'Silver':      '#8877aa'
};

export default class JwelCraftInventory extends LightningElement {
    @api inventory = [];

    @track showAddModal   = false;
    @track measureType    = 'pieces';   // 'pieces' | 'lw'
    @track newItem = { name: '', mat: '', kar: '', size: '', qty: 1, notes: '',
                       inches: '', grams: '' };

    get hasInventory()    { return this.inventory && this.inventory.length > 0; }
    get newItemIsLW()     { return this.measureType === 'lw'; }
    get piecesTabClass()  { return 'mtype-btn' + (this.measureType === 'pieces' ? ' mtype-active' : ''); }
    get lwTabClass()      { return 'mtype-btn' + (this.measureType === 'lw'     ? ' mtype-active' : ''); }

    handleMeasureTypeToggle(e) {
        this.measureType = e.currentTarget.dataset.type;
        // Reset qty/inches/grams when switching
        this.newItem = Object.assign({}, this.newItem, { qty: 0, inches: '', grams: '' });
    }

    get inventoryCards() {
        var list = this.inventory || [];

        // For progress bar — find max value across all items
        // For LW items use inches as the bar reference
        var maxVal = Math.max(1,
            Math.max.apply(null, list.map(function(i) {
                var isLW = (i.inches > 0 || i.grams > 0 ||
                            i.Available_Inches__c > 0 || i.Available_Grams__c > 0);
                return isLW
                    ? (i.inches || i.Available_Inches__c || 0)
                    : (i.qty    || i.Available_Qty__c    || 0);
            }).concat([0]))
        );

        return list.map(function(i) {
            var color = MAT_COLORS[i.mat || i.Color__c] || '#888';

            // Resolve field names — support both old local props and Salesforce field names
            var qty    = i.qty    != null ? i.qty    : (i.Available_Qty__c    || 0);
            var inches = i.inches != null ? i.inches : (i.Available_Inches__c || 0);
            var grams  = i.grams  != null ? i.grams  : (i.Available_Grams__c  || 0);
            var mat    = i.mat    || i.Color__c    || '';
            var kar    = i.kar    || i.Karat__c    || '';
            var size   = i.size   || i.Size__c     || '';
            var name   = i.name   || i.Item_Code__c || '';
            var notes  = i.notes  || '';

            // Infer measurement type from data
            var isLW = (inches > 0 || grams > 0);

            // Bar value and status
            var barVal, hasStock, isLow;
            if (isLW) {
                barVal   = inches;
                hasStock = (inches > 0 || grams > 0);
                isLow    = (inches > 0 && inches < 5) || (grams > 0 && grams < 10);
            } else {
                barVal   = qty;
                hasStock = qty > 0;
                isLow    = qty > 0 && qty <= 2;
            }

            var stockStatus = !hasStock ? '● Out of Stock'
                            : isLow    ? '● Low Stock'
                            :             '● Good Stock';
            var statusColor = !hasStock ? 'var(--red2)'
                            : isLow    ? 'var(--orange2)'
                            :             'var(--green2)';

            // LW display string: "12.50 in · 85.320 g"
            var lwDisplay = '';
            if (isLW) {
                var parts = [];
                if (inches > 0) parts.push(parseFloat(inches).toFixed(2) + ' in');
                if (grams  > 0) parts.push(parseFloat(grams).toFixed(3)  + ' g');
                lwDisplay = parts.join(' · ') || '—';
            }

            return {
                id:               i.id || i.Id || name,
                name:             name,
                mat:              mat,
                kar:              kar,
                size:             size,
                notes:            notes,
                qty:              qty,
                inches:           inches,
                grams:            grams,
                isLW:             isLW,
                lwDisplay:        lwDisplay,
                sizeDisplay:      size || 'N/A',
                matStyle:         'color:' + color,
                barStyle:         'width:' + Math.round(barVal / maxVal * 100) + '%;background:' + color,
                statusStyle:      'color:' + statusColor,
                stockStatusLabel: stockStatus
            };
        });
    }

    handleRemove(e) {
        var id = e.currentTarget.dataset.id;
        this.dispatchEvent(new CustomEvent('inventoryupdate', {
            detail: { action: 'remove', id: id },
            bubbles: true, composed: true
        }));
    }

    handleOpenAddModal() { this.showAddModal = true; }
    handleCloseModal()   { this.showAddModal = false; this._resetNewItem(); }

    handleOverlayClick(e) {
        if (e.target === e.currentTarget) this.handleCloseModal();
    }

    handleNewItemChange(e) {
        var field = e.target.dataset.field;
        var value = (field === 'qty' || field === 'inches' || field === 'grams')
            ? parseFloat(e.target.value) || 0
            : e.target.value;
        this.newItem = Object.assign({}, this.newItem, { [field]: value });
    }

    handleAddItem() {
        if (!this.newItem.name.trim() || !this.newItem.mat) return;
        // Validate based on measurement type
        if (this.measureType === 'pieces' && (!this.newItem.qty || this.newItem.qty <= 0)) return;
        if (this.measureType === 'lw' &&
            ((!this.newItem.inches || parseFloat(this.newItem.inches) <= 0) &&
             (!this.newItem.grams  || parseFloat(this.newItem.grams)  <= 0))) return;

        var item = Object.assign({}, this.newItem);
        // Zero out unused fields
        if (this.measureType === 'pieces') {
            item.inches = 0; item.grams = 0;
        } else {
            item.qty = 0;
            item.inches = parseFloat(item.inches) || 0;
            item.grams  = parseFloat(item.grams)  || 0;
        }
        this.dispatchEvent(new CustomEvent('inventoryupdate', {
            detail: { action: 'add', item: item },
            bubbles: true, composed: true
        }));
        this.showAddModal = false;
        this._resetNewItem();
    }

    _resetNewItem() {
        this.measureType = 'pieces';
        this.newItem = { name: '', mat: '', kar: '', size: '', qty: 0,
                         inches: '', grams: '', notes: '' };
    }
}