/*
public class SGF_OrderPDFController {
    public String clientName { get; set; }
    public String gstNumber  { get; set; }
    public List<OrderWrapper> orders { get; set; }

    public SGF_OrderPDFController() {
        clientName = ApexPages.currentPage().getParameters().get('client');
        gstNumber  = ApexPages.currentPage().getParameters().get('gst');

        String ordersStr = ApexPages.currentPage().getParameters().get('orders');
        if (String.isNotBlank(ordersStr)) {
            try {
                orders = (List<OrderWrapper>) JSON.deserialize(ordersStr, List<OrderWrapper>.class);
                // Assign serial numbers for use in VF
                for (Integer i = 0; i < orders.size(); i++) {
                    orders[i].serialNo = i + 1;
                    orders[i].isEven   = Math.mod(i, 2) == 0;
                }
            } catch (Exception e) {
                orders = new List<OrderWrapper>();
            }
        } else {
            orders = new List<OrderWrapper>();
        }
    }

    public class OrderWrapper {
        public String  orderCode { get; set; }
        public String  itemCode  { get; set; }
        public Decimal quantity  { get; set; }
        public String  unit      { get; set; }
        // Computed in constructor
        public Integer serialNo  { get; set; }
        public Boolean isEven    { get; set; }
    }
}*/
public class SGF_OrderPDFController {
    public String clientName { get; set; }
    public String gstNumber  { get; set; }
    public List<OrderWrapper> orders { get; set; }

    public SGF_OrderPDFController() {
        clientName = ApexPages.currentPage().getParameters().get('client');
        gstNumber  = ApexPages.currentPage().getParameters().get('gst');

        String ordersStr = ApexPages.currentPage().getParameters().get('orders');
        if (String.isNotBlank(ordersStr)) {
            try {
                orders = (List<OrderWrapper>) JSON.deserialize(ordersStr, List<OrderWrapper>.class);
                // Assign serial numbers for use in VF
                for (Integer i = 0; i < orders.size(); i++) {
                    orders[i].serialNo = i + 1;
                    orders[i].isEven   = Math.mod(i, 2) == 0;
                }
            } catch (Exception e) {
                orders = new List<OrderWrapper>();
            }
        } else {
            orders = new List<OrderWrapper>();
        }
    }

    public class OrderWrapper {
        public String  orderCode { get; set; }
        public String  itemCode  { get; set; }
        public Decimal quantity  { get; set; }
        public String  unit      { get; set; }
        // Computed in constructor
        public Integer serialNo  { get; set; }
        public Boolean isEven    { get; set; }
    }
}