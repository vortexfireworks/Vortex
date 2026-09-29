const CONTACTS_CACHE_KEY = 'mergedContacts_v1';
const CONTACTS_CACHE_SECONDS = 300; // 5 minutes
const VENUES_CACHE_KEY = 'venues_v1';
const VENUES_CACHE_SECONDS = 300; // 5 minutes
const ANNOUNCEMENTS_CACHE_KEY = 'announcements_v1';
const ANNOUNCEMENTS_CACHE_SECONDS = 120; // 2 minutes

function buildCombinedLicense(displayLicense, specialEffectsLicense, flameLicense) {
  const parts = [];
  if (displayLicense) parts.push('D: ' + displayLicense);
  if (specialEffectsLicense) parts.push('P: ' + specialEffectsLicense);
  if (flameLicense) parts.push('F: ' + flameLicense);
  return parts.join(' · ');
}

function getMergedContacts(ss) {
  const cache = CacheService.getScriptCache();
  const cached = cache.get(CONTACTS_CACHE_KEY);
  if (cached) {
    return JSON.parse(cached);
  }

  const map = {};
  const sheet = ss.getSheetByName('Contacts');
  if (sheet) {
    const values = sheet.getDataRange().getValues();
    const headers = values[0] || [];
    const idx = {};
    headers.forEach((h, i) => { idx[h] = i; });
    values.slice(1).forEach(row => {
      const name = row[idx['Name']];
      if (!name) return;
      const displayLicense = row[idx['DisplayLicense']] || '';
      const specialEffectsLicense = row[idx['SpecialEffectsLicense']] || '';
      const flameLicense = row[idx['FlameLicense']] || '';
      map[String(name).trim().toLowerCase()] = {
        name: String(name).trim(),
        displayLicense: displayLicense,
        specialEffectsLicense: specialEffectsLicense,
        flameLicense: flameLicense,
        license: buildCombinedLicense(displayLicense, specialEffectsLicense, flameLicense),
        address: row[idx['Address']] || '',
        age: row[idx['Age']] || '',
        phone: row[idx['Phone']] || '',
        email: row[idx['Email']] || '',
        photoUrl: row[idx['PhotoURL']] || '',
        emergencyContact: row[idx['EmergencyContact']] || '',
        emergencyContactPhone: row[idx['EmergencyContactPhone']] || ''
      };
    });
  }

  try {
    cache.put(CONTACTS_CACHE_KEY, JSON.stringify(map), CONTACTS_CACHE_SECONDS);
  } catch (err) {
    // if the dataset is too large to cache, just skip caching this time
  }
  return map;
}

function getOrCreateContactsSheet(ss) {
  const requiredHeaders = ['Name', 'DisplayLicense', 'SpecialEffectsLicense', 'FlameLicense', 'Address', 'Age', 'Phone', 'Email', 'PhotoURL', 'EmergencyContact', 'EmergencyContactPhone'];
  let sheet = ss.getSheetByName('Contacts');
  if (!sheet) {
    sheet = ss.insertSheet('Contacts');
    sheet.appendRow(requiredHeaders);
    return sheet;
  }
  const headers = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0];
  requiredHeaders.forEach(h => {
    if (headers.indexOf(h) === -1) {
      sheet.getRange(1, sheet.getLastColumn() + 1).setValue(h);
    }
  });
  return sheet;
}

function getOrCreateVenuesSheet(ss) {
  const requiredHeaders = ['Name', 'Address', 'County', 'EventDate', 'SignInEnabled'];
  let sheet = ss.getSheetByName('Venues');
  if (!sheet) {
    sheet = ss.insertSheet('Venues');
    sheet.appendRow(requiredHeaders);
    return sheet;
  }
  const headers = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0];
  requiredHeaders.forEach(h => {
    if (headers.indexOf(h) === -1) {
      sheet.getRange(1, sheet.getLastColumn() + 1).setValue(h);
    }
  });
  return sheet;
}

function getOrCreateAnnouncementsSheet(ss) {
  const requiredHeaders = ['Timestamp', 'Message'];
  let sheet = ss.getSheetByName('Announcements');
  if (!sheet) {
    sheet = ss.insertSheet('Announcements');
    sheet.appendRow(requiredHeaders);
    return sheet;
  }
  return sheet;
}

const SITEMAP_FOLDER_NAME = 'Vortex Site Maps';

function jsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function getOrCreateInventorySheet(ss) {
  const requiredHeaders = ['Container', 'ItemsJson', 'UpdatedAt'];
  let sheet = ss.getSheetByName('Inventory');
  if (!sheet) {
    sheet = ss.insertSheet('Inventory');
    sheet.appendRow(requiredHeaders);
    return sheet;
  }
  const headers = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0];
  requiredHeaders.forEach(h => {
    if (headers.indexOf(h) === -1) {
      sheet.getRange(1, sheet.getLastColumn() + 1).setValue(h);
    }
  });
  return sheet;
}

function findInventoryRow(sheet, map, container) {
  const rows = sheet.getDataRange().getValues();
  const key = String(container || '').trim().toLowerCase();
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][map['Container']]).trim().toLowerCase() === key) return i + 1;
  }
  return -1;
}

function getOrCreatePickListsSheet(ss) {
  const requiredHeaders = ['Name', 'EventDate', 'SiteMapUrl', 'SiteMapFileId', 'DataJson', 'UpdatedAt'];
  let sheet = ss.getSheetByName('PickLists');
  if (!sheet) {
    sheet = ss.insertSheet('PickLists');
    sheet.appendRow(requiredHeaders);
    return sheet;
  }
  const headers = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0];
  requiredHeaders.forEach(h => {
    if (headers.indexOf(h) === -1) {
      sheet.getRange(1, sheet.getLastColumn() + 1).setValue(h);
    }
  });
  return sheet;
}

function getOrCreatePickListSettingsSheet(ss) {
  let sheet = ss.getSheetByName('PickListSettings');
  if (!sheet) {
    sheet = ss.insertSheet('PickListSettings');
    sheet.appendRow(['Key', 'Value']);
  }
  return sheet;
}

function getPickListSetting(ss, key) {
  const sheet = ss.getSheetByName('PickListSettings');
  if (!sheet) return '';
  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === key) return String(rows[i][1] == null ? '' : rows[i][1]);
  }
  return '';
}

function setPickListSetting(ss, key, value) {
  const sheet = getOrCreatePickListSettingsSheet(ss);
  const rows = sheet.getDataRange().getValues();
  let rowNumber = -1;
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === key) { rowNumber = i + 1; break; }
  }
  if (rowNumber < 0) {
    sheet.appendRow([key, '']);
    rowNumber = sheet.getLastRow();
  }
  const cell = sheet.getRange(rowNumber, 2);
  cell.setNumberFormat('@');   // keep it as plain text so Sheets never treats a formula like "=..." as a real formula
  cell.setValue(value);
}

function findPickListRow(sheet, map, name) {
  const rows = sheet.getDataRange().getValues();
  const key = String(name || '').trim().toLowerCase();
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][map['Name']]).trim().toLowerCase() === key) return i + 1;
  }
  return -1;
}

function saveSiteMapToDrive(dataUrl, name) {
  const matches = String(dataUrl || '').match(/^data:(image\/(?:jpeg|png|webp|gif));base64,(.*)$/);
  if (!matches) return null;
  const bytes = Utilities.base64Decode(matches[2]);
  if (bytes.length > 8 * 1024 * 1024) return null;   // safety cap: 8 MB
  const ext = matches[1] === 'image/png' ? 'png' : (matches[1] === 'image/jpeg' ? 'jpg' : matches[1].split('/')[1]);
  const safeName = 'sitemap_' + String(name).replace(/[^a-zA-Z0-9]/g, '_') + '_' + new Date().getTime() + '.' + ext;
  const blob = Utilities.newBlob(bytes, matches[1], safeName);
  const folders = DriveApp.getFoldersByName(SITEMAP_FOLDER_NAME);
  const folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(SITEMAP_FOLDER_NAME);
  const file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return { fileId: file.getId(), url: 'https://lh3.googleusercontent.com/d/' + file.getId() + '=s1600' };
}

function headerMap(sheet) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const map = {};
  headers.forEach((h, i) => { map[h] = i; });
  return map;
}

function getOrCreatePhotoFolder() {
  const folderName = 'Vortex Operator Photos';
  const folders = DriveApp.getFoldersByName(folderName);
  if (folders.hasNext()) return folders.next();
  return DriveApp.createFolder(folderName);
}

