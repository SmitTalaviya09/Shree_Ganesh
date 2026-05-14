import { LightningElement, track, api } from 'lwc';
//import searchCustomers   from '@salesforce/apex/JewelryOrderController.searchCustomers';
import placeOrders       from '@salesforce/apex/JewelryOrderController.placeOrders';
import getPicklistValues from '@salesforce/apex/JewelryOrderController.getPicklistValues';
import getItemMeasurementTypes from '@salesforce/apex/JewelryOrderController.getItemMeasurementTypes';
import getItemCodesByCategory from '@salesforce/apex/JewelryOrderController.getItemCodesByCategory';
import getItemSizeMap from '@salesforce/apex/JewelryOrderController.getItemSizeMap';
import searchClients from '@salesforce/apex/JewelryOrderController.searchClients';

export default class JwelCraftOrderEntry extends LightningElement {
    @api userName = '';
    @api userRole = '';

    // ── Customer fields ──────────────────────────────────────
    @track customerCode   = '';
    @track customerName   = '';
    @track customerMobile = '';
    @track customerLocked = false;

    // ── Customer Code picklist ───────────────────────────────
    @track showCustPick    = false;
    @track custPickSearch  = '';
    @track clientOptions   = [];
    @track selectedClientId = '';
    @track allItemCodes   = [];
    @track allKaratValues = [];
    @track allQtyUnits = [];

    // ── Order lines ──────────────────────────────────────────
    @track orderLines   = [];
    @track isSubmitting = false;
    allItemMap = {};
    @track categoryOptions = [];
    allItemSizeMap = {};   // { 'RING-001': '7', 'CHAIN-001': '18' }

    handleLineCategoryChange(event) {
        var id       = event.target.dataset.id;
        var category = event.target.value;
        var self     = this;

        // Get item codes for this category
        var filtered = category ? (self.allItemMap[category] || []) : [];

        this.orderLines = this.orderLines.map(function(l) {
            if (l.id !== id) return l;

            return Object.assign({}, l, {
                category:          category,
                // ── Reset item code when category changes ──
                itemCode:          '',
                itemCodeLabel:     'Select item…',
                itemCodeClass:     'rpt-placeholder',
                itemPickSearch:    '',
                showItemPick:      false,
                filteredItemCodes: filtered,
                hasItemOptions:    filtered.length > 0,
                // ── Reset all other line values ──
                color:             '',
                karat:             '',
                size:              '',
                qtyUnit:           '',
                quantity:          '',
                priority:          'Medium',
                dueDate:           '',
                remark:            ''
            });
        });
    }

    connectedCallback() {
        var self = this;
        this._loadPicklists().then(function() {
            self.handleAddLine();
        });
    }

    // _loadPicklists() {
    //     var self = this;
    //     getItemCodesByCategory()
    //     .then(result => {
    //         this.allItemMap = result;
    //         this.categoryOptions = Object.keys(result); // ✅ categories loaded
    //     })
    //     // ✅ Load item code → size map
    //     getItemSizeMap()
    //         .then(result => {
    //             self.allItemSizeMap = result || {};
    //         });
    //     return getPicklistValues()
    //         .then(function(result) {
    //             console.log('Result:', result);
    //             self.allItemCodes   = result.itemCodes     || [];
    //             // self.allCustCodes   = result.customerCodes || [];
    //             self.allKaratValues = result.karatValues   || [];
    //             self.allQtyUnits = result.qtyUnits || [];

    //             var defKarat = self.allKaratValues.length ? self.allKaratValues[0] : '';
    //             var defQtyUnit = self.allQtyUnits.length ? self.allQtyUnits[0] : 'Pieces';

