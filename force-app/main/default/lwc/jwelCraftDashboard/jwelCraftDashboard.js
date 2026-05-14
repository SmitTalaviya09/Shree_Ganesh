import { LightningElement, api } from 'lwc';

export default class JwelCraftDashboard extends LightningElement {
    @api orders = [];
    @api inventory = [];
    @api dispatched = [];
    @api counts = {};
    @api todayDate = '';

    // ── Timeline Steps ──
    get timelineSteps() {
        const c = this.counts;
        return [
            { tab: 'orders',     icon: '✓',  label: 'All Orders',   count: `${c.orders || 0} orders`,      cls: 'tl-step done' },
            { tab: 'stockcheck', icon: '🔍', label: 'Stock Check',  count: `${c.stockCheck || 0} pending`,  cls: 'tl-step on' },
            { tab: 'production', icon: '⚙',  label: 'In Production',count: `${c.production || 0} active`,   cls: 'tl-step' },
            { tab: 'ready',      icon: '📦', label: 'Ready',        count: `${c.ready || 0} orders`,        cls: 'tl-step' },
            { tab: 'dispatched', icon: '🚚', label: 'Dispatched',   count: `${c.dispatched || 0} delivered`, cls: 'tl-step' },
            { tab: 'inventory',  icon: '🪣', label: 'Bucket',       count: `${c.inventoryQty || 0} items`,  cls: 'tl-step' },
        ];
    }

    // ── Recent Orders ──
    get hasOrders() { return this.orders && this.orders.length > 0; }

    get recentOrders() {
        return [...(this.orders || [])].slice(-6).reverse().map(o => ({
            ...o,
            matClass: this._matClass(o.mat),
            badgeClass: this._badgeClass(o.status),
        }));
    }

    // ── Material Bars ──
    get materialBars() {
        const ms = {};
        (this.orders || []).forEach(o => { ms[o.mat] = (ms[o.mat] || 0) + 1; });
        const tot = this.orders.length || 1;
        const cols = { 'Yellow Gold': '#b8860b', 'White Gold': '#8899bb', 'Silver': '#8877aa' };
        return Object.entries(ms).map(([mat, count]) => ({
            mat, count,
            style: `width:${count / tot * 100}%;background:${cols[mat] || '#888'}`
        }));
    }

    // ── Workflow Bars ──
    get workflowBars() {
        const c = this.counts;
        const dispCount = this.dispatched ? this.dispatched.length : 0;
        const bars = [
            { label: 'New',        count: (this.orders || []).filter(o => o.status === 'New').length, color: '#2a65c0' },
            { label: 'Stock Check',count: c.stockCheck || 0, color: '#4a5a6a' },
            { label: 'Production', count: c.production  || 0, color: '#e07010' },
            { label: 'Ready',      count: c.ready       || 0, color: '#27a35a' },
            { label: 'Dispatched', count: dispCount,          color: '#5a2a90' },
        ];
        const max = Math.max(...bars.map(b => b.count), 1);
        return bars.map(b => ({
            ...b,
            style: `width:${b.count / max * 100}%;background:${b.color}`
        }));
    }

    // ── Handlers ──
    handleTimelineClick(event) {
        const tab = event.currentTarget.dataset.tab;
        this.dispatchEvent(new CustomEvent('navigate', { detail: { tab }, bubbles: true, composed: true }));
    }
    handleViewAllOrders() {
        this.dispatchEvent(new CustomEvent('navigate', { detail: { tab: 'orders' }, bubbles: true, composed: true }));
    }

    // ── Utilities ──
    _matClass(m) {
        if (m === 'Silver') return 'mat sil';
        if (m === 'White Gold') return 'mat wh';
        return 'mat';
    }
    _badgeClass(s) {
        const m = { New: 'badge b-new', 'Stock Check': 'badge b-stock', 'In Production': 'badge b-prod', Ready: 'badge b-ready', Dispatched: 'badge b-done' };
        return m[s] || 'badge b-new';
    }
}