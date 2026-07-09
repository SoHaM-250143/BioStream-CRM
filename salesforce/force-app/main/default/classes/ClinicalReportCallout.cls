public with sharing class ClinicalReportCallout {
    
    @future(callout=true)
    public static void sendReportToMiddleware(Id reportId) {
        try {
            // Fetch the record details
            Clinical_Report__c report = [
                SELECT Id, Report_Text__c 
                FROM Clinical_Report__c 
                WHERE Id = :reportId 
                LIMIT 1
            ];
            
            if (String.isBlank(report.Report_Text__c)) {
                return;
            }
            
            // Build the payload
            Map<String, String> payload = new Map<String, String>();
            payload.put('recordId', String.valueOf(report.Id));
            payload.put('reportText', report.Report_Text__c);
            String jsonBody = JSON.serialize(payload);
            
            // Create HTTP request
            HttpRequest req = new HttpRequest();
            // Local dev middleware port 5000. In production, this uses a Named Credential.
            req.setEndpoint('http://localhost:5000/api/reports/analyze');
            req.setMethod('POST');
            req.setHeader('Content-Type', 'application/json');
            req.setBody(jsonBody);
            req.setTimeout(60000); // 60 seconds
            
            Http h = new Http();
            HttpResponse res = h.send(req);
            
            if (res.getStatusCode() != 202 && res.getStatusCode() != 200) {
                System.debug('❌ Error calling MedSync middleware: ' + res.getStatusCode() + ' - ' + res.getBody());
                updateErrorStatus(report.Id);
            } else {
                System.debug('✅ Report successfully sent to middleware for record ID: ' + report.Id);
            }
        } catch (Exception e) {
            System.debug('❌ Exception in ClinicalReportCallout: ' + e.getMessage());
            updateErrorStatus(reportId);
        }
    }
    
    private static void updateErrorStatus(Id reportId) {
        try {
            // Check current status first to prevent recursive triggers
            Clinical_Report__c current = [SELECT Status__c FROM Clinical_Report__c WHERE Id = :reportId LIMIT 1];
            if (current.Status__c != 'Error') {
                Clinical_Report__c repToUpdate = new Clinical_Report__c(
                    Id = reportId,
                    Status__c = 'Error'
                );
                update repToUpdate;
            }
        } catch (Exception e) {
            System.debug('❌ Failed to update status to Error for ' + reportId + ': ' + e.getMessage());
        }
    }
}
