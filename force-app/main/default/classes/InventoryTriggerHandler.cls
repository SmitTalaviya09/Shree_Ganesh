public class InventoryTriggerHandler {

    public static void deleteInventoryWhenQtyBecomesZero(
        List<Inventory__c> newList,
        Map<Id, Inventory__c> oldMap
    ) {
        List<Inventory__c> inventoryToDelete = new List<Inventory__c>();

        for (Inventory__c newInv : newList) {
            Inventory__c oldInv = oldMap.get(newInv.Id);

            if (oldInv == null) {
                continue;
            }

            Boolean inchesBecameZero = oldInv.Available_Inches__c != null
                && oldInv.Available_Inches__c > 0
                && (newInv.Available_Inches__c == null || newInv.Available_Inches__c == 0);

            Boolean pairBecameZero = oldInv.Available_Pair__c != null
                && oldInv.Available_Pair__c > 0
                && (newInv.Available_Pair__c == null || newInv.Available_Pair__c == 0);

            Boolean qtyBecameZero = oldInv.Available_Qty__c != null
                && oldInv.Available_Qty__c > 0
                && (newInv.Available_Qty__c == null || newInv.Available_Qty__c == 0);

            if (inchesBecameZero || pairBecameZero || qtyBecameZero) {
                inventoryToDelete.add(new Inventory__c(Id = newInv.Id));
            }
        }

        if (!inventoryToDelete.isEmpty()) {
            delete inventoryToDelete;
        }
    }
}