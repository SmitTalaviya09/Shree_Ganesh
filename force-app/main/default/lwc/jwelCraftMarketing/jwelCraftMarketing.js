import { LightningElement, track } from 'lwc';
import getAllContent from '@salesforce/apex/MarketingContentController.getAllContent';
import saveContent from '@salesforce/apex/MarketingContentController.saveContent';
import deleteContent from '@salesforce/apex/MarketingContentController.deleteContent';
import createPublicImageLink from '@salesforce/apex/MarketingContentController.createPublicImageLink';
import LightningConfirm from 'lightning/confirm';

const EMPTY = () => ({ id: null, title: '', message: '', active: true, displayOrder: null });
export default class JwelCraftMarketing extends LightningElement {
    @track items = []; @track draft = EMPTY();
    loading = true; saving = false; showEditor = false;
    acceptedFormats = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    connectedCallback() { this.load(); }
    get hasItems() { return this.items.length > 0; }
    get editorTitle() { return this.draft.id ? 'Edit marketing content' : 'New marketing content'; }
    load() {
        this.loading = true;
        getAllContent().then(data => {
            this.items = (data || []).map(i => ({ ...i, statusLabel: i.active ? 'Live' : 'Hidden', statusClass: i.active ? 'pill live' : 'pill', orderLabel: i.displayOrder == null ? 'Auto' : i.displayOrder }));
        }).catch(e => this.toast('error', 'Could not load content', this.message(e))).finally(() => { this.loading = false; });
    }
    handleNew() { this.draft = EMPTY(); this.showEditor = true; }
    handleCancel() { this.showEditor = false; this.draft = EMPTY(); }
    handleInput(e) { const field = e.target.dataset.field; this.draft = { ...this.draft, [field]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }; }
    handleEdit(e) { const item = this.items.find(i => i.id === e.currentTarget.dataset.id); this.draft = { id: item.id, title: item.title || '', message: item.message || '', active: item.active, displayOrder: item.displayOrder }; this.showEditor = true; window.scrollTo({ top: 0, behavior: 'smooth' }); }
    async handleSave() {
        this.saving = true;
        try {
            const id = await saveContent({ recordId: this.draft.id, title: this.draft.title, message: this.draft.message, active: this.draft.active, displayOrder: this.draft.displayOrder === '' ? null : this.draft.displayOrder });
            this.draft = { ...this.draft, id }; this.toast('success', 'Saved', 'You can now upload an optional image.'); this.load();
        } catch (e) { this.toast('error', 'Save failed', this.message(e)); }
        finally { this.saving = false; }
    }
    async handleUploadFinished(event) {
        const file = event.detail.files?.[0];
        const versionId = file?.contentVersionId || file?.documentId;
        try {
            if (!versionId) throw new Error('Salesforce did not return the uploaded file Id.');
            await createPublicImageLink({ contentVersionId: versionId, recordId: this.draft.id });
            this.toast('success', 'Image uploaded', 'The image is now visible on the login page.');
            this.load();
        } catch (e) { this.toast('error', 'Image upload failed', this.message(e)); }
    }
    async handleDelete(e) {
        // Save the id before opening the async confirmation dialog. LWC releases
        // the original event after this handler yields, making currentTarget null.
        const recordId = e.currentTarget.dataset.id;
        const confirmed = await LightningConfirm.open({ label: 'Delete marketing content?', message: 'This removes it from every client login page.', theme: 'warning' });
        if (!confirmed) return;
        try {
            await deleteContent({ recordId });
            // Update the screen immediately instead of calling the cacheable list
            // method again, which can briefly return the deleted record.
            this.items = this.items.filter(item => item.id !== recordId);
            if (this.draft.id === recordId) this.handleCancel();
            this.toast('success', 'Deleted', 'Content was removed from the login page.');
        }
        catch (err) { this.toast('error', 'Delete failed', this.message(err)); }
    }
    message(e) { return e?.body?.message || e?.message || 'Please try again.'; }
    toast(variant, title, message) {
        const icons = { success: '✅', error: '❌', warning: '⚠️' };
        this.dispatchEvent(new CustomEvent('showtoast', { detail: { icon: icons[variant] || 'ℹ️', message: title, subMessage: message }, bubbles: true, composed: true }));
    }
}