    //             self.orderLines = self.orderLines.map(function(l) {
    //                 return Object.assign({}, l, {
    //                     filteredItemCodes: self.allItemCodes,
    //                     hasItemOptions: self.allItemCodes.length > 0,
    //                     karat: l.karat || defKarat,
    //                     karatOptions: self.allKaratValues.map(function(k) {
    //                         return { value: k, label: k };
    //                     }),
    //                     qtyUnit: l.qtyUnit || defQtyUnit,
    //                     qtyUnitOptions: self.allQtyUnits.map(function(u) {
    //                         return { value: u, label: u };
    //                     })
    //                 });
    //             });
    //         })
    //         .catch(function() {
    //             console.error('Error loading picklists');
    //         });
    // }
    _loadPicklists() {
        var self = this;

        // ✅ Use Promise.all so all three calls run together properly
        return Promise.all([
            getItemCodesByCategory(),
            getItemSizeMap(),
            getPicklistValues()
        ])
        .then(function(results) {
            var categoryMap  = results[0] || {};
            var sizeMap      = results[1] || {};
            var picklistData = results[2] || {};

            self.allItemMap      = categoryMap;
            self.categoryOptions = Object.keys(categoryMap);
            self.allItemSizeMap  = sizeMap;

            self.allItemCodes   = picklistData.itemCodes   || [];
            self.allKaratValues = picklistData.karatValues || [];
            self.allQtyUnits    = picklistData.qtyUnits    || [];

            var defKarat  = self.allKaratValues.length ? self.allKaratValues[0] : '';
            var defQtyUnit = self.allQtyUnits.length   ? self.allQtyUnits[0]   : 'Pieces';

            self.orderLines = self.orderLines.map(function(l) {
                return Object.assign({}, l, {
                    filteredItemCodes:  self.allItemCodes,
                    hasItemOptions:     self.allItemCodes.length > 0,
                    filteredCatOptions: self.categoryOptions,
                    hasCatOptions:      self.categoryOptions.length > 0,
                    karat:              l.karat || defKarat,
                    karatOptions:       self.allKaratValues.map(function(k) {
                        return { value: k, label: k };
                    }),
                    qtyUnit:            l.qtyUnit || defQtyUnit,
                    qtyUnitOptions:     self.allQtyUnits.map(function(u) {
                        return { value: u, label: u };
                    })
                });
            });
        })
        .catch(function(err) {
            console.error('Error loading picklists', err);
        });
    }

    // ─── Customer Code picklist ──────────────────────────────
    get custChevron()       { return this.showCustPick ? '▲' : '▾'; }
    get filteredCustCodes() {
        return this.clientOptions;
    }

    get hasCustOptions() {
        return this.clientOptions && this.clientOptions.length > 0;
    }

    handleCustPickFocus() {
        if (this.customerLocked) return;

        this.showCustPick = !this.showCustPick;

        if (this.showCustPick) {
            this.loadClients('');
        }
    }
    loadClients(searchText) {
        var self = this;
        searchClients({ searchTerm: searchText })
            .then(function(res) {
                self.clientOptions = (res || []).map(function(r) {
                    return {
                        id: r.Id,
                        name: r.Client_Name__c || '',
                        customerCode: r.Customer_Code__c || '',
                        mobile: r.Client_Mobile__c || ''
                    };
                });
            })
            .catch(function(err) {
                self.clientOptions = [];
                self._toast('❌', 'Error loading clients', (err.body && err.body.message) || err.message || '');
            });
    }

    handleCustPickSearch(e) {
        this.custPickSearch = e.target.value;
        this.customerName   = e.target.value;
        this.customerCode   = '';
        this.showCustPick   = true;
        this.loadClients(this.custPickSearch);
    }

    handleCustCodeSelect(e) {
        var id = e.currentTarget.dataset.id;
        var selected = this.clientOptions.find(function(c) {
            return c.id === id;
        });

        if (!selected) return;

        this.selectedClientId = selected.id;
        this.customerName     = selected.name;
        this.custPickSearch   = selected.name;
        this.customerCode     = selected.customerCode;
        this.customerMobile   = selected.mobile;
        this.showCustPick     = false;
    }

    // _lookupCustomer(code) {
    //     var self = this;
    //     searchCustomers({ searchTerm: code })
    //         .then(function(res) {
    //             var match = (res || []).find(function(c){ return c.Customer_Code__c === code; });
    //             if (match) {
    //                 self.customerName   = match.Name      || '';
    //                 self.customerMobile = match.Mobile__c  || '';
    //             }
    //         })
    //         .catch(function(){});
    // }

    handleNameInput(e)   { this.customerName   = e.target.value; }
    handleMobileInput(e) { this.customerMobile = e.target.value; }

    handleChangeCustomer() {
        this.customerLocked   = false;
        this.selectedClientId = '';
        this.customerCode     = '';
        this.customerName     = '';
        this.customerMobile   = '';
        this.custPickSearch   = '';
        this.clientOptions    = [];
        this.showCustPick     = false;
    }

    // handleAddLine() {
    //     var num  = this.orderLines.length + 1;
    //     var self = this;

