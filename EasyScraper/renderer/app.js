// EasyScraper Desktop App JavaScript

class EasyScraperApp {
  constructor() {
    this.currentResults = null;
    this.isTermsAccepted = false;
    this.licenseInfo = null;
    
    this.initializeApp();
  }

  async initializeApp() {
    await this.checkLicense();
    this.bindEvents();
    this.showTermsIfNeeded();
  }

  async checkLicense() {
    try {
      this.licenseInfo = await window.electronAPI.checkLicense();
      this.updateLicenseUI();
      this.updateUsageUI();
    } catch (error) {
      console.error('Error checking license:', error);
    }
  }

  updateLicenseUI() {
    const licenseText = document.getElementById('licenseText');
    const licenseBtn = document.getElementById('licenseBtn');
    const jsonOption = document.getElementById('jsonOption');

    if (this.licenseInfo.valid) {
      const typeMap = {
        'pro': '⭐ Pro',
        'lifetime': '💎 Lifetime',
        'demo': '🧪 Demo'
      };
      licenseText.textContent = typeMap[this.licenseInfo.type] || 'Licensed';
      licenseText.className = 'status-success';
      licenseBtn.textContent = 'Licensed';
      licenseBtn.disabled = true;
      
      // Enable JSON export for licensed users
      jsonOption.disabled = false;
    } else {
      licenseText.textContent = 'Free Tier';
      licenseText.className = 'status-warning';
      licenseBtn.textContent = 'Upgrade';
      licenseBtn.disabled = false;
      
      // Disable JSON export for free users
      jsonOption.disabled = true;
      if (document.getElementById('format').value === 'json') {
        document.getElementById('format').value = 'csv';
      }
    }
  }

  updateUsageUI() {
    const usageText = document.getElementById('usageText');
    const usageStats = document.getElementById('usageStats');

    if (this.licenseInfo.valid) {
      usageStats.style.display = 'none';
    } else {
      const { dailyUsage = 0 } = this.licenseInfo;
      usageText.textContent = `Free tier: ${dailyUsage}/3 scrapes today`;
      usageStats.style.display = 'block';
      
      // Show warning if near limit
      if (dailyUsage >= 2) {
        usageStats.style.borderLeftColor = 'var(--danger-color)';
      }
    }
  }

  bindEvents() {
    // License modal
    document.getElementById('licenseBtn').addEventListener('click', () => this.showLicenseModal());
    document.getElementById('upgradeLink').addEventListener('click', (e) => {
      e.preventDefault();
      this.showLicenseModal();
    });
    document.getElementById('closeLicenseModal').addEventListener('click', () => this.hideLicenseModal());
    document.getElementById('validateLicenseBtn').addEventListener('click', () => this.validateLicense());

    // Terms modal
    document.getElementById('closeTermsModal').addEventListener('click', () => this.hideTermsModal());
    document.getElementById('termsAccept').addEventListener('change', (e) => {
      document.getElementById('proceedBtn').disabled = !e.target.checked;
    });
    document.getElementById('proceedBtn').addEventListener('click', () => this.acceptTerms());

    // Main form
    document.getElementById('validateBtn').addEventListener('click', () => this.validateUrl());
    document.getElementById('advancedToggle').addEventListener('click', () => this.toggleAdvanced());
    document.getElementById('scrapeBtn').addEventListener('click', () => this.startScraping());
    document.getElementById('stopBtn').addEventListener('click', () => this.stopScraping());

    // Results
    document.getElementById('saveBtn').addEventListener('click', () => this.saveResults());
    document.getElementById('previewBtn').addEventListener('click', () => this.togglePreview());
    document.getElementById('newScrapeBtn').addEventListener('click', () => this.newScrape());

    // Format change
    document.getElementById('format').addEventListener('change', (e) => {
      if (e.target.value === 'json' && !this.licenseInfo.valid) {
        e.target.value = 'csv';
        this.showMessage('JSON export requires Pro license', 'warning');
      }
    });

    // Progress updates
    window.electronAPI.onScrapingProgress((event, progress) => {
      this.updateProgress(progress);
    });
  }

  showTermsIfNeeded() {
    if (!this.isTermsAccepted) {
      this.showTermsModal();
    }
  }

  showTermsModal() {
    document.getElementById('termsModal').style.display = 'flex';
  }

  hideTermsModal() {
    document.getElementById('termsModal').style.display = 'none';
  }

  acceptTerms() {
    this.isTermsAccepted = true;
    this.hideTermsModal();
    this.showMessage('Terms accepted. You can now use EasyScraper.', 'success');
  }

