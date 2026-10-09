public without sharing class MarketingContentController {
    public class ContentItem {
        @AuraEnabled public Id id;
        @AuraEnabled public String title;
        @AuraEnabled public String message;
        @AuraEnabled public Boolean active;
        @AuraEnabled public Decimal displayOrder;
        @AuraEnabled public Id contentDocumentId;
        @AuraEnabled public String imageUrl;
        @AuraEnabled public Datetime createdDate;
    }

    @AuraEnabled
    public static List<ContentItem> getActiveContent() {
        return buildItems([SELECT Id, Title__c, Message__c, Active__c, Display_Order__c, Image_URL__c, CreatedDate
            FROM Marketing_Content__c WHERE Active__c = true
            ORDER BY Display_Order__c ASC NULLS LAST, CreatedDate DESC]);
    }

    @AuraEnabled
    public static List<ContentItem> getAllContent() {
        return buildItems([SELECT Id, Title__c, Message__c, Active__c, Display_Order__c, Image_URL__c, CreatedDate
            FROM Marketing_Content__c ORDER BY Display_Order__c ASC NULLS LAST, CreatedDate DESC]);
    }

    @AuraEnabled
    public static Id saveContent(Id recordId, String title, String message, Boolean active, Decimal displayOrder) {
        Marketing_Content__c item = recordId == null ? new Marketing_Content__c() :
            [SELECT Id FROM Marketing_Content__c WHERE Id = :recordId LIMIT 1];
        item.Title__c = String.isBlank(title) ? null : title.trim();
        item.Message__c = String.isBlank(message) ? null : message.trim();
        item.Active__c = active == null ? true : active;
        item.Display_Order__c = displayOrder;
        upsert item;
        return item.Id;
    }

    @AuraEnabled
    public static String createPublicImageLink(Id contentVersionId, Id recordId) {
        if (contentVersionId == null) throw new AuraHandledException('Uploaded file Id is required.');
        ContentVersion version = [SELECT Id, Title FROM ContentVersion WHERE Id = :contentVersionId LIMIT 1];
        List<ContentDistribution> existing = [SELECT ContentDownloadUrl FROM ContentDistribution WHERE ContentVersionId = :version.Id LIMIT 1];
        if (!existing.isEmpty()) { update new Marketing_Content__c(Id = recordId, Image_URL__c = existing[0].ContentDownloadUrl); return existing[0].ContentDownloadUrl; }
        ContentDistribution distribution = new ContentDistribution(
            Name = version.Title,
            ContentVersionId = version.Id,
            PreferencesAllowViewInBrowser = true,
            PreferencesLinkLatestVersion = true
        );
        insert distribution;
        String url = [SELECT ContentDownloadUrl FROM ContentDistribution WHERE Id = :distribution.Id].ContentDownloadUrl;
        update new Marketing_Content__c(Id = recordId, Image_URL__c = url);
        return url;
    }

    @AuraEnabled
    public static void deleteContent(Id recordId) {
        if (recordId == null) throw new AuraHandledException('Content Id is required.');
        List<ContentDocumentLink> links = [SELECT ContentDocumentId FROM ContentDocumentLink WHERE LinkedEntityId = :recordId];
        Set<Id> documentIds = new Set<Id>();
        for (ContentDocumentLink link : links) documentIds.add(link.ContentDocumentId);
        if (!documentIds.isEmpty()) delete [SELECT Id FROM ContentDistribution WHERE ContentDocumentId IN :documentIds];
        delete [SELECT Id FROM Marketing_Content__c WHERE Id = :recordId LIMIT 1];
        if (!documentIds.isEmpty()) delete [SELECT Id FROM ContentDocument WHERE Id IN :documentIds];
    }

    private static List<ContentItem> buildItems(List<Marketing_Content__c> records) {
        Map<Id, ContentDocumentLink> firstImage = new Map<Id, ContentDocumentLink>();
        if (!records.isEmpty()) {
            Set<Id> recordIds = new Set<Id>();
            for (Marketing_Content__c record : records) recordIds.add(record.Id);
            for (ContentDocumentLink link : [SELECT LinkedEntityId, ContentDocumentId,
                ContentDocument.LatestPublishedVersionId, ContentDocument.FileType
                FROM ContentDocumentLink WHERE LinkedEntityId IN :recordIds ORDER BY SystemModstamp DESC]) {
                if (!firstImage.containsKey(link.LinkedEntityId) &&
                    new Set<String>{'PNG','JPG','JPEG','GIF','WEBP'}.contains(link.ContentDocument.FileType)) {
                    firstImage.put(link.LinkedEntityId, link);
                }
            }
        }
        List<ContentItem> result = new List<ContentItem>();
        for (Marketing_Content__c record : records) {
            ContentItem item = new ContentItem();
            item.id = record.Id; item.title = record.Title__c; item.message = record.Message__c;
            item.active = record.Active__c; item.displayOrder = record.Display_Order__c; item.createdDate = record.CreatedDate; item.imageUrl = record.Image_URL__c;
            ContentDocumentLink link = firstImage.get(record.Id);
            if (link != null) {
                item.contentDocumentId = link.ContentDocumentId;
                List<ContentDistribution> distributions = [SELECT ContentDownloadUrl FROM ContentDistribution WHERE ContentVersionId = :link.ContentDocument.LatestPublishedVersionId LIMIT 1];
                item.imageUrl = distributions.isEmpty() ? null : distributions[0].ContentDownloadUrl;
            }
            result.add(item);
        }
        return result;
    }
}