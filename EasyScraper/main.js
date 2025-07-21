const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { Scraper } = require('./scraper');
const { LicenseManager } = require('./license');

let mainWindow;
let scraper;
let licenseManager;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, 'assets', 'icon.png'),
    title: 'EasyScraper v1.0',
    resizable: true,
    autoHideMenuBar: true
  });

  mainWindow.loadFile('renderer/index.html');

  // Open DevTools in development
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }
}

app.whenReady().then(() => {
  // Initialize modules
  scraper = new Scraper();
  licenseManager = new LicenseManager();
  
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC Handlers
ipcMain.handle('check-license', async () => {
  return licenseManager.checkLicense();
});

ipcMain.handle('validate-license', async (event, key) => {
  return licenseManager.validateLicense(key);
});

ipcMain.handle('start-scraping', async (event, options) => {
  try {
    const license = licenseManager.checkLicense();
    
    // Free tier limitations
    if (!license.valid && license.dailyUsage >= 3) {
      throw new Error('Free tier limit reached (3 scrapes per day). Please upgrade to Pro.');
    }
    
    const result = await scraper.scrapeWebsite(options, (progress) => {
      mainWindow.webContents.send('scraping-progress', progress);
    });
    
    // Track usage for free tier
    if (!license.valid) {
      licenseManager.trackUsage();
    }
    
    return result;
  } catch (error) {
    throw error;
  }
});

ipcMain.handle('save-file', async (event, data, format) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    filters: [
      { name: format.toUpperCase(), extensions: [format.toLowerCase()] },
      { name: 'All Files', extensions: ['*'] }
    ],
    defaultPath: `scrape-results-${new Date().getTime()}.${format.toLowerCase()}`
  });

  if (!result.canceled) {
    try {
      if (format.toLowerCase() === 'csv') {
        await scraper.saveAsCSV(data, result.filePath);
      } else {
        fs.writeFileSync(result.filePath, JSON.stringify(data, null, 2));
      }
      return { success: true, path: result.filePath };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
  
  return { success: false, error: 'Save cancelled' };
});

ipcMain.handle('get-app-info', () => {
  return {
    version: app.getVersion(),
    name: app.getName(),
    userDataPath: app.getPath('userData')
  };
});