  showLicenseModal() {
    document.getElementById('licenseModal').style.display = 'flex';
    document.getElementById('licenseKey').value = '';
    document.getElementById('licenseResult').innerHTML = '';
    document.getElementById('licenseResult').className = 'license-result';
  }

  hideLicenseModal() {
    document.getElementById('licenseModal').style.display = 'none';
  }

  async validateLicense() {
    const key = document.getElementById('licenseKey').value.trim();
    const result = document.getElementById('licenseResult');
    const btn = document.getElementById('validateLicenseBtn');

    if (!key) {
      result.innerHTML = 'Please enter a license key';
      result.className = 'license-result error';
      return;
    }

    btn.textContent = 'Validating...';
    btn.disabled = true;

    try {
      const validation = await window.electronAPI.validateLicense(key);
      
      if (validation.success) {
        result.innerHTML = validation.message;
        result.className = 'license-result success';
        
        // Update license info and UI
        setTimeout(async () => {
          await this.checkLicense();
          this.hideLicenseModal();
        }, 2000);
      } else {
        result.innerHTML = validation.message;
        result.className = 'license-result error';
      }
    } catch (error) {
      result.innerHTML = 'Validation failed. Please check your connection.';
      result.className = 'license-result error';
    } finally {
      btn.textContent = 'Activate License';
      btn.disabled = false;
    }
  }

  async validateUrl() {
    const urlInput = document.getElementById('urlInput');
    const url = urlInput.value.trim();
    
    if (!url) {
      this.showMessage('Please enter a URL', 'error');
      return;
    }

    try {
      new URL(url);
      this.showMessage('URL format is valid ✓', 'success');
    } catch (error) {
      this.showMessage('Invalid URL format', 'error');
    }
  }

  toggleAdvanced() {
    const advanced = document.getElementById('customSelectors');
    const btn = document.getElementById('advancedToggle');
    
    if (advanced.style.display === 'none') {
      advanced.style.display = 'block';
      btn.textContent = '⚙️ Basic';
    } else {
      advanced.style.display = 'none';
      btn.textContent = '⚙️ Advanced';
    }
  }

  async startScraping() {
    if (!this.isTermsAccepted) {
      this.showTermsModal();
      return;
    }

    // Check free tier limits
    if (!this.licenseInfo.valid && this.licenseInfo.dailyUsage >= 3) {
      this.showMessage('Free tier limit reached (3/day). Please upgrade to Pro.', 'error');
      this.showLicenseModal();
      return;
    }

    const url = document.getElementById('urlInput').value.trim();
    if (!url) {
      this.showMessage('Please enter a URL to scrape', 'error');
      return;
    }

    // Get selected data types
    const dataTypes = Array.from(document.querySelectorAll('input[name="dataType"]:checked'))
      .map(cb => cb.value);
    
    if (dataTypes.length === 0) {
      this.showMessage('Please select at least one data type to scrape', 'error');
      return;
    }

    const options = {
      url: url,
      dataTypes: dataTypes,
      maxPages: parseInt(document.getElementById('maxPages').value) || 1,
      format: document.getElementById('format').value,
      customSelectors: {
        titles: document.getElementById('titleSelector').value.trim(),
        prices: document.getElementById('priceSelector').value.trim(),
        images: document.getElementById('imageSelector').value.trim()
      }
    };

    try {
      this.showProgress();
      this.toggleScrapingState(true);

      const result = await window.electronAPI.startScraping(options);
      
      if (result.success) {
        this.currentResults = result.data;
        this.showResults(result);
        await this.checkLicense(); // Update usage count
      } else {
        throw new Error(result.error || 'Scraping failed');
      }
    } catch (error) {
      this.showMessage(`Scraping failed: ${error.message}`, 'error');
      this.hideProgress();
    } finally {
      this.toggleScrapingState(false);
    }
  }

  stopScraping() {
    // In a real implementation, you'd send a stop signal
    this.hideProgress();
    this.toggleScrapingState(false);
    this.showMessage('Scraping stopped', 'warning');
  }

  toggleScrapingState(isScraping) {
    document.getElementById('scrapeBtn').style.display = isScraping ? 'none' : 'block';
    document.getElementById('stopBtn').style.display = isScraping ? 'block' : 'none';
    
    // Disable form inputs
    const inputs = document.querySelectorAll('input, select, button');
    inputs.forEach(input => {
      if (!input.id || input.id !== 'stopBtn') {
        input.disabled = isScraping;
      }
    });
  }

