/**
 * @description : JwelCraft Order Management — Apex Controller
 * @note        : No Customer__c object. Big Object written FIRST before Order_Stage_Log__c.
 *                Production_Batch__c deleted on batch complete.
 *                Inventory__c deleted when Available_Qty__c reaches 0.
 */
public without sharing class JewelryOrderController {

    // ════════════════════════════════════════════════════════════
    // PICKLIST VALUES
    // ════════════════════════════════════════════════════════════

    /**
     * Returns Item_Code__c and Customer_Code__c picklist values
     * from their promoted Global Value Sets on Order_Stage_Log__c
     */
    @AuraEnabled
    public static Map<String, List<String>> getPicklistValues() {
        try {
            List<String> itemCodes = new List<String>();
            for (Schema.PicklistEntry pe : Order_Stage_Log__c.Item_Code__c.getDescribe().getPicklistValues()) {
                if (pe.isActive()) itemCodes.add(pe.getValue());
            }
            List<String> karatValues = new List<String>();
            for (Schema.PicklistEntry pe : Order_Stage_Log__c.Karat__c.getDescribe().getPicklistValues()) {
                if (pe.isActive()) karatValues.add(pe.getValue());
            }
            List<String> qtyUnits = new List<String>();
            for (Schema.PicklistEntry pe : Order_Stage_Log__c.Quantity_Unit__c.getDescribe().getPicklistValues()) {
                if (pe.isActive()) qtyUnits.add(pe.getValue());
            }
            return new Map<String, List<String>>{
                'itemCodes'     => itemCodes,
                'karatValues'   => karatValues,
                'qtyUnits'      => qtyUnits
            };
        } catch (Exception e) {
            throw new AuraHandledException('getPicklistValues: ' + e.getMessage());
        }
    }

    // ════════════════════════════════════════════════════════════
    // PLACE ORDERS
    // Big Object written FIRST (insertImmediate), then Order_Stage_Log__c.
    // No prior DML in this transaction so insertImmediate runs cleanly.
    // ════════════════════════════════════════════════════════════

    @AuraEnabled
    public static List<String> placeOrders(
            String customerName,
            String customerCode,
            String customerMobile,
            String changedBy,
            List<Map<String, Object>> orderLines) {
        try {
            String actor = String.isNotBlank(changedBy) ? changedBy : UserInfo.getName();
            List<String>            orderIds = new List<String>();
            List<Order_Stage_Log__c> logs    = new List<Order_Stage_Log__c>();

            System.debug('RESPONSE :' + orderLines);

            for (Map<String, Object> line : orderLines) {
                String oid = generateOrderId();
                orderIds.add(oid);

                Decimal qty   = line.get('quantity') != null ? Decimal.valueOf(String.valueOf(line.get('quantity'))) : 0;
                //Decimal karat = line.get('karat')    != null ? Decimal.valueOf(String.valueOf(line.get('karat')))    : null;
                String karat = (String) line.get('karat');
                String qtyUnit = (String) line.get('qtyUnit');

                // ── 1. Build Order_Stage_Log__c record ──
                Order_Stage_Log__c log       = new Order_Stage_Log__c();
                log.Order_ID_Ref__c          = oid;
                log.Customer_Name__c         = customerName;
                log.Customer_Code__c         = customerCode;
                log.Customer_Mobile_No__c    = customerMobile;
                log.Item_Category__c = (String) line.get('category');
                log.Item_Code__c             = (String) line.get('itemCode');
                log.Color__c                 = (String) line.get('color');
                log.Karat__c                 = karat;
                log.Size__c                  = (String) line.get('size');
                log.Quantity_Unit__c      = String.isNotBlank(qtyUnit) ? qtyUnit : 'Pieces';
                log.Quantity__c              = qty;
                log.Priority__c              = (String) line.get('priority');
                log.Remark__c                = (String) line.get('remark');
                log.Order_Date__c            = DateTime.now();
                log.Order_Due_Date__c = String.isNotBlank((String) line.get('dueDate')) ? DateTime.valueOf((String) line.get('dueDate') + ' 00:00:00') : null;
                log.Current_Stage__c         = 'New';
                log.Changed_By__c            = actor;
                log.Fulfilled_Qty__c         = 0;
                log.Dispatch_Status__c       = 'Pending';
                log.Dispatched_Qty__c        = 0;
                logs.add(log);
            }

            // ── 2. Insert all Order_Stage_Log__c records ──
            insert logs;
            return orderIds;

        } catch (Exception e) {
            throw new AuraHandledException('placeOrders: ' + e.getMessage());
        }
    }

    // ════════════════════════════════════════════════════════════
    // GET ORDERS
    // ════════════════════════════════════════════════════════════

    @AuraEnabled
    public static List<Order_Stage_Log__c> getAllOrders() {
        List<Order_Stage_Log__c> orderData = [
                SELECT Id, Name, Order_ID_Ref__c, Customer_Name__c, Customer_Code__c,
                       Customer_Mobile_No__c, Item_Code__c, Color__c, Karat__c,
                       Size__c, Quantity_Unit__c, Quantity__c,Pending_Qty__c, Fulfilled_Qty__c, Priority__c,
                       Remark__c, Order_Date__c, Order_Due_Date__c, Current_Stage__c, Item_Category__c,
                       Changed_By__c, Dispatch_Status__c, Dispatched_Qty__c, Production_Batch_Ref__c
                FROM Order_Stage_Log__c
                ORDER BY CreatedDate DESC];
        // try {
            return orderData;
        // } catch (Exception e) {
        //     throw new AuraHandledException(e.getMessage());
        // }
    }

    // ════════════════════════════════════════════════════════════
    // STOCK CHECK — USE STOCK (Option C: single record, Fulfilled_Qty__c)
    // ════════════════════════════════════════════════════════════

    /**
     * Attempts to fulfill an order from Inventory__c.
     *
     * Full stock  (inv >= pending qty):
     *   → Fulfilled_Qty__c = Quantity__c → stage = "Ready"
     *   → Inventory deducted; if hits 0 → Inventory__c record DELETED
     *
     * Partial stock (inv > 0 but < pending qty):
     *   → Fulfilled_Qty__c += available → stage = "Partially Ready"
     *   → Inventory hits 0 → Inventory__c record DELETED
     *   → Stock Check screen still shows order (Pending_Qty__c > 0)
     *
     * No stock (inv = 0):
     *   → Returns success=false, caller shows message
     */
    @AuraEnabled
    public static Map<String, Object> useStock(String orderId, String changedBy) {
        try {
            String actor = String.isNotBlank(changedBy) ? changedBy : UserInfo.getName();

            List<Order_Stage_Log__c> logs = [
                SELECT Id, Order_ID_Ref__c, Item_Code__c, Quantity__c, Fulfilled_Qty__c,
                       Current_Stage__c, Changed_By__c
                FROM Order_Stage_Log__c
                WHERE Order_ID_Ref__c = :orderId LIMIT 1
            ];
            if (logs.isEmpty()) throw new AuraHandledException('Order not found: ' + orderId);
            Order_Stage_Log__c log = logs[0];

            Decimal totalQty    = log.Quantity__c     != null ? log.Quantity__c     : 0;
            Decimal fulfilledSoFar = log.Fulfilled_Qty__c != null ? log.Fulfilled_Qty__c : 0;
            Decimal pendingQty  = totalQty - fulfilledSoFar;

            // Get inventory
            List<Inventory__c> invList = [
                SELECT Id, Available_Qty__c
                FROM Inventory__c
                WHERE Item_Code__c = :log.Item_Code__c LIMIT 1
            ];

            Decimal available = (!invList.isEmpty() && invList[0].Available_Qty__c != null)
                                ? invList[0].Available_Qty__c : 0;

            Map<String, Object> result = new Map<String, Object>();

            if (available <= 0) {
                result.put('success', false);
                result.put('message', 'No stock available for ' + log.Item_Code__c);
                return result;
            }

            if (available >= pendingQty) {
                // ── FULL fulfillment ──
                invList[0].Available_Qty__c = available - pendingQty;
                log.Fulfilled_Qty__c = totalQty;
                log.Current_Stage__c = 'Ready';
                log.Changed_By__c    = actor;

                update log;

                if (invList[0].Available_Qty__c <= 0) {
                    delete invList[0];  // clean up zero-stock record
                } else {
                    update invList[0];
                }

                result.put('success',      true);
                result.put('partial',      false);
                result.put('fulfilledQty', pendingQty);

            } else {
                // ── PARTIAL fulfillment ──
                Decimal nowFulfilled = fulfilledSoFar + available;
                log.Fulfilled_Qty__c = nowFulfilled;
                log.Current_Stage__c = 'Partially Ready';
                log.Changed_By__c    = actor;

                invList[0].Available_Qty__c = 0;

                update log;
                delete invList[0];   // inventory exhausted — delete record

                result.put('success',      true);
                result.put('partial',      true);
                result.put('fulfilledQty', available);
                result.put('pendingQty',   totalQty - nowFulfilled);
            }

            return result;

        } catch (AuraHandledException e) { throw e; }
        catch (Exception e) { throw new AuraHandledException('useStock: ' + e.getMessage()); }
    }

    // ════════════════════════════════════════════════════════════
    // SEND TO Bag Generate
    // ════════════════════════════════════════════════════════════

    @AuraEnabled
    public static void sendToProduction(String orderId, String changedBy) {
        try {
            String actor = String.isNotBlank(changedBy) ? changedBy : UserInfo.getName();
            List<Order_Stage_Log__c> logs = [
                SELECT Id, Current_Stage__c, Changed_By__c
                FROM Order_Stage_Log__c WHERE Order_ID_Ref__c = :orderId LIMIT 1
            ];
            if (!logs.isEmpty()) {
                logs[0].Current_Stage__c = 'Bag Generate';
                logs[0].Changed_By__c    = actor;
                update logs[0];
            }
        } catch (Exception e) { throw new AuraHandledException(e.getMessage()); }
    }

    // ════════════════════════════════════════════════════════════
    // CREATE PRODUCTION BATCHES
    // Returns Map with 'names' and 'ids' for VF slip trigger
    // ════════════════════════════════════════════════════════════

    // @AuraEnabled
    // public static Map<String, String> createProductionBatch(
    //         Map<String, Object> batchData, String changedBy) {
    //     try {
    //         String actor = String.isNotBlank(changedBy) ? changedBy : UserInfo.getName();

    //         String slipTitle  = (String) batchData.get('slipTitle');
    //         String color      = (String) batchData.get('color');
    //         String karat      = (String) batchData.get('karat');
    //         Decimal totalQty  = batchData.get('totalQty') != null
    //                             ? Decimal.valueOf(String.valueOf(batchData.get('totalQty'))) : 0;
    //         Set<String> specialCategories = new Set<String>{ 
    //             'Round Tikli','MQS Single Tikli','MQS Double Tikli','Pear Single Tikli','Pear Double Tikli', 'Cluster Tikli', 'Heart Single Tikli', 'Outer Ring'
    //         };
    //         Boolean isSpecial = false;
    //         // Build comma-separated item codes from itemDetails
    //         List<Object> itemDetailsRaw = (List<Object>) batchData.get('itemDetails');
    //         List<String> itemCodes = new List<String>();
    //         for (Object raw : itemDetailsRaw) {

    //             Map<Object, Object> d = (Map<Object, Object>) raw;

    //             String ic = (String) d.get('itemCode');
    //             String category = (String) d.get('itemCategory');

    //             if (String.isNotBlank(ic) && !itemCodes.contains(ic)) {
    //                 itemCodes.add(ic);
    //             }
    //             // Check if this item belongs to special category
    //             if (!isSpecial) {
    //                 // If category is missing in the payload, try fetching from Order_Stage_Log__c
    //                 if (String.isBlank(category)) {
    //                     List<Order_Stage_Log__c> orders = [
    //                         SELECT Item_Category__c 
    //                         FROM Order_Stage_Log__c 
    //                         WHERE Item_Code__c = :ic 
    //                         LIMIT 1
    //                     ];
    //                     if (!orders.isEmpty()) category = orders[0].Item_Category__c;
    //                 }
    //                 if (specialCategories.contains(category)) isSpecial = true;
    //             }
    //         }

    //         // Collect all order IDs
    //         List<Object> orderIdsRaw = (List<Object>) batchData.get('orderIds');
    //         List<String> orderIds = new List<String>();
    //         for (Object o : orderIdsRaw) orderIds.add((String) o);

    //         Production_Batch__c pb   = new Production_Batch__c();
    //         pb.Slip_Title__c         = slipTitle;
    //         pb.Item_Code__c          = String.join(itemCodes, ', ');
    //         pb.Color__c              = color;
    //         pb.Karat__c              = karat;
    //         pb.Order_Qty__c          = totalQty;
    //         pb.Total_Qty__c          = totalQty;
    //         pb.Status__c             = 'Sent to Production';
    //         pb.Slip_Printed__c       = true;
    //         pb.Order_IDs__c          = JSON.serialize(orderIds);
    //         pb.Item_Details__c       = JSON.serialize(itemDetailsRaw);
    //         pb.Special_Item_Category__c  = isSpecial;
    //         insert pb;

    //         // Move all orders to In Production
    //         List<Order_Stage_Log__c> toUpdate = [
    //             SELECT Id, Order_ID_Ref__c, Current_Stage__c, Changed_By__c, Production_Batch_Ref__c
    //             FROM Order_Stage_Log__c WHERE Order_ID_Ref__c IN :orderIds
    //         ];
    //         for (Order_Stage_Log__c ol : toUpdate) {
    //             ol.Current_Stage__c        = 'In Production';
    //             ol.Changed_By__c           = actor;
    //             ol.Production_Batch_Ref__c = pb.Name;
    //         }
    //         update toUpdate;

    //         return new Map<String, String>{ 'id' => pb.Id, 'name' => pb.Name };

    //     } catch (Exception e) {
    //         throw new AuraHandledException('createProductionBatch: ' + e.getMessage());
    //     }
    // }
 @AuraEnabled
public static Map<String, String> createProductionBatch(
        Map<String, Object> batchData, String changedBy) {
    try {
        String actor     = String.isNotBlank(changedBy) ? changedBy : UserInfo.getName();
        String slipTitle = (String) batchData.get('slipTitle');
        String color     = (String) batchData.get('color');
        String karat     = (String) batchData.get('karat');
        Decimal totalQty = batchData.get('totalQty') != null
                           ? Decimal.valueOf(String.valueOf(batchData.get('totalQty'))) : 0;

        Set<String> specialCategories = new Set<String>{
            'Round Tikli','MQS Single Tikli','MQS Double Tikli',
            'Pear Single Tikli','Pear Double Tikli',
            'Cluster Tikli','Heart Single Tikli','Outer Ring'
        };

        List<Object> itemDetailsRaw = (List<Object>) batchData.get('itemDetails');

        // Collect all order IDs (needed for both batch and the category lookup)
        List<Object> orderIdsRaw = (List<Object>) batchData.get('orderIds');
        List<String> orderIds    = new List<String>();
        for (Object o : orderIdsRaw) orderIds.add((String) o);

        // ✅ STEP 1: First pass — collect item codes + find which item codes are missing category
        List<String>  itemCodes         = new List<String>();
        Set<String>   missingCategoryICs = new Set<String>();
        Map<String, String> icToCategoryFromPayload = new Map<String, String>();

        for (Object raw : itemDetailsRaw) {
            Map<Object, Object> d = (Map<Object, Object>) raw;
            String ic       = (String) d.get('itemCode');
            String category = (String) d.get('itemCategory');

            if (String.isNotBlank(ic) && !itemCodes.contains(ic)) {
                itemCodes.add(ic);
            }
            if (String.isNotBlank(ic) && String.isNotBlank(category)) {
                // Category already in payload — store it
                icToCategoryFromPayload.put(ic, category);
            } else if (String.isNotBlank(ic)) {
                // Category missing — need to look up
                missingCategoryICs.add(ic);
            }
        }

        // ✅ STEP 2: Single bulk query OUTSIDE loop
        // Query by BOTH Item_Code__c AND Order_ID_Ref__c for accuracy
        Map<String, String> icToCategoryFromDB = new Map<String, String>();
        if (!missingCategoryICs.isEmpty()) {
            for (Order_Stage_Log__c osl : [
                SELECT Item_Code__c, Item_Category__c
                FROM Order_Stage_Log__c
                WHERE Item_Code__c IN :missingCategoryICs
                AND   Order_ID_Ref__c IN :orderIds
            ]) {
                // First category found per item code wins (same as old LIMIT 1 logic)
                if (!icToCategoryFromDB.containsKey(osl.Item_Code__c)
                        && String.isNotBlank(osl.Item_Category__c)) {
                    icToCategoryFromDB.put(osl.Item_Code__c, osl.Item_Category__c);
                }
            }
        }

        // ✅ STEP 3: Determine isSpecial — NO SOQL, use pre-built maps
        Boolean isSpecial = false;
        for (Object raw : itemDetailsRaw) {
            Map<Object, Object> d = (Map<Object, Object>) raw;
            String ic       = (String) d.get('itemCode');
            String category = (String) d.get('itemCategory');

            // Priority: payload category → DB category
            if (String.isBlank(category)) {
                category = icToCategoryFromPayload.containsKey(ic)
                           ? icToCategoryFromPayload.get(ic)
                           : icToCategoryFromDB.get(ic);
            }
            if (!isSpecial && specialCategories.contains(category)) {
                isSpecial = true;
            }
        }

        // Insert Production Batch
        Production_Batch__c pb      = new Production_Batch__c();
        pb.Slip_Title__c            = slipTitle;
        pb.Item_Code__c             = String.join(itemCodes, ', ');
        pb.Color__c                 = color;
        pb.Karat__c                 = karat;
        pb.Order_Qty__c             = totalQty;
        pb.Total_Qty__c             = totalQty;
        pb.Status__c                = 'Sent to Production';
        pb.Slip_Printed__c          = true;
        pb.Order_IDs__c             = JSON.serialize(orderIds);
        pb.Item_Details__c          = JSON.serialize(itemDetailsRaw);
        pb.Special_Item_Category__c = isSpecial;
        insert pb;

        // Move all orders to In Production
        List<Order_Stage_Log__c> toUpdate = [
            SELECT Id, Order_ID_Ref__c, Current_Stage__c, Changed_By__c, Production_Batch_Ref__c
            FROM Order_Stage_Log__c
            WHERE Order_ID_Ref__c IN :orderIds
        ];
        for (Order_Stage_Log__c ol : toUpdate) {
            ol.Current_Stage__c        = 'In Production';
            ol.Changed_By__c           = actor;
            ol.Production_Batch_Ref__c = pb.Name;
        }
        update toUpdate;

        return new Map<String, String>{ 'id' => pb.Id, 'name' => pb.Name };

    } catch (Exception e) {
        throw new AuraHandledException('createProductionBatch: ' + e.getMessage());
    }
}
    // ════════════════════════════════════════════════════════════
    // GET ACTIVE BATCHES (for Production Board)
    // ════════════════════════════════════════════════════════════

    @AuraEnabled
    public static List<Production_Batch__c> getActiveBatches() {
        try {
            return [
                SELECT Id, Name, Slip_Title__c, Item_Code__c, Item_Details__c,
                       Color__c, Karat__c, Order_Qty__c, Total_Qty__c,
                       Status__c, Order_IDs__c, Slip_Printed__c, CreatedDate
                FROM Production_Batch__c
                WHERE Status__c = 'Sent to Production'
                AND Special_Item_Category__c = false
                ORDER BY CreatedDate DESC LIMIT 200
            ];
        } catch (Exception e) { throw new AuraHandledException(e.getMessage()); }
    }
    @AuraEnabled
    public static List<Production_Batch__c> getActiveBatchesWhite() {
        try {
            return [
                SELECT Id, Name, Slip_Title__c, Item_Code__c, Item_Details__c,
                       Color__c, Karat__c, Order_Qty__c, Total_Qty__c,
                       Status__c, Order_IDs__c, Slip_Printed__c, CreatedDate
                FROM Production_Batch__c
                WHERE Status__c = 'Sent to Production' 
                AND Special_Item_Category__c = true
                ORDER BY CreatedDate DESC LIMIT 200
            ];
        } catch (Exception e) { throw new AuraHandledException(e.getMessage()); }
    }

    // @AuraEnabled
    // public static void completeBatch(String batchId,
    //         String completionItemsJson, String changedBy) {
    //     try {
    //         String actor = String.isNotBlank(changedBy) ? changedBy : UserInfo.getName();

    //         Production_Batch__c batch = [
    //             SELECT Id, Name, Color__c, Karat__c, Order_IDs__c
    //             FROM Production_Batch__c WHERE Id = :batchId LIMIT 1
    //         ];

    //         List<Object> rawItems = (List<Object>) JSON.deserializeUntyped(completionItemsJson);

    //         for (Object raw : rawItems) {
    //             Map<String, Object> ci = (Map<String, Object>) raw;
    //             String  ic    = (String) ci.get('itemCode');
    //             // ✅ Read measureType from payload — no metadata query needed
    //             String  mType = String.isNotBlank((String) ci.get('measureType'))
    //                         ? (String) ci.get('measureType') : 'Quantity';

    //             // Safe decimal helpers
    //             Decimal qty  = ci.get('qty')    != null ? Decimal.valueOf(String.valueOf(ci.get('qty')))    : 0;
    //             Decimal inch = ci.get('inches') != null ? Decimal.valueOf(String.valueOf(ci.get('inches'))) : 0;
    //             Decimal gram = ci.get('grams')  != null ? Decimal.valueOf(String.valueOf(ci.get('grams')))  : 0;
    //             Decimal pair = ci.get('pair')   != null ? Decimal.valueOf(String.valueOf(ci.get('pair')))   : 0;

    //             List<Inventory__c> existing = [
    //                 SELECT Id, Available_Qty__c, Available_Inches__c,
    //                     Available_Grams__c, Available_Pair__c
    //                 FROM Inventory__c
    //                 WHERE Item_Code__c = :ic
    //                 AND   Color__c     = :batch.Color__c
    //                 AND   Karat__c     = :batch.Karat__c
    //                 LIMIT 1
    //             ];

    //             // ✅ One record — insert or update
    //             Inventory__c inv = existing.isEmpty()
    //                 ? new Inventory__c(
    //                     Item_Code__c        = ic,
    //                     Color__c            = batch.Color__c,
    //                     Karat__c            = batch.Karat__c,
    //                     Available_Qty__c    = 0,
    //                     Available_Inches__c = 0,
    //                     Available_Grams__c  = 0,
    //                     Available_Pair__c   = 0
    //                 )
    //                 : existing[0];

    //             if (mType == 'LengthWeight') {
    //                 // ✅ Inches + Grams
    //                 inv.Available_Inches__c = (inv.Available_Inches__c != null ? inv.Available_Inches__c : 0) + inch;
    //                 inv.Available_Grams__c  = (inv.Available_Grams__c  != null ? inv.Available_Grams__c  : 0) + gram;

    //             } else if (mType == 'Pair') {
    //                 // ✅ Pair only
    //                 inv.Available_Pair__c = (inv.Available_Pair__c != null ? inv.Available_Pair__c : 0) + pair;

    //             } else if (mType == 'QuantityPair') {
    //                 // ✅ Pieces + Pair
    //                 inv.Available_Qty__c  = (inv.Available_Qty__c  != null ? inv.Available_Qty__c  : 0) + qty;
    //                 inv.Available_Pair__c = (inv.Available_Pair__c != null ? inv.Available_Pair__c : 0) + pair;

    //             } else if (mType == 'QuantityWeight') {
    //                 // ✅ Pieces + Grams
    //                 inv.Available_Qty__c   = (inv.Available_Qty__c   != null ? inv.Available_Qty__c   : 0) + qty;
    //                 inv.Available_Grams__c = (inv.Available_Grams__c != null ? inv.Available_Grams__c : 0) + gram;

    //             } else {
    //                 // ✅ Quantity — Pieces only
    //                 inv.Available_Qty__c = (inv.Available_Qty__c != null ? inv.Available_Qty__c : 0) + qty;
    //             }

    //             if (existing.isEmpty()) {
    //                 insert inv;
    //             } else {
    //                 update inv;
    //             }
    //         }

    //         // ✅ Delete batch after all inventory updated
    //         delete batch;

    //     } catch (AuraHandledException e) { throw e; }
    //     catch (Exception e) { throw new AuraHandledException('completeBatch: ' + e.getMessage()); }
    // }
    @AuraEnabled
    public static void completeBatch(String batchId, String completionItemsJson, String changedBy) {
        try {
            if (String.isBlank(batchId)) {
                throw new AuraHandledException('Batch Id is required.');
            }
    
            Production_Batch__c batch = [
                SELECT Id, Name, Color__c, Karat__c, Order_IDs__c,
                    Item_Code__c, Item_Details__c, Total_Qty__c, Order_Qty__c
                FROM Production_Batch__c
                WHERE Id = :batchId
                LIMIT 1
            ];
    
            // ── Parse completion payload ──
            List<Object> rawItems = (List<Object>) JSON.deserializeUntyped(completionItemsJson);
    
            // Build map: itemCode → completion data
            Map<String, Map<String, Object>> completedByItem = new Map<String, Map<String, Object>>();
            Set<String> itemCodes = new Set<String>();
    
            for (Object raw : rawItems) {
                Map<String, Object> ci = (Map<String, Object>) raw;
                String ic = ci.get('itemCode') != null ? String.valueOf(ci.get('itemCode')) : '';
                if (String.isNotBlank(ic)) {
                    // completedByItem.put(ic, ci);
                    String size = ci.get('size') != null ? String.valueOf(ci.get('size')) : '';
                    completedByItem.put(ic + '|' + size, ci);
                    itemCodes.add(ic);
                }
            }
    
            // ── Parse Item_Details__c ──
            String detailsJson = String.isNotBlank(batch.Item_Details__c)
                ? batch.Item_Details__c : '[]';
            List<Object> rawDetails = (List<Object>) JSON.deserializeUntyped(detailsJson);
    
            // ── Bulk load existing inventory ──
            Map<String, Inventory__c> existingInventory = new Map<String, Inventory__c>();
            for (Inventory__c inv : [
                SELECT Id, Item_Code__c, Color__c, Karat__c, Size__c,
                    Available_Qty__c, Available_Inches__c,
                    Available_Grams__c, Available_Pair__c
                FROM Inventory__c
                WHERE Item_Code__c IN :itemCodes
                AND   Color__c     = :batch.Color__c
                AND   Karat__c     = :batch.Karat__c
            ]) {
                String k = makeInventoryKey(inv.Item_Code__c, inv.Color__c, inv.Karat__c, inv.Size__c);
                existingInventory.put(k, inv);
            }
    
            List<Inventory__c> inventoryToInsert = new List<Inventory__c>();
            List<Inventory__c> inventoryToUpdate = new List<Inventory__c>();
    
            // Track which inv keys we have already staged (avoid double-insert for same key)
            Map<String, Inventory__c> stagedNew = new Map<String, Inventory__c>();
    
            // ── Remaining batch tracking ──
            List<Object>  remainingDetails   = new List<Object>();
            Decimal       remainingGrandTotal = 0;
            List<String>  remainingItemCodes  = new List<String>();
            Set<String>   remainingOrderIds   = new Set<String>();
    
            // ── Process each item detail ──
            for (Object rawDetail : rawDetails) {
                if (rawDetail == null) continue;
                Map<String, Object> detail = (Map<String, Object>) rawDetail;
    
                String  ic          = detail.get('itemCode') != null ? String.valueOf(detail.get('itemCode')) : '';
                String  measureType = String.isNotBlank((String) detail.get('measureType'))
                                    ? (String) detail.get('measureType') : 'Quantity';
                // Size: prefer 'size', fallback to 'regularSize'
                String  size        = '';
                if (detail.get('size') != null && String.isNotBlank(String.valueOf(detail.get('size')))) {
                    size = String.valueOf(detail.get('size'));
                } else if (detail.get('regularSize') != null && String.isNotBlank(String.valueOf(detail.get('regularSize')))) {
                    size = String.valueOf(detail.get('regularSize'));
                }
    
                Decimal oldTotal = getDecimalValue(detail.get('totalQty'));
                if (oldTotal <= 0) continue; // nothing to process
    
                // ── How much was entered for this item? ──
                // Map<String, Object> completed = completedByItem.get(ic);
                Map<String, Object> completed = completedByItem.get(ic + '|' + size);
    
                Decimal enteredQty   = 0;
                Decimal enteredInch  = 0;
                Decimal enteredGram  = 0;
                Decimal enteredPair  = 0;
                Decimal completedTotal = 0;
    
                if (completed != null) {
                    enteredQty  = getDecimalValue(completed.get('qty'));
                    enteredInch = getDecimalValue(completed.get('inches'));
                    enteredGram = getDecimalValue(completed.get('grams'));
                    enteredPair = getDecimalValue(completed.get('pair'));
    
                    // completedTotal = the "primary" quantity completed for this item
                    // Used to reduce totalQty on the batch detail
                    completedTotal = getCompletedTotal(measureType, enteredQty, enteredInch, enteredGram, enteredPair);
                }
    
                // Cap at oldTotal
                if (completedTotal > oldTotal) {
                    completedTotal = oldTotal;
                    // Also cap the individual values proportionally (simple approach: cap primary)
                    if (measureType == 'LengthWeight') {
                        // no capping needed — inches+grams are independent
                    } else if (measureType == 'Pair') {
                        enteredPair = oldTotal;
                    } else if (measureType == 'QuantityPair') {
                        // cap combined
                        Decimal excess = completedTotal - oldTotal;
                        enteredQty = Math.max(0, enteredQty - excess);
                    } else {
                        enteredQty = oldTotal;
                    }
                }
    
                // ── Update inventory if anything was completed ──
                if (
                    completedTotal > 0 ||
                    (measureType == 'LengthWeight' && (enteredInch > 0 || enteredGram > 0)) ||
                    (measureType == 'LengthQuantity' && (enteredInch > 0 || enteredQty > 0)) ||
                    (measureType == 'Weight' && enteredGram > 0)
                ) {
                    // String invKey = makeInventoryKey(ic, batch.Color__c, batch.Karat__c, size);
                    String cleanSizeVal = cleanSize(size);
                    String invKey = makeInventoryKey(ic, batch.Color__c, batch.Karat__c, cleanSizeVal);
                    Inventory__c inv = null;
                    Boolean isNew = false;
    
                    // Check already-staged new records first
                    if (stagedNew.containsKey(invKey)) {
                        inv = stagedNew.get(invKey);
                    } else if (existingInventory.containsKey(invKey)) {
                        inv = existingInventory.get(invKey);
                    } else {
                        // New record
                        inv = new Inventory__c(
                            Item_Code__c        = ic,
                            Color__c            = batch.Color__c,
                            Karat__c            = batch.Karat__c,
                            // Size__c             = String.isNotBlank(size) ? size : null,
                            Size__c = cleanSizeVal,
                            Available_Qty__c    = 0,
                            Available_Inches__c = 0,
                            Available_Grams__c  = 0,
                            Available_Pair__c   = 0
                        );
                        isNew = true;
                        stagedNew.put(invKey, inv);
                    }
    
                    // Add completed amounts to inventory
                    if (measureType == 'LengthWeight') {
                        inv.Available_Inches__c = safeDecimal(inv.Available_Inches__c) + enteredInch;
                        inv.Available_Grams__c  = safeDecimal(inv.Available_Grams__c)  + enteredGram;
                    } else if (measureType == 'LengthQuantity') {
                        inv.Available_Inches__c = safeDecimal(inv.Available_Inches__c) + enteredInch;
                        inv.Available_Qty__c    = safeDecimal(inv.Available_Qty__c)    + enteredQty;
                    } else if (measureType == 'Weight') {
                        inv.Available_Grams__c = safeDecimal(inv.Available_Grams__c) + enteredGram;
                     } else if (measureType == 'Pair') {
                        inv.Available_Pair__c = safeDecimal(inv.Available_Pair__c) + enteredPair;
                    } else if (measureType == 'QuantityPair') {
                        inv.Available_Qty__c  = safeDecimal(inv.Available_Qty__c)  + enteredQty;
                        inv.Available_Pair__c = safeDecimal(inv.Available_Pair__c) + enteredPair;
    
                    } else if (measureType == 'QuantityWeight') {
                        inv.Available_Qty__c   = safeDecimal(inv.Available_Qty__c)   + enteredQty;
                        inv.Available_Grams__c = safeDecimal(inv.Available_Grams__c) + enteredGram;
    
                    } else {
                        // Quantity
                        inv.Available_Qty__c = safeDecimal(inv.Available_Qty__c) + enteredQty;
                    }
    
                    if (isNew) {
                        inventoryToInsert.add(inv);
                    } else {
                        if (!inventoryToUpdate.contains(inv)) {
                            inventoryToUpdate.add(inv);
                        }
                    }
                }
    
                // ── Calculate remaining for this detail ──
                Decimal remaining = oldTotal - completedTotal;
    
                if (remaining > 0) {
                    // Clone the detail map so we can mutate it safely
                    Map<String, Object> remainingDetail = detail.clone();
                    remainingDetail.put('totalQty', remaining);
    
                    // Reduce the custLines and regularQty proportionally
                    reduceDetailLines(remainingDetail, remaining);
    
                    remainingDetails.add(remainingDetail);
                    remainingGrandTotal += remaining;
    
                    if (!remainingItemCodes.contains(ic)) {
                        remainingItemCodes.add(ic);
                    }
    
                    // Collect order IDs still in remaining custLines
                    Object clRawObj = remainingDetail.get('custLines');
                    if (clRawObj != null) {
                        List<Object> custLines = (List<Object>) clRawObj;
                        for (Object clRaw : custLines) {
                            if (clRaw == null) continue;
                            Map<String, Object> cl = (Map<String, Object>) clRaw;
                            String oid = cl.get('orderId') != null ? String.valueOf(cl.get('orderId')) : '';
                            if (String.isNotBlank(oid)) {
                                remainingOrderIds.add(oid);
                            }
                        }
                    }
                }
            }
    
            // ── DML ──
            if (!inventoryToInsert.isEmpty()) insert inventoryToInsert;
            if (!inventoryToUpdate.isEmpty()) update inventoryToUpdate;
    
            // ── Delete or update batch ──
            if (remainingDetails.isEmpty()) {
                delete batch;
            } else {
                batch.Item_Details__c = JSON.serialize(remainingDetails);
                batch.Total_Qty__c    = remainingGrandTotal;
                batch.Order_Qty__c    = remainingGrandTotal;
                batch.Item_Code__c    = String.join(remainingItemCodes, ', ');
                batch.Order_IDs__c    = JSON.serialize(new List<String>(remainingOrderIds));
                update batch;
            }
    
        } catch (AuraHandledException e) { throw e; }
        catch (Exception e) {
            throw new AuraHandledException('completeBatch: ' + e.getMessage());
        }
    }
    private static Decimal getDecimalValue(Object val) {
        if (val == null) return 0;
        try { return Decimal.valueOf(String.valueOf(val)); } catch (Exception e) { return 0; }
    }
    
    private static Decimal safeDecimal(Decimal val) {
        return val == null ? 0 : val;
    }

    // private static String makeInventoryKey(String itemCode, String color, String karat, String sizeVal) {
    //     String safeSize = String.isNotBlank(sizeVal) ? sizeVal.trim() : '';
    //     return String.valueOf(itemCode).trim()
    //         + '|' + String.valueOf(color).trim()
    //         + '|' + String.valueOf(karat).trim()
    //         + '|' + safeSize;
    // }
    private static String makeInventoryKey(String itemCode, String color, String karat, String sizeVal) {
        String safeItem  = String.isBlank(itemCode) ? '' : itemCode.trim().toLowerCase();
        String safeColor = String.isBlank(color)    ? '' : color.trim().toLowerCase();
        String safeKarat = String.isBlank(karat)    ? '' : karat.trim().toLowerCase();

        String cleanedSize = cleanSize(sizeVal);
        String safeSize = String.isBlank(cleanedSize) ? '' : cleanedSize.trim().toLowerCase();

        return safeItem + '|' + safeColor + '|' + safeKarat + '|' + safeSize;
    }

    // ════════════════════════════════════════════════════════════
    // DELETE REMAINING BATCH — unchanged
    // ════════════════════════════════════════════════════════════
    @AuraEnabled
    public static void deleteRemainingBatch(Id batchId) {
        try {
            List<Production_Batch__c> batches = [
                SELECT Id FROM Production_Batch__c WHERE Id = :batchId LIMIT 1
            ];
            if (!batches.isEmpty()) delete batches[0];
        } catch (Exception e) {
            throw new AuraHandledException('deleteRemainingBatch: ' + e.getMessage());
        }
    }
    private static Decimal getCompletedTotal(
        String measureType, Decimal qty, Decimal inches, Decimal grams, Decimal pairQty
    ) {
        if (measureType == 'LengthWeight') {
            // Use whichever is larger as the "primary" for reducing totalQty on batch
            return Math.max(inches != null ? inches : 0, grams != null ? grams : 0);
        }
        if (measureType == 'LengthQuantity') {
            return Math.max(inches != null ? inches : 0, qty != null ? qty : 0);
        }
        if (measureType == 'Weight')         return grams != null ? grams : 0;
        if (measureType == 'Pair')         return pairQty != null ? pairQty : 0;
        if (measureType == 'QuantityPair') return (qty != null ? qty : 0) + (pairQty != null ? pairQty : 0);
        if (measureType == 'QuantityWeight') return qty != null ? qty : 0;
        return qty != null ? qty : 0; // Quantity
    }

    private static void reduceDetailLines(Map<String, Object> detail, Decimal remainingQty) {
    if (detail == null || remainingQty == null || remainingQty <= 0) return;
 
    Decimal left = remainingQty;
    List<Object> newCustLines = new List<Object>();
 
    // Process custLines
    Object clObj = detail.get('custLines');
    if (clObj != null) {
        List<Object> custLines = (List<Object>) clObj;
        for (Object rawLine : custLines) {
            if (left <= 0) break;
            if (rawLine == null) continue;
 
            Map<String, Object> line    = (Map<String, Object>) rawLine;
            Decimal             oldQty  = getDecimalValue(line.get('qty'));
            Decimal             keepQty = (oldQty > left) ? left : oldQty;
 
            if (keepQty > 0) {
                // Clone line and set new qty
                Map<String, Object> newLine = line.clone();
                newLine.put('qty', keepQty);
                newCustLines.add(newLine);
                left -= keepQty;
            }
        }
    }
 
    detail.put('custLines', newCustLines);
 
    // Process regularQty
    Decimal oldRegQty   = detail.containsKey('regularQty') ? getDecimalValue(detail.get('regularQty')) : 0;
    Decimal keepRegQty  = 0;
    if (left > 0 && oldRegQty > 0) {
            keepRegQty = (oldRegQty > left) ? left : oldRegQty;
        }
        detail.put('regularQty', keepRegQty);
    }
    // ════════════════════════════════════════════════════════════
    // GET ITEM MEASUREMENT TYPES (for Production Board completion modal)
    // ════════════════════════════════════════════════════════════

    @AuraEnabled
    public static Map<String, String> getItemMeasurementTypes(List<String> itemCodes) {
        try {
            Map<String, String> result = new Map<String, String>();
            for (Item_Configuration__mdt cfg : [
                SELECT MasterLabel, Measurement_Type__c
                FROM Item_Configuration__mdt
                WHERE MasterLabel IN :itemCodes
            ]) {
                result.put(cfg.MasterLabel, cfg.Measurement_Type__c);
            }
            // Default to Quantity for any item not in mdt
            for (String ic : itemCodes) {
                if (!result.containsKey(ic)) result.put(ic, 'Quantity');
            }
            return result;
        } catch (Exception e) {
            throw new AuraHandledException('getItemMeasurementTypes: ' + e.getMessage());
        }
    }

    @AuraEnabled(cacheable=true)
    public static Map<String, List<String>> getItemCodesByCategory() {
        Map<String, List<String>> result = new Map<String, List<String>>();

        for (Item_Configuration__mdt cfg : [
            SELECT MasterLabel, Item_Category__c
            FROM Item_Configuration__mdt
        ]) {
            if (!result.containsKey(cfg.Item_Category__c)) {
                result.put(cfg.Item_Category__c, new List<String>());
            }
            result.get(cfg.Item_Category__c).add(cfg.MasterLabel);
        }

        return result;
    }
    @AuraEnabled(cacheable=true)
    public static Map<String, String> getItemSizeMap() {
        Map<String, String> result = new Map<String, String>();

        for (Item_Configuration__mdt cfg : [
            SELECT MasterLabel, Size__c
            FROM Item_Configuration__mdt
            WHERE Size__c != null
        ]) {
            result.put(cfg.MasterLabel, cfg.Size__c);
        }

        return result;
    }
    // ════════════════════════════════════════════════════════════
    // DISPATCH ORDER
    // ════════════════════════════════════════════════════════════

    @AuraEnabled
    public static void dispatchOrder(String orderId, Decimal dispatchedQty, String changedBy) {
        try {
            String actor = String.isNotBlank(changedBy) ? changedBy : UserInfo.getName();
            List<Order_Stage_Log__c> logs = [
                SELECT Id, Quantity__c, Fulfilled_Qty__c
                FROM Order_Stage_Log__c WHERE Order_ID_Ref__c = :orderId LIMIT 1
            ];
            if (logs.isEmpty()) throw new AuraHandledException('Order not found: ' + orderId);

            Decimal fulfilled = logs[0].Fulfilled_Qty__c != null ? logs[0].Fulfilled_Qty__c : 0;
            logs[0].Dispatched_Qty__c  = dispatchedQty;
            logs[0].Current_Stage__c   = 'Dispatched';
            logs[0].Changed_By__c      = actor;
            logs[0].Dispatch_Status__c = dispatchedQty >= fulfilled
                                         ? 'Fully Dispatched' : 'Partially Dispatched';
            update logs[0];

        } catch (AuraHandledException e) { throw e; }
        catch (Exception e) { throw new AuraHandledException('dispatchOrder: ' + e.getMessage()); }
    }

    // ════════════════════════════════════════════════════════════
    // MARK ORDER COMPLETED (Admin Dispatch)
    // ════════════════════════════════════════════════════════════

    @AuraEnabled
    public static void markOrderCompleted(List<String> orderIds, String changedBy) {
        try {
            if (orderIds == null || orderIds.isEmpty()) return;
            String actor = String.isNotBlank(changedBy) ? changedBy : UserInfo.getName();

            List<Order_Stage_Log__c> logs = [
                SELECT Id, Current_Stage__c, Changed_By__c, Dispatch_Status__c
                FROM Order_Stage_Log__c
                WHERE Order_ID_Ref__c IN :orderIds
            ];
            for (Order_Stage_Log__c log : logs) {
                log.Current_Stage__c   = 'Completed';
                log.Dispatch_Status__c = 'Completed';
                log.Changed_By__c      = actor;
            }
            if (!logs.isEmpty()) update logs;
            // ✅ Trigger fires after update → writes Big Object → deletes records

        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }

    // ════════════════════════════════════════════════════════════
    // ADD STOCK MANUALLY (Craftsman + Manager)
    // Upserts Inventory__c by Item_Code__c + Color__c + Karat__c
    // ════════════════════════════════════════════════════════════

    // @AuraEnabled
    // public static void addStock(String itemCode, String color, String karat,
    //                             Decimal qty, Decimal inches, Decimal grams,
    //                             Decimal pair,   // ✅ ADD this parameter
    //                             String size, String changedBy) {
    //     try {
    //         if (String.isBlank(itemCode)) throw new AuraHandledException('Item Code is required');

    //         String mType = 'Quantity';
    //         List<Item_Configuration__mdt> cfgList = [
    //             SELECT Measurement_Type__c FROM Item_Configuration__mdt
    //             WHERE Label = :itemCode LIMIT 1
    //         ];
    //         if (!cfgList.isEmpty()) mType = cfgList[0].Measurement_Type__c;

    //         // Normalize karat
    //         String normKarat = karat != null
    //             ? karat.toUpperCase().replace('KT','').replace('K','').trim() : '';

    //         // Find existing record
    //         List<Inventory__c> allInv = [
    //             SELECT Id, Available_Qty__c, Available_Inches__c,
    //                 Available_Grams__c, Available_Pair__c, Karat__c
    //             FROM Inventory__c
    //             WHERE Item_Code__c = :itemCode AND Color__c = :color
    //         ];
    //         Inventory__c existing = null;
    //         for (Inventory__c inv : allInv) {
    //             String invKar = inv.Karat__c != null
    //                 ? inv.Karat__c.toUpperCase().replace('KT','').replace('K','').trim() : '';
    //             if (invKar == normKarat) { existing = inv; break; }
    //         }

    //         // Build record
    //         Inventory__c inv = existing != null ? existing : new Inventory__c(
    //             Item_Code__c        = itemCode,
    //             Color__c            = color,
    //             Karat__c            = karat,
    //             Available_Qty__c    = 0,
    //             Available_Inches__c = 0,
    //             Available_Grams__c  = 0,
    //             Available_Pair__c   = 0,
    //             Size__c             = size
    //         );

    //         if (mType == 'LengthWeight') {
    //             inv.Available_Inches__c = (inv.Available_Inches__c != null ? inv.Available_Inches__c : 0) + (inches != null ? inches : 0);
    //             inv.Available_Grams__c  = (inv.Available_Grams__c  != null ? inv.Available_Grams__c  : 0) + (grams  != null ? grams  : 0);
    //         } else if (mType == 'Pair') {
    //             inv.Available_Pair__c = (inv.Available_Pair__c != null ? inv.Available_Pair__c : 0) + (pair != null ? pair : 0);
    //         } else if (mType == 'QuantityPair') {
    //             inv.Available_Qty__c  = (inv.Available_Qty__c  != null ? inv.Available_Qty__c  : 0) + (qty  != null ? qty  : 0);
    //             inv.Available_Pair__c = (inv.Available_Pair__c != null ? inv.Available_Pair__c : 0) + (pair != null ? pair : 0);
    //         } else if (mType == 'QuantityWeight') {
    //             inv.Available_Qty__c   = (inv.Available_Qty__c   != null ? inv.Available_Qty__c   : 0) + (qty   != null ? qty   : 0);
    //             inv.Available_Grams__c = (inv.Available_Grams__c != null ? inv.Available_Grams__c : 0) + (grams != null ? grams : 0);
    //         } else {
    //             // Quantity
    //             inv.Available_Qty__c = (inv.Available_Qty__c != null ? inv.Available_Qty__c : 0) + (qty != null ? qty : 0);
    //         }

    //         if (existing == null) { insert inv; } else { update inv; }

    //     } catch (AuraHandledException e) { throw e; }
    //     catch (Exception e) { throw new AuraHandledException('addStock: ' + e.getMessage()); }
    // }
    @AuraEnabled
    public static void addStock(String itemCode, String color, String karat,
                                Decimal qty, Decimal inches, Decimal grams,
                                Decimal pair,   // ✅ ADD this parameter
                                String size, String changedBy) {
        try {
            if (String.isBlank(itemCode)) throw new AuraHandledException('Item Code is required');

            String mType = 'Quantity';
            List<Item_Configuration__mdt> cfgList = [
                SELECT Measurement_Type__c FROM Item_Configuration__mdt
                WHERE Label = :itemCode LIMIT 1
            ];
            if (!cfgList.isEmpty()) mType = cfgList[0].Measurement_Type__c;

            // Normalize karat
            String normKarat = karat != null
                ? karat.toUpperCase().replace('KT','').replace('K','').trim() : '';
            String normSize = size != null
                ? size.trim().toLowerCase()
                : '';

            // Find existing record
            List<Inventory__c> allInv = [
                SELECT Id, Available_Qty__c, Available_Inches__c,
                    Available_Grams__c, Available_Pair__c, Karat__c,Size__c
                FROM Inventory__c
                WHERE Item_Code__c = :itemCode AND Color__c = :color
            ];
            Inventory__c existing = null;
            for (Inventory__c inv : allInv) {
                String invKar = inv.Karat__c != null
                    ? inv.Karat__c.toUpperCase().replace('KT','').replace('K','').trim() : '';
                String invSize = inv.Size__c != null
                    ? inv.Size__c.trim().toLowerCase()
                    : '';
                if (invKar == normKarat && invSize == normSize) { existing = inv; break; }
            }

            // Build record
            Inventory__c inv = existing != null ? existing : new Inventory__c(
                Item_Code__c        = itemCode,
                Color__c            = color,
                Karat__c            = karat,
                Available_Qty__c    = 0,
                Available_Inches__c = 0,
                Available_Grams__c  = 0,
                Available_Pair__c   = 0,
                Size__c             = size
            );

            if (mType == 'LengthWeight') {
                inv.Available_Inches__c = (inv.Available_Inches__c != null ? inv.Available_Inches__c : 0) + (inches != null ? inches : 0);
                inv.Available_Grams__c  = (inv.Available_Grams__c  != null ? inv.Available_Grams__c  : 0) + (grams  != null ? grams  : 0);
            } else if (mType == 'Pair') {
                inv.Available_Pair__c = (inv.Available_Pair__c != null ? inv.Available_Pair__c : 0) + (pair != null ? pair : 0);
            } else if (mType == 'QuantityPair') {
                inv.Available_Qty__c  = (inv.Available_Qty__c  != null ? inv.Available_Qty__c  : 0) + (qty  != null ? qty  : 0);
                inv.Available_Pair__c = (inv.Available_Pair__c != null ? inv.Available_Pair__c : 0) + (pair != null ? pair : 0);
            } else if (mType == 'QuantityWeight') {
                inv.Available_Qty__c   = (inv.Available_Qty__c   != null ? inv.Available_Qty__c   : 0) + (qty   != null ? qty   : 0);
                inv.Available_Grams__c = (inv.Available_Grams__c != null ? inv.Available_Grams__c : 0) + (grams != null ? grams : 0);
            } else if (mType == 'LengthQuantity') {
                inv.Available_Inches__c =
                    (inv.Available_Inches__c != null ? inv.Available_Inches__c : 0)
                    + (inches != null ? inches : 0);
                inv.Available_Qty__c =
                    (inv.Available_Qty__c != null ? inv.Available_Qty__c : 0)
                    + (qty != null ? qty : 0);
            } 
            else if (mType == 'Weight') {
                inv.Available_Grams__c =
                    (inv.Available_Grams__c != null ? inv.Available_Grams__c : 0)
                    + (grams != null ? grams : 0);
            } 
            else {
                // Quantity
                inv.Available_Qty__c = (inv.Available_Qty__c != null ? inv.Available_Qty__c : 0) + (qty != null ? qty : 0);
            }

            if (existing == null) { insert inv; } else { update inv; }

        } catch (AuraHandledException e) { throw e; }
        catch (Exception e) { throw new AuraHandledException('addStock: ' + e.getMessage()); }
    }


    // ════════════════════════════════════════════════════════════
    // INVENTORY
    // ════════════════════════════════════════════════════════════

    @AuraEnabled
    public static List<Inventory__c> getAllInventory() {
        try {
            return [
                SELECT Id, Name, Item_Code__c, Color__c, Karat__c, Size__c, Available_Qty__c,Available_Grams__c,Available_Inches__c,Available_Pair__c
                FROM Inventory__c ORDER BY Item_Code__c 
            ];
        } catch (Exception e) { throw new AuraHandledException(e.getMessage()); }
    }

    @AuraEnabled
    public static Inventory__c getStockForItem(String itemCode) {
        try {
            List<Inventory__c> r = [
                SELECT Id, Item_Code__c, Color__c, Karat__c, Available_Qty__c
                FROM Inventory__c WHERE Item_Code__c = :itemCode LIMIT 1
            ];
            return r.isEmpty() ? null : r[0];
        } catch (Exception e) { throw new AuraHandledException(e.getMessage()); }
    }

    // ════════════════════════════════════════════════════════════
    // GENERIC STAGE UPDATE (used by All Orders screen for manual override)
    // ════════════════════════════════════════════════════════════

    @AuraEnabled
    public static void updateOrderStage(String orderId, String customerName,
                                         String newStage, String changedBy) {
        try {
            List<String> valid = new List<String>{
                'New', 'Stock Check', 'Bag Generate', 'In Production',
                'Partially Ready', 'Ready', 'Dispatched', 'Completed'
            };
            if (!valid.contains(newStage)) throw new AuraHandledException('Invalid stage: ' + newStage);
            String actor = String.isNotBlank(changedBy) ? changedBy : UserInfo.getName();
            List<Order_Stage_Log__c> logs = [
                SELECT Id, Current_Stage__c, Changed_By__c
                FROM Order_Stage_Log__c WHERE Order_ID_Ref__c = :orderId LIMIT 1
            ];
            if (!logs.isEmpty()) {
                logs[0].Current_Stage__c = newStage;
                logs[0].Changed_By__c    = actor;
                update logs[0];
            }
        } catch (AuraHandledException e) { throw e; }
        catch (Exception e) { throw new AuraHandledException(e.getMessage()); }
    }

    // ════════════════════════════════════════════════════════════
    // VF SLIP DATA (for JwelCraftProductionSlip page)
    // ════════════════════════════════════════════════════════════

    @AuraEnabled
    public static Map<String, Object> getBatchSlipData(String batchId) {
        try {
            Production_Batch__c batch = [
                SELECT Id, Name, Item_Code__c, Color__c, Karat__c,
                       Order_Qty__c, Buffer_Qty__c, Total_Qty__c,
                       Order_IDs__c, CreatedDate
                FROM Production_Batch__c WHERE Id = :batchId LIMIT 1
            ];
            List<String> orderIds = new List<String>();
            try {
                orderIds = (List<String>) JSON.deserialize(
                    batch.Order_IDs__c != null ? batch.Order_IDs__c : '[]',
                    List<String>.class
                );
            } catch(Exception ex) {}

            List<Order_Stage_Log__c> orders = [
                SELECT Order_ID_Ref__c, Customer_Code__c, Quantity__c
                FROM Order_Stage_Log__c WHERE Order_ID_Ref__c IN :orderIds
            ];
            List<Map<String, Object>> breakdown = new List<Map<String, Object>>();
            for (Order_Stage_Log__c o : orders) {
                breakdown.add(new Map<String, Object>{
                    'customerCode' => String.isNotBlank(o.Customer_Code__c) ? o.Customer_Code__c : '—',
                    'qty'          => o.Quantity__c != null ? o.Quantity__c.intValue() : 0
                });
            }
            return new Map<String, Object>{
                'batchName'  => batch.Name,
                'itemCode'   => batch.Item_Code__c,
                'color'      => batch.Color__c,
                'karat'      => batch.Karat__c,
                'orderQty'   => batch.Order_Qty__c  != null ? batch.Order_Qty__c.intValue()  : 0,
                'bufferQty'  => batch.Buffer_Qty__c != null ? batch.Buffer_Qty__c.intValue() : 0,
                'totalQty'   => batch.Total_Qty__c  != null ? batch.Total_Qty__c.intValue()  : 0,
                'breakdown'  => breakdown
            };
        } catch (Exception e) { throw new AuraHandledException('getBatchSlipData: ' + e.getMessage()); }
    }

    // ════════════════════════════════════════════════════════════
    // PRIVATE HELPERS
    // ════════════════════════════════════════════════════════════

    private static String generateOrderId() {
        String chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        String id    = '';
        for (Integer i = 0; i < 8; i++) {
            Integer idx = Math.mod(Math.abs(Crypto.getRandomInteger()), 36);
            id += chars.substring(idx, idx + 1);
        }
        return 'JO-' + id;
    }

    @AuraEnabled
    public static void updateOrder(
        Id recordId,
        String itemCode,
        String color,
        String karat,
        String size,
        Decimal quantity,
        String qtyUnit
    ){
        try{

            Order_Stage_Log__c rec = [
                SELECT Id, Current_Stage__c
                FROM Order_Stage_Log__c
                WHERE Id=:recordId
            ];

            if(rec.Current_Stage__c!='New'){
                throw new AuraHandledException('Only NEW orders can be edited');
            }

            rec.Item_Code__c = itemCode;
            rec.Color__c = color;
            rec.Karat__c = karat;
            rec.Size__c = size;
            rec.Quantity__c = quantity;
            rec.Quantity_Unit__c = qtyUnit;

            update rec;

        }catch(Exception e){
            throw new AuraHandledException(e.getMessage());
        }
    }

    @AuraEnabled
    public static void deleteOrder(Id recordId) {
        try {
            Order_Stage_Log__c rec = [
                SELECT Id, Current_Stage__c
                FROM Order_Stage_Log__c
                WHERE Id = :recordId LIMIT 1
            ];
            List<String> allowed = new List<String>{
                'New', 'Stock Check', 'Bag Generate'
            };
            if (!allowed.contains(rec.Current_Stage__c)) {
                throw new AuraHandledException(
                    'Cannot cancel — order is already in stage: ' + rec.Current_Stage__c
                );
            }
            rec.Current_Stage__c   = 'Cancelled';
            rec.Dispatch_Status__c = 'Cancelled';
            update rec;

        } catch (AuraHandledException e) { throw e; }
        catch (Exception e) {
            throw new AuraHandledException('Cancel failed: ' + e.getMessage());
        }
    }
    
    // ════════════════════════════════════════════════════════════
    // CLEAR STOCK MANUALLY
    // Sets Available_Qty__c to 0 then deletes the Inventory__c record
    // ════════════════════════════════════════════════════════════

    @AuraEnabled
    public static void clearStock(String inventoryId) {
        try {
            if (String.isBlank(inventoryId)) throw new AuraHandledException('Inventory ID required');
            List<Inventory__c> inv = [SELECT Id FROM Inventory__c WHERE Id = :inventoryId LIMIT 1];
            if (!inv.isEmpty()) delete inv[0];
        } catch (AuraHandledException e) { throw e; }
        catch (Exception e) { throw new AuraHandledException('clearStock: ' + e.getMessage()); }
    }

    // ════════════════════════════════════════════════════════════
    // ALLOCATE STOCK TO ORDER
    // Deducts from Inventory__c matched by Item_Code__c
    // Updates Fulfilled_Qty__c, moves order to Ready or Partially Ready
    // allocateQty   : pieces to allocate (for Quantity type)
    // allocateInches: inches to deduct   (for LengthWeight type)
    // allocateGrams : grams to deduct    (for LengthWeight type)
    // ════════════════════════════════════════════════════════════

    //  @AuraEnabled
    // public static Map<String, Object> allocateStock(
    //         String  orderId,
    //         Decimal allocateQty,
    //         Decimal allocateInches,
    //         Decimal allocateGrams,
    //         String  changedBy) {
    //     try {
    //         String actor = String.isNotBlank(changedBy) ? changedBy : UserInfo.getName();

    //         // ── 1. Load order ──
    //         List<Order_Stage_Log__c> logs = [
    //             SELECT Id, Order_ID_Ref__c, Item_Code__c, Color__c, Karat__c,
    //                    Quantity__c, Fulfilled_Qty__c, Current_Stage__c,
    //                    Quantity_Unit__c, Changed_By__c
    //             FROM Order_Stage_Log__c
    //             WHERE Order_ID_Ref__c = :orderId LIMIT 1
    //         ];
    //         if (logs.isEmpty()) throw new AuraHandledException('Order not found: ' + orderId);
    //         Order_Stage_Log__c log = logs[0];

    //         Decimal totalQty     = log.Quantity__c      != null ? log.Quantity__c      : 0;
    //         Decimal fulfilledSoFar = log.Fulfilled_Qty__c != null ? log.Fulfilled_Qty__c : 0;
    //         Decimal pendingQty   = totalQty - fulfilledSoFar;
    //         String  unit         = log.Quantity_Unit__c != null ? log.Quantity_Unit__c : 'Pieces';
    //         Boolean isLW         = unit == 'Inches' || unit == 'Grams';

    //         // ── 2. Validate allocation amount ──
    //         if (!isLW) {
    //             if (allocateQty == null || allocateQty <= 0)
    //                 throw new AuraHandledException('Allocation quantity must be greater than 0');
    //             if (allocateQty > pendingQty)
    //                 throw new AuraHandledException('Cannot allocate more than pending qty (' + pendingQty.intValue() + ')');
    //         } else {
    //             if ((allocateInches == null || allocateInches < 0) &&
    //                 (allocateGrams  == null || allocateGrams  < 0))
    //                 throw new AuraHandledException('Enter inches and/or grams to allocate');
    //         }

    //         // ── 3. Find inventory by Item_Code__c + Color__c + Karat__c ──
    //         List<Inventory__c> invList = [
    //             SELECT Id, Available_Qty__c, Available_Inches__c, Available_Grams__c
    //             FROM Inventory__c
    //             WHERE Item_Code__c = :log.Item_Code__c
    //             AND   Color__c     = :log.Color__c
    //             AND   Karat__c     = :log.Karat__c
    //             LIMIT 1
    //         ];

    //         if (invList.isEmpty())
    //             throw new AuraHandledException(
    //                 'No inventory found for ' + log.Item_Code__c +
    //                 ' · ' + log.Color__c + ' · ' + log.Karat__c);

    //         Inventory__c inv = invList[0];

    //         if (!isLW) {
    //             // ── Pieces: check Available_Qty__c ──
    //             Decimal available = inv.Available_Qty__c != null ? inv.Available_Qty__c : 0;
    //             if (available <= 0)
    //                 throw new AuraHandledException(
    //                     'No stock available for ' + log.Item_Code__c +
    //                     ' · ' + log.Color__c + ' · ' + log.Karat__c);
    //             if (allocateQty > available)
    //                 throw new AuraHandledException(
    //                     'Not enough stock. Available: ' + available.intValue() + ' pcs');
    //             inv.Available_Qty__c = available - allocateQty;
    //         } else {
    //             // ── LengthWeight: check Available_Inches__c and Available_Grams__c ──
    //             Decimal availIn  = inv.Available_Inches__c != null ? inv.Available_Inches__c : 0;
    //             Decimal availGm  = inv.Available_Grams__c  != null ? inv.Available_Grams__c  : 0;
    //             if (availIn <= 0 && availGm <= 0)
    //                 throw new AuraHandledException(
    //                     'No stock (inches/grams) available for ' + log.Item_Code__c +
    //                     ' · ' + log.Color__c + ' · ' + log.Karat__c);
    //             Decimal deductIn = allocateInches != null ? allocateInches : 0;
    //             Decimal deductGm = allocateGrams  != null ? allocateGrams  : 0;
    //             if (deductIn > availIn)
    //                 throw new AuraHandledException(
    //                     'Not enough inches. Available: ' + availIn);
    //             if (deductGm > availGm)
    //                 throw new AuraHandledException(
    //                     'Not enough grams. Available: ' + availGm);
    //             inv.Available_Inches__c = availIn - deductIn;
    //             inv.Available_Grams__c  = availGm - deductGm;
    //             allocateQty = 1;
    //         }

    //         // ── 4. Update or delete inventory ──
    //         Decimal remQty = inv.Available_Qty__c    != null ? inv.Available_Qty__c    : 0;
    //         Decimal remIn  = inv.Available_Inches__c != null ? inv.Available_Inches__c : 0;
    //         Decimal remGm  = inv.Available_Grams__c  != null ? inv.Available_Grams__c  : 0;
    //         Boolean isEmpty = !isLW
    //             ? remQty <= 0
    //             : (remIn <= 0 && remGm <= 0);

    //         if (isEmpty) {
    //             delete inv;
    //         } else {
    //             update inv;
    //         }

    //         // ── 5. Update order fulfilled qty + stage ──
    //         Decimal newFulfilled = fulfilledSoFar + allocateQty;
    //         log.Fulfilled_Qty__c  = newFulfilled;
    //         log.Changed_By__c     = actor;
    //         log.Current_Stage__c  = newFulfilled >= totalQty ? 'Ready' : 'Partially Ready';
    //         update log;

    //         return new Map<String, Object>{
    //             'success'       => true,
    //             'newFulfilled'  => newFulfilled,
    //             'newStage'      => log.Current_Stage__c,
    //             'isReady'       => newFulfilled >= totalQty
    //         };

    //     } catch (AuraHandledException e) { throw e; }
    //     catch (Exception e) {
    //         throw new AuraHandledException('allocateStock: ' + e.getMessage());
    //     }
    // }
    @AuraEnabled
    public static Map<String, Object> allocateStock(
            String  orderId,
            Decimal allocateQty,
            Decimal allocateInches,
            Decimal allocateGrams,
            Decimal allocatePair,      // ✅ ADD new parameter
            String  changedBy) {
        try {
            String actor = String.isNotBlank(changedBy) ? changedBy : UserInfo.getName();

            // ── 1. Load order ──
            List<Order_Stage_Log__c> logs = [
                SELECT Id, Order_ID_Ref__c, Item_Code__c, Color__c, Karat__c,Size__c,
                    Quantity__c, Fulfilled_Qty__c, Current_Stage__c,
                    Quantity_Unit__c, Changed_By__c,
                    Dispatched_Qty__c, Dispatch_Status__c
                FROM Order_Stage_Log__c
                WHERE Order_ID_Ref__c = :orderId LIMIT 1
            ];
            if (logs.isEmpty()) throw new AuraHandledException('Order not found: ' + orderId);
            Order_Stage_Log__c log = logs[0];

            Decimal totalQty      = log.Quantity__c       != null ? log.Quantity__c       : 0;
            Decimal fulfilledSoFar = log.Fulfilled_Qty__c != null ? log.Fulfilled_Qty__c : 0;
            Decimal pendingQty    = totalQty - fulfilledSoFar;
            String  unit          = log.Quantity_Unit__c  != null ? log.Quantity_Unit__c  : 'Pieces';

            // ✅ All type flags
            Boolean isLW   = unit == 'Inches' || unit == 'Grams';
            Boolean isPair = unit == 'Pair';
            Boolean isQP   = unit == 'QuantityPair';
            Boolean isQW   = unit == 'QuantityWeight';

            // ── 2. Validate allocation amount ──
            if (isLW) {
                if ((allocateInches == null || allocateInches < 0) &&
                    (allocateGrams  == null || allocateGrams  < 0))
                    throw new AuraHandledException('Enter inches and/or grams to allocate');
            } else if (isPair) {
                if (allocatePair == null || allocatePair <= 0)
                    throw new AuraHandledException('Enter a valid Pair quantity to allocate');
                if (allocatePair > pendingQty)
                    throw new AuraHandledException('Cannot allocate more than pending (' + pendingQty.intValue() + ' Pair)');
            } else if (isQP) {
                if ((allocateQty  == null || allocateQty  <= 0) &&
                    (allocatePair == null || allocatePair <= 0))
                    throw new AuraHandledException('Enter Pieces and/or Pair to allocate');
            } else if (isQW) {
                if (allocateQty == null || allocateQty <= 0)
                    throw new AuraHandledException('Enter a valid Pieces quantity to allocate');
                if (allocateQty > pendingQty)
                    throw new AuraHandledException('Cannot allocate more than pending (' + pendingQty.intValue() + ')');
            } else {
                // Quantity — Pieces
                if (allocateQty == null || allocateQty <= 0)
                    throw new AuraHandledException('Allocation quantity must be greater than 0');
                if (allocateQty > pendingQty)
                    throw new AuraHandledException('Cannot allocate more than pending qty (' + pendingQty.intValue() + ')');
            }

            // ── 3. Find inventory ──
            List<Inventory__c> invList = [
                SELECT Id, Available_Qty__c, Available_Inches__c,Size__c,
                    Available_Grams__c, Available_Pair__c
                FROM Inventory__c
                WHERE Item_Code__c = :log.Item_Code__c
                AND   Color__c     = :log.Color__c
                AND   Karat__c     = :log.Karat__c
                AND Size__c        = :log.Size__c
                LIMIT 1
            ];
            if (invList.isEmpty())
                throw new AuraHandledException(
                    'No inventory found for ' + log.Item_Code__c +
                    ' · ' + log.Color__c + ' · ' + log.Karat__c);

            Inventory__c inv = invList[0];

            // ── 4. Deduct inventory per type ──
            if (isLW) {
                Decimal availIn = inv.Available_Inches__c != null ? inv.Available_Inches__c : 0;
                Decimal availGm = inv.Available_Grams__c  != null ? inv.Available_Grams__c  : 0;
                if (availIn <= 0 && availGm <= 0)
                    throw new AuraHandledException('No stock (inches/grams) available');
                Decimal deductIn = allocateInches != null ? allocateInches : 0;
                Decimal deductGm = allocateGrams  != null ? allocateGrams  : 0;
                if (deductIn > availIn) throw new AuraHandledException('Not enough inches. Available: ' + availIn);
                if (deductGm > availGm) throw new AuraHandledException('Not enough grams. Available: ' + availGm);
                inv.Available_Inches__c = availIn - deductIn;
                inv.Available_Grams__c  = availGm - deductGm;
                // allocateQty = 1;
                 if (unit == 'Inches') {
                    allocateQty = deductIn;   // ✅ use actual inches entered, not 1
                } else {
                    allocateQty = deductGm;   // ✅ use actual grams entered, not 1
                }
            } else if (isPair) {
                // ✅ Pair — deduct Available_Pair__c
                Decimal availPair = inv.Available_Pair__c != null ? inv.Available_Pair__c : 0;
                if (availPair <= 0)
                    throw new AuraHandledException('No Pair stock available for ' + log.Item_Code__c);
                if (allocatePair > availPair)
                    throw new AuraHandledException('Not enough Pair stock. Available: ' + availPair.intValue());
                inv.Available_Pair__c = availPair - allocatePair;
                allocateQty = allocatePair;

            } else if (isQP) {
                // ✅ QuantityPair — deduct both Pieces and Pair
                Decimal availQty  = inv.Available_Qty__c  != null ? inv.Available_Qty__c  : 0;
                Decimal availPair = inv.Available_Pair__c != null ? inv.Available_Pair__c : 0;
                Decimal deductQty  = allocateQty  != null ? allocateQty  : 0;
                Decimal deductPair = allocatePair != null ? allocatePair : 0;
                if (deductQty  > availQty)  throw new AuraHandledException('Not enough Pieces. Available: ' + availQty.intValue());
                if (deductPair > availPair) throw new AuraHandledException('Not enough Pair. Available: '   + availPair.intValue());
                inv.Available_Qty__c  = availQty  - deductQty;
                inv.Available_Pair__c = availPair - deductPair;
                allocateQty = deductQty > 0 ? deductQty : deductPair;

            } else if (isQW) {
                // ✅ QuantityWeight — deduct Pieces + optional Grams
                Decimal availQty = inv.Available_Qty__c  != null ? inv.Available_Qty__c  : 0;
                Decimal availGm  = inv.Available_Grams__c != null ? inv.Available_Grams__c : 0;
                if (allocateQty > availQty)
                    throw new AuraHandledException('Not enough Pieces. Available: ' + availQty.intValue());
                Decimal deductGm = allocateGrams != null ? allocateGrams : 0;
                if (deductGm > availGm) throw new AuraHandledException('Not enough grams. Available: ' + availGm);
                inv.Available_Qty__c   = availQty - allocateQty;
                inv.Available_Grams__c = availGm  - deductGm;

            } else {
                // ✅ Quantity — Pieces only
                Decimal availQty = inv.Available_Qty__c != null ? inv.Available_Qty__c : 0;
                if (availQty <= 0)
                    throw new AuraHandledException('No stock available for ' + log.Item_Code__c);
                if (allocateQty > availQty)
                    throw new AuraHandledException('Not enough stock. Available: ' + availQty.intValue() + ' pcs');
                inv.Available_Qty__c = availQty - allocateQty;
            }

            // ── 5. Update or delete inventory ──
            Decimal remQty  = inv.Available_Qty__c    != null ? inv.Available_Qty__c    : 0;
            Decimal remIn   = inv.Available_Inches__c != null ? inv.Available_Inches__c : 0;
            Decimal remGm   = inv.Available_Grams__c  != null ? inv.Available_Grams__c  : 0;
            Decimal remPair = inv.Available_Pair__c   != null ? inv.Available_Pair__c   : 0;
            Boolean isEmpty = (remQty <= 0 && remIn <= 0 && remGm <= 0 && remPair <= 0);

            if (isEmpty) { delete inv; } else { update inv; }

            // ── 6. Update order fulfilled qty + stage ──
            // Decimal newFulfilled = fulfilledSoFar + allocateQty;
            // log.Fulfilled_Qty__c = newFulfilled;
            // log.Changed_By__c    = actor;
            // log.Current_Stage__c = newFulfilled >= totalQty ? 'Ready' : 'Partially Ready';
            // update log;
            // ── 6. Update order fulfilled qty + move directly to Dispatch ──
            Decimal newFulfilled = fulfilledSoFar + allocateQty;

            log.Fulfilled_Qty__c = newFulfilled;
            log.Changed_By__c    = actor;
            log.Current_Stage__c = newFulfilled >= totalQty ? 'Dispatched' : 'Partially Ready';
            log.Dispatched_Qty__c = newFulfilled;

            if (newFulfilled >= totalQty) {
                log.Dispatch_Status__c = 'Fully Dispatched';
            } else {
                log.Dispatch_Status__c = 'Partially Ready';
            }

            update log;

            return new Map<String, Object>{
                'success'      => true,
                'newFulfilled' => newFulfilled,
                'newStage'     => log.Current_Stage__c,
                'isReady'      => newFulfilled >= totalQty
            };

        } catch (AuraHandledException e) { throw e; }
        catch (Exception e) {
            throw new AuraHandledException('allocateStock: ' + e.getMessage());
        }
    }

    // ════════════════════════════════════════════════════════════
    // GET ALLOCATABLE ORDERS
    // Returns all orders NOT in Ready / Dispatched / Completed
    // that have pending qty > 0
    // ════════════════════════════════════════════════════════════

    @AuraEnabled
    public static List<Order_Stage_Log__c> getAllocatableOrders() {
        try {
            return [
                SELECT Id, Name, Order_ID_Ref__c,Item_Category__c,
                       Customer_Name__c, Customer_Code__c, Customer_Mobile_No__c,
                       Item_Code__c, Color__c, Karat__c, Size__c,
                       Quantity__c, Fulfilled_Qty__c, Quantity_Unit__c,
                       Priority__c, Remark__c, Order_Date__c,
                       Current_Stage__c, Changed_By__c, Production_Batch_Ref__c
                FROM Order_Stage_Log__c
                WHERE Current_Stage__c NOT IN ('Ready','Dispatched','Completed')
                AND   Quantity__c > 0
                ORDER BY Order_Date__c ASC, Priority__c ASC
                LIMIT 500
            ];
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }

    // ════════════════════════════════════════════════════════════
    // CANCEL ORDER
    // Sets stage to Cancelled, adds fulfilled qty back to Inventory__c
    // ════════════════════════════════════════════════════════════

    // @AuraEnabled
    // public static void cancelOrder(String orderId, String changedBy) {
    //     try {
    //         String actor = String.isNotBlank(changedBy) ? changedBy : UserInfo.getName();

    //         List<Order_Stage_Log__c> logs = [
    //             SELECT Id, Order_ID_Ref__c, Item_Code__c, Color__c, Karat__c,
    //                 Quantity__c, Fulfilled_Qty__c, Current_Stage__c,
    //                 Changed_By__c, Quantity_Unit__c
    //             FROM Order_Stage_Log__c
    //             WHERE Order_ID_Ref__c = :orderId LIMIT 1
    //         ];
    //         if (logs.isEmpty()) throw new AuraHandledException('Order not found: ' + orderId);
    //         Order_Stage_Log__c log = logs[0];

    //         Decimal fulfilledQty = log.Fulfilled_Qty__c != null ? log.Fulfilled_Qty__c : 0;
    //         String  unit         = log.Quantity_Unit__c != null ? log.Quantity_Unit__c : 'Pieces';
    //         Boolean isLW         = unit == 'Inches' || unit == 'Grams';

    //         // ── 1. Return fulfilled qty back to Inventory__c ──
    //         if (fulfilledQty > 0) {
    //             List<Inventory__c> invList = [
    //                 SELECT Id, Available_Qty__c, Available_Inches__c, Available_Grams__c
    //                 FROM Inventory__c
    //                 WHERE Item_Code__c = :log.Item_Code__c
    //                 AND   Color__c     = :log.Color__c
    //                 AND   Karat__c     = :log.Karat__c
    //                 LIMIT 1
    //             ];
    //             if (invList.isEmpty()) {
    //                 insert new Inventory__c(
    //                     Item_Code__c        = log.Item_Code__c,
    //                     Color__c            = log.Color__c,
    //                     Karat__c            = log.Karat__c,
    //                     Available_Qty__c    = isLW ? 0 : fulfilledQty,
    //                     Available_Inches__c = isLW ? fulfilledQty : 0,
    //                     Available_Grams__c  = 0
    //                 );
    //             } else {
    //                 if (isLW) {
    //                     invList[0].Available_Inches__c =
    //                         (invList[0].Available_Inches__c != null
    //                             ? invList[0].Available_Inches__c : 0) + fulfilledQty;
    //                 } else {
    //                     invList[0].Available_Qty__c =
    //                         (invList[0].Available_Qty__c != null
    //                             ? invList[0].Available_Qty__c : 0) + fulfilledQty;
    //                 }
    //                 update invList[0];
    //             }
    //         }

    //         // ── 2. Set Cancelled — trigger fires → Big Object → delete ──
    //         log.Current_Stage__c   = 'Cancelled';
    //         log.Dispatch_Status__c = 'Cancelled';
    //         log.Changed_By__c      = actor;
    //         update log;

    //     } catch (AuraHandledException e) { throw e; }
    //     catch (Exception e) {
    //         throw new AuraHandledException('cancelOrder: ' + e.getMessage());
    //     }
    // }
    @AuraEnabled
    public static void cancelOrder(String orderId, String changedBy) {
        try {
            String actor = String.isNotBlank(changedBy) ? changedBy : UserInfo.getName();

            List<Order_Stage_Log__c> logs = [
                SELECT Id, Order_ID_Ref__c, Item_Code__c, Color__c, Karat__c,
                    Quantity__c, Fulfilled_Qty__c, Current_Stage__c,
                    Changed_By__c, Quantity_Unit__c
                FROM Order_Stage_Log__c
                WHERE Order_ID_Ref__c = :orderId LIMIT 1
            ];
            if (logs.isEmpty())
                throw new AuraHandledException('Order not found: ' + orderId);

            Order_Stage_Log__c log = logs[0];

            Decimal fulfilledQty = log.Fulfilled_Qty__c != null ? log.Fulfilled_Qty__c : 0;
            String  unit         = log.Quantity_Unit__c != null ? log.Quantity_Unit__c : 'Pieces';

            // ✅ All type flags — same pattern as allocateStock
            Boolean isLW   = unit == 'Inches' || unit == 'Grams';
            Boolean isPair = unit == 'Pair';
            Boolean isQP   = unit == 'QuantityPair';
            Boolean isQW   = unit == 'QuantityWeight';

            // ── 1. Return fulfilled qty back to Inventory ──
            if (fulfilledQty > 0) {

                List<Inventory__c> invList = [
                    SELECT Id, Available_Qty__c, Available_Inches__c,
                        Available_Grams__c, Available_Pair__c
                    FROM Inventory__c
                    WHERE Item_Code__c = :log.Item_Code__c
                    AND   Color__c     = :log.Color__c
                    AND   Karat__c     = :log.Karat__c
                    LIMIT 1
                ];

                if (invList.isEmpty()) {
                    // ── No inventory record — create one and return qty ──
                    Inventory__c newInv = new Inventory__c(
                        Item_Code__c = log.Item_Code__c,
                        Color__c     = log.Color__c,
                        Karat__c     = log.Karat__c
                    );

                    if (isLW) {
                        // ✅ Return to correct field based on unit
                        if (unit == 'Inches') {
                            newInv.Available_Inches__c = fulfilledQty;
                            newInv.Available_Grams__c  = 0;
                        } else {
                            newInv.Available_Grams__c  = fulfilledQty;
                            newInv.Available_Inches__c = 0;
                        }
                        newInv.Available_Qty__c  = 0;
                        newInv.Available_Pair__c = 0;

                    } else if (isPair) {
                        // ✅ Return to Pair — was going to Qty before (BUG)
                        newInv.Available_Pair__c   = fulfilledQty;
                        newInv.Available_Qty__c    = 0;
                        newInv.Available_Inches__c = 0;
                        newInv.Available_Grams__c  = 0;

                    } else if (isQP) {
                        // ✅ QuantityPair — return to Pieces (primary fulfillment)
                        newInv.Available_Qty__c    = fulfilledQty;
                        newInv.Available_Pair__c   = 0;
                        newInv.Available_Inches__c = 0;
                        newInv.Available_Grams__c  = 0;

                    } else if (isQW) {
                        // ✅ QuantityWeight — return to Pieces
                        newInv.Available_Qty__c    = fulfilledQty;
                        newInv.Available_Grams__c  = 0;
                        newInv.Available_Inches__c = 0;
                        newInv.Available_Pair__c   = 0;

                    } else {
                        // ✅ Quantity — Pieces
                        newInv.Available_Qty__c    = fulfilledQty;
                        newInv.Available_Inches__c = 0;
                        newInv.Available_Grams__c  = 0;
                        newInv.Available_Pair__c   = 0;
                    }

                    insert newInv;

                } else {
                    // ── Existing inventory — add back to correct field ──
                    Inventory__c inv = invList[0];

                    if (isLW) {
                        // ✅ Return to correct LW field
                        if (unit == 'Inches') {
                            inv.Available_Inches__c =
                                (inv.Available_Inches__c != null ? inv.Available_Inches__c : 0)
                                + fulfilledQty;
                        } else {
                            inv.Available_Grams__c =
                                (inv.Available_Grams__c != null ? inv.Available_Grams__c : 0)
                                + fulfilledQty;
                        }

                    } else if (isPair) {
                        // ✅ Return to Pair — was going to Qty before (BUG FIXED)
                        inv.Available_Pair__c =
                            (inv.Available_Pair__c != null ? inv.Available_Pair__c : 0)
                            + fulfilledQty;

                    } else if (isQP) {
                        // ✅ QuantityPair — return Pieces to Qty
                        inv.Available_Qty__c =
                            (inv.Available_Qty__c != null ? inv.Available_Qty__c : 0)
                            + fulfilledQty;

                    } else if (isQW) {
                        // ✅ QuantityWeight — return Pieces to Qty
                        inv.Available_Qty__c =
                            (inv.Available_Qty__c != null ? inv.Available_Qty__c : 0)
                            + fulfilledQty;

                    } else {
                        // ✅ Quantity — Pieces
                        inv.Available_Qty__c =
                            (inv.Available_Qty__c != null ? inv.Available_Qty__c : 0)
                            + fulfilledQty;
                    }

                    update inv;
                }
            }

            // ── 2. Mark order Cancelled ──
            log.Current_Stage__c   = 'Cancelled';
            log.Dispatch_Status__c = 'Cancelled';
            log.Changed_By__c      = actor;
            update log;

        } catch (AuraHandledException e) { throw e; }
        catch (Exception e) {
            throw new AuraHandledException('cancelOrder: ' + e.getMessage());
        }
    }

    // ════════════════════════════════════════════════════════════
    // BULK DISPATCH ORDERS
    // Dispatches multiple orders at once — dispatched qty = fulfilled qty
    // ════════════════════════════════════════════════════════════

    @AuraEnabled
    public static void bulkDispatchOrders(List<String> orderIds, String changedBy) {
        try {
            String actor = String.isNotBlank(changedBy) ? changedBy : UserInfo.getName();
            List<Order_Stage_Log__c> logs = [
                SELECT Id, Order_ID_Ref__c, Fulfilled_Qty__c, Quantity__c,
                       Current_Stage__c, Changed_By__c, Dispatch_Status__c, Dispatched_Qty__c
                FROM Order_Stage_Log__c
                WHERE Order_ID_Ref__c IN :orderIds
            ];
            for (Order_Stage_Log__c ol : logs) {
                Decimal fulfilled = ol.Fulfilled_Qty__c != null ? ol.Fulfilled_Qty__c : 0;
                Decimal total     = ol.Quantity__c      != null ? ol.Quantity__c      : 0;
                ol.Dispatched_Qty__c  = fulfilled;
                ol.Current_Stage__c   = 'Dispatched';
                ol.Changed_By__c      = actor;
                ol.Dispatch_Status__c = fulfilled >= total ? 'Fully Dispatched' : 'Partially Dispatched';
            }
            update logs;
        } catch (AuraHandledException e) { throw e; }
        catch (Exception e) { throw new AuraHandledException('bulkDispatchOrders: ' + e.getMessage()); }
    }   

    @AuraEnabled
    public static List<Map<String, Object>> getCompletedOrders() {
        try {
            List<Map<String, Object>> result = new List<Map<String, Object>>();

            List<JewelryOrder__b> records = [
                SELECT Order_ID__c, Customer_Name__c, Customer_Code__c,
                    Item_Code__c, Color__c, Karat__c, Size__c,
                    Quantity__c, Dispatched_Quantity__c, Priority__c,
                    Remark__c, Order_Status__c, Order_Created_By__c,
                    Order_Date__c, Order_Due_Date__c, Order_Dispatch_Date__c
                FROM JewelryOrder__b
                // ORDER BY Order_Dispatch_Date__c DESC
                // LIMIT 500
            ];

            for (JewelryOrder__b bo : records) {
                result.add(new Map<String, Object>{
                    'orderId'          => bo.Order_ID__c,
                    'customerName'     => bo.Customer_Name__c,
                    'customerCode'     => bo.Customer_Code__c,
                    'itemCode'         => bo.Item_Code__c,
                    'color'            => bo.Color__c,
                    'karat'            => bo.Karat__c,
                    'size'             => bo.Size__c,
                    'quantity'         => bo.Quantity__c,
                    'dispatchedQty'    => bo.Dispatched_Quantity__c,
                    'priority'         => bo.Priority__c,
                    'remark'           => bo.Remark__c,
                    'status'           => bo.Order_Status__c,
                    'createdBy'        => bo.Order_Created_By__c,
                    'orderDate'        => bo.Order_Date__c,
                    'dispatchDate'     => bo.Order_Dispatch_Date__c
                });
            }

            return result;

        } catch (Exception e) {
            throw new AuraHandledException('getCompletedOrders: ' + e.getMessage());
        }
    }
    @AuraEnabled
    public static List<Client_Registration__c> searchClients(String searchTerm) {
        try {
            String term = String.isBlank(searchTerm) ? '' : searchTerm.trim();

            if (String.isBlank(term)) {
                return [
                    SELECT Id, Name, Client_Name__c, GST_Number__c, Client_Mobile__c,
                        Customer_Code__c, CreatedDate
                    FROM Client_Registration__c
                    WHERE Client_Name__c != null
                    ORDER BY CreatedDate DESC
                    LIMIT 5
                ];
            }

            String likeTerm = '%' + term + '%';

            return [
                SELECT Id, Name, Client_Name__c, GST_Number__c, Client_Mobile__c,
                    Customer_Code__c, CreatedDate
                FROM Client_Registration__c
                WHERE Client_Name__c LIKE :likeTerm
                ORDER BY Client_Name__c
                LIMIT 20
            ];
        } catch (Exception e) {
            throw new AuraHandledException('searchClients: ' + e.getMessage());
        }
    }
    @AuraEnabled
    public static Map<String, List<Map<String, String>>> getItemDetailsByCategory() {
        try {
            Map<String, List<Map<String, String>>> result = new Map<String, List<Map<String, String>>>();

            for (Item_Configuration__mdt cfg : [
                SELECT MasterLabel, Item_Category__c, Size__c
                FROM Item_Configuration__mdt
                WHERE Item_Category__c != null
                ORDER BY Item_Category__c, MasterLabel
            ]) {
                if (!result.containsKey(cfg.Item_Category__c)) {
                    result.put(cfg.Item_Category__c, new List<Map<String, String>>());
                }

                result.get(cfg.Item_Category__c).add(new Map<String, String>{
                    'itemCode' => cfg.MasterLabel,
                    'size'     => cfg.Size__c == null ? '' : cfg.Size__c
                });
            }

            return result;
        } catch (Exception e) {
            throw new AuraHandledException('getItemDetailsByCategory: ' + e.getMessage());
        }
    }
    @AuraEnabled
    public static void revertProductionBatch(String batchId, String changedBy) {
        try {
            if (String.isBlank(batchId)) {
                throw new AuraHandledException('Batch Id is required.');
            }

            String actor = String.isNotBlank(changedBy) ? changedBy : UserInfo.getName();

            Production_Batch__c batch = [
                SELECT Id, Name, Order_IDs__c, Status__c
                FROM Production_Batch__c
                WHERE Id = :batchId
                LIMIT 1
            ];

            if (batch.Status__c != 'Sent to Production') {
                throw new AuraHandledException('Only active production batches can be reverted.');
            }

            List<String> orderIds = new List<String>();

            if (String.isNotBlank(batch.Order_IDs__c)) {
                List<Object> rawIds = (List<Object>) JSON.deserializeUntyped(batch.Order_IDs__c);
                for (Object o : rawIds) {
                    if (o != null && String.isNotBlank(String.valueOf(o))) {
                        orderIds.add(String.valueOf(o));
                    }
                }
            }

            if (orderIds.isEmpty()) {
                throw new AuraHandledException('No orders found for this production batch.');
            }

            List<Order_Stage_Log__c> ordersToUpdate = [
                SELECT Id, Order_ID_Ref__c, Current_Stage__c, Changed_By__c, Production_Batch_Ref__c
                FROM Order_Stage_Log__c
                WHERE Order_ID_Ref__c IN :orderIds
                AND Current_Stage__c = 'In Production'
            ];

            for (Order_Stage_Log__c osl : ordersToUpdate) {
                osl.Current_Stage__c = 'Bag Generate';
                osl.Changed_By__c = actor;
                osl.Production_Batch_Ref__c = null;
            }

            if (!ordersToUpdate.isEmpty()) {
                update ordersToUpdate;
            }

            delete batch;

        } catch (AuraHandledException e) {
            throw e;
        } catch (Exception e) {
            throw new AuraHandledException('revertProductionBatch: ' + e.getMessage());
        }
    }
    @AuraEnabled
    public static void updateInventorySize(String inventoryId, String size) {
        try {
            if (String.isBlank(inventoryId)) 
                throw new AuraHandledException('Inventory ID is required');
            
            List<Inventory__c> invList = [
                SELECT Id, Size__c FROM Inventory__c WHERE Id = :inventoryId LIMIT 1
            ];
            if (invList.isEmpty()) 
                throw new AuraHandledException('Inventory record not found');
            
            invList[0].Size__c = String.isBlank(size) ? null : size.trim();
            update invList[0];
            
        } catch (AuraHandledException e) { throw e; }
        catch (Exception e) { 
            throw new AuraHandledException('updateInventorySize: ' + e.getMessage()); 
        }
    }
    
    @AuraEnabled
    public static void deleteAnyOrderRecord(Id recordId) {
        try {
            if (recordId == null) {
                throw new AuraHandledException('Record Id is required.');
            }

            List<Order_Stage_Log__c> orders = [
                SELECT Id
                FROM Order_Stage_Log__c
                WHERE Id = :recordId
                LIMIT 1
            ];

            if (orders.isEmpty()) {
                throw new AuraHandledException('Order record not found.');
            }

            delete orders[0];

        } catch (AuraHandledException e) {
            throw e;
        } catch (Exception e) {
            throw new AuraHandledException('deleteAnyOrderRecord: ' + e.getMessage());
        }
    }
    private static String cleanSize(String sizeVal) {
        if (String.isBlank(sizeVal)) return null;

        String s = sizeVal.trim();

        if (
            s == '-' ||
            s == '—' ||
            s == '–' ||
            s == '--'
        ) {
            return null;
        }

        return s;
    }
}