/*public class OrderStageLogTriggerHandler {

    public static void archiveAndDelete(List<Order_Stage_Log__c> records) {

        List<Map<String, Object>> archiveData = new List<Map<String, Object>>();

        for (Order_Stage_Log__c log : records) {
            archiveData.add(new Map<String, Object>{
                'orderId'        => log.Order_ID_Ref__c,
                'customerName'   => log.Customer_Name__c,
                'customerCode'   => log.Customer_Code__c,
                'customerMobile' => log.Customer_Mobile_No__c,
                'itemCode'       => log.Item_Code__c,
                'color'          => log.Color__c,
                'karat'          => log.Karat__c,
                'size'           => log.Size__c,
                'quantity'       => log.Quantity__c != null
                                        ? log.Quantity__c.intValue() : 0,
                'priority'       => log.Priority__c,
                'remark'         => log.Remark__c,
                'orderStatus'    => log.Current_Stage__c,
                'changedBy'      => log.Changed_By__c,
                'orderDate'      => log.Order_Date__c != null
                                        ? String.valueOf(log.Order_Date__c) : null,
                'orderDueDate'   => log.Order_Due_Date__c != null
                                        ? String.valueOf(log.Order_Due_Date__c) : null,
                'dispatchedQty'  => log.Dispatched_Qty__c != null
                                        ? log.Dispatched_Qty__c.intValue() : 0
            });
        }

        writeBigObjectsAsync(JSON.serialize(archiveData));

        try { delete records; }
        catch (Exception e) { System.debug('Delete failed: ' + e.getMessage()); }
    }

    @future
    public static void writeBigObjectsAsync(String archiveDataJson) {
        try {
            List<Object> items = (List<Object>) JSON.deserializeUntyped(archiveDataJson);

            for (Object item : items) {
                Map<String, Object> d = (Map<String, Object>) item;
                try {
                    JewelryOrder__b bo = new JewelryOrder__b();

                    bo.Order_ID__c           = (String) d.get('orderId');
                    bo.Customer_Name__c      = (String) d.get('customerName');
                    bo.Customer_Code__c      = (String) d.get('customerCode');
                    bo.Customer_Mobile_No__c = (String) d.get('customerMobile');
                    bo.Item_Code__c          = (String) d.get('itemCode');
                    bo.Color__c              = (String) d.get('color');
                    bo.Karat__c              = (String) d.get('karat');
                    bo.Size__c               = (String) d.get('size');
                    bo.Priority__c           = (String) d.get('priority');
                    bo.Remark__c             = (String) d.get('remark');
                    bo.Order_Status__c       = (String) d.get('orderStatus');
                    bo.Order_Created_By__c   = (String) d.get('changedBy');

                    bo.Quantity__c = d.get('quantity') != null
                        ? Integer.valueOf(String.valueOf(d.get('quantity'))) : 0;

                    bo.Dispatched_Quantity__c = d.get('dispatchedQty') != null
                        ? Integer.valueOf(String.valueOf(d.get('dispatchedQty'))) : 0;

                    String orderDateStr = (String) d.get('orderDate');
                    bo.Order_Date__c = String.isNotBlank(orderDateStr)
                        ? DateTime.valueOf(orderDateStr) : DateTime.now();

                    String dueDateStr = (String) d.get('orderDueDate');
                    bo.Order_Due_Date__c = String.isNotBlank(dueDateStr)
                        ? DateTime.valueOf(dueDateStr) : null;

                    // ✅ Set dispatch date for cleanup reference
                    bo.Order_Dispatch_Date__c = DateTime.now();

                    Database.insertImmediate(bo);

                } catch (Exception e) {
                    System.debug('Big Object write failed for '
                        + d.get('orderId') + ': ' + e.getMessage());
                }
            }
        } catch (Exception e) {
            System.debug('writeBigObjectsAsync failed: ' + e.getMessage());
        }
    }
}*/
public class OrderStageLogTriggerHandler {
    public static void archiveAndDelete(List<Order_Stage_Log__c> records) {

    List<Map<String, Object>> archiveData = new List<Map<String, Object>>();

    // Collect Ids for re-query
    List<Id> recordIds = new List<Id>();

    for (Order_Stage_Log__c log : records) {
        recordIds.add(log.Id); // collect IDs
        
        archiveData.add(new Map<String, Object>{
            'orderId'        => log.Order_ID_Ref__c,
            'customerName'   => log.Customer_Name__c,
            'customerCode'   => log.Customer_Code__c,
            'customerMobile' => log.Customer_Mobile_No__c,
            'itemCode'       => log.Item_Code__c,
            'color'          => log.Color__c,
            'karat'          => log.Karat__c,
            'size'           => log.Size__c,
            'quantity'       => log.Quantity__c != null
                                    ? log.Quantity__c.intValue() : 0,
            'priority'       => log.Priority__c,
            'remark'         => log.Remark__c,
            'orderStatus'    => log.Current_Stage__c,
            'changedBy'      => log.Changed_By__c,
            'orderDate'      => log.Order_Date__c != null
                                    ? String.valueOf(log.Order_Date__c) : null,
            'orderDueDate'   => log.Order_Due_Date__c != null
                                    ? String.valueOf(log.Order_Due_Date__c) : null,
            'dispatchedQty'  => log.Dispatched_Qty__c != null
                                    ? log.Dispatched_Qty__c.intValue() : 0
        });
    }

    // Pass both archiveData JSON and IDs to async method
    writeBigObjectsAsync(JSON.serialize(archiveData), JSON.serialize(recordIds));
}

@future
public static void writeBigObjectsAsync(String archiveDataJson, String recordIdsJson) {
    try {
        List<Object> items = (List<Object>) JSON.deserializeUntyped(archiveDataJson);

        for (Object item : items) {
            Map<String, Object> d = (Map<String, Object>) item;
            try {
                JewelryOrder__b bo = new JewelryOrder__b();

                bo.Order_ID__c           = (String) d.get('orderId');
                bo.Customer_Name__c      = (String) d.get('customerName');
                bo.Customer_Code__c      = (String) d.get('customerCode');
                bo.Customer_Mobile_No__c = (String) d.get('customerMobile');
                bo.Item_Code__c          = (String) d.get('itemCode');
                bo.Color__c              = (String) d.get('color');
                bo.Karat__c              = (String) d.get('karat');
                bo.Size__c               = (String) d.get('size');
                bo.Priority__c           = (String) d.get('priority');
                bo.Remark__c             = (String) d.get('remark');
                bo.Order_Status__c       = (String) d.get('orderStatus');
                bo.Order_Created_By__c   = (String) d.get('changedBy');

                bo.Quantity__c = d.get('quantity') != null
                    ? Integer.valueOf(String.valueOf(d.get('quantity'))) : 0;

                bo.Dispatched_Quantity__c = d.get('dispatchedQty') != null
                    ? Integer.valueOf(String.valueOf(d.get('dispatchedQty'))) : 0;

                String orderDateStr = (String) d.get('orderDate');
                bo.Order_Date__c = String.isNotBlank(orderDateStr)
                    ? DateTime.valueOf(orderDateStr) : DateTime.now();

                String dueDateStr = (String) d.get('orderDueDate');
                bo.Order_Due_Date__c = String.isNotBlank(dueDateStr)
                    ? DateTime.valueOf(dueDateStr) : null;

                bo.Order_Dispatch_Date__c = DateTime.now();

                Database.insertImmediate(bo);

            } catch (Exception e) {
                System.debug('Big Object write failed for '
                    + d.get('orderId') + ': ' + e.getMessage());
            }
        }

        // ✅ Re-query by Id so DML is NOT on trigger.new
        List<Id> ids = (List<Id>) JSON.deserialize(recordIdsJson, List<Id>.class);
        List<Order_Stage_Log__c> toDelete = [
            SELECT Id FROM Order_Stage_Log__c WHERE Id IN :ids
        ];
        
        if (!toDelete.isEmpty()) {
            delete toDelete;
        }

    } catch (Exception e) {
        System.debug('writeBigObjectsAsync failed: ' + e.getMessage());
    }
}
}