    //     this.orderLines = [...this.orderLines, {
    //         id:               'line-' + Date.now() + '-' + num,
    //         num:              num,
    //         itemCode:         '',
    //         itemCodeLabel:    'Select item…',
    //         itemCodeClass:    'rpt-placeholder',
    //         itemPickSearch:   '',
    //         showItemPick:     false,
    //         filteredItemCodes: self.allItemCodes,
    //         hasItemOptions:   self.allItemCodes.length > 0,
    //         color:            '',       // empty
    //         karat:             '',       // empty
    //         dueDate:          '',
    //         size:             '',
    //         qtyUnit:          '',       // optional
    //         qtyStep:          '1',
    //         quantity:         '',
    //         priority:         'Medium',
    //         remark:           ''
    //     }];
    // }
    handleAddLine() {
    var num  = this.orderLines.length + 1;

    this.orderLines = [...this.orderLines, {
        id:                 'line-' + Date.now() + '-' + num,
        num:                num,
        // ── Category picklist fields ──
        category:           '',
        catLabel:           'Select category…',
        catCodeClass:       'rpt-placeholder',
        catSearch:          '',
        showCatPick:        false,
        filteredCatOptions: this.categoryOptions,   // full list initially
        hasCatOptions:      this.categoryOptions.length > 0,
        // ── Item picklist fields ──
        itemCode:           '',
        itemCodeLabel:      'Select item…',
        itemCodeClass:      'rpt-placeholder',
        itemPickSearch:     '',
        showItemPick:       false,
        filteredItemCodes:  [],
        hasItemOptions:     false,
        // ── Other fields ──
        color:              '',
        karat:              '',
        dueDate:            '',
        size:               '',
        sizeIsAuto:         false,
        qtyUnit:            '',
        qtyStep:            '1',
        quantity:           '',
        priority:           'Medium',
        remark:             ''
    }];
}
handleCatPickFocus(e) {
    var id   = e.currentTarget.dataset.id;
    var self = this;

    this.orderLines = this.orderLines.map(function(l) {
        if (l.id === id) {
            var isOpen = l.showCatPick;
            if (isOpen) {
                return Object.assign({}, l, { showCatPick: false });
            }
            return Object.assign({}, l, {
                showCatPick:        !l.showCatPick,
                catSearch:          '',
                filteredCatOptions: self.categoryOptions,
                hasCatOptions:      self.categoryOptions.length > 0,
                showItemPick:       false   // close item picker if open
            });
        }
        return Object.assign({}, l, { showCatPick: false });
    });
}
handleCatPickSearch(e) {
    var id   = e.target.dataset.id;
    var s    = (e.target.value || '').toLowerCase();
    var self = this;

    var filtered = s
        ? this.categoryOptions.filter(function(c) {
            return c.toLowerCase().includes(s);
          })
        : this.categoryOptions;

    this.orderLines = this.orderLines.map(function(l) {
        if (l.id !== id) return l;
        return Object.assign({}, l, {
            catSearch:          e.target.value,
            filteredCatOptions: filtered,
            hasCatOptions:      filtered.length > 0
        });
    });
}
// handleCatSelect(e) {
//     var id       = e.currentTarget.dataset.id;
//     var category = e.currentTarget.dataset.value;
//     var self     = this;

//     var filtered = category ? (self.allItemMap[category] || []) : [];

//     this.orderLines = this.orderLines.map(function(l) {
//         if (l.id !== id) return l;
//         return Object.assign({}, l, {
//             // ── Category picklist update ──
//             category:           category,
//             catLabel:           category,
//             catCodeClass:       'rpt-selected',
//             showCatPick:        false,
//             catSearch:          '',
//             // ── Reset item code ──
//             itemCode:           '',
//             itemCodeLabel:      'Select item…',
//             itemCodeClass:      'rpt-placeholder',
//             itemPickSearch:     '',
//             showItemPick:       false,
//             filteredItemCodes:  filtered,
//             hasItemOptions:     filtered.length > 0,
//             // ✅ Reset size too
//             size:              '',
//             sizeIsAuto:        false,
//             // ── Reset other fields ──
//             color:              '',
//             karat:              '',
//             size:               '',
//             qtyUnit:            '',
//             quantity:           '',
//             priority:           'Medium',
//             dueDate:            '',
//             remark:             ''
//         });
//     });
// }
    handleCatSelect(e) {
        var id       = e.currentTarget.dataset.id;
        var category = e.currentTarget.dataset.value;
        var self     = this;

        var filtered = category ? (self.allItemMap[category] || []) : [];

        this.orderLines = this.orderLines.map(function(l) {
            if (l.id !== id) return l;
            return Object.assign({}, l, {
                category:           category,
                catLabel:           category,
                catCodeClass:       'rpt-selected',
                showCatPick:        false,
                catSearch:          '',

                itemCode:           '',
                itemCodeLabel:      'Select item…',
                itemCodeClass:      'rpt-placeholder',
                itemPickSearch:     '',
                showItemPick:       false,
                filteredItemCodes:  filtered,
                hasItemOptions:     filtered.length > 0,

                color:              '',
                karat:              '',
                size:               '',
                sizeIsAuto:         false,
                qtyUnit:            '',
                quantity:           '',
                priority:           'Medium',
                dueDate:            '',
                remark:             ''
            });
        });
    }
    // normalizeSize(sizeValue) {
    //     if (!sizeValue) {
    //         return '';
    //     }

