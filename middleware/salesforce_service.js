const jsforce = require('jsforce');
require('dotenv').config();

class SalesforceService {
    constructor() {
        this.conn = null;
        this.loggedIn = false;
    }

    async connect() {
        if (this.loggedIn && this.conn) {
            return this.conn;
        }

        const loginUrl = process.env.SF_LOGIN_URL || 'https://login.salesforce.com';
        const username = process.env.SF_USERNAME;
        const password = process.env.SF_PASSWORD;
        const securityToken = process.env.SF_SECURITY_TOKEN || '';

        // If credentials are placeholder or missing, trigger mock mode for clean local execution
        if (!username || !password || username.includes('your_') || password.includes('your_')) {
            console.warn('⚠️ Salesforce credentials are placeholder. Running SalesforceService in mock mode.');
            this.mockMode = true;
            this.loggedIn = true;
            return null;
        }

        this.conn = new jsforce.Connection({
            loginUrl: loginUrl
        });

        return new Promise((resolve, reject) => {
            this.conn.login(username, password + securityToken, (err, userInfo) => {
                if (err) {
                    console.error('❌ Salesforce Login Error:', err.message);
                    return reject(err);
                }
                console.log(`✅ Connected to Salesforce instance: ${this.conn.instanceUrl}`);
                this.loggedIn = true;
                resolve(this.conn);
            });
        });
    }

    async updateReport(recordId, fields) {
        await this.connect();
        
        if (this.mockMode) {
            console.log(`[MOCK SF API] Updating Clinical_Report__c record ${recordId} with payload:`, JSON.stringify(fields, null, 2));
            return { id: recordId, success: true };
        }

        return new Promise((resolve, reject) => {
            this.conn.sobject('Clinical_Report__c').update({
                Id: recordId,
                ...fields
            }, (err, ret) => {
                if (err || !ret.success) {
                    console.error(`❌ Error updating Clinical_Report__c record ${recordId}:`, err);
                    return reject(err || new Error('Update failed.'));
                }
                console.log(`✅ Successfully updated Salesforce record ${recordId}`);
                resolve(ret);
            });
        });
    }
}

module.exports = new SalesforceService();
