public class OrderStageLogBackup implements Schedulable {
    
    static final String APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzXQL5osV7nVD9qHZWkv_rajjnxpNpb0D2Q-b9yMN-R7vqSIuAFwNtERT5k2ShxbHns8A/exec'; // keep your existing URL
    static final String SECRET = 'sfbackup2026';
    
    public void execute(SchedulableContext sc) {
        backupToDrive();
    }
    
    @future(callout=true)
    public static void backupToDrive() {
        List<String> lines = new List<String>();
        String today = Date.today().format().replace('/','_');
        
        // ==========================================
        // SECTION 1: Order_Stage_Log__c
        // ==========================================
        lines.add('===== Order Stage Log =====');
        lines.add(
            'Id,OwnerId,Name,CreatedDate,LastModifiedDate,' +
            'Order_ID_Ref__c,Customer_Name__c,Current_Stage__c,' +
            'Changed_By__c,Color__c,Order_Date__c,Priority__c,' +
            'Quantity__c,Remark__c,Size__c,Customer_Mobile_No__c,' +
            'Dispatch_Status__c,Dispatched_Qty__c,Production_Batch_Ref__c,' +
            'Customer_Code__c,Item_Code__c,Fulfilled_Qty__c,Pending_Qty__c,' +
            'Order_Due_Date__c,Karat__c,Quantity_Unit__c,'+
            'Rejection_Reason__c,Customer_GST_Number__c,Item_Category__c'
        );
        
        for (Order_Stage_Log__c r : [
            SELECT Id, OwnerId, Name, CreatedDate, LastModifiedDate,
                   Order_ID_Ref__c, Customer_Name__c, Current_Stage__c,
                   Changed_By__c, Color__c, Order_Date__c, Priority__c,
                   Quantity__c, Remark__c, Size__c, Customer_Mobile_No__c,
                   Dispatch_Status__c, Dispatched_Qty__c, Production_Batch_Ref__c,
                   Customer_Code__c, Item_Code__c, Fulfilled_Qty__c, Pending_Qty__c,
                   Order_Due_Date__c, Karat__c, Quantity_Unit__c,
            	   Rejection_Reason__c,Customer_GST_Number__c,Item_Category__c
            FROM Order_Stage_Log__c
        ]) {
            lines.add(
                esc(r.Id) + ',' +
                esc(r.OwnerId) + ',' +
                esc(r.Name) + ',' +
                esc(str(r.CreatedDate)) + ',' +
                esc(str(r.LastModifiedDate)) + ',' +
                esc(r.Order_ID_Ref__c) + ',' +
                esc(r.Customer_Name__c) + ',' +
                esc(r.Current_Stage__c) + ',' +
                esc(r.Changed_By__c) + ',' +
                esc(r.Color__c) + ',' +
                esc(str(r.Order_Date__c)) + ',' +
                esc(r.Priority__c) + ',' +
                esc(str(r.Quantity__c)) + ',' +
                esc(r.Remark__c) + ',' +
                esc(r.Size__c) + ',' +
                esc(r.Customer_Mobile_No__c) + ',' +
                esc(r.Dispatch_Status__c) + ',' +
                esc(str(r.Dispatched_Qty__c)) + ',' +
                esc(r.Production_Batch_Ref__c) + ',' +
                esc(r.Customer_Code__c) + ',' +
                esc(r.Item_Code__c) + ',' +
                esc(str(r.Fulfilled_Qty__c)) + ',' +
                esc(str(r.Pending_Qty__c)) + ',' +
                esc(str(r.Order_Due_Date__c)) + ',' +
                esc(r.Karat__c) + ',' +
                esc(r.Quantity_Unit__c) + ',' +
                esc(r.Rejection_Reason__c) + ',' +
                esc(r.Customer_GST_Number__c) + ',' +
                esc(r.Item_Category__c) 
            );
        }
        
        // blank line between sections
        lines.add('');
        
        // ==========================================
        // SECTION 2: Inventory__c
        // ==========================================
        lines.add('===== Inventory =====');
        lines.add(
            'Id,OwnerId,IsDeleted,Name,CreatedDate,CreatedById,' +
            'LastModifiedDate,LastModifiedById,SystemModstamp,' +
            'LastViewedDate,LastReferencedDate,Available_Qty__c,' +
            'Color__c,Item_Code__c,Karat__c,Size__c,' +
            'Available_Grams__c,Available_Inches__c,Available_Pair__c'
        );
        
        for (Inventory__c r : [
            SELECT Id, OwnerId, IsDeleted, Name, CreatedDate, CreatedById,
                   LastModifiedDate, LastModifiedById, SystemModstamp,
                   LastViewedDate, LastReferencedDate, Available_Qty__c,
                   Color__c, Item_Code__c, Karat__c, Size__c,
                   Available_Grams__c, Available_Inches__c, Available_Pair__c
            FROM Inventory__c
        ]) {
            lines.add(
                esc(r.Id) + ',' +
                esc(r.OwnerId) + ',' +
                esc(str(r.IsDeleted)) + ',' +
                esc(r.Name) + ',' +
                esc(str(r.CreatedDate)) + ',' +
                esc(r.CreatedById) + ',' +
                esc(str(r.LastModifiedDate)) + ',' +
                esc(r.LastModifiedById) + ',' +
                esc(str(r.SystemModstamp)) + ',' +
                esc(str(r.LastViewedDate)) + ',' +
                esc(str(r.LastReferencedDate)) + ',' +
                esc(str(r.Available_Qty__c)) + ',' +
                esc(r.Color__c) + ',' +
                esc(r.Item_Code__c) + ',' +
                esc(r.Karat__c) + ',' +
                esc(r.Size__c) + ',' +
                esc(str(r.Available_Grams__c)) + ',' +
                esc(str(r.Available_Inches__c)) + ',' +
                esc(str(r.Available_Pair__c))
            );
        }
        
        lines.add('');
        
        // ==========================================
        // SECTION 3: Production_Batch__c
        // ==========================================
        lines.add('===== Production Batch =====');
        lines.add(
            'Id,OwnerId,IsDeleted,Name,CreatedDate,CreatedById,' +
            'LastModifiedDate,LastModifiedById,SystemModstamp,' +
            'LastViewedDate,LastReferencedDate,Buffer_Qty__c,' +
            'Color__c,Item_Code__c,Karat__c,Order_IDs__c,' +
            'Order_Qty__c,Slip_Printed__c,Status__c,Total_Qty__c,' +
            'Item_Details__c,Slip_Title__c,Quantity_Unit__c,Special_Item_Category__c'
        );
        
        for (Production_Batch__c r : [
            SELECT Id, OwnerId, IsDeleted, Name, CreatedDate, CreatedById,
                   LastModifiedDate, LastModifiedById, SystemModstamp,
                   LastViewedDate, LastReferencedDate, Buffer_Qty__c,
                   Color__c, Item_Code__c, Karat__c, Order_IDs__c,
                   Order_Qty__c, Slip_Printed__c, Status__c, Total_Qty__c,
                   Item_Details__c, Slip_Title__c, Quantity_Unit__c,Special_Item_Category__c
            FROM Production_Batch__c
        ]) {
            lines.add(
                esc(r.Id) + ',' +
                esc(r.OwnerId) + ',' +
                esc(str(r.IsDeleted)) + ',' +
                esc(r.Name) + ',' +
                esc(str(r.CreatedDate)) + ',' +
                esc(r.CreatedById) + ',' +
                esc(str(r.LastModifiedDate)) + ',' +
                esc(r.LastModifiedById) + ',' +
                esc(str(r.SystemModstamp)) + ',' +
                esc(str(r.LastViewedDate)) + ',' +
                esc(str(r.LastReferencedDate)) + ',' +
                esc(str(r.Buffer_Qty__c)) + ',' +
                esc(r.Color__c) + ',' +
                esc(r.Item_Code__c) + ',' +
                esc(r.Karat__c) + ',' +
                esc(r.Order_IDs__c) + ',' +
                esc(str(r.Order_Qty__c)) + ',' +
                esc(str(r.Slip_Printed__c)) + ',' +
                esc(r.Status__c) + ',' +
                esc(str(r.Total_Qty__c)) + ',' +
                esc(r.Item_Details__c) + ',' +
                esc(r.Slip_Title__c) + ',' +
                esc(r.Quantity_Unit__c) + ',' +
                esc(str(r.Special_Item_Category__c))
            );
        }
        
        // ==========================================
        // SECTION 4: Client_Registration__c
        // ==========================================
        lines.add('');
        lines.add('===== Client Registration =====');
        
        lines.add(
            'Id,OwnerId,IsDeleted,Name,CreatedDate,CreatedById,' +
            'LastModifiedDate,LastModifiedById,SystemModstamp,' +
            'LastViewedDate,LastReferencedDate,GST_Number__c,' +
            'Client_Name__c,Client_Mobile__c,Customer_Code__c '
        );
        
        for (Client_Registration__c r : [
            SELECT Id, OwnerId, IsDeleted, Name, CreatedDate, CreatedById,
            LastModifiedDate, LastModifiedById, SystemModstamp,
            LastViewedDate, LastReferencedDate, GST_Number__c,
            Client_Name__c, Client_Mobile__c,Customer_Code__c 
            FROM Client_Registration__c
        ]) {
            lines.add(
                esc(r.Id) + ',' +
                esc(r.OwnerId) + ',' +
                esc(str(r.IsDeleted)) + ',' +
                esc(r.Name) + ',' +
                esc(str(r.CreatedDate)) + ',' +
                esc(r.CreatedById) + ',' +
                esc(str(r.LastModifiedDate)) + ',' +
                esc(r.LastModifiedById) + ',' +
                esc(str(r.SystemModstamp)) + ',' +
                esc(str(r.LastViewedDate)) + ',' +
                esc(str(r.LastReferencedDate)) + ',' +
                esc(r.GST_Number__c) + ',' +
                esc(r.Client_Name__c) + ',' +
                esc(r.Client_Mobile__c) + ',' +
                esc(r.Customer_Code__c )
            );
        }
        
        
        // ==========================================
        // SECTION 5: JwelUser__c
        // ==========================================
        lines.add('');
        lines.add('===== Jwel Users =====');
        
        lines.add(
            'Id,OwnerId,IsDeleted,Name,CreatedDate,CreatedById,' +
            'LastModifiedDate,LastModifiedById,SystemModstamp,' +
            'LastViewedDate,LastReferencedDate,Is_Active__c,' +
            'Last_Login__c,Login_ID__c,Password__c,Role__c'
        );
        
        for (JwelUser__c r : [
            SELECT Id, OwnerId, IsDeleted, Name, CreatedDate, CreatedById,
            LastModifiedDate, LastModifiedById, SystemModstamp,
            LastViewedDate, LastReferencedDate, Is_Active__c,
            Last_Login__c, Login_ID__c, Password__c, Role__c
            FROM JwelUser__c
        ]) {
            lines.add(
                esc(r.Id) + ',' +
                esc(r.OwnerId) + ',' +
                esc(str(r.IsDeleted)) + ',' +
                esc(r.Name) + ',' +
                esc(str(r.CreatedDate)) + ',' +
                esc(r.CreatedById) + ',' +
                esc(str(r.LastModifiedDate)) + ',' +
                esc(r.LastModifiedById) + ',' +
                esc(str(r.SystemModstamp)) + ',' +
                esc(str(r.LastViewedDate)) + ',' +
                esc(str(r.LastReferencedDate)) + ',' +
                esc(str(r.Is_Active__c)) + ',' +
                esc(str(r.Last_Login__c)) + ',' +
                esc(r.Login_ID__c) + ',' +
                esc(r.Password__c) + ',' +
                esc(r.Role__c)
            );
        }
        
        // Final CSV string
        String csvContent = String.join(lines, '\n');
        String fileName = 'SalesforceBackup_' + today + '.csv';
        
        // Send to Apps Script
        Map<String,String> payload = new Map<String,String>{
            'secret'   => SECRET,
            'csv'      => csvContent,
            'fileName' => fileName
        };
        
        HttpRequest req = new HttpRequest();
        req.setEndpoint(APPS_SCRIPT_URL);
        req.setMethod('POST');
        req.setHeader('Content-Type', 'application/json');
        req.setBody(JSON.serialize(payload));
        req.setTimeout(120000);
        
        HttpResponse res = new Http().send(req);
        System.debug('Status: ' + res.getStatusCode());
        System.debug('Response: ' + res.getBody());
        
        if (res.getStatusCode() == 200 || res.getStatusCode() == 302) {
            System.debug('SUCCESS! File: ' + fileName);
        } else {
            System.debug('ERROR: ' + res.getBody());
        }
    }
    
    private static String esc(String val) {
        if (val == null) return '';
        if (val.contains(',') || val.contains('"') || val.contains('\n')) {
            return '"' + val.replace('"', '""') + '"';
        }
        return val;
    }
    
    private static String str(Object val) {
        return val == null ? '' : String.valueOf(val);
    }
}