    //     var txt = String(sizeValue).toLowerCase().trim();
    //     txt = txt.replace(/mm/g, '');
    //     txt = txt.replace(/\s*x\s*/g, ' x ');
    //     txt = txt.replace(/\(\s*/g, '(');
    //     txt = txt.replace(/\s*\)/g, ')');
    //     txt = txt.replace(/\s+/g, ' ').trim();

    //     return txt;
    // }
    normalizeSize(sizeValue) {
        if (!sizeValue) {
            return '';
        }

        var txt = String(sizeValue).toLowerCase().trim();

        txt = txt.replace(/mm/g, '');
        txt = txt.replace(/\s*x\s*/g, ' x ');
        txt = txt.replace(/\(\s*/g, '(');
        txt = txt.replace(/\s*\)/g, ')');
        txt = txt.replace(/\s+/g, ' ').trim();

        var parts = txt.split(' x ');

        parts = parts.map(function(part) {
            var suffix = '';

            var bracketIndex = part.indexOf('(');
            if (bracketIndex !== -1) {
                suffix = part.substring(bracketIndex);
                part = part.substring(0, bracketIndex);
            }

            var num = parseFloat(part);
            if (!isNaN(num) && String(part).match(/^[0-9.]+$/)) {
                return String(num) + suffix;
            }

            return part + suffix;
        });

        return parts.join(' x ');
    }
    getSizeFirstPart(sizeValue) {
        var normalized = this.normalizeSize(sizeValue);
        if (!normalized) {
            return '';
        }

        return normalized.split(' x ')[0].trim();
    }
    // getMatchingItemCodes(category, size) {
    //     var self = this;

    //     if (!category || !size) {
    //         return [];
    //     }

    //     var normalizedInput = self.normalizeSize(size);
    //     var inputFirstPart  = self.getSizeFirstPart(size);
    //     var itemCodes       = self.allItemMap[category] || [];

    //     // 1. Exact full match first
    //     var exactMatches = itemCodes.filter(function(code) {
    //         var metadataSize = self.allItemSizeMap[code] || '';
    //         return self.normalizeSize(metadataSize) === normalizedInput;
    //     });

    //     if (exactMatches.length) {
    //         return exactMatches;
    //     }

    //     // 2. If no exact match, try first-part match only
    //     var partialMatches = itemCodes.filter(function(code) {
    //         var metadataSize = self.allItemSizeMap[code] || '';
    //         var metadataFirstPart = self.getSizeFirstPart(metadataSize);
    //         return metadataFirstPart === inputFirstPart;
    //     });

    //     return partialMatches;
    // }
    getMatchingItemCodes(category, size) {
        var self = this;

        if (!category || !size) {
            return [];
        }

        var normalizedInput = self.normalizeSize(size);
        var itemCodes = self.allItemMap[category] || [];

        return itemCodes.filter(function(code) {
            var metadataSize = self.allItemSizeMap[code] || '';

            if (!metadataSize) {
                return false;
            }

            return self.normalizeSize(metadataSize) === normalizedInput;
        });
    }
    getFullSizeByItemCode(itemCode) {
        return this.allItemSizeMap[itemCode] || '';
    }
    isValidManualSize(sizeValue) {
        if (!sizeValue) return false;
        // Must be: digits . one-digit space mm  (e.g. 5.0 mm, 21.0 mm)
        var pattern = /^\d+\.\d\s+mm$/i;
        return pattern.test(sizeValue.trim());
    }
    handleRemoveLine(e) {
        var id = e.currentTarget.dataset.id;
        this.orderLines = this.orderLines
            .filter(function(l){ return l.id !== id; })
            .map(function(l, i){ return Object.assign({}, l, { num: i + 1 }); });
    }

    // handleLineInput(event) {
    //     const id    = event.target.dataset.id;
    //     const field = event.target.dataset.field;
    //     const value = event.target.value;
    //     const self  = this;

    //     this.orderLines = this.orderLines.map(function(line) {
    //         if (line.id !== id) return line;

    //         let updated = Object.assign({}, line);

    //         if (field === 'qtyUnit') {
    //             updated.qtyUnit = value;
    //             updated.qtyStep = (value === 'Grams' || value === 'Inches') ? '0.001' : '1';

    //         } else if (field === 'quantity') {
    //             updated.quantity = value === '' ? '' : parseFloat(value);

    //         } else if (field === 'size') {
    //             updated.size = value;
    //             updated.sizeIsAuto = false;

    //             var matches = self.getMatchingItemCodes(updated.category, value);

    //             if (matches.length === 1) {
    //                 var matchedCode = matches[0];
    //                 var fullSize = self.allItemSizeMap[matchedCode] || '';

    //                 updated.itemCode = matchedCode;
    //                 updated.itemCodeLabel = matchedCode;
    //                 updated.itemCodeClass = 'rpt-selected';
    //                 updated.filteredItemCodes = matches;
    //                 updated.hasItemOptions = true;