function savePhotoToDrive(dataUrl, name) {
  const matches = dataUrl.match(/^data:(image\/\w+);base64,(.*)$/);
  if (!matches) return '';
  const contentType = matches[1];
  const bytes = Utilities.base64Decode(matches[2]);
  const safeName = String(name).replace(/[^a-zA-Z0-9]/g, '_') + '_' + new Date().getTime() + '.jpg';
  const blob = Utilities.newBlob(bytes, contentType, safeName);
  const folder = getOrCreatePhotoFolder();
  const file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return 'https://lh3.googleusercontent.com/d/' + file.getId() + '=s400';
}

function doPost(e) {
  const data = JSON.parse(e.postData.contents);
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  if (data.recordType === 'payroll') {
    let sheet = ss.getSheetByName('Payroll');
    if (!sheet) {
      sheet = ss.insertSheet('Payroll');
      sheet.appendRow(['Timestamp', 'Event', 'Event Date', 'Name', 'Amount']);
    }
    const timestamp = new Date();
    (data.entries || []).forEach(entry => {
      sheet.appendRow([timestamp, data.event, data.eventDate, entry.name, entry.amount]);
    });
    return ContentService.createTextOutput(JSON.stringify({status: 'ok'}))
      .setMimeType(ContentService.MimeType.JSON);
  }

  if (data.recordType === 'contact') {
    if (data.verifyPhone) {
      const merged = getMergedContacts(ss);
      const nameKeyCheck = String(data.name || '').trim().toLowerCase();
      const existingMatch = merged[nameKeyCheck];
      const onFilePhoneCheck = existingMatch ? String(existingMatch.phone || '').replace(/\D/g, '') : '';
      const enteredPhoneCheck = String(data.verifyPhone || '').replace(/\D/g, '');
      if (!existingMatch || !onFilePhoneCheck || enteredPhoneCheck.length < 7 || onFilePhoneCheck !== enteredPhoneCheck) {
        return ContentService.createTextOutput(JSON.stringify({status: 'error', message: 'Verification failed'}))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }

    const sheet = getOrCreateContactsSheet(ss);
    const map = headerMap(sheet);
    const rows = sheet.getDataRange().getValues();
    // If this save came with an originalName (the person was renamed), look up
    // the row by the OLD name so we rename it in place instead of creating a
    // duplicate row under the new name.
    const nameLower = String(data.originalName || data.name || '').trim().toLowerCase();
    let rowIndex = -1;
    for (let i = 1; i < rows.length; i++) {
      if (String(rows[i][map['Name']]).trim().toLowerCase() === nameLower) {
        rowIndex = i + 1;
        break;
      }
    }

    let photoUrl = rowIndex > 0 ? rows[rowIndex - 1][map['PhotoURL']] : '';
    let photoError = '';
    if (data.photoBase64) {
      try {
        const uploaded = savePhotoToDrive(data.photoBase64, data.name);
        if (uploaded) photoUrl = uploaded;
      } catch (err) {
        photoError = String(err && err.message ? err.message : err);
        console.log('Photo upload failed: ' + photoError);
      }
    }

    const combinedLicense = buildCombinedLicense(data.displayLicense || '', data.specialEffectsLicense || '', data.flameLicense || '');
    const newRow = [];
    newRow[map['Name']] = data.name;
    if (map['License'] !== undefined) newRow[map['License']] = combinedLicense;
    newRow[map['DisplayLicense']] = data.displayLicense || '';
    newRow[map['SpecialEffectsLicense']] = data.specialEffectsLicense || '';
    newRow[map['FlameLicense']] = data.flameLicense || '';
    newRow[map['Address']] = data.address || '';
    newRow[map['Age']] = data.age || '';
    newRow[map['Phone']] = data.phone || '';
    newRow[map['Email']] = data.email || '';
    newRow[map['PhotoURL']] = photoUrl || '';
    newRow[map['EmergencyContact']] = data.emergencyContact || '';
    newRow[map['EmergencyContactPhone']] = data.emergencyContactPhone || '';

    if (rowIndex > 0) {
      sheet.getRange(rowIndex, 1, 1, newRow.length).setValues([newRow]);
    } else {
      sheet.appendRow(newRow);
    }
    CacheService.getScriptCache().remove(CONTACTS_CACHE_KEY);
    return ContentService.createTextOutput(JSON.stringify({status: 'ok', photoUrl: photoUrl, photoError: photoError}))
      .setMimeType(ContentService.MimeType.JSON);
  }

  if (data.recordType === 'deleteContact') {
    const sheet = ss.getSheetByName('Contacts');
    if (sheet) {
      const map = headerMap(sheet);
      const rows = sheet.getDataRange().getValues();
      const nameLower = String(data.name || '').trim().toLowerCase();
      for (let i = 1; i < rows.length; i++) {
        if (String(rows[i][map['Name']]).trim().toLowerCase() === nameLower) {
          sheet.deleteRow(i + 1);
          break;
        }
      }
    }
    CacheService.getScriptCache().remove(CONTACTS_CACHE_KEY);
    return ContentService.createTextOutput(JSON.stringify({status: 'ok'}))
      .setMimeType(ContentService.MimeType.JSON);
  }

  if (data.recordType === 'deleteContactRow') {
    const sheet = ss.getSheetByName('Contacts');
    if (sheet && data.rowNumber) {
      sheet.deleteRow(Number(data.rowNumber));
    }
    CacheService.getScriptCache().remove(CONTACTS_CACHE_KEY);
    return ContentService.createTextOutput(JSON.stringify({status: 'ok'}))
      .setMimeType(ContentService.MimeType.JSON);
  }

  if (data.recordType === 'deleteVenueRow') {
    const sheet = ss.getSheetByName('Venues');
    if (sheet && data.rowNumber) {
      sheet.deleteRow(Number(data.rowNumber));
    }
    CacheService.getScriptCache().remove(VENUES_CACHE_KEY);
    return ContentService.createTextOutput(JSON.stringify({status: 'ok'}))
      .setMimeType(ContentService.MimeType.JSON);
  }

  if (data.recordType === 'announcement') {
    const sheet = getOrCreateAnnouncementsSheet(ss);
    sheet.appendRow([new Date(), data.message || '']);
    CacheService.getScriptCache().remove(ANNOUNCEMENTS_CACHE_KEY);
    return ContentService.createTextOutput(JSON.stringify({status: 'ok'}))
      .setMimeType(ContentService.MimeType.JSON);
  }

  if (data.recordType === 'deleteAnnouncementRow') {
    const sheet = ss.getSheetByName('Announcements');
    if (sheet && data.rowNumber) {
      sheet.deleteRow(Number(data.rowNumber));
    }
    CacheService.getScriptCache().remove(ANNOUNCEMENTS_CACHE_KEY);
    return ContentService.createTextOutput(JSON.stringify({status: 'ok'}))
      .setMimeType(ContentService.MimeType.JSON);
  }

  if (data.recordType === 'pickList') {
    const name = String(data.name || '').trim();
    if (!name) return jsonOut({status: 'error', message: 'Missing show name'});
    const dataJson = JSON.stringify(data.data && typeof data.data === 'object' ? data.data : {});
    if (dataJson.length > 45000) return jsonOut({status: 'error', message: 'Pick list is too large'});
    const sheet = getOrCreatePickListsSheet(ss);
    const map = headerMap(sheet);
    const row = findPickListRow(sheet, map, name);
    const eventDate = normalizeDateValue(data.eventDate);
    if (row > 0) {
      // Only touch the fields this save owns, so an uploaded site map is never lost.
      sheet.getRange(row, map['EventDate'] + 1).setValue(eventDate);
      sheet.getRange(row, map['DataJson'] + 1).setValue(dataJson);
      sheet.getRange(row, map['UpdatedAt'] + 1).setValue(new Date());
    } else {
      const newRow = ['', '', '', '', '', ''];
      newRow[map['Name']] = name;
      newRow[map['EventDate']] = eventDate;
      newRow[map['SiteMapUrl']] = '';
      newRow[map['SiteMapFileId']] = '';
      newRow[map['DataJson']] = dataJson;
      newRow[map['UpdatedAt']] = new Date();
      sheet.appendRow(newRow);
    }
    return jsonOut({status: 'ok'});
  }

  if (data.recordType === 'pickListSiteMap') {
    const name = String(data.name || '').trim();
    if (!name) return jsonOut({status: 'error', message: 'Missing show name'});
    const sheet = getOrCreatePickListsSheet(ss);
    const map = headerMap(sheet);
    let row = findPickListRow(sheet, map, name);
    if (row < 0) {
      const newRow = ['', '', '', '', '', ''];
      newRow[map['Name']] = name;
      newRow[map['DataJson']] = '{}';
      newRow[map['UpdatedAt']] = new Date();
      sheet.appendRow(newRow);
      row = sheet.getLastRow();
    }
    const oldId = String(sheet.getRange(row, map['SiteMapFileId'] + 1).getValue() || '');
    let newUrl = '';
    let newId = '';
    if (!data.remove) {
      const saved = saveSiteMapToDrive(data.imageBase64, name);
      if (!saved) return jsonOut({status: 'error', message: 'Could not read that image'});
      newUrl = saved.url;
      newId = saved.fileId;
    }
    sheet.getRange(row, map['SiteMapUrl'] + 1).setValue(newUrl);
    sheet.getRange(row, map['SiteMapFileId'] + 1).setValue(newId);
    sheet.getRange(row, map['UpdatedAt'] + 1).setValue(new Date());
    if (oldId) {
      try { DriveApp.getFileById(oldId).setTrashed(true); } catch (err) { /* already gone */ }
    }
    return jsonOut({status: 'ok', siteMapUrl: newUrl});
  }

  if (data.recordType === 'inventoryContainer') {
    const container = String(data.container || '').trim();
    if (!container) return jsonOut({status: 'error', message: 'Missing container name'});
    const itemsJson = JSON.stringify(Array.isArray(data.items) ? data.items : []);
    if (itemsJson.length > 45000) return jsonOut({status: 'error', message: 'This container has too many items to save at once'});
    const sheet = getOrCreateInventorySheet(ss);
    const map = headerMap(sheet);
    // originalContainer lets a rename update the same row instead of creating a duplicate, same as venues.
    const row = findInventoryRow(sheet, map, data.originalContainer || container);
    if (row > 0) {
      sheet.getRange(row, map['Container'] + 1).setValue(container);
      sheet.getRange(row, map['ItemsJson'] + 1).setValue(itemsJson);
      sheet.getRange(row, map['UpdatedAt'] + 1).setValue(new Date());
    } else {
      const newRow = ['', '', ''];
      newRow[map['Container']] = container;
      newRow[map['ItemsJson']] = itemsJson;
      newRow[map['UpdatedAt']] = new Date();
      sheet.appendRow(newRow);
    }
    return jsonOut({status: 'ok'});
  }

  if (data.recordType === 'deleteInventoryContainer') {
    const sheet = ss.getSheetByName('Inventory');
    if (sheet) {
      const map = headerMap(sheet);
      const row = findInventoryRow(sheet, map, data.container);
      if (row > 0) sheet.deleteRow(row);
    }
    return jsonOut({status: 'ok'});
  }

  if (data.recordType === 'pickListRacksConfig') {
    const json = JSON.stringify(data.racksConfig && typeof data.racksConfig === 'object' ? data.racksConfig : {});
    if (json.length > 2000) return jsonOut({status: 'error', message: 'Rack settings are too large'});
    setPickListSetting(ss, 'racksConfig', json);
    return jsonOut({status: 'ok'});
  }

  if (data.recordType === 'toggleVenueSignIn') {
    const sheet = getOrCreateVenuesSheet(ss);
    const map = headerMap(sheet);
    const rows = sheet.getDataRange().getValues();
    const nameLower = String(data.name || '').trim().toLowerCase();
    for (let i = 1; i < rows.length; i++) {
      if (String(rows[i][map['Name']]).trim().toLowerCase() === nameLower) {
        sheet.getRange(i + 1, map['SignInEnabled'] + 1).setValue(data.enabled ? 'Yes' : 'No');
        break;
      }
    }
    CacheService.getScriptCache().remove(VENUES_CACHE_KEY);
    return ContentService.createTextOutput(JSON.stringify({status: 'ok'}))
      .setMimeType(ContentService.MimeType.JSON);
  }

  if (data.recordType === 'venue') {
    const sheet = getOrCreateVenuesSheet(ss);
    const map = headerMap(sheet);
    const rows = sheet.getDataRange().getValues();
    // Same rename-in-place logic as contacts: look up by the original name
    // when one is provided, so renaming a venue doesn't create a duplicate.
    const nameLower = String(data.originalName || data.name || '').trim().toLowerCase();
    let rowIndex = -1;
    for (let i = 1; i < rows.length; i++) {
      if (String(rows[i][map['Name']]).trim().toLowerCase() === nameLower) {
        rowIndex = i + 1;
        break;
      }
    }

    const newRow = [];
    newRow[map['Name']] = data.name;
    newRow[map['Address']] = data.address || '';
    newRow[map['County']] = data.county || '';
    newRow[map['EventDate']] = data.eventDate || '';

    if (rowIndex > 0) {
      sheet.getRange(rowIndex, 1, 1, newRow.length).setValues([newRow]);
    } else {
      sheet.appendRow(newRow);
    }
    CacheService.getScriptCache().remove(VENUES_CACHE_KEY);
    return ContentService.createTextOutput(JSON.stringify({status: 'ok'}))
      .setMimeType(ContentService.MimeType.JSON);
  }

  const sheet = ss.getSheetByName('Sheet1');
  sheet.appendRow([new Date(), data.event, data.eventDate, data.name, data.license, data.address, data.age, data.phone || '', data.checkInTime || '', data.isHeadPyro ? 'Yes' : '']);
  return ContentService.createTextOutput(JSON.stringify({status: 'ok'}))
    .setMimeType(ContentService.MimeType.JSON);
}

function normalizeDateValue(value) {
  if (Object.prototype.toString.call(value) === '[object Date]') {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  return String(value || '').slice(0, 10);
}

function doGet(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  if (e.parameter.type === 'names') {
    const merged = getMergedContacts(ss);
    const names = Object.values(merged).map(c => c.name).sort((a, b) => a.localeCompare(b));
    return ContentService.createTextOutput(JSON.stringify(names))
      .setMimeType(ContentService.MimeType.JSON);
  }

  if (e.parameter.type === 'verifyPerson') {
    const merged = getMergedContacts(ss);
    const nameKey = String(e.parameter.name || '').trim().toLowerCase();
    const enteredPhone = String(e.parameter.phone || '').replace(/\D/g, '');
    const match = merged[nameKey];
    const onFilePhone = match ? String(match.phone || '').replace(/\D/g, '') : '';
    if (match && onFilePhone && enteredPhone.length >= 7 && onFilePhone === enteredPhone) {
      return ContentService.createTextOutput(JSON.stringify({
        verified: true,
        license: match.license || '',
        displayLicense: match.displayLicense || '',
        specialEffectsLicense: match.specialEffectsLicense || '',
        flameLicense: match.flameLicense || '',
        address: match.address || '',
        age: match.age || '',
        phone: match.phone || '',
        email: match.email || '',
        photoUrl: match.photoUrl || '',
        emergencyContact: match.emergencyContact || '',
        emergencyContactPhone: match.emergencyContactPhone || ''
      })).setMimeType(ContentService.MimeType.JSON);
    }
    return ContentService.createTextOutput(JSON.stringify({verified: false}))
      .setMimeType(ContentService.MimeType.JSON);
  }

  if (e.parameter.type === 'contacts') {
    const sheet = ss.getSheetByName('Contacts');
    if (!sheet) {
      return ContentService.createTextOutput(JSON.stringify([]))
        .setMimeType(ContentService.MimeType.JSON);
    }
    const map = headerMap(sheet);
    const rows = sheet.getDataRange().getValues();
    const results = rows.slice(1)
      .filter(row => row[map['Name']])
      .map(row => {
        const displayLicense = row[map['DisplayLicense']] || '';
        const specialEffectsLicense = row[map['SpecialEffectsLicense']] || '';
        const flameLicense = row[map['FlameLicense']] || '';
        return {
          name: row[map['Name']],
          displayLicense: displayLicense,
          specialEffectsLicense: specialEffectsLicense,
          flameLicense: flameLicense,
          license: buildCombinedLicense(displayLicense, specialEffectsLicense, flameLicense),
          address: row[map['Address']],
          age: row[map['Age']],
          phone: row[map['Phone']] || '',
          email: row[map['Email']] || '',
          photoUrl: row[map['PhotoURL']] || '',
          emergencyContact: row[map['EmergencyContact']] || '',
          emergencyContactPhone: row[map['EmergencyContactPhone']] || ''
        };
      });
    return ContentService.createTextOutput(JSON.stringify(results))
      .setMimeType(ContentService.MimeType.JSON);
  }

  if (e.parameter.type === 'findDuplicateContacts') {
    const sheet = ss.getSheetByName('Contacts');
    if (!sheet) {
      return ContentService.createTextOutput(JSON.stringify([]))
        .setMimeType(ContentService.MimeType.JSON);
    }
    const map = headerMap(sheet);
    const rows = sheet.getDataRange().getValues();
    const groups = {};
    rows.slice(1).forEach((row, i) => {
      const name = row[map['Name']];
      if (!name) return;
      const key = String(name).trim().toLowerCase();
      if (!groups[key]) groups[key] = [];
      groups[key].push({
        rowNumber: i + 2,
        name: String(name).trim(),
        displayLicense: row[map['DisplayLicense']] || '',
        specialEffectsLicense: row[map['SpecialEffectsLicense']] || '',
        flameLicense: row[map['FlameLicense']] || '',
        address: row[map['Address']] || '',
        age: row[map['Age']] || '',
        phone: row[map['Phone']] || '',
        email: row[map['Email']] || '',
        photoUrl: row[map['PhotoURL']] || '',
        emergencyContact: row[map['EmergencyContact']] || '',
        emergencyContactPhone: row[map['EmergencyContactPhone']] || ''
      });
    });
    const duplicates = Object.values(groups)
      .filter(g => g.length > 1)
      .map(g => ({ rows: g }));
    return ContentService.createTextOutput(JSON.stringify(duplicates))
      .setMimeType(ContentService.MimeType.JSON);
  }

  if (e.parameter.type === 'announcements') {
    const cache = CacheService.getScriptCache();
    const cached = cache.get(ANNOUNCEMENTS_CACHE_KEY);
    if (cached) {
      return ContentService.createTextOutput(cached).setMimeType(ContentService.MimeType.JSON);
    }
    const sheet = ss.getSheetByName('Announcements');
    if (!sheet) {
      return ContentService.createTextOutput(JSON.stringify([]))
        .setMimeType(ContentService.MimeType.JSON);
    }
    const rows = sheet.getDataRange().getValues();
    const results = rows.slice(1)
      .map((row, i) => ({
        rowNumber: i + 2,
        timestamp: row[0] instanceof Date ? row[0].toISOString() : String(row[0] || ''),
        message: row[1] || ''
      }))
      .filter(r => r.message)
      .reverse(); // newest first
    const json = JSON.stringify(results);
    try {
      cache.put(ANNOUNCEMENTS_CACHE_KEY, json, ANNOUNCEMENTS_CACHE_SECONDS);
    } catch (err) {
      // skip caching if too large
    }
    return ContentService.createTextOutput(json)
      .setMimeType(ContentService.MimeType.JSON);
  }

  if (e.parameter.type === 'pickLists') {
    // Show dates come live from the Venues sheet, so changing a venue's date never leaves a pick list behind.
    const venueDates = {};
    const vSheet = ss.getSheetByName('Venues');
    if (vSheet && vSheet.getLastRow() > 1) {
      const vm = headerMap(vSheet);
      vSheet.getDataRange().getValues().slice(1).forEach(r => {
        const n = String(r[vm['Name']] || '').trim().toLowerCase();
        if (n) venueDates[n] = normalizeDateValue(r[vm['EventDate']]);
      });
    }
    const lists = [];
    const sheet = ss.getSheetByName('PickLists');
    if (sheet && sheet.getLastRow() > 1) {
      const map = headerMap(sheet);
      sheet.getDataRange().getValues().slice(1).forEach(r => {
        const name = String(r[map['Name']] || '').trim();
        if (!name) return;
        let parsed = {};
        try { parsed = JSON.parse(r[map['DataJson']] || '{}'); } catch (err) { parsed = {}; }
        const updated = r[map['UpdatedAt']];
        lists.push({
          name: name,
          eventDate: venueDates[name.toLowerCase()] || normalizeDateValue(r[map['EventDate']]),
          siteMapUrl: String(r[map['SiteMapUrl']] || ''),
          data: parsed,
          updatedAt: updated instanceof Date ? updated.toISOString() : String(updated || '')
        });
      });
    }
    let racksConfig = {};
    try { racksConfig = JSON.parse(getPickListSetting(ss, 'racksConfig') || '{}'); } catch (err) { racksConfig = {}; }
    return jsonOut({racksConfig: racksConfig, lists: lists});
  }

  if (e.parameter.type === 'inventory') {
    const containers = [];
    const sheet = ss.getSheetByName('Inventory');
    if (sheet && sheet.getLastRow() > 1) {
      const map = headerMap(sheet);
      sheet.getDataRange().getValues().slice(1).forEach(r => {
        const name = String(r[map['Container']] || '').trim();
        if (!name) return;
        let items = [];
        try { items = JSON.parse(r[map['ItemsJson']] || '[]'); } catch (err) { items = []; }
        const updated = r[map['UpdatedAt']];
        containers.push({
          container: name,
          items: items,
          updatedAt: updated instanceof Date ? updated.toISOString() : String(updated || '')
        });
      });
    }
    containers.sort((a, b) => a.container.localeCompare(b.container));
    return jsonOut({containers: containers});
  }

  if (e.parameter.type === 'pickListSiteMapData') {
    // Returns the site map as base64 so the PDF can embed it without any cross-site image restrictions.
    const sheet = ss.getSheetByName('PickLists');
    if (!sheet) return jsonOut({dataUrl: ''});
    const map = headerMap(sheet);
    const row = findPickListRow(sheet, map, e.parameter.name);
    if (row < 0) return jsonOut({dataUrl: ''});
    const fileId = String(sheet.getRange(row, map['SiteMapFileId'] + 1).getValue() || '');
    if (!fileId) return jsonOut({dataUrl: ''});
    try {
      const blob = DriveApp.getFileById(fileId).getBlob();
      return jsonOut({dataUrl: 'data:' + blob.getContentType() + ';base64,' + Utilities.base64Encode(blob.getBytes())});
    } catch (err) {
      return jsonOut({dataUrl: '', error: 'Could not read the site map'});
    }
  }

  if (e.parameter.type === 'pyroDirectory') {
    const merged = getMergedContacts(ss);
    const results = Object.values(merged)
      .map(c => ({ name: c.name, license: c.license || '', phone: c.phone || '', email: c.email || '', photoUrl: c.photoUrl || '' }))
      .sort((a, b) => a.name.localeCompare(b.name));
    return ContentService.createTextOutput(JSON.stringify(results))
      .setMimeType(ContentService.MimeType.JSON);
  }

  if (e.parameter.type === 'venues') {
    const cache = CacheService.getScriptCache();
    const cachedVenues = cache.get(VENUES_CACHE_KEY);
    if (cachedVenues) {
      return ContentService.createTextOutput(cachedVenues)
        .setMimeType(ContentService.MimeType.JSON);
    }
    const sheet = ss.getSheetByName('Venues');
    if (!sheet) {
      return ContentService.createTextOutput(JSON.stringify([]))
        .setMimeType(ContentService.MimeType.JSON);
    }
    const values = sheet.getDataRange().getValues();
    const headers = values[0] || [];
    const idx = {};
    headers.forEach((h, i) => { idx[h] = i; });
    const results = values.slice(1)
      .filter(row => row[idx['Name']])
      .map(row => ({
        name: row[idx['Name']],
        address: row[idx['Address']],
        county: row[idx['County']] || '',
        eventDate: normalizeDateValue(row[idx['EventDate']]),
        signInEnabled: row[idx['SignInEnabled']] === 'Yes'
      }));
    const json = JSON.stringify(results);
    try {
      cache.put(VENUES_CACHE_KEY, json, VENUES_CACHE_SECONDS);
    } catch (err) {
      // skip caching if too large
    }
    return ContentService.createTextOutput(json)
      .setMimeType(ContentService.MimeType.JSON);
  }

  if (e.parameter.type === 'findDuplicateVenues') {
    const sheet = ss.getSheetByName('Venues');
    if (!sheet) {
      return ContentService.createTextOutput(JSON.stringify([]))
        .setMimeType(ContentService.MimeType.JSON);
    }
    const map = headerMap(sheet);
    const rows = sheet.getDataRange().getValues();
    const groups = {};
    rows.slice(1).forEach((row, i) => {
      const name = row[map['Name']];
      if (!name) return;
      const key = String(name).trim().toLowerCase();
      if (!groups[key]) groups[key] = [];
      groups[key].push({
        rowNumber: i + 2,
        name: String(name).trim(),
        address: row[map['Address']] || '',
        county: row[map['County']] || '',
        eventDate: normalizeDateValue(row[map['EventDate']]),
        signInEnabled: row[map['SignInEnabled']] === 'Yes'
      });
    });
    const duplicates = Object.values(groups)
      .filter(g => g.length > 1)
      .map(g => ({ rows: g }));
    return ContentService.createTextOutput(JSON.stringify(duplicates))
      .setMimeType(ContentService.MimeType.JSON);
  }

  const sheet = ss.getSheetByName('Sheet1');
  const rows = sheet.getDataRange().getValues();
  const eventFilter = e.parameter.event;
  const results = rows.slice(1)
    .map(row => ({
      timestamp: row[0], event: row[1], eventDate: normalizeDateValue(row[2]), name: row[3],
      license: row[4], address: row[5], age: row[6], phone: row[7] || '', checkInTime: row[8] || '', isHeadPyro: row[9] === 'Yes'
    }))
    .filter(r => !eventFilter || String(r.event).toLowerCase() === eventFilter.toLowerCase());
  return ContentService.createTextOutput(JSON.stringify(results))
    .setMimeType(ContentService.MimeType.JSON);
}
