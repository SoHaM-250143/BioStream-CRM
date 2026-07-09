trigger ClinicalReportTrigger on Clinical_Report__c (after insert) {
    for (Clinical_Report__c report : Trigger.new) {
        // Fire outbound callout automatically for newly submitted reports
        if (report.Status__c == 'New') {
            ClinicalReportCallout.sendReportToMiddleware(report.Id);
        }
    }
}
