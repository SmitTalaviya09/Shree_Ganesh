/**
 * jwelCraftUtils — shared helper functions
 * Import with: import { formatDate, matClass, badgeClass, priClass } from 'c/jwelCraftUtils';
 */

export function formatDate(val) {
    if (!val) return '—';

    if (val instanceof Date) {
        return _format(val, true);
    }

    if (typeof val === 'string') {
        const hasTime = val.includes('T');
        const parts = val.split('T')[0].split('-');
        if (parts.length === 3) {
            const [year, month, day] = parts.map(Number);
            if (!year || !month || !day) return '—';

            if (hasTime) {
                // Parse full datetime preserving the original value
                const d = new Date(val);
                return isNaN(d.getTime()) ? '—' : _format(d, true);
            } else {
                // Date only — parse as local to avoid UTC shift
                const d = new Date(year, month - 1, day);
                return _format(d, false);
            }
        }
    }

    const d = new Date(val);
    return isNaN(d.getTime()) ? '—' : _format(d, false);
}

function _format(d, includeTime) {
    if (!d || isNaN(d.getTime())) return '—';

    const dateStr = d.toLocaleDateString('en-IN', {
        day:   '2-digit',
        month: 'short',
        year:  'numeric',
    });

    if (!includeTime) return dateStr;

    const timeStr = d.toLocaleTimeString('en-IN', {
        hour:   '2-digit',
        minute: '2-digit',
        hour12: true,
    });

    return `${dateStr}, ${timeStr}`;
    // Output: "08 Mar 2024, 06:30 PM"
}

export function matClass(m) {
    if (m === 'Silver')     return 'mat sil';
    if (m === 'White Gold') return 'mat wh';
    return 'mat';
}

export function badgeClass(s) {
    const map = {
        'New':           'badge b-new',
        'Stock Check':   'badge b-stock',
        'In Production': 'badge b-prod',
        'Ready':         'badge b-ready',
        'Dispatched':    'badge b-done',
    };
    return map[s] || 'badge b-new';
}

export function priClass(p) {
    const map = { 'High': 'pri ph', 'Medium': 'pri pm', 'Low': 'pri pl' };
    return map[p] || 'pri pm';
}

export function isLate(due) {
    return due && new Date(due + 'T00:00:00') < new Date();
}

export function nowFormatted() {
    return new Date().toLocaleDateString('en-IN', {
        day: 'numeric', month: 'short', year: 'numeric'
    });
}