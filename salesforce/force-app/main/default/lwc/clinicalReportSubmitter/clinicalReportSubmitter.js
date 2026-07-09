import { LightningElement, track, wire } from 'lwc';
import { createRecord, getRecord } from 'lightning/uiRecordApi';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

const OBJECT_NAME = 'Clinical_Report__c';

// API fields to query
const FIELDS = [
    'Clinical_Report__c.Status__c',
    'Clinical_Report__c.Extracted_Entities__c',
    'Clinical_Report__c.Anomaly_Detected__c',
    'Clinical_Report__c.Anomaly_Description__c'
];

export default class ClinicalReportSubmitter extends LightningElement {
    @track patientName = '';
    @track clinicName = '';
    @track reportText = '';
    
    @track recordId;
    @track isSubmitted = false;
    @track isLoading = false;
    @track loadingMessage = 'Submitting report...';

    // Analytics outputs
    @track reportStatus = 'New';
    @track extractedEntities = {};
    @track anomalyDetected = false;
    @track anomalyDescription = '';

    handlePatientChange(event) {
        this.patientName = event.target.value;
    }

    handleClinicChange(event) {
        this.clinicName = event.target.value;
    }

    handleReportChange(event) {
        this.reportText = event.target.value;
    }

    // Wire handler to react to real-time database updates from Node.js middleware
    @wire(getRecord, { recordId: '$recordId', fields: FIELDS })
    wiredRecord({ error, data }) {
        if (data) {
            this.reportStatus = data.fields.Status__c.value;
            this.anomalyDetected = data.fields.Anomaly_Detected__c.value;
            this.anomalyDescription = data.fields.Anomaly_Description__c.value || '';
            
            const entitiesStr = data.fields.Extracted_Entities__c.value;
            if (entitiesStr) {
                try {
                    this.extractedEntities = JSON.parse(entitiesStr);
                } catch (e) {
                    console.error('Error parsing entities JSON:', e);
                }
            }

            // Manage loading states based on processing status
            if (this.reportStatus === 'Processing') {
                this.isLoading = true;
                this.loadingMessage = 'BioBERT analyzing medical text report...';
            } else if (this.reportStatus === 'Analyzed') {
                this.isLoading = false;
            } else if (this.reportStatus === 'Error') {
                this.isLoading = false;
                this.showToast('Error', 'BioBERT text analysis failed. Please verify the report formatting.', 'error');
            }
        } else if (error) {
            console.error('Error fetching record:', error);
            this.isLoading = false;
        }
    }

    async handleSubmit() {
        if (!this.patientName || !this.reportText) {
            this.showToast('Validation Error', 'Please complete all required fields.', 'warning');
            return;
        }

        this.isLoading = true;
        this.loadingMessage = 'Registering clinical report...';
        this.isSubmitted = true;

        // Build field payload
        const fields = {};
        fields['Patient_Name__c'] = this.patientName;
        fields['Clinic_Name__c'] = this.clinicName;
        fields['Report_Text__c'] = this.reportText;
        fields['Status__c'] = 'New';

        const recordInput = { apiName: OBJECT_NAME, fields };

        try {
            const result = await createRecord(recordInput);
            this.recordId = result.id;
            this.showToast('Success', 'Clinical report submitted. Analysis starting.', 'success');
            
            // Set status message
            this.loadingMessage = 'Triggering BioBERT API Gateway...';
        } catch (error) {
            this.isSubmitted = false;
            this.isLoading = false;
            this.showToast('Error creating record', error.body.message, 'error');
        }
    }

    handleReset() {
        this.patientName = '';
        this.clinicName = '';
        this.reportText = '';
        this.recordId = undefined;
        this.isSubmitted = false;
        this.isLoading = false;
        this.reportStatus = 'New';
        this.extractedEntities = {};
        this.anomalyDetected = false;
        this.anomalyDescription = '';
    }

    // Getters for template logic
    get diseases() {
        return this.extractedEntities.diseases || [];
    }

    get chemicals() {
        return this.extractedEntities.chemicals || [];
    }

    get anatomy() {
        return this.extractedEntities.anatomy || [];
    }

    get hasDiseases() {
        return this.diseases.length > 0;
    }

    get hasChemicals() {
        return this.chemicals.length > 0;
    }

    get hasAnatomy() {
        return this.anatomy.length > 0;
    }

    get statusBadgeClass() {
        let baseClass = 'status-badge slds-var-m-left_small ';
        if (this.reportStatus === 'New') return baseClass + 'status-new';
        if (this.reportStatus === 'Processing') return baseClass + 'status-processing';
        if (this.reportStatus === 'Analyzed') return baseClass + 'status-analyzed';
        if (this.reportStatus === 'Error') return baseClass + 'status-error';
        return baseClass;
    }

    showToast(title, message, variant) {
        this.dispatchEvent(
            new ShowToastEvent({
                title: title,
                message: message,
                variant: variant
            })
        );
    }
}