    //                 if (fullSize) {
    //                     updated.size = fullSize;
    //                     updated.sizeIsAuto = true;
    //                 }

    //             } else if (matches.length > 1) {
    //                 updated.itemCode = '';
    //                 updated.itemCodeLabel = 'Select item…';
    //                 updated.itemCodeClass = 'rpt-placeholder';
    //                 updated.filteredItemCodes = matches;
    //                 updated.hasItemOptions = true;

    //             } else {
    //                 updated.itemCode = '';
    //                 updated.itemCodeLabel = 'Select item…';
    //                 updated.itemCodeClass = 'rpt-placeholder';
    //                 updated.filteredItemCodes = updated.category ? (self.allItemMap[updated.category] || []) : [];
    //                 updated.hasItemOptions = updated.filteredItemCodes.length > 0;
    //             }

    //         } else {
    //             updated[field] = value;
    //         }

    //         return updated;
    //     });
    // }
    handleLineInput(event) {
    const id    = event.target.dataset.id;
    const field = event.target.dataset.field;
    const value = event.target.value;
    const self  = this;

    this.orderLines = this.orderLines.map(function(line) {
        if (line.id !== id) return line;

        let updated = Object.assign({}, line);

        if (field === 'qtyUnit') {
            updated.qtyUnit = value;
            updated.qtyStep = (value === 'Grams' || value === 'Inches') ? '0.001' : '1';

        } else if (field === 'quantity') {
            updated.quantity = value === '' ? '' : parseFloat(value);

        } else if (field === 'size') {
            updated.size = value;
            updated.sizeIsAuto = false;

            var matches = self.getMatchingItemCodes(updated.category, value);

            if (updated.itemCode) {
                updated.filteredItemCodes = matches.length > 0
                    ? matches
                    : (updated.category ? (self.allItemMap[updated.category] || []) : []);

                updated.hasItemOptions = updated.filteredItemCodes.length > 0;
                return updated;
            }

            if (matches.length === 1) {
                var matchedCode = matches[0];

                updated.itemCode = matchedCode;
                updated.itemCodeLabel = matchedCode;
                updated.itemCodeClass = 'rpt-selected';
                updated.filteredItemCodes = matches;
                updated.hasItemOptions = true;

            } else if (matches.length > 1) {
                updated.itemCode = '';
                updated.itemCodeLabel = 'Select item…';
                updated.itemCodeClass = 'rpt-placeholder';
                updated.filteredItemCodes = matches;
                updated.hasItemOptions = true;

            } else {
                updated.itemCode = '';
                updated.itemCodeLabel = 'Select item…';
                updated.itemCodeClass = 'rpt-placeholder';
                updated.filteredItemCodes = updated.category ? (self.allItemMap[updated.category] || []) : [];
                updated.hasItemOptions = updated.filteredItemCodes.length > 0;
            }

        } else {
            updated[field] = value;
        }

        return updated;
    });
}
    handleSizeBlur(event) {
    const id    = event.target.dataset.id;
    const value = event.target.value;
    const self  = this;

    if (!value) return;

    this.orderLines = this.orderLines.map(function(line) {
        if (line.id !== id) return line;
        if (!line.category) return line;

        let updated = Object.assign({}, line);

        if (updated.itemCode) {
            return updated;
        }

        var matches = self.getMatchingItemCodes(updated.category, value);

        if (matches.length === 1) {
            var matchedCode = matches[0];
            var fullSize = self.allItemSizeMap[matchedCode] || '';

            updated.itemCode = matchedCode;
            updated.itemCodeLabel = matchedCode;
            updated.itemCodeClass = 'rpt-selected';
            updated.filteredItemCodes = matches;
            updated.hasItemOptions = true;

            if (fullSize) {
                updated.size = fullSize;
                updated.sizeIsAuto = true;
            }

        } else if (matches.length > 1) {
            updated.itemCode = '';
            updated.itemCodeLabel = 'Select item…';
            updated.itemCodeClass = 'rpt-placeholder';
            updated.filteredItemCodes = matches;
            updated.hasItemOptions = true;

        } else {
            updated.itemCode = '';
            updated.itemCodeLabel = 'Select item…';
            updated.itemCodeClass = 'rpt-placeholder';
            updated.filteredItemCodes = updated.category ? (self.allItemMap[updated.category] || []) : [];
            updated.hasItemOptions = updated.filteredItemCodes.length > 0;
            if (!updated.sizeIsAuto && !self.isValidManualSize(value)) {

                self._toast(
                    '❌',
                    'Invalid Size Format',
                    'Allowed: 5.0 mm, 5.1 mm, 21.0 mm'
                );
            }
        }

        return updated;
    });
}
    handleClear() { this.orderLines = []; this.handleAddLine(); }

