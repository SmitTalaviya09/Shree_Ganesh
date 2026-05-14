global class OrderDataCleanupBatch implements Database.Batchable<SObject>, Database.Stateful {
    
    // ── Which job to run ──
    private String jobType; // 'REJECTED_ORDERS' or 'BIG_OBJECT_CLEANUP'
    
    global OrderDataCleanupBatch(String jobType) {
        this.jobType = jobType;
    }
    
    global Database.QueryLocator start(Database.BatchableContext bc) {
        if (jobType == 'REJECTED_ORDERS') {
            Date cutoff = Date.today().addDays(-2);
            return Database.getQueryLocator([
                SELECT Id, Order_ID_Ref__c, Current_Stage__c, LastModifiedDate
                FROM Order_Stage_Log__c
                WHERE Current_Stage__c = 'Rejected'
                AND DAY_ONLY(LastModifiedDate) <= :cutoff 
            ]); 
        } else {
            // ✅ BIG_OBJECT_CLEANUP — return single dummy record
            // Real cleanup happens in execute() via cleanupBigObjects()
            return Database.getQueryLocator([
                SELECT Id
                FROM Order_Stage_Log__c
                LIMIT 1
            ]);
        }
    }
    
    global void execute(Database.BatchableContext bc, List<SObject> scope) {
        if (jobType == 'REJECTED_ORDERS') {
            List<Order_Stage_Log__c> toDelete = (List<Order_Stage_Log__c>) scope;
            if (!toDelete.isEmpty()) {
                try {
                    delete toDelete;
                } catch (Exception e) {
                    System.debug('Rejected order delete failed: ' + e.getMessage());
                }
            }
        } else {
            // ✅ Big Object cleanup runs once in execute
            OrderDataCleanupBatch.cleanupBigObjects();
        }
    }
    
    global void finish(Database.BatchableContext bc) {
        System.debug(jobType + ' batch completed.');
    }
    
    // ✅ Big Object cleanup — delete records older than 10 days
    // Big Objects use Database.deleteImmediate with the unique key
    /*public static void cleanupBigObjects() {
try {
DateTime cutoff = DateTime.now().addDays(-1);

// ✅ Query Big Object WITHOUT date filter
// Big Objects only allow filtering on indexed fields
// So fetch all and filter in Apex
List<JewelryOrder__b> allRecords = [
SELECT Order_ID__c, Order_Dispatch_Date__c
FROM JewelryOrder__b
LIMIT 2000
];

List<JewelryOrder__b> toDelete = new List<JewelryOrder__b>();

for (JewelryOrder__b bo : allRecords) {
// ✅ Filter in Apex — not in SOQL
if (bo.Order_Dispatch_Date__c != null
&& bo.Order_Dispatch_Date__c <= cutoff) {
toDelete.add(bo);
}
}

for (JewelryOrder__b bo : toDelete) {
try {
Database.deleteImmediate(bo);
} catch (Exception e) {
System.debug('Big Object delete failed for '
+ bo.Order_ID__c + ': ' + e.getMessage());
}
}

System.debug('Big Object cleanup: deleted '
+ toDelete.size() + ' records older than 10 days');

} catch (Exception e) {
System.debug('cleanupBigObjects failed: ' + e.getMessage());
}
}*/
    public static void cleanupBigObjects() {
        try {
            DateTime cutoff = DateTime.now().addDays(-10);
            
            List<JewelryOrder__b> allRecords = [
                SELECT Order_ID__c, Order_Dispatch_Date__c
                FROM JewelryOrder__b
                LIMIT 2000
            ];
            
            Integer deletedCount = 0;
            
            for (JewelryOrder__b bo : allRecords) {
                if (bo.Order_Dispatch_Date__c != null &&
                    bo.Order_Dispatch_Date__c <= cutoff) {
                        
                        // ✅ Use different variable name
                        JewelryOrder__b boToDelete = new JewelryOrder__b(
                            Order_ID__c = bo.Order_ID__c
                        );
                        
                        try {
                            Database.deleteImmediate(boToDelete);
                            deletedCount++;
                        } catch (Exception e) {
                            System.debug('Big Object delete failed for '
                                         + bo.Order_ID__c + ': ' + e.getMessage());
                        }
                    }
            }
            
            System.debug('Big Object cleanup: deleted '
                         + deletedCount + ' records older than cutoff');
            
        } catch (Exception e) {
            System.debug('cleanupBigObjects failed: ' + e.getMessage());
        }
    }
    
}