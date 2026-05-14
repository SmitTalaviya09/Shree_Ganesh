global class OrderDataCleanupScheduler implements Schedulable {

    private String jobType;

    global OrderDataCleanupScheduler(String jobType) {
        this.jobType = jobType;
    }

    global void execute(SchedulableContext sc) {
        if (jobType == 'REJECTED_ORDERS') {
            Database.executeBatch(
                new OrderDataCleanupBatch('REJECTED_ORDERS'), 200
            );
        } else {
            // ✅ Big Object cleanup — call directly, no batch needed
            OrderDataCleanupBatch.cleanupBigObjects();
        }
    }
}