  showProgress() {
    document.getElementById('progressSection').style.display = 'block';
    document.getElementById('resultsSection').style.display = 'none';
    this.updateProgress({ percentage: 0, status: 'Starting...' });
  }

  hideProgress() {
    document.getElementById('progressSection').style.display = 'none';
  }

  updateProgress(progress) {
    document.getElementById('progressFill').style.width = `${progress.percentage || 0}%`;
    document.getElementById('progressText').textContent = progress.status || 'Processing...';
  }

  showResults(result) {
    this.hideProgress();
    
    const resultsSection = document.getElementById('resultsSection');
    const resultsStats = document.getElementById('resultsStats');
    
    resultsStats.textContent = `Found ${result.totalItems} items from ${result.pagesScraped} page(s)`;
    resultsSection.style.display = 'block';
    
    // Scroll to results
    resultsSection.scrollIntoView({ behavior: 'smooth' });
  }

  togglePreview() {
    const preview = document.getElementById('resultsPreview');
    const btn = document.getElementById('previewBtn');
    
    if (preview.style.display === 'none') {
      this.generatePreview();
      preview.style.display = 'block';
      btn.textContent = '🙈 Hide Preview';
    } else {
      preview.style.display = 'none';
      btn.textContent = '👁️ Preview Data';
    }
  }

  generatePreview() {
    if (!this.currentResults || this.currentResults.length === 0) {
      document.getElementById('resultsPreview').innerHTML = '<p>No data to preview</p>';
      return;
    }

    // Show first 10 items
    const previewData = this.currentResults.slice(0, 10);
    const keys = Object.keys(previewData[0]);
    
    let html = '<table class="preview-table"><thead><tr>';
    keys.forEach(key => {
      html += `<th>${key}</th>`;
    });
    html += '</tr></thead><tbody>';
    
    previewData.forEach(item => {
      html += '<tr>';
      keys.forEach(key => {
        let value = item[key] || '';
        // Truncate long values
        if (value.length > 50) {
          value = value.substring(0, 50) + '...';
        }
        html += `<td>${this.escapeHtml(value)}</td>`;
      });
      html += '</tr>';
    });
    
    html += '</tbody></table>';
    
    if (this.currentResults.length > 10) {
      html += `<p><small>Showing first 10 of ${this.currentResults.length} items</small></p>`;
    }
    
    document.getElementById('resultsPreview').innerHTML = html;
  }

  async saveResults() {
    if (!this.currentResults) {
      this.showMessage('No data to save', 'error');
      return;
    }

    const format = document.getElementById('format').value;
    
    try {
      const result = await window.electronAPI.saveFile(this.currentResults, format);
      
      if (result.success) {
        this.showMessage(`File saved successfully: ${result.path}`, 'success');
      } else {
        this.showMessage(`Save failed: ${result.error}`, 'error');
      }
    } catch (error) {
      this.showMessage(`Save failed: ${error.message}`, 'error');
    }
  }

  newScrape() {
    // Reset form
    document.getElementById('urlInput').value = '';
    document.getElementById('maxPages').value = '1';
    document.getElementById('titleSelector').value = '';
    document.getElementById('priceSelector').value = '';
    document.getElementById('imageSelector').value = '';
    
    // Hide results
    document.getElementById('resultsSection').style.display = 'none';
    document.getElementById('resultsPreview').style.display = 'none';
    document.getElementById('previewBtn').textContent = '👁️ Preview Data';
    
    this.currentResults = null;
    
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  showMessage(message, type = 'info') {
    // Create a temporary message element
    const messageDiv = document.createElement('div');
    messageDiv.className = `message message-${type}`;
    messageDiv.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 15px 20px;
      border-radius: 8px;
      color: white;
      font-weight: 600;
      z-index: 10000;
      max-width: 400px;
      box-shadow: var(--shadow-lg);
    `;
    
    const colors = {
      success: 'var(--success-color)',
      error: 'var(--danger-color)',
      warning: 'var(--warning-color)',
      info: 'var(--primary-color)'
    };
    
    messageDiv.style.backgroundColor = colors[type] || colors.info;
    messageDiv.textContent = message;
    
    document.body.appendChild(messageDiv);
    
    // Remove after 4 seconds
    setTimeout(() => {
      if (document.body.contains(messageDiv)) {
        messageDiv.style.opacity = '0';
        setTimeout(() => {
          document.body.removeChild(messageDiv);
        }, 300);
      }
    }, 4000);
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new EasyScraperApp();
});