const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const axios = require('axios');

class LicenseManager {
  constructor() {
    this.licenseFile = path.join(__dirname, 'license.json');
    this.usageFile = path.join(__dirname, 'usage.json');
    this.initializeFiles();
  }

  initializeFiles() {
    // Initialize license file
    if (!fs.existsSync(this.licenseFile)) {
      const defaultLicense = {
        key: null,
        valid: false,
        type: 'free',
        validatedAt: null,
        expiresAt: null
      };
      fs.writeFileSync(this.licenseFile, JSON.stringify(defaultLicense, null, 2));
    }

    // Initialize usage file
    if (!fs.existsSync(this.usageFile)) {
      const defaultUsage = {
        dailyUsage: 0,
        lastReset: new Date().toDateString(),
        totalUsage: 0
      };
      fs.writeFileSync(this.usageFile, JSON.stringify(defaultUsage, null, 2));
    }
  }

  checkLicense() {
    try {
      const licenseData = JSON.parse(fs.readFileSync(this.licenseFile, 'utf8'));
      const usageData = this.getUsageData();
      
      // Check if license is expired
      if (licenseData.expiresAt && new Date() > new Date(licenseData.expiresAt)) {
        licenseData.valid = false;
        licenseData.type = 'expired';
      }

      return {
        ...licenseData,
        ...usageData
      };
    } catch (error) {
      console.error('Error checking license:', error);
      return {
        valid: false,
        type: 'free',
        error: 'License file corrupted'
      };
    }
  }

  getUsageData() {
    try {
      const usage = JSON.parse(fs.readFileSync(this.usageFile, 'utf8'));
      const today = new Date().toDateString();
      
      // Reset daily usage if it's a new day
      if (usage.lastReset !== today) {
        usage.dailyUsage = 0;
        usage.lastReset = today;
        fs.writeFileSync(this.usageFile, JSON.stringify(usage, null, 2));
      }
      
      return usage;
    } catch (error) {
      console.error('Error reading usage data:', error);
      return {
        dailyUsage: 0,
        totalUsage: 0,
        lastReset: new Date().toDateString()
      };
    }
  }

  trackUsage() {
    try {
      const usage = this.getUsageData();
      usage.dailyUsage += 1;
      usage.totalUsage += 1;
      fs.writeFileSync(this.usageFile, JSON.stringify(usage, null, 2));
    } catch (error) {
      console.error('Error tracking usage:', error);
    }
  }

  async validateLicense(key) {
    if (!key || key.trim() === '') {
      return { success: false, message: 'License key is required' };
    }

    try {
      // For demo purposes - simulate license validation
      // In production, you would call your license server (LemonSqueezy, Gumroad, etc.)
      
      const validationResult = await this.validateWithServer(key);
      
      if (validationResult.valid) {
        const licenseData = {
          key: key,
          valid: true,
          type: validationResult.type,
          validatedAt: new Date().toISOString(),
          expiresAt: validationResult.expiresAt
        };
        
        fs.writeFileSync(this.licenseFile, JSON.stringify(licenseData, null, 2));
        
        return {
          success: true,
          message: `License activated successfully! Type: ${validationResult.type}`,
          type: validationResult.type
        };
      } else {
        return {
          success: false,
          message: 'Invalid license key. Please check your key and try again.'
        };
      }
    } catch (error) {
      console.error('License validation error:', error);
      return {
        success: false,
        message: 'Could not validate license. Please check your internet connection.'
      };
    }
  }

  async validateWithServer(key) {
    // Demo validation - replace with actual license server
    
    // Simulate different license types
    if (key.startsWith('PRO-')) {
      return {
        valid: true,
        type: 'pro',
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days
      };
    } else if (key.startsWith('LIFETIME-')) {
      return {
        valid: true,
        type: 'lifetime',
        expiresAt: null // Never expires
      };
    } else if (key === 'DEMO-123-456') {
      return {
        valid: true,
        type: 'demo',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days
      };
    }

    // For real implementation, uncomment and configure:
    /*
    try {
      const response = await axios.post('https://api.lemonsqueezy.com/v1/licenses/validate', {
        license_key: key,
        instance_name: 'EasyScraper'
      }, {
        headers: {
          'Accept': 'application/vnd.api+json',
          'Content-Type': 'application/vnd.api+json',
          'Authorization': 'Bearer YOUR_API_KEY'
        }
      });
      
      return {
        valid: response.data.license_key.status === 'active',
        type: response.data.license_key.meta?.variant_name?.toLowerCase() || 'pro',
        expiresAt: response.data.license_key.expires_at
      };
    } catch (error) {
      return { valid: false };
    }
    */

    return { valid: false };
  }

  resetLicense() {
    const defaultLicense = {
      key: null,
      valid: false,
      type: 'free',
      validatedAt: null,
      expiresAt: null
    };
    fs.writeFileSync(this.licenseFile, JSON.stringify(defaultLicense, null, 2));
  }

  getLicenseInfo() {
    return this.checkLicense();
  }
}

module.exports = { LicenseManager };