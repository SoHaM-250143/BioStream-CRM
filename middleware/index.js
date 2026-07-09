const express = require('express');
const cors = require('cors');
const salesforceService = require('./salesforce_service');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;
const PYTHON_BACKEND_URL = process.env.PYTHON_BACKEND_URL || 'http://127.0.0.1:8000';

app.use(cors());
app.use(express.json());

// Health endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'healthy', service: 'medsync-middleware' });
});

// Primary Endpoint called by Salesforce
app.post('/api/reports/analyze', async (req, res) => {
    const { recordId, reportText } = req.body;

    if (!recordId || !reportText) {
        return res.status(400).json({ error: 'recordId and reportText are required.' });
    }

    console.log(`Received analysis request for Salesforce record: ${recordId}`);

    try {
        // Step 1: Immediately update status in Salesforce to 'Processing'
        await salesforceService.updateReport(recordId, {
            Status__c: 'Processing'
        });

        // Send a 202 Accepted response back to Salesforce immediately to avoid connection timeouts
        res.status(202).json({
            status: 'Accepted',
            message: 'Processing started asynchronously.',
            recordId
        });

        // Step 2: Spin off asynchronous process to call Python and write back results
        // This runs in the background of the Node process
        (async () => {
            try {
                console.log(`Sending text to Python BioBERT service: ${PYTHON_BACKEND_URL}/analyze`);
                
                const response = await fetch(`${PYTHON_BACKEND_URL}/analyze`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ report_text: reportText })
                });

                if (!response.ok) {
                    throw new Error(`Python service responded with status ${response.status}`);
                }

                const data = await response.json();
                console.log('Received analysis data from Python:', JSON.stringify(data));

                // Step 3: Write back parsed data to Salesforce
                await salesforceService.updateReport(recordId, {
                    Status__c: 'Analyzed',
                    Extracted_Entities__c: JSON.stringify(data.entities),
                    Anomaly_Detected__c: data.anomaly_detected,
                    Anomaly_Description__c: data.anomaly_description
                });
                
                console.log(`Analysis and update complete for record ${recordId}`);

            } catch (asyncErr) {
                console.error(`Error in async analysis handler for ${recordId}:`, asyncErr.message);
                
                // Fallback: Mark record status as Error
                try {
                    await salesforceService.updateReport(recordId, {
                        Status__c: 'Error'
                    });
                } catch (sfErr) {
                    console.error('Failed to set error status in Salesforce:', sfErr.message);
                }
            }
        })();

    } catch (err) {
        console.error('Initial request handling failed:', err.message);
        res.status(500).json({ error: 'Failed to initiate processing: ' + err.message });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Node.js Middleware listening on port ${PORT}`);
});