    get hasLines() { return this.orderLines.length > 0; }
    // get totalQty() {
    //     return this.orderLines.reduce(function(s, l){ return s + (parseInt(l.quantity) || 0); }, 0);
    // }
    get totalQty() {
    return this.orderLines.reduce(function(s, l){
        return s + (parseFloat(l.quantity) || 0); 
    }, 0);
}

    // ─── Item Code picklist (per row) ─────────────────────────
    // handleItemPickFocus(e) {
    //     var id   = e.currentTarget.dataset.id;
    //     var self = this;
    //     this.orderLines = this.orderLines.map(function(l) {
    //         if (l.id === id) {
    //             return Object.assign({}, l, {
    //                 showItemPick:      true,
    //                 itemPickSearch:    '',
    //                 filteredItemCodes: self.allItemCodes,
    //                 hasItemOptions:    self.allItemCodes.length > 0
    //             });
    //         }
    //         return Object.assign({}, l, { showItemPick: false });
    //     });
    // }
    handleItemPickFocus(e) {
    var id   = e.currentTarget.dataset.id;
    var self = this;

    this.orderLines = this.orderLines.map(function(l) {
        if (l.id === id) {
            var isOpen = l.showItemPick;
            if (isOpen) {
                return Object.assign({}, l, { showItemPick: false });
            }

            var filtered = [];
            if (l.category && l.size) {
                filtered = self.getMatchingItemCodes(l.category, l.size);
                if (!filtered.length) {
                    filtered = self.allItemMap[l.category] || [];
                }
            } else {
                filtered = l.category ? (self.allItemMap[l.category] || []) : [];
            }

            return Object.assign({}, l, {
                showItemPick:      true,
                itemPickSearch:    '',
                filteredItemCodes: filtered,
                hasItemOptions:    filtered.length > 0
            });
        }
        return Object.assign({}, l, { showItemPick: false });
    });
}

    handleDropdownInputClick(e) { e.stopPropagation(); }

    // handleItemPickSearch(e) {
    //     var id       = e.target.dataset.id;
    //     var s        = (e.target.value || '').toLowerCase();
    //     var self     = this;
    //     var filtered = s
    //         ? this.allItemCodes.filter(function(c){ return c.toLowerCase().includes(s); })
    //         : this.allItemCodes;
    //     this.orderLines = this.orderLines.map(function(l) {
    //         if (l.id !== id) return l;
    //         return Object.assign({}, l, {
    //             itemPickSearch:    e.target.value,
    //             filteredItemCodes: filtered,
    //             hasItemOptions:    filtered.length > 0
    //         });
    //     });
    // }
    handleItemPickSearch(e) {
        var id   = e.target.dataset.id;
        var s    = (e.target.value || '').toLowerCase();
        var self = this;

        this.orderLines = this.orderLines.map(function(l) {
            if (l.id !== id) return l;

            // Search only within this line's category codes
            var base     = l.category ? (self.allItemMap[l.category] || []) : [];
            var filtered = s
                ? base.filter(function(c){ return c.toLowerCase().includes(s); })
                : base;

            return Object.assign({}, l, {
                itemPickSearch:    e.target.value,
                filteredItemCodes: filtered,
                hasItemOptions:    filtered.length > 0
            });
        });
    }

    // handleItemCodeSelect(e) {
    //     var id  = e.currentTarget.dataset.id;
    //     var val = e.currentTarget.dataset.value;
    //     this.orderLines = this.orderLines.map(function(l) {
    //         if (l.id !== id) return l;
    //         return Object.assign({}, l, {
    //             itemCode:       val,
    //             itemCodeLabel:  val,
    //             itemCodeClass:  'rpt-selected',
    //             showItemPick:   false,
    //             itemPickSearch: ''
    //         });
    //     });
    // }
    handleItemCodeSelect(e) {
        var id   = e.currentTarget.dataset.id;
        var val  = e.currentTarget.dataset.value;
        var self = this;

        // ✅ Look up size for selected item code
        var autoSize     = self.allItemSizeMap[val] || '';
        var hasSizeAuto  = autoSize !== '';

        this.orderLines = this.orderLines.map(function(l) {
            if (l.id !== id) return l;
            return Object.assign({}, l, {
                itemCode:      val,
                itemCodeLabel: val,
                itemCodeClass: 'rpt-selected',
                showItemPick:  false,
                itemPickSearch:'',
                // ✅ Auto-fill size if available, mark as auto so field is readonly
                size:          hasSizeAuto ? autoSize : l.size,
                sizeIsAuto:    hasSizeAuto
            });
        });
    }
  
