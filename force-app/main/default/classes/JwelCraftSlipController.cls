public without sharing class JwelCraftSlipController {

    public String          slipTitle    { get; private set; }
    public String          batchName    { get; private set; }
    public String          slipDate     { get; private set; }
    public Boolean         hasError     { get; private set; }
    public String          errorMessage { get; private set; }
    public List<SlipGroup> groups       { get; private set; }
    public Integer         grandTotal   { get; private set; }

    public class CustLine {
        public String  customerCode { get; set; }
         public String  size         { get; set; } 
        public Integer qty          { get; set; }
        public String  remark       { get; set; }
    }

    public class SlipGroup {
        public String         itemCode     { get; set; }
        public Integer        totalQty     { get; set; }
        public String         unitLabel    { get; set; }
        public List<CustLine> custLines    { get; set; }
        public Boolean        hasCustLines { get; set; }
        public Integer        regularQty   { get; set; }
        public String         regularSize      { get; set; }
        public Boolean        hasRegular   { get; set; }
        public String         regularRemark { get; set; }
        public Boolean        hasRegularRemark { get; set; }
        public Boolean        hasDetails   { get; set; }
    }

    public JwelCraftSlipController() {
        this.hasError   = false;
        this.groups     = new List<SlipGroup>();
        this.grandTotal = 0;
        this.batchName  = '';
        this.slipDate   = Datetime.now().format('dd MMM yyyy · HH:mm');

        String batchId    = ApexPages.currentPage().getParameters().get('batchId');
        String titleParam = ApexPages.currentPage().getParameters().get('title');

        if (String.isBlank(batchId)) {
            this.hasError     = true;
            this.errorMessage = 'No batch ID provided.';
            return;
        }

        try {
            List<Production_Batch__c> batches = [
                SELECT Id, Name, Slip_Title__c, Item_Details__c, CreatedDate
                FROM Production_Batch__c WHERE Id = :batchId LIMIT 1
            ];

            if (batches.isEmpty()) {
                this.hasError     = true;
                this.errorMessage = 'Batch not found: ' + batchId;
                return;
            }

            Production_Batch__c batch = batches[0];
            this.slipTitle = String.isNotBlank(titleParam)
                           ? titleParam
                           : String.isNotBlank(batch.Slip_Title__c)
                           ? batch.Slip_Title__c
                           : 'Production Slip';
            this.slipDate  = batch.CreatedDate.format('dd MMM yyyy \u00b7 HH:mm');
            this.batchName = batch.Name;

            if (String.isBlank(batch.Item_Details__c)) {
                this.hasError     = true;
                this.errorMessage = 'No item details found on batch.';
                return;
            }

            List<Object> itemDetailsRaw =
                (List<Object>) JSON.deserializeUntyped(batch.Item_Details__c);

            for (Object rawItem : itemDetailsRaw) {
                Map<String, Object> d = (Map<String, Object>) rawItem;

                String  ic       = (String) d.get('itemCode');
                String  unitRaw  = (String) d.get('unit');

                // ✅ Bug 1 fix — handle all unit values LWC sends
                String unitLabel = unitRaw == 'g/in'  ? 'g / in'
                                 : unitRaw == 'Inches' ? 'Inches'
                                 : unitRaw == 'Grams'  ? 'Grams'
                                 : unitRaw == 'Pair'   ? 'Pair'// AADD
                                 : unitRaw == 'pcs+Pair'  ? 'pcs + Pair'  // ✅ ADD
                                 : unitRaw == 'pcs+g'     ? 'pcs + g'     // ✅ ADD
                                 : 'Pcs';

                Integer totalQty = d.get('totalQty') != null
                    ? Integer.valueOf(String.valueOf(d.get('totalQty'))) : 0;
                Integer regularQty = d.get('regularQty') != null
                    ? Integer.valueOf(String.valueOf(d.get('regularQty'))) : 0;
                String regularRemark = d.get('regularRemark') != null
                    ? (String) d.get('regularRemark') : '';

                // ✅ Bug 3 fix — check hasDetails while building custLines
                List<CustLine> custLines = new List<CustLine>();
                Boolean anyDetail = false;

                if (d.get('custLines') != null) {
                    List<Object> clRaw = (List<Object>) d.get('custLines');
                    for (Object clObj : clRaw) {
                        Map<String, Object> cl = (Map<String, Object>) clObj;
                        CustLine line     = new CustLine();
                        line.customerCode = (String) cl.get('customerCode');
                        line.size         = cl.get('size') != null ? (String) cl.get('size') : ''; 
                        line.qty          = cl.get('qty') != null
                            ? Integer.valueOf(String.valueOf(cl.get('qty'))) : 0;
                        line.remark       = (String) cl.get('remark');
                        custLines.add(line);
                        // hasDetails = true if any customer code or remark present
                        if (String.isNotBlank(line.customerCode)
                            || String.isNotBlank(line.remark)) {
                            anyDetail = true;
                        }
                    }
                }

                SlipGroup g  = new SlipGroup();
                g.itemCode   = ic;
                g.totalQty   = totalQty;
                g.unitLabel  = unitLabel;
                g.custLines  = custLines;
                g.hasCustLines = !custLines.isEmpty();
                g.regularQty = regularQty;
                g.hasRegular = regularQty > 0;
                g.regularRemark      = regularRemark;
                g.hasRegularRemark   = String.isNotBlank(regularRemark);
                g.hasDetails = anyDetail || String.isNotBlank(regularRemark);
                g.regularSize        = d.get('regularSize') != null
                ? (String) d.get('regularSize') : '';  // ✅ ADD
                this.grandTotal += g.totalQty;
                this.groups.add(g);
            }

        } catch (Exception e) {
            this.hasError     = true;
            this.errorMessage = 'Error: ' + e.getMessage();
        }
    }

    public PageReference autoprint() { return null; }
}