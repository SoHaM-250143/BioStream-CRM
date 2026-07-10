@isTest
public class ClinicalReportCalloutTest {

    // HTTP Callout Mock implementation
    private class ClinicalReportCalloutMock implements HttpCalloutMock {
        private Integer responseCode;
        private String responseBody;

        public ClinicalReportCalloutMock(Integer code, String body) {
            this.responseCode = code;
            this.responseBody = body;
        }

        public HttpResponse respond(HttpRequest req) {
            HttpResponse res = new HttpResponse();
            res.setHeader('Content-Type', 'application/json');
            res.setBody(this.responseBody);
            res.setStatusCode(this.responseCode);
            return res;
        }
    }

    @isTest
    static void testCalloutSuccess() {
        // Set mock callout response
        Test.setMock(HttpCalloutMock.class, new ClinicalReportCalloutMock(202, '{"status": "Accepted"}'));

        Clinical_Report__c report = new Clinical_Report__c(
            Patient_Name__c = 'John Doe',
            Clinic_Name__c = 'City Clinic',
            Report_Text__c = 'Patient shows normal symptoms. No critical risk.',
            Status__c = 'New'
        );

        Test.startTest();
        insert report;
        Test.stopTest(); // Forces future method execution

        // Verify status remains New as Node middleware will write the next state
        Clinical_Report__c queriedReport = [SELECT Status__c FROM Clinical_Report__c WHERE Id = :report.Id];
        System.assertEquals('New', queriedReport.Status__c, 'Status should remain New on initial successful callout');
    }

    @isTest
    static void testCalloutFailure() {
        // Set mock failure response (HTTP 500)
        Test.setMock(HttpCalloutMock.class, new ClinicalReportCalloutMock(500, '{"error": "Internal Error"}'));

        Clinical_Report__c report = new Clinical_Report__c(
            Patient_Name__c = 'Jane Doe',
            Clinic_Name__c = 'County Health',
            Report_Text__c = 'Patient indicates malignant tumor markers.',
            Status__c = 'New'
        );

        Test.startTest();
        insert report;
        Test.stopTest(); // Forces future method execution

        // Verify status is updated to Error on middleware HTTP failure
        Clinical_Report__c queriedReport = [SELECT Status__c FROM Clinical_Report__c WHERE Id = :report.Id];
        System.assertEquals('Error', queriedReport.Status__c, 'Status should be set to Error on HTTP failure');
    }

    @isTest
    static void testCalloutException() {
        // No mock set, Salesforce automatically throws CalloutException which forces try/catch to set status to Error
        Clinical_Report__c report = new Clinical_Report__c(
            Patient_Name__c = 'Baby Doe',
            Clinic_Name__c = 'Pediatrics Care',
            Report_Text__c = 'Routine infant screening.',
            Status__c = 'New'
        );

        Test.startTest();
        insert report;
        Test.stopTest(); // Forces future method execution

        Clinical_Report__c queriedReport = [SELECT Status__c FROM Clinical_Report__c WHERE Id = :report.Id];
        System.assertEquals('Error', queriedReport.Status__c, 'Status should be set to Error on connection exception');
    }
}