    // handleSubmit() {
    //     var self = this;
    //     if (!this.customerName) {
    //         this._toast('❌', 'Customer required', 'Enter Customer Name'); 
    //         return;
    //     }

    //     // var invalidLines = this.orderLines.filter(function(l){
    //     //     const qty = parseFloat(l.quantity);
    //     //     return !l.category || l.itemCode || !l.quantity || !l.color || !l.karat || qty <= 0;
    //     // });
    //     var invalidLines = this.orderLines.filter(function(l) {
    //         const qty = parseFloat(l.quantity);
    //         return !l.category          // category missing
    //             || !l.itemCode          // item code missing
    //             || !l.color             // color missing
    //             || !l.karat             // karat missing
    //             || !l.qtyUnit          // unit missing
    //             || isNaN(qty)           // quantity not a number
    //             || qty <= 0;            // quantity zero or negative
    //     });
    //     var ambiguousLine = this.orderLines.find(function(l) {
    //         return l.size && l.category && !l.itemCode && l.filteredItemCodes && l.filteredItemCodes.length > 1;
    //     });
    //     var invalidSizeLine = this.orderLines.find(function(l) {

    //         // Skip auto-filled sizes
    //         if (l.sizeIsAuto) {
    //             return false;
    //         }

    //         // If user entered manual size, validate it
    //         if (l.size && !self.isValidManualSize(l.size)) {
    //             return true;
    //         }

    //         return false;
    //     });

    //     if (invalidSizeLine) {
    //         this._toast(
    //             '❌',
    //             'Invalid Size Format',
    //             'Line ' + invalidSizeLine.num + ': Allowed: 5.0 mm, 5.1 mm, 21.0 mm'
    //         );
    //         return;
    //     }
    //     if (ambiguousLine) {
    //         this._toast(
    //             '❌',
    //             'Size is ambiguous',
    //             'Line ' + ambiguousLine.num + ': enter more complete size or select item code manually'
    //         );
    //         return;
    //     }
    //     if (invalidLines.length > 0) {
    //         var firstInvalid = invalidLines[0];
    //         var missing = [];

    //         if (!firstInvalid.category) missing.push('Category');
    //         if (!firstInvalid.itemCode) missing.push('Item Code');
    //         if (!firstInvalid.color) missing.push('Color');
    //         if (!firstInvalid.karat) missing.push('Karat');
    //         if (!firstInvalid.qtyUnit) missing.push('Qty Unit');

    //         var qty = parseFloat(firstInvalid.quantity);
    //         if (isNaN(qty) || qty <= 0) missing.push('Quantity');

    //         this._toast(
    //             '❌',
    //             'Incomplete line',
    //             'Line ' + firstInvalid.num + ' missing: ' + missing.join(', ')
    //         );
    //         return;
    //     }

    //     var self = this;
    //     var itemCodes = this.orderLines.map(function(l){ return l.itemCode; });

    //     getItemMeasurementTypes({ itemCodes: itemCodes })
    //     .then(function(typeMap) {

    //         var unitError = null;

    //         var allowedUnits = {
    //             'Quantity':       ['Pieces'],
    //             'LengthWeight':   ['Inches', 'Grams'],
    //             'Pair':           ['Pair'],
    //             'QuantityPair':   ['Pieces', 'Pair'],
    //             'QuantityWeight': ['Pieces', 'Grams']
    //         };

    //         for (var i = 0; i < self.orderLines.length; i++) {
    //             var line         = self.orderLines[i];
    //             var mType        = typeMap[line.itemCode] || 'Quantity';
    //             var selectedUnit = (line.qtyUnit || '').trim();
    //             var allowed      = allowedUnits[mType] || ['Pieces'];

    //             if (!allowed.includes(selectedUnit)) {
    //                 unitError = 'Line ' + line.num + ' (' + line.itemCode + '): '
    //                     + 'Type "' + mType + '" only allows: ' + allowed.join(' or ') + '. '
    //                     + 'You selected "' + selectedUnit + '"';
    //                 break;
    //             }
    //         }

    //         if (unitError) {
    //             self._toast('❌', 'Wrong Unit Selected', unitError);
    //             return;
    //         }

