import { createElement } from 'lwc';
import { registerApexTestWireAdapter } from '@salesforce/sfdx-lwc-jest';
import ClinicalReportSubmitter from 'c/clinicalReportSubmitter';
import { createRecord, getRecord } from 'lightning/uiRecordApi';
import getRecentReports from '@salesforce/apex/ClinicalReportController.getRecentReports';

// Register Apex mock wire adapter
const getRecentReportsAdapter = registerApexTestWireAdapter(getRecentReports);

// Setup default mock values for createRecord
createRecord.mockResolvedValue({ id: 'a001a00000abcde' });



describe('c-clinical-report-submitter', () => {
    afterEach(() => {
        // Clear DOM and mocks
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
        jest.clearAllMocks();
    });

    it('renders the initial submit form correctly', () => {
        const element = createElement('c-clinical-report-submitter', {
            is: ClinicalReportSubmitter
        });
        document.body.appendChild(element);

        // Verify input fields exist
        const inputs = element.shadowRoot.querySelectorAll('lightning-input');
        expect(inputs.length).toBe(2);
        
        const textarea = element.shadowRoot.querySelector('lightning-textarea');
        expect(textarea).toBeTruthy();

        // Verify submit button exists
        const submitBtn = element.shadowRoot.querySelector('.submit-button');
        expect(submitBtn).toBeTruthy();
        expect(submitBtn.textContent.trim()).toBe('Submit to MedSync AI');
    });

    it('calls createRecord on submission with valid inputs', async () => {
        const element = createElement('c-clinical-report-submitter', {
            is: ClinicalReportSubmitter
        });
        document.body.appendChild(element);

        // Populate fields
        const inputs = element.shadowRoot.querySelectorAll('lightning-input');
        inputs[0].value = 'John Doe';
        inputs[0].dispatchEvent(new CustomEvent('change'));

        inputs[1].value = 'City Clinic';
        inputs[1].dispatchEvent(new CustomEvent('change'));

        const textarea = element.shadowRoot.querySelector('lightning-textarea');
        textarea.value = 'Unstructured clinical note describing chest discomfort and heart issues.';
        textarea.dispatchEvent(new CustomEvent('change'));

        // Click submit
        const submitBtn = element.shadowRoot.querySelector('.submit-button');
        submitBtn.click();

        // Wait for asynchronous DOM/Microtask updates
        await Promise.resolve();

        // Verify createRecord mock was invoked
        expect(createRecord).toHaveBeenCalled();
    });

    it('renders the results and badges after a successful analysis callback', async () => {
        const element = createElement('c-clinical-report-submitter', {
            is: ClinicalReportSubmitter
        });
        document.body.appendChild(element);

        // Populate fields to allow submission
        const inputs = element.shadowRoot.querySelectorAll('lightning-input');
        inputs[0].value = 'Jane Doe';
        inputs[0].dispatchEvent(new CustomEvent('change'));

        inputs[1].value = 'County Health';
        inputs[1].dispatchEvent(new CustomEvent('change'));

        const textarea = element.shadowRoot.querySelector('lightning-textarea');
        textarea.value = 'Malignant tumor in the lung.';
        textarea.dispatchEvent(new CustomEvent('change'));

        // Click submit
        const submitBtn = element.shadowRoot.querySelector('.submit-button');
        submitBtn.click();

        // Resolve createRecord promise to set recordId internally
        await Promise.resolve();

        // Emit updated record fields from the database wire adapter
        const mockGetRecord = {
            fields: {
                Status__c: { value: 'Analyzed' },
                Extracted_Entities__c: {
                    value: '{"diseases":["arrhythmia","hypertension"],"chemicals":["lisinopril","aspirin"],"anatomy":["heart"]}'
                },
                Anomaly_Detected__c: { value: true },
                Anomaly_Description__c: { value: 'Hypertension warning and arrhythmia detected.' }
            }
        };
        getRecord.emit(mockGetRecord);

        // Resolve JS queue to update elements in the DOM
        await Promise.resolve();
        await Promise.resolve();

        // Verify status badge
        const statusBadge = element.shadowRoot.querySelector('.status-badge');
        expect(statusBadge).toBeTruthy();
        expect(statusBadge.textContent.trim()).toBe('Analyzed');

        // Verify emergency banner
        const anomalyBanner = element.shadowRoot.querySelector('.anomaly-banner');
        expect(anomalyBanner).toBeTruthy();
        expect(element.shadowRoot.querySelector('.anomaly-text').textContent).toBe('Hypertension warning and arrhythmia detected.');

        // Verify badge lists
        const diseaseBadges = element.shadowRoot.querySelectorAll('.disease-badge');
        expect(diseaseBadges.length).toBe(2);
        expect(diseaseBadges[0].textContent).toBe('arrhythmia');

        const chemicalBadges = element.shadowRoot.querySelectorAll('.chemical-badge');
        expect(chemicalBadges.length).toBe(2);

        const anatomyBadges = element.shadowRoot.querySelectorAll('.anatomy-badge');
        expect(anatomyBadges.length).toBe(1);
        expect(anatomyBadges[0].textContent).toBe('heart');
    });

    it('renders recent submissions in the sidebar and loads a clicked report', async () => {
        const element = createElement('c-clinical-report-submitter', {
            is: ClinicalReportSubmitter
        });
        document.body.appendChild(element);

        // Mock recent reports list returned by Apex wire
        const mockReports = [
            { Id: 'a001a00000abc01', Patient_Name__c: 'Alice Smith', Clinic_Name__c: 'West Clinic', Status__c: 'Analyzed' },
            { Id: 'a001a00000abc02', Patient_Name__c: 'Bob Jones', Clinic_Name__c: 'East Clinic', Status__c: 'New' }
        ];
        
        // Emit list via wired Apex adapter
        getRecentReportsAdapter.emit(mockReports);


        // Resolve JS queue to update elements in the DOM
        await Promise.resolve();

        // Verify sidebar items render
        const reportItems = element.shadowRoot.querySelectorAll('.report-item');
        expect(reportItems.length).toBe(2);
        expect(reportItems[0].querySelector('.report-list-patient').textContent).toBe('Alice Smith');

        // Click the first item
        reportItems[0].click();

        // Verify recordId is updated to the clicked report ID
        expect(element.recordId).toBe('a001a00000abc01');
    });
});

