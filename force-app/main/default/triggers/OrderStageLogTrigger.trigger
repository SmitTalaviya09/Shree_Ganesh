trigger OrderStageLogTrigger on Order_Stage_Log__c (after update) {

    List<Order_Stage_Log__c> toArchive = new List<Order_Stage_Log__c>();

    for (Order_Stage_Log__c newRec : Trigger.new) {
        Order_Stage_Log__c oldRec = Trigger.oldMap.get(newRec.Id);
        String newStage = newRec.Current_Stage__c;
        String oldStage = oldRec.Current_Stage__c;

        // Fire only when stage changes TO Completed or Cancelled
        if ((newStage == 'Completed' || newStage == 'Cancelled') && newStage != oldStage) {
            toArchive.add(newRec);
        }
    }

    if (!toArchive.isEmpty()) {
        OrderStageLogTriggerHandler.archiveAndDelete(toArchive);
    }
}