    //         self._doSubmit();
    //     })
    //     .catch(function(err) {
    //         self._toast('❌', 'Validation Error', 
    //             (err.body && err.body.message) || 'Could not load item configuration');
    //     });
    // }
    handleSubmit() {
    var self = this;  // ✅ only ONE declaration at the top, remove the second one below

    if (!this.customerName) {
        this._toast('❌', 'Customer required', 'Enter Customer Name'); 
        return;
    }

    var invalidLines = this.orderLines.filter(function(l) {
        const qty = parseFloat(l.quantity);
        return !l.category
            || !l.itemCode
            || !l.color
            || !l.karat
            || !l.qtyUnit
            || isNaN(qty)
            || qty <= 0;
    });

    var ambiguousLine = this.orderLines.find(function(l) {
        return l.size && l.category && !l.itemCode && l.filteredItemCodes && l.filteredItemCodes.length > 1;
    });

    var invalidSizeLine = this.orderLines.find(function(l) {
        if (l.sizeIsAuto) return false;
        if (l.size && !self.isValidManualSize(l.size)) return true;
        return false;
    });

    if (invalidSizeLine) {
        this._toast('❌', 'Invalid Size Format',
            'Line ' + invalidSizeLine.num + ': Allowed: 5.0 mm, 5.1 mm, 21.0 mm');
        return;
    }
    if (ambiguousLine) {
        this._toast('❌', 'Size is ambiguous',
            'Line ' + ambiguousLine.num + ': enter more complete size or select item code manually');
        return;
    }
    if (invalidLines.length > 0) {
        var firstInvalid = invalidLines[0];
        var missing = [];
        if (!firstInvalid.category) missing.push('Category');
        if (!firstInvalid.itemCode) missing.push('Item Code');
        if (!firstInvalid.color)    missing.push('Color');
        if (!firstInvalid.karat)    missing.push('Karat');
        if (!firstInvalid.qtyUnit)  missing.push('Qty Unit');
        var qty = parseFloat(firstInvalid.quantity);
        if (isNaN(qty) || qty <= 0) missing.push('Quantity');
        this._toast('❌', 'Incomplete line',
            'Line ' + firstInvalid.num + ' missing: ' + missing.join(', '));
        return;
    }

    // ✅ NO second "var self = this;" here — already declared above
    var itemCodes = this.orderLines.map(function(l){ return l.itemCode; });

    getItemMeasurementTypes({ itemCodes: itemCodes })
    .then(function(typeMap) {
        var unitError = null;
        var allowedUnits = {
            'Quantity':       ['Pieces'],
            'LengthWeight':   ['Inches', 'Grams'],
            'Pair':           ['Pair'],
            'QuantityPair':   ['Pieces', 'Pair'],
            'QuantityWeight': ['Pieces', 'Grams'],
            'Weight':['Grams']
        };
        for (var i = 0; i < self.orderLines.length; i++) {
            var line         = self.orderLines[i];
            var mType        = typeMap[line.itemCode] || 'Quantity';
            var selectedUnit = (line.qtyUnit || '').trim();
            var allowed      = allowedUnits[mType] || ['Pieces'];
            if (!allowed.includes(selectedUnit)) {
                unitError = 'Line ' + line.num + ' (' + line.itemCode + '): '
                    + 'Type "' + mType + '" only allows: ' + allowed.join(' or ')
                    + '. You selected "' + selectedUnit + '"';
                break;
            }
        }
        if (unitError) {
            self._toast('❌', 'Wrong Unit Selected', unitError);
            return;
        }
        self._doSubmit();
    })
    .catch(function(err) {
        self._toast('❌', 'Validation Error',
            (err.body && err.body.message) || 'Could not load item configuration');
    });
}

// ── Move your existing submit logic into this helper ──
_doSubmit() {
    this.isSubmitting = true;
    var self  = this;
    var lines = this.orderLines.map(function(l){ return {
        itemCode:  l.itemCode,
        category:  l.category,
        color:     l.color,
        karat:     l.karat,
        size:      l.size || '',
        qtyUnit:   l.qtyUnit || 'Pieces',
        quantity:  parseFloat(l.quantity) || 0,
        priority:  l.priority || 'Medium',
        dueDate:   l.dueDate || '', 
        remark:    l.remark || ''
    }; });

    placeOrders({
        customerName:   this.customerName,
        customerCode:   this.customerCode,
        customerMobile: this.customerMobile || '',
        changedBy:      this.userName || '',
        orderLines:     lines
    })
    .then(function(ids) {
        self.isSubmitting = false;
        self._toast('✅', lines.length + ' order(s) placed', 'For ' + self.customerName);
        self.dispatchEvent(new CustomEvent('orderssaved', {
            bubbles: true, composed: true,
            detail: { count: ids.length, customerName: self.customerName }
        }));
        // Reset form (your existing logic unchanged)
        self.orderLines     = [];
        self.customerLocked = false;
        self.customerCode   = '';
        self.customerName   = '';
        self.customerMobile = '';
        self.custPickSearch = '';
        self.handleAddLine();
    })
    .catch(function(err) {
        self.isSubmitting = false;
        self._toast('❌', 'Error', (err.body && err.body.message) || err.message || '');
    });
}

    _toast(icon, msg, sub) {
        this.dispatchEvent(new CustomEvent('showtoast', {
            bubbles: true, composed: true,
            detail: { icon, message: msg, subMessage: sub }
        }));
    }
}