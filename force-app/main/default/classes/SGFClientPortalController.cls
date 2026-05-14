public without sharing class SGFClientPortalController {

    // ════════════════════════════════════════════════════════════
    // VERIFY CLIENT — check GST + Mobile against Client_Registration__c
    // Returns client record if found, null if not
    // ════════════════════════════════════════════════════════════
    @AuraEnabled
    public static Map<String, Object> verifyClient(String gstNumber, String mobileNo) {
        try {
            if (String.isBlank(gstNumber) || String.isBlank(mobileNo))
                throw new AuraHandledException('GST Number and Mobile are required');

            String cleanGst    = gstNumber.trim();
            String cleanMobile = mobileNo.trim();

            List<Client_Registration__c> clients = [
                SELECT Id, Client_Name__c, GST_Number__c, Client_Mobile__c
                FROM Client_Registration__c
                WHERE GST_Number__c   = :cleanGst
                AND   Client_Mobile__c = :cleanMobile
                LIMIT 1
            ];

            if (clients.isEmpty()) {
                return new Map<String, Object>{
                    'verified'    => false,
                    'clientName'  => '',
                    'clientId'    => '',
                    'message'     => 'You are not authorized to place orders. Please contact Shree Ganesh Finding.'
                };
            }

            return new Map<String, Object>{
                'verified'    => true,
                'clientName'  => clients[0].Client_Name__c,
                'clientId'    => clients[0].Id,
                'gstNumber'   => clients[0].GST_Number__c,
                'mobileNo'    => clients[0].Client_Mobile__c,
                'message'     => ''
            };
        } catch (AuraHandledException e) { throw e; }
        catch (Exception e) {
            throw new AuraHandledException('verifyClient: ' + e.getMessage());
        }
    }

    // ════════════════════════════════════════════════════════════
    // PLACE CLIENT ORDERS
    // Same flow as internal placeOrders but sets stage = 'Client New'
    // customerCode = GST Number, customerMobile = mobile
    // ════════════════════════════════════════════════════════════
    @AuraEnabled
    public static List<String> placeClientOrders(
            String  clientName,
            String  gstNumber,
            String  mobileNo,
            List<Map<String, Object>> orderLines) {
        try {
            if (String.isBlank(clientName))
                throw new AuraHandledException('Client name is required');
            if (orderLines == null || orderLines.isEmpty())
                throw new AuraHandledException('At least one order line is required');

            List<String> orderIds = new List<String>();
            List<Order_Stage_Log__c> logs = new List<Order_Stage_Log__c>();
 
            for (Map<String, Object> line : orderLines) {
                String  itemCode = (String)  line.get('itemCode');
                String  color    = (String)  line.get('color');
                String  karat    = (String)  line.get('karat');
                String  size     = (String)  line.get('size');
                String  qtyUnit  = (String)  line.get('qtyUnit');
                Decimal quantity = line.get('quantity') != null
                    ? Decimal.valueOf(String.valueOf(line.get('quantity'))) : 0;
                String  priority = (String)  line.get('priority');
                String  dueDate  = (String)  line.get('dueDate');
                String  remark   = (String)  line.get('remark');
                String  category = (String)  line.get('category');

                if (String.isBlank(itemCode) || quantity <= 0) continue;

                // Generate order ID
                String orderId = generateOrderId();
                orderIds.add(orderId);

                logs.add(new Order_Stage_Log__c(
                    Order_ID_Ref__c       = orderId,
                    Customer_Name__c      = clientName,
                    //Customer_Code__c      = gstNumber  != null ? gstNumber  : '',
                    Customer_GST_Number__c = gstNumber  != null ? gstNumber  : '',
                    Customer_Mobile_No__c = mobileNo   != null ? mobileNo   : '',
                    Item_Code__c          = itemCode,
                    Color__c              = color       != null ? color       : '',
                    Karat__c              = karat       != null ? karat       : '',
                    Size__c               = size        != null ? size        : '',
                    Quantity__c           = quantity,
                    Quantity_Unit__c      = qtyUnit     != null ? qtyUnit     : 'Pieces',
                    Priority__c           = priority    != null ? priority    : 'Medium',
                    Order_Date__c         = Date.today(),
                    Order_Due_Date__c     = String.isNotBlank(dueDate)
                                            ? Date.valueOf(dueDate) : null,
                    Remark__c             = remark      != null ? remark      : '',
                    Current_Stage__c      = 'Client New',   // <-- new stage
                    Item_Category__c      = category    != null ? category    : '',
                    Changed_By__c         = 'Client Portal',
                    Fulfilled_Qty__c      = 0
                ));
            }

            if (!logs.isEmpty()) insert logs;
            return orderIds;

        } catch (AuraHandledException e) { throw e; }
        catch (Exception e) {
            throw new AuraHandledException('placeClientOrders: ' + e.getMessage());
        }
    }

    // ════════════════════════════════════════════════════════════
    // GET PICKLIST VALUES — item codes, karats, qty units
    // ════════════════════════════════════════════════════════════
    @AuraEnabled(cacheable=true)
    public static Map<String, Object> getClientPicklistValues() {
        try {
            // Item codes from global value set
            List<String> itemCodes = new List<String>();
            Schema.DescribeFieldResult itemField =
                Order_Stage_Log__c.Item_Code__c.getDescribe();
            for (Schema.PicklistEntry e : itemField.getPicklistValues()) {
                if (e.isActive()) itemCodes.add(e.getValue());
            }

            // Karat values
            List<String> karats = new List<String>();
            Schema.DescribeFieldResult karatField =
                Order_Stage_Log__c.Karat__c.getDescribe();
            for (Schema.PicklistEntry e : karatField.getPicklistValues()) {
                if (e.isActive()) karats.add(e.getValue());
            }

            // Qty units
            List<String> units = new List<String>{ 'Pieces', 'Inches', 'Grams', 'Pair' };

            return new Map<String, Object>{
                'itemCodes'   => itemCodes,
                'karatValues' => karats,
                'qtyUnits'    => units
            };
        } catch (Exception e) {
            throw new AuraHandledException('getClientPicklistValues: ' + e.getMessage());
        }
    }

    // ════════════════════════════════════════════════════════════
    // GET MEASUREMENT TYPES — same as internal
    // ════════════════════════════════════════════════════════════
    @AuraEnabled(cacheable=true)
    public static Map<String, String> getClientItemMeasurementTypes(List<String> itemCodes) {
        try {
            Map<String, String> result = new Map<String, String>();
            for (Item_Configuration__mdt cfg : [
                SELECT MasterLabel, Measurement_Type__c
                FROM Item_Configuration__mdt
                WHERE MasterLabel IN :itemCodes
            ]) {
                result.put(cfg.MasterLabel, cfg.Measurement_Type__c);
            }
            for (String ic : itemCodes) {
                if (!result.containsKey(ic)) result.put(ic, 'Quantity');
            }
            return result;
        } catch (Exception e) {
            throw new AuraHandledException('getClientItemMeasurementTypes: ' + e.getMessage());
        }
    }

    // ════════════════════════════════════════════════════════════
    // NOTIFY INTERNAL — Platform Event to trigger real-time badge
    // ════════════════════════════════════════════════════════════
    @AuraEnabled
    public static Integer getClientNewOrderCount() {
        try {
            return [
                SELECT COUNT()
                FROM Order_Stage_Log__c
                WHERE Current_Stage__c = 'Client New'
            ];
        } catch (Exception e) {
            throw new AuraHandledException('getClientNewOrderCount: ' + e.getMessage());
        }
    }

    private static String generateOrderId() {
        String chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        String id    = '';
        for (Integer i = 0; i < 8; i++) {
            Integer idx = Math.mod(Math.abs(Crypto.getRandomInteger()), 36);
            id += chars.substring(idx, idx + 1);
        }
        return 'CO-' + id;   // CO = Client Order prefix
    }
    @AuraEnabled
    public static List<Client_Registration__c> getAllClientRegistrations() {
        try {
            return [
                SELECT Id, Name, Client_Name__c, GST_Number__c, Client_Mobile__c,
                       CreatedDate,Customer_Code__c
                FROM Client_Registration__c
                ORDER BY CreatedDate DESC
                LIMIT 500
            ];
        } catch (Exception e) {
            throw new AuraHandledException('getAllClientRegistrations: ' + e.getMessage());
        }
    }

    @AuraEnabled
    public static String saveClientRegistration(
            String recordId,
            String clientName,
            String gstNumber,
            String mobileNo,
            String customerCode) {
        try {
            if (String.isBlank(clientName))
                throw new AuraHandledException('Client Name is required');
            if (String.isBlank(gstNumber))
                throw new AuraHandledException('GST Number is required');
            if (String.isBlank(mobileNo))
                throw new AuraHandledException('Mobile Number is required');
            if (String.isBlank(customerCode)) {
                throw new AuraHandledException('Customer Code is required');
            }

            if (String.isNotBlank(recordId)) {
                // Update
                Client_Registration__c rec = [
                    SELECT Id FROM Client_Registration__c WHERE Id = :recordId LIMIT 1
                ];
                rec.Client_Name__c   = clientName.trim();
                rec.GST_Number__c    = gstNumber.trim();
                rec.Client_Mobile__c = mobileNo.trim();
                rec.Customer_Code__c = customerCode.trim();
                update rec;
                return rec.Id;
            } else {
                // Insert
                Client_Registration__c rec = new Client_Registration__c(
                    Client_Name__c   = clientName.trim(),
                    GST_Number__c    = gstNumber.trim(),
                    Client_Mobile__c = mobileNo.trim(),
                    Customer_Code__c = customerCode.trim()
                );
                insert rec;
                return rec.Id;
            }
        } catch (AuraHandledException e) { throw e; }
        catch (Exception e) {
            throw new AuraHandledException('saveClientRegistration: ' + e.getMessage());
        }
    }

    @AuraEnabled
    public static void deleteClientRegistration(String recordId) {
        try {
            delete [SELECT Id FROM Client_Registration__c WHERE Id = :recordId LIMIT 1];
        } catch (Exception e) {
            throw new AuraHandledException('deleteClientRegistration: ' + e.getMessage());
        }
    }

    @AuraEnabled
    public static List<Order_Stage_Log__c> getClientNewOrders() {
        try {
            return [
                SELECT Id, Order_ID_Ref__c, Customer_Name__c, Customer_Code__c,
                       Customer_Mobile_No__c, Item_Code__c, Color__c, Karat__c,
                       Size__c, Quantity__c, Quantity_Unit__c, Priority__c,
                       Remark__c, Order_Date__c, Order_Due_Date__c,
                       Current_Stage__c, Rejection_Reason__c, Changed_By__c
                FROM Order_Stage_Log__c
                WHERE Current_Stage__c = 'Client New'
                ORDER BY Order_Date__c ASC
                LIMIT 500
            ];
        } catch (Exception e) {
            throw new AuraHandledException('getClientNewOrders: ' + e.getMessage());
        }
    }

    // ════════════════════════════════════════════════════════════
    // ACCEPT ORDER — moves Client New → New
    // ════════════════════════════════════════════════════════════
    @AuraEnabled
    public static void acceptClientOrder(String orderId, String changedBy, 
                                        String newSize, String newRemark) {
        try {
            List<Order_Stage_Log__c> logs = [
                SELECT Id, Current_Stage__c, Changed_By__c, Size__c, Remark__c
                FROM Order_Stage_Log__c
                WHERE Order_ID_Ref__c = :orderId LIMIT 1
            ];
            if (logs.isEmpty())
                throw new AuraHandledException('Order not found: ' + orderId);

            logs[0].Current_Stage__c    = 'New';
            logs[0].Changed_By__c       = String.isNotBlank(changedBy) 
                                            ? changedBy : UserInfo.getName();
            logs[0].Rejection_Reason__c = null;

            // Always write size — if blank, clears it; if filled, updates it
            if (newSize != null) {
                logs[0].Size__c = String.isNotBlank(newSize) ? newSize.trim() : null;
            }
            if (newRemark != null) {
                logs[0].Remark__c = String.isNotBlank(newRemark) ? newRemark.trim() : null;
            }

            update logs[0];
        } catch (AuraHandledException e) { throw e; }
        catch (Exception e) {
            throw new AuraHandledException('acceptClientOrder: ' + e.getMessage());
        }
    }

    // ════════════════════════════════════════════════════════════
    // REJECT ORDER — moves Client New → Rejected, saves reason
    // ════════════════════════════════════════════════════════════
    // @AuraEnabled
    // public static void rejectClientOrder(String orderId, String reason, String changedBy) {
    //     try {
    //         if (String.isBlank(reason))
    //             throw new AuraHandledException('Rejection reason is required');
    //         List<Order_Stage_Log__c> logs = [
    //             SELECT Id, Current_Stage__c, Changed_By__c, Rejection_Reason__c
    //             FROM Order_Stage_Log__c
    //             WHERE Order_ID_Ref__c = :orderId LIMIT 1
    //         ];
    //         if (logs.isEmpty())
    //             throw new AuraHandledException('Order not found: ' + orderId);
    //         logs[0].Current_Stage__c    = 'Rejected';
    //         logs[0].Rejection_Reason__c = reason.trim();
    //         logs[0].Changed_By__c       = String.isNotBlank(changedBy) ? changedBy : UserInfo.getName();
    //         update logs[0];
    //     } catch (AuraHandledException e) { throw e; }
    //     catch (Exception e) {
    //         throw new AuraHandledException('rejectClientOrder: ' + e.getMessage());
    //     }
    // }
    @AuraEnabled
    public static void rejectClientOrder(String orderId, String reason, String changedBy) {
        try {
            List<Order_Stage_Log__c> logs = [
                SELECT Id, Current_Stage__c, Changed_By__c, Rejection_Reason__c
                FROM Order_Stage_Log__c
                WHERE Order_ID_Ref__c = :orderId LIMIT 1
            ];

            if (logs.isEmpty())
                throw new AuraHandledException('Order not found: ' + orderId);

            logs[0].Current_Stage__c = 'Rejected';
            logs[0].Rejection_Reason__c = String.isNotBlank(reason) 
                ? reason.trim() 
                : null;  // or '' if you prefer

            logs[0].Changed_By__c = String.isNotBlank(changedBy) 
                ? changedBy 
                : UserInfo.getName();

            update logs[0];

        } catch (AuraHandledException e) {
            throw e;
        } catch (Exception e) {
            throw new AuraHandledException('rejectClientOrder: ' + e.getMessage());
        }
    }

    // ════════════════════════════════════════════════════════════
    // GET CLIENT ORDERS — for client portal My Orders tab
    // Matches by GST number (stored as Customer_Code__c) + mobile
    // Returns ONLY Accepted (any stage except Client New/Rejected)
    // and Rejected orders — with rejection reason
    // ════════════════════════════════════════════════════════════
    @AuraEnabled
    public static List<Order_Stage_Log__c> getMyOrders(String gstNumber, String mobileNo) {
        try {
            if (String.isBlank(gstNumber) || String.isBlank(mobileNo))
                throw new AuraHandledException('GST and mobile required');
            return [
                SELECT Id, Order_ID_Ref__c, Item_Code__c, Color__c, Karat__c,
                       Size__c, Quantity__c, Quantity_Unit__c, Priority__c,
                       Remark__c, Order_Date__c, Order_Due_Date__c,
                       Current_Stage__c, Rejection_Reason__c
                FROM Order_Stage_Log__c
                WHERE Customer_GST_Number__c    = :gstNumber.trim()
                AND   Customer_Mobile_No__c = :mobileNo.trim()
                // AND   Current_Stage__c NOT IN ('Client New')
                ORDER BY Order_Date__c DESC
                LIMIT 200
            ];
        } catch (AuraHandledException e) { throw e; }
        catch (Exception e) {
            throw new AuraHandledException('getMyOrders: ' + e.getMessage());
        }
    }

    // @AuraEnabled(cacheable=true)
    // public static Map<String, List<String>> getClientItemCodesByCategory() {
    //     Map<String, List<String>> result = new Map<String, List<String>>();
    //     for (Item_Configuration__mdt cfg : [
    //         SELECT MasterLabel, Item_Category__c
    //         FROM Item_Configuration__mdt
    //         WHERE Item_Category__c != null
    //     ]) {
    //         if (!result.containsKey(cfg.Item_Category__c)) {
    //             result.put(cfg.Item_Category__c, new List<String>());
    //         }
    //         result.get(cfg.Item_Category__c).add(cfg.MasterLabel);
    //     }
    //     return result;
    // }
    @AuraEnabled
    public static Map<String, List<String>> getClientItemCodesByCategory() {
        Map<String, List<String>> result = new Map<String, List<String>>();

        for (Item_Configuration__mdt cfg : [
            SELECT MasterLabel, Item_Category__c
            FROM Item_Configuration__mdt
            ORDER BY Item_Category__c, MasterLabel
        ]) {
            String categoryName = String.isBlank(cfg.Item_Category__c)
                ? 'Uncategorized'
                : cfg.Item_Category__c;

            if (!result.containsKey(categoryName)) {
                result.put(categoryName, new List<String>());
            }

            result.get(categoryName).add(cfg.MasterLabel);
        }

        return result;
    }
    @AuraEnabled(cacheable=true)
    public static Map<String, String> getClientItemSizeMap() {
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
    
}