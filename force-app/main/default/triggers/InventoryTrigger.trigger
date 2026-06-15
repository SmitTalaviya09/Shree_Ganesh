trigger InventoryTrigger on Inventory__c (after update) {
    if (Trigger.isAfter && Trigger.isUpdate) {
        InventoryTriggerHandler.deleteInventoryWhenQtyBecomesZero(
            Trigger.new,
            Trigger.oldMap
        );
    }
}