import { LightningElement, track } from 'lwc';
import getClientNewOrderCount from '@salesforce/apex/SGFClientPortalController.getClientNewOrderCount';

const POLL_INTERVAL = 30000; // poll every 30 seconds

export default class SgfClientOrderBanner extends LightningElement {

    @track notifications  = [];
    @track showBanner     = false;
    @track clientNewCount = 0;

    _pollTimer    = null;
    _lastSeenCount = -1;   // -1 = not yet loaded, avoids false alert on first load

    connectedCallback()    { this._startPolling(); }
    disconnectedCallback() { this._stopPolling();  }

    _startPolling() {
        var self = this;
        // First load — set baseline, don't alert
        getClientNewOrderCount()
            .then(function(count) {
                self._lastSeenCount  = count;
                self.clientNewCount  = count;
            })
            .catch(function() {});

        // Poll every 30s
        this._pollTimer = setInterval(function() {
            self._poll();
        }, POLL_INTERVAL);
    }

    _stopPolling() {
        if (this._pollTimer) {
            clearInterval(this._pollTimer);
            this._pollTimer = null;
        }
    }

    _poll() {
        var self = this;
        getClientNewOrderCount()
            .then(function(count) {
                self.clientNewCount = count;

                // Only notify if count INCREASED since last check
                if (self._lastSeenCount >= 0 && count > self._lastSeenCount) {
                    var newOrders = count - self._lastSeenCount;
                    self._pushNotification(newOrders);
                }
                self._lastSeenCount = count;
            })
            .catch(function() {});
    }

    _pushNotification(newCount) {
        var note = {
            id:      Date.now(),
            message: '🛒 ' + newCount + ' new Client Order(s) waiting for review',
            time:    new Date().toLocaleTimeString('en-IN',
                        { hour: '2-digit', minute: '2-digit' })
        };
        this.notifications = [note, ...this.notifications].slice(0, 5);
        this.showBanner    = true;

        // Auto-dismiss this notification after 10s
        var self = this;
        var id   = note.id;
        setTimeout(function() {
            self.notifications = self.notifications.filter(function(n){ return n.id !== id; });
            if (!self.notifications.length) self.showBanner = false;
        }, 10000);
    }

    handleDismiss(e) {
        var id = parseInt(e.currentTarget.dataset.id);
        this.notifications = this.notifications.filter(function(n){ return n.id !== id; });
        if (!this.notifications.length) this.showBanner = false;
    }

    handleDismissAll() {
        this.notifications = [];
        this.showBanner    = false;
    }

    // Badge count getter — used if you show a count badge in the app header
    get hasClientNew()       { return this.clientNewCount > 0; }
    get clientNewCountLabel(){ return this.clientNewCount; }
}