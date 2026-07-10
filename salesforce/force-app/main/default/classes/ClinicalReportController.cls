public with sharing class ClinicalReportController {
    
    @AuraEnabled(cacheable=true)
    public static List<Clinical_Report__c> getRecentReports() {
        return [
            SELECT Id, Name, Patient_Name__c, Status__c, Extracted_Entities__c, 
                   Anomaly_Detected__c, Anomaly_Description__c, Clinic_Name__c, CreatedDate
            FROM Clinical_Report__c
            WITH USER_MODE
            ORDER BY CreatedDate DESC
            LIMIT 10
        ];
    }
}
