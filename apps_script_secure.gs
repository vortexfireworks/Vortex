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
  const requiredHeaders = ['Name', 'Address', 'County', 'EventDate', 'SignInEnabled', 'Id'];
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

function getOrCreateShellProductsSheet(ss) {
  const requiredHeaders = ['Id', 'Size', 'Manufacturer', 'IsAssortment', 'AssortmentNumber', 'Colors', 'Effect', 'ItemNumber', 'SKU'];
  let sheet = ss.getSheetByName('ShellProducts');
  if (!sheet) {
    sheet = ss.insertSheet('ShellProducts');
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

function getOrCreateCakeProductsSheet(ss) {
  const requiredHeaders = ['Id', 'Manufacturer', 'Name', 'ShotCount', 'Gram', 'Effects', 'Colors'];
  let sheet = ss.getSheetByName('CakeProducts');
  if (!sheet) {
    sheet = ss.insertSheet('CakeProducts');
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

function getOrCreateShowPlansSheet(ss) {
  const requiredHeaders = ['Name', 'ItemsJson', 'UpdatedAt'];
  let sheet = ss.getSheetByName('ShowPlans');
  if (!sheet) {
    sheet = ss.insertSheet('ShowPlans');
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

function findShowPlanRow(sheet, map, name) {
  const rows = sheet.getDataRange().getValues();
  const key = String(name || '').trim().toLowerCase();
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][map['Name']]).trim().toLowerCase() === key) return i + 1;
  }
  return -1;
}

const AAR_FOLDER_NAME = 'Vortex After Action Reports';

function getOrCreateAarSheet(ss) {
  const requiredHeaders = ['Id', 'SavedAt', 'EventDate', 'Venue', 'Operator', 'License', 'Incidents', 'FileName', 'FileId'];
  let sheet = ss.getSheetByName('AfterActionReports');
  if (!sheet) {
    sheet = ss.insertSheet('AfterActionReports');
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

function findAarRow(sheet, map, id) {
  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][map['Id']]) === String(id)) return i + 1;
  }
  return -1;
}

// Saved privately in the script owner's Drive (no public link) — these reports hold crew licence numbers and addresses.
function saveAarPdfToDrive(base64, fileName) {
  const bytes = Utilities.base64Decode(base64);
  if (!bytes || !bytes.length || bytes.length > 15 * 1024 * 1024) return null;   // safety cap: 15 MB
  const blob = Utilities.newBlob(bytes, 'application/pdf', fileName);
  const folders = DriveApp.getFoldersByName(AAR_FOLDER_NAME);
  const folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(AAR_FOLDER_NAME);
  return folder.createFile(blob).getId();
}

function trashDriveFileQuietly(fileId) {
  if (!fileId) return;
  try { DriveApp.getFileById(String(fileId)).setTrashed(true); } catch (err) { /* already gone */ }
}

function getOrCreateFireworkProductsSheet(ss) {
  const requiredHeaders = ['Name', 'Type', 'Size', 'Manufacturer', 'Effects', 'SKU', 'IsAssortment', 'AssortmentJson'];
  let sheet = ss.getSheetByName('FireworkProducts');
  if (!sheet) {
    sheet = ss.insertSheet('FireworkProducts');
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

function findFireworkProductRow(sheet, map, name) {
  const rows = sheet.getDataRange().getValues();
  const key = String(name || '').trim().toLowerCase();
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][map['Name']]).trim().toLowerCase() === key) return i + 1;
  }
  return -1;
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

function getOrCreateInventoryHistorySheet(ss) {
  const requiredHeaders = ['Timestamp', 'Type', 'FromContainer', 'Item', 'Quantity', 'Destination', 'Note'];
  let sheet = ss.getSheetByName('InventoryHistory');
  if (!sheet) {
    sheet = ss.insertSheet('InventoryHistory');
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

function describeInventoryItem(item) {
  const sizeLabels = {'2.5': '2-1/2"', '3': '3"', '4': '4"', '5': '5"', '6': '6"', '8': '8"'};
  const unitLabels = {'boxes': 'boxes', 'shells': 'shells', 'pairs': 'pairs'};
  const main = item.type === 'cake' ? 'Cake' : (sizeLabels[item.size] || item.size || 'Shell');
  const bits = [main];
  if (item.manufacturer) bits.push(item.manufacturer);
  if (item.effects) bits.push(item.effects);
  let label = bits.join(' — ');
  if (item.type !== 'cake' && item.unit) label += ' (' + unitLabels[item.unit] + ')';
  return label;
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

/* ===================== ACCESS CONTROL =====================
   Three levels of access:
     public - Check-In, New Hire and Update My Info. These only ever get what they need.
     hp     - Head Pyro Tools: the crew directory, pick lists, Payroll, the After-Action Report, Enable Sign-In.
     admin  - Manage/Edit: everything that edits or deletes, plus the saved reports and backups.
   A page logs in once (recordType 'login') and gets a signed token that expires. Every request that is not
   public must carry a valid token of at least the level it needs. Passwords live in Script Properties,
   never in a page. The first time this runs it starts with the same two passwords the pages used before,
   so nobody is locked out; change them afterwards with setAdminPasswordNow() and setHpPasswordNow(). */
const TOKEN_LIFETIME_SECONDS = 24 * 60 * 60;
const LOGIN_FAIL_KEY = 'loginFailures_v1';
const MAX_LOGIN_FAILS = 10;
const LOGIN_LOCKOUT_SECONDS = 600;
const ORIGINAL_HP_HASH = '3527374c1ff8dad43a5fae9007904cc82041d83a5d9adb69e030a71340f54b2a';
const ORIGINAL_ADMIN_HASH = 'cf7c3f3c216f72e7b13203c30ff418dfff1206d08139fe52411603eeda3aedb2';

// What each read needs. Anything not listed here (including the check-in list) needs the Head Pyro level.
const GET_LEVELS = {
  names: 'public', verifyPerson: 'public', venues: 'public', announcements: 'public',
  contacts: 'hp', pyroDirectory: 'hp', pickLists: 'hp', pickListSiteMapData: 'hp',
  findDuplicateContacts: 'admin', findDuplicateVenues: 'admin',
  shellProducts: 'admin', cakeProducts: 'admin', showPlans: 'admin', fireworkProducts: 'admin',
  inventory: 'admin', inventoryHistory: 'admin', aarReports: 'admin', aarReportFile: 'admin', backups: 'admin'
};
// What each write needs. Anything not listed here needs the Manage/Edit level.
// (A check-in has no recordType and is public; 'contact' decides for itself below.)
const POST_LEVELS = {
  aarReport: 'hp', toggleVenueSignIn: 'hp',
  payroll: 'admin', deleteContact: 'admin', deleteContactRow: 'admin', venue: 'admin', deleteVenueRow: 'admin',
  announcement: 'admin', deleteAnnouncementRow: 'admin', pickList: 'admin', pickListSiteMap: 'admin', pickListRacksConfig: 'admin',
  shellProductsImport: 'admin', cakeProductsImport: 'admin', deleteShellProduct: 'admin', deleteCakeProduct: 'admin',
  showPlan: 'admin', deleteShowPlan: 'admin', fireworkProduct: 'admin', deleteFireworkProduct: 'admin',
  inventoryContainer: 'admin', deleteInventoryContainer: 'admin', inventoryTransfer: 'admin',
  deleteAarReport: 'admin', backupNow: 'admin'
};

function bytesToHex(bytes) {
  return bytes.map(b => ((b < 0 ? b + 256 : b)).toString(16).padStart(2, '0')).join('');
}
function sha256Hex(text) {
  return bytesToHex(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(text), Utilities.Charset.UTF_8));
}
function safeEqual(a, b) {
  a = String(a); b = String(b);
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
function getSecurityProps() {
  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty('TOKEN_SECRET')) props.setProperty('TOKEN_SECRET', Utilities.getUuid() + Utilities.getUuid());
  if (!props.getProperty('HP_PASSWORD_HASH')) props.setProperty('HP_PASSWORD_HASH', ORIGINAL_HP_HASH);
  if (!props.getProperty('ADMIN_PASSWORD_HASH')) props.setProperty('ADMIN_PASSWORD_HASH', ORIGINAL_ADMIN_HASH);
  return props;
}
// A stored password is either an original plain SHA-256 hash, or "salt$hash" for passwords set with the functions below.
function passwordMatches(stored, candidate) {
  if (!stored) return false;
  stored = String(stored);
  const at = stored.indexOf('$');
  if (at > -1) return safeEqual(sha256Hex(stored.slice(0, at) + candidate), stored.slice(at + 1));
  return safeEqual(sha256Hex(candidate), stored);
}
function saltedHash(password) {
  const salt = Utilities.getUuid();
  return salt + '$' + sha256Hex(salt + password);
}
function signPayload(payload) {
  const secret = getSecurityProps().getProperty('TOKEN_SECRET');
  return Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(payload, secret)).replace(/=+$/, '');
}
function makeToken(tier) {
  const expires = Math.floor(new Date().getTime() / 1000) + TOKEN_LIFETIME_SECONDS;
  const payload = tier + '.' + expires;
  return payload + '.' + signPayload(payload);
}
function tierFromToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const tier = parts[0];
  const expires = Number(parts[1]);
  if (tier !== 'hp' && tier !== 'admin') return null;
  if (!expires || expires < Math.floor(new Date().getTime() / 1000)) return null;
  return safeEqual(signPayload(tier + '.' + parts[1]), parts[2]) ? tier : null;
}
function tierRank(tier) {
  return tier === 'admin' ? 2 : (tier === 'hp' ? 1 : 0);
}
function authError(needed) {
  return jsonOut({
    status: 'error', code: 'auth', needs: needed,
    message: needed === 'admin' ? 'Enter the Manage/Edit password to continue.' : 'Enter the Head Pyro Tools password to continue.'
  });
}
function authorize(token, needed) {
  if (needed === 'public') return null;
  return tierRank(tierFromToken(token)) >= tierRank(needed) ? null : authError(needed);
}
function handleLogin(data) {
  const cache = CacheService.getScriptCache();
  const failures = Number(cache.get(LOGIN_FAIL_KEY) || 0);
  if (failures >= MAX_LOGIN_FAILS) {
    return jsonOut({status: 'error', code: 'locked', message: 'Too many wrong passwords. Wait a few minutes and try again.'});
  }
  const tier = data.tier === 'admin' ? 'admin' : 'hp';
  const stored = getSecurityProps().getProperty(tier === 'admin' ? 'ADMIN_PASSWORD_HASH' : 'HP_PASSWORD_HASH');
  if (passwordMatches(stored, String(data.password || ''))) {
    cache.remove(LOGIN_FAIL_KEY);
    return jsonOut({status: 'ok', token: makeToken(tier), tier: tier, expiresIn: TOKEN_LIFETIME_SECONDS});
  }
  cache.put(LOGIN_FAIL_KEY, String(failures + 1), LOGIN_LOCKOUT_SECONDS);
  return jsonOut({status: 'error', code: 'badpassword', message: 'That password is not right.'});
}

/* ---- Run these from the Apps Script editor (not from a page) ---- */
function setPasswordFor(tier, newPassword) {
  newPassword = String(newPassword || '');
  if (newPassword.length < 8) throw new Error('Use at least 8 characters for the new password.');
  getSecurityProps().setProperty(tier === 'admin' ? 'ADMIN_PASSWORD_HASH' : 'HP_PASSWORD_HASH', saltedHash(newPassword));
  signOutEveryone();   // anyone logged in with the old password has to sign in again
}
function setAdminPasswordNow() {
  const NEW_PASSWORD = '';   // type the new Manage/Edit password between the quotes, run this once, then delete it from here and save
  setPasswordFor('admin', NEW_PASSWORD);
  console.log('Manage/Edit password changed. Now delete the password from this function and save.');
}
function setHpPasswordNow() {
  const NEW_PASSWORD = '';   // type the new Head Pyro Tools password between the quotes, run this once, then delete it from here and save
  setPasswordFor('hp', NEW_PASSWORD);
  console.log('Head Pyro Tools password changed. Now delete the password from this function and save.');
}
function signOutEveryone() {
  PropertiesService.getScriptProperties().setProperty('TOKEN_SECRET', Utilities.getUuid() + Utilities.getUuid());
}
function securityStatus() {
  const props = getSecurityProps();
  const describe = key => (String(props.getProperty(key)).indexOf('$') > -1) ? 'changed (good)' : 'STILL THE ORIGINAL — change it';
  console.log('Manage/Edit password: ' + describe('ADMIN_PASSWORD_HASH'));
  console.log('Head Pyro Tools password: ' + describe('HP_PASSWORD_HASH'));
}

/* ===================== BACKUPS =====================
   A dated copy of this whole spreadsheet goes into a Drive folder, and only the newest few are kept.
   Run installWeeklyBackup() once from the editor to make it automatic; the Backups page can also take one on demand. */
const BACKUP_FOLDER_NAME = 'Vortex Data Backups';
const BACKUPS_TO_KEEP = 12;

function getBackupFolder() {
  const folders = DriveApp.getFoldersByName(BACKUP_FOLDER_NAME);
  return folders.hasNext() ? folders.next() : DriveApp.createFolder(BACKUP_FOLDER_NAME);
}
function backupSpreadsheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const folder = getBackupFolder();
  const stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm');
  const copy = DriveApp.getFileById(ss.getId()).makeCopy('Vortex Data Backup ' + stamp, folder);
  const files = [];
  const iter = folder.getFiles();
  while (iter.hasNext()) files.push(iter.next());
  files.sort((a, b) => b.getDateCreated().getTime() - a.getDateCreated().getTime());
  files.slice(BACKUPS_TO_KEEP).forEach(f => f.setTrashed(true));
  return { id: copy.getId(), name: copy.getName() };
}
function listBackups() {
  const folders = DriveApp.getFoldersByName(BACKUP_FOLDER_NAME);
  if (!folders.hasNext()) return [];
  const out = [];
  const iter = folders.next().getFiles();
  while (iter.hasNext()) {
    const f = iter.next();
    if (f.isTrashed()) continue;
    out.push({ id: f.getId(), name: f.getName(), createdAt: f.getDateCreated().toISOString(), url: 'https://drive.google.com/open?id=' + f.getId() });
  }
  out.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return out;
}
function weeklyBackupIsOn() {
  try {
    return ScriptApp.getProjectTriggers().some(t => t.getHandlerFunction() === 'backupSpreadsheet');
  } catch (err) {
    return null;   // not authorised to look: the Backups page then says it cannot tell
  }
}
function installWeeklyBackup() {
  removeWeeklyBackup();
  ScriptApp.newTrigger('backupSpreadsheet').timeBased().onWeekDay(ScriptApp.WeekDay.SUNDAY).atHour(3).create();
  console.log('Weekly backup is on: every Sunday around 3 AM. The newest ' + BACKUPS_TO_KEEP + ' are kept in the Drive folder "' + BACKUP_FOLDER_NAME + '".');
}
function removeWeeklyBackup() {
  ScriptApp.getProjectTriggers().forEach(t => { if (t.getHandlerFunction() === 'backupSpreadsheet') ScriptApp.deleteTrigger(t); });
}

function doPost(e) {
  const data = JSON.parse(e.postData.contents);
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  if (data.recordType === 'login') return handleLogin(data);
  if (data.recordType && data.recordType !== 'contact') {
    const denied = authorize(data.token, POST_LEVELS[data.recordType] || 'admin');
    if (denied) return denied;
  }

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
    // Three ways in: the manager (token), a person updating their own record (name + phone must match what is on file),
    // or a brand-new person (createOnly: it can add a record but never touch an existing one).
    const isAdmin = tierRank(tierFromToken(data.token)) >= 2;
    if (!isAdmin && !data.verifyPhone && !data.createOnly) return authError('admin');
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
    const createOnlyRequest = !!data.createOnly && !isAdmin && !data.verifyPhone;
    const nameLower = String((createOnlyRequest ? data.name : (data.originalName || data.name)) || '').trim().toLowerCase();
    let rowIndex = -1;
    for (let i = 1; i < rows.length; i++) {
      if (String(rows[i][map['Name']]).trim().toLowerCase() === nameLower) {
        rowIndex = i + 1;
        break;
      }
    }
    if (createOnlyRequest && rowIndex > 0) return jsonOut({status: 'ok', existing: true});   // already on file: change nothing

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
    if (sheet && data.id) {
      const map = headerMap(sheet);
      const rows = sheet.getDataRange().getValues();
      for (let i = 1; i < rows.length; i++) {
        if (String(rows[i][map['Id']]) === String(data.id)) { sheet.deleteRow(i + 1); break; }
      }
    } else if (sheet && data.rowNumber) {
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

  if (data.recordType === 'aarReport') {
    const base64 = String(data.pdfBase64 || '').replace(/^data:application\/pdf[^,]*;base64,/, '');
    if (!base64) return jsonOut({status: 'error', message: 'Missing the report PDF'});
    const operator = String(data.operator || '').trim().slice(0, 120);
    const eventDate = normalizeDateValue(data.eventDate);
    if (!operator && !eventDate) return jsonOut({status: 'error', message: 'Missing operator name and event date'});
    let fileName = String(data.fileName || '').replace(/[\\\/:*?"<>|]/g, '').trim().slice(0, 120);
    if (!fileName) fileName = 'AAR_' + (eventDate || 'report') + '.pdf';
    if (!/\.pdf$/i.test(fileName)) fileName += '.pdf';

    const sheet = getOrCreateAarSheet(ss);
    const map = headerMap(sheet);
    const row = data.id ? findAarRow(sheet, map, data.id) : -1;

    // Save the new file first, so a Drive problem can never damage an existing saved report.
    const fileId = saveAarPdfToDrive(base64, fileName);
    if (!fileId) return jsonOut({status: 'error', message: 'Could not save that PDF to Drive'});

    const values = {
      SavedAt: new Date(),
      EventDate: eventDate,
      Venue: String(data.venue || '').trim().slice(0, 200),
      Operator: operator,
      License: String(data.license || '').trim().slice(0, 60),
      Incidents: String(data.incidents || '').trim().slice(0, 200),
      FileName: fileName,
      FileId: fileId
    };
    let id;
    if (row > 0) {
      id = String(data.id);
      const oldFileId = sheet.getRange(row, map['FileId'] + 1).getValue();
      Object.keys(values).forEach(k => sheet.getRange(row, map[k] + 1).setValue(values[k]));
      trashDriveFileQuietly(oldFileId);
    } else {
      id = Utilities.getUuid();
      const newRow = new Array(Object.keys(map).length).fill('');
      newRow[map['Id']] = id;
      Object.keys(values).forEach(k => { newRow[map[k]] = values[k]; });
      sheet.appendRow(newRow);
    }
    return jsonOut({status: 'ok', id: id, fileId: fileId, replaced: row > 0});
  }

  if (data.recordType === 'deleteAarReport') {
    const sheet = ss.getSheetByName('AfterActionReports');
    if (sheet && data.id) {
      const map = headerMap(sheet);
      const row = findAarRow(sheet, map, data.id);
      if (row > 0) {
        trashDriveFileQuietly(sheet.getRange(row, map['FileId'] + 1).getValue());
        sheet.deleteRow(row);
      }
    }
    return jsonOut({status: 'ok'});
  }

  if (data.recordType === 'backupNow') {
    const made = backupSpreadsheet();
    return jsonOut({status: 'ok', name: made.name});
  }

  if (data.recordType === 'shellProductsImport') {
    const rows = Array.isArray(data.rows) ? data.rows : [];
    if (!rows.length) return jsonOut({status: 'error', message: 'No rows to import'});
    if (rows.length > 3000) return jsonOut({status: 'error', message: 'That CSV has too many rows to import at once (max 3000)'});
    const sheet = getOrCreateShellProductsSheet(ss);
    const map = headerMap(sheet);
    const bulk = rows.map(r => {
      const row = new Array(Object.keys(map).length).fill('');
      row[map['Id']] = Utilities.getUuid();
      row[map['Size']] = String(r.size || '');
      row[map['Manufacturer']] = String(r.manufacturer || '');
      row[map['IsAssortment']] = r.isAssortment ? 'Yes' : 'No';
      row[map['AssortmentNumber']] = String(r.assortmentNumber || '');
      row[map['Colors']] = String(r.colors || '');
      row[map['Effect']] = String(r.effect || '');
      row[map['ItemNumber']] = String(r.itemNumber || '');
      row[map['SKU']] = String(r.sku || '');
      return row;
    });
    sheet.getRange(sheet.getLastRow() + 1, 1, bulk.length, bulk[0].length).setValues(bulk);
    return jsonOut({status: 'ok', imported: bulk.length});
  }

  if (data.recordType === 'cakeProductsImport') {
    const rows = Array.isArray(data.rows) ? data.rows : [];
    if (!rows.length) return jsonOut({status: 'error', message: 'No rows to import'});
    if (rows.length > 3000) return jsonOut({status: 'error', message: 'That CSV has too many rows to import at once (max 3000)'});
    const sheet = getOrCreateCakeProductsSheet(ss);
    const map = headerMap(sheet);
    const bulk = rows.map(r => {
      const row = new Array(Object.keys(map).length).fill('');
      row[map['Id']] = Utilities.getUuid();
      row[map['Manufacturer']] = String(r.manufacturer || '');
      row[map['Name']] = String(r.name || '');
      row[map['ShotCount']] = String(r.shotCount || '');
      row[map['Gram']] = String(r.gram || '');
      row[map['Effects']] = String(r.effects || '');
      row[map['Colors']] = String(r.colors || '');
      return row;
    });
    sheet.getRange(sheet.getLastRow() + 1, 1, bulk.length, bulk[0].length).setValues(bulk);
    return jsonOut({status: 'ok', imported: bulk.length});
  }

  if (data.recordType === 'deleteShellProduct') {
    const sheet = ss.getSheetByName('ShellProducts');
    if (sheet) {
      const map = headerMap(sheet);
      const rows = sheet.getDataRange().getValues();
      for (let i = 1; i < rows.length; i++) {
        if (String(rows[i][map['Id']]) === String(data.id)) { sheet.deleteRow(i + 1); break; }
      }
    }
    return jsonOut({status: 'ok'});
  }

  if (data.recordType === 'deleteCakeProduct') {
    const sheet = ss.getSheetByName('CakeProducts');
    if (sheet) {
      const map = headerMap(sheet);
      const rows = sheet.getDataRange().getValues();
      for (let i = 1; i < rows.length; i++) {
        if (String(rows[i][map['Id']]) === String(data.id)) { sheet.deleteRow(i + 1); break; }
      }
    }
    return jsonOut({status: 'ok'});
  }

  if (data.recordType === 'showPlan') {
    const name = String(data.name || '').trim();
    if (!name) return jsonOut({status: 'error', message: 'Missing plan name'});
    const itemsJson = JSON.stringify(Array.isArray(data.items) ? data.items : []);
    if (itemsJson.length > 200000) return jsonOut({status: 'error', message: 'That plan is too large to save at once'});
    const sheet = getOrCreateShowPlansSheet(ss);
    const map = headerMap(sheet);
    const row = findShowPlanRow(sheet, map, data.originalName || name);
    if (row > 0) {
      sheet.getRange(row, map['Name'] + 1).setValue(name);
      sheet.getRange(row, map['ItemsJson'] + 1).setValue(itemsJson);
      sheet.getRange(row, map['UpdatedAt'] + 1).setValue(new Date());
    } else {
      const newRow = ['', '', ''];
      newRow[map['Name']] = name;
      newRow[map['ItemsJson']] = itemsJson;
      newRow[map['UpdatedAt']] = new Date();
      sheet.appendRow(newRow);
    }
    return jsonOut({status: 'ok'});
  }

  if (data.recordType === 'deleteShowPlan') {
    const sheet = ss.getSheetByName('ShowPlans');
    if (sheet) {
      const map = headerMap(sheet);
      const row = findShowPlanRow(sheet, map, data.name);
      if (row > 0) sheet.deleteRow(row);
    }
    return jsonOut({status: 'ok'});
  }

  if (data.recordType === 'fireworkProduct') {
    const name = String(data.name || '').trim();
    if (!name) return jsonOut({status: 'error', message: 'Missing product name'});

    const isAssortment = !!data.isAssortment;
    let assortment = [];
    let effects = String(data.effects || '').trim();
    if (isAssortment) {
      assortment = (Array.isArray(data.assortment) ? data.assortment : [])
        .map(a => ({ effect: String(a.effect || '').trim(), qty: Math.max(0, Math.round(Number(a.qty) || 0)) }))
        .filter(a => a.effect && a.qty > 0)
        .slice(0, 50);   // 36 is the expected norm; this is just a generous safety cap
      if (!assortment.length) return jsonOut({status: 'error', message: 'Add at least one effect and quantity for this box'});
      // Auto-build a plain-text summary so anything that only reads the simple
      // Effects column (like Manage Inventory's autofill) still gets something useful.
      const total = assortment.reduce((sum, a) => sum + a.qty, 0);
      effects = `Assorted (${assortment.length} effects, ${total} shells): ` +
        assortment.map(a => `${a.effect} x${a.qty}`).join(', ');
    }
    const assortmentJson = JSON.stringify(assortment);
    if (assortmentJson.length > 12000) return jsonOut({status: 'error', message: 'That box has too many effects listed at once'});

    const sheet = getOrCreateFireworkProductsSheet(ss);
    const map = headerMap(sheet);
    // originalName lets a rename update the same row instead of creating a duplicate, same as operators/venues.
    const row = findFireworkProductRow(sheet, map, data.originalName || name);
    const newRow = ['', '', '', '', '', '', '', ''];
    newRow[map['Name']] = name;
    newRow[map['Type']] = data.type === 'cake' ? 'cake' : 'shell';
    newRow[map['Size']] = data.type === 'cake' ? '' : (data.size || '');
    newRow[map['Manufacturer']] = data.manufacturer || '';
    newRow[map['Effects']] = effects;
    newRow[map['SKU']] = data.sku || '';
    newRow[map['IsAssortment']] = isAssortment ? 'Yes' : 'No';
    newRow[map['AssortmentJson']] = assortmentJson;
    if (row > 0) {
      sheet.getRange(row, 1, 1, newRow.length).setValues([newRow]);
    } else {
      sheet.appendRow(newRow);
    }
    return jsonOut({status: 'ok'});
  }

  if (data.recordType === 'deleteFireworkProduct') {
    const sheet = ss.getSheetByName('FireworkProducts');
    if (sheet) {
      const map = headerMap(sheet);
      const row = findFireworkProductRow(sheet, map, data.name);
      if (row > 0) sheet.deleteRow(row);
    }
    return jsonOut({status: 'ok'});
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

  if (data.recordType === 'inventoryTransfer') {
    const fromContainer = String(data.fromContainer || '').trim();
    const itemId = String(data.itemId || '').trim();
    const qtyToMove = Number(data.qty);
    const destinationType = data.destinationType; // 'container' | 'show' | 'remove'
    const destinationName = String(data.destinationName || '').trim();
    const note = String(data.note || '').trim().slice(0, 300);

    if (!fromContainer || !itemId) return jsonOut({status: 'error', message: 'Missing container or item'});
    if (!qtyToMove || qtyToMove <= 0) return jsonOut({status: 'error', message: 'Enter a quantity greater than 0'});
    if (destinationType === 'container' && !destinationName) return jsonOut({status: 'error', message: 'Choose a destination container'});
    if (destinationType === 'show' && !destinationName) return jsonOut({status: 'error', message: 'Choose a show'});
    if (destinationType === 'container' && destinationName.toLowerCase() === fromContainer.toLowerCase()) {
      return jsonOut({status: 'error', message: 'Choose a different container to transfer to'});
    }

    const sheet = getOrCreateInventorySheet(ss);
    const map = headerMap(sheet);
    const fromRow = findInventoryRow(sheet, map, fromContainer);
    if (fromRow < 0) return jsonOut({status: 'error', message: 'Source container not found — try reloading the page'});

    let fromItems = [];
    try { fromItems = JSON.parse(sheet.getRange(fromRow, map['ItemsJson'] + 1).getValue() || '[]'); } catch (err) { fromItems = []; }
    const itemIndex = fromItems.findIndex(it => String(it.id) === itemId);
    if (itemIndex < 0) return jsonOut({status: 'error', message: 'That item could not be found — try reloading the page'});
    const item = fromItems[itemIndex];
    const available = Number(item.qty) || 0;
    if (qtyToMove > available) return jsonOut({status: 'error', message: 'Only ' + available + ' available to move'});

    const itemDescription = describeInventoryItem(item);

    // Update the source: reduce quantity, drop the line entirely once it hits zero.
    if (qtyToMove >= available) {
      fromItems.splice(itemIndex, 1);
    } else {
      fromItems[itemIndex] = Object.assign({}, item, { qty: available - qtyToMove });
    }
    sheet.getRange(fromRow, map['ItemsJson'] + 1).setValue(JSON.stringify(fromItems));
    sheet.getRange(fromRow, map['UpdatedAt'] + 1).setValue(new Date());

    let destinationLabel = '';
    let historyType = '';

    if (destinationType === 'container') {
      historyType = 'Transfer';
      destinationLabel = destinationName;
      const destRow = findInventoryRow(sheet, map, destinationName);
      let destItems = [];
      if (destRow > 0) {
        try { destItems = JSON.parse(sheet.getRange(destRow, map['ItemsJson'] + 1).getValue() || '[]'); } catch (err) { destItems = []; }
      }
      // Merge into a matching existing item if one exists, otherwise add it as a new line.
      const matchIndex = destItems.findIndex(it =>
        it.type === item.type && it.size === item.size && it.unit === item.unit &&
        (it.manufacturer || '') === (item.manufacturer || '') && (it.effects || '') === (item.effects || '') &&
        (it.sku || '') === (item.sku || '')
      );
      if (matchIndex > -1) {
        destItems[matchIndex] = Object.assign({}, destItems[matchIndex], { qty: (Number(destItems[matchIndex].qty) || 0) + qtyToMove });
      } else {
        destItems.push(Object.assign({}, item, { id: Utilities.getUuid(), qty: qtyToMove }));
      }
      if (destRow > 0) {
        sheet.getRange(destRow, map['ItemsJson'] + 1).setValue(JSON.stringify(destItems));
        sheet.getRange(destRow, map['UpdatedAt'] + 1).setValue(new Date());
      } else {
        const newDestRow = ['', '', ''];
        newDestRow[map['Container']] = destinationName;
        newDestRow[map['ItemsJson']] = JSON.stringify(destItems);
        newDestRow[map['UpdatedAt']] = new Date();
        sheet.appendRow(newDestRow);
      }
    } else if (destinationType === 'show') {
      historyType = 'Pull';
      destinationLabel = destinationName;
    } else {
      historyType = 'Remove';
      destinationLabel = 'Removed';
    }

    const historySheet = getOrCreateInventoryHistorySheet(ss);
    historySheet.appendRow([new Date(), historyType, fromContainer, itemDescription, qtyToMove, destinationLabel, note]);

    return jsonOut({status: 'ok', historyType: historyType});
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
    const wantDate = String(data.eventDate || '').slice(0, 10);
    // The same venue can have several dates, so match the exact entry: by its Id first,
    // then by name + date. Name alone is only used if no date was sent (older pages).
    let targetRow = -1;
    if (data.id) {
      for (let i = 1; i < rows.length; i++) {
        if (String(rows[i][map['Id']]) === String(data.id)) { targetRow = i + 1; break; }
      }
    }
    if (targetRow < 0) {
      for (let i = 1; i < rows.length; i++) {
        const sameName = String(rows[i][map['Name']]).trim().toLowerCase() === nameLower;
        const sameDate = !wantDate || normalizeDateValue(rows[i][map['EventDate']]) === wantDate;
        if (sameName && sameDate) { targetRow = i + 1; break; }
      }
    }
    if (targetRow > 0) {
      sheet.getRange(targetRow, map['SignInEnabled'] + 1).setValue(data.enabled ? 'Yes' : 'No');
    }
    CacheService.getScriptCache().remove(VENUES_CACHE_KEY);
    return ContentService.createTextOutput(JSON.stringify({status: 'ok'}))
      .setMimeType(ContentService.MimeType.JSON);
  }

  if (data.recordType === 'venue') {
    const sheet = getOrCreateVenuesSheet(ss);
    const map = headerMap(sheet);
    const rows = sheet.getDataRange().getValues();
    // Prefer matching by the row's stable Id (every row has one; older rows get one
    // lazily backfilled the next time the venues list is read). originalName is kept
    // as a fallback only so an already-open old page still works mid-transition. A
    // fresh "add" with neither matches nothing and always creates a new row — even if
    // the name matches an existing venue, since the same venue can legitimately happen
    // on more than one date (an annual event, a second show the same year, etc.).
    let rowIndex = -1;
    if (data.id) {
      for (let i = 1; i < rows.length; i++) {
        if (String(rows[i][map['Id']]) === String(data.id)) { rowIndex = i + 1; break; }
      }
    }
    if (rowIndex < 0 && data.originalName) {
      const nameLower = String(data.originalName).trim().toLowerCase();
      for (let i = 1; i < rows.length; i++) {
        if (String(rows[i][map['Name']]).trim().toLowerCase() === nameLower) { rowIndex = i + 1; break; }
      }
    }

    const existingSignIn = rowIndex > 0 ? rows[rowIndex - 1][map['SignInEnabled']] : '';
    const existingId = rowIndex > 0 ? String(rows[rowIndex - 1][map['Id']] || '') : '';

    const newRow = [];
    newRow[map['Name']] = data.name;
    newRow[map['Address']] = data.address || '';
    newRow[map['County']] = data.county || '';
    newRow[map['EventDate']] = data.eventDate || '';
    newRow[map['SignInEnabled']] = existingSignIn || '';
    newRow[map['Id']] = existingId || Utilities.getUuid();

    if (rowIndex > 0) {
      sheet.getRange(rowIndex, 1, 1, newRow.length).setValues([newRow]);
    } else {
      sheet.appendRow(newRow);
    }
    CacheService.getScriptCache().remove(VENUES_CACHE_KEY);
    return ContentService.createTextOutput(JSON.stringify({status: 'ok', id: newRow[map['Id']]}))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // Only a real check-in (which has no recordType) reaches here. Anything else is a request this script does not know,
  // and must not be quietly written into the check-in sheet.
  if (data.recordType) return jsonOut({status: 'error', message: 'Unknown request'});

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
  const requestType = (e.parameter && e.parameter.type) || '';
  const denied = authorize(e.parameter && e.parameter.token, GET_LEVELS[requestType] || 'hp');
  if (denied) return denied;

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

  if (e.parameter.type === 'aarReports') {
    // Details only — the PDFs themselves are fetched one at a time, on request.
    const reports = [];
    const sheet = ss.getSheetByName('AfterActionReports');
    if (sheet && sheet.getLastRow() > 1) {
      const map = headerMap(sheet);
      sheet.getDataRange().getValues().slice(1).forEach(r => {
        const id = String(r[map['Id']] || '').trim();
        if (!id) return;
        const saved = r[map['SavedAt']];
        reports.push({
          id: id,
          savedAt: saved instanceof Date ? saved.toISOString() : String(saved || ''),
          eventDate: normalizeDateValue(r[map['EventDate']]),
          venue: String(r[map['Venue']] || ''),
          operator: String(r[map['Operator']] || ''),
          license: String(r[map['License']] || ''),
          incidents: String(r[map['Incidents']] || ''),
          fileId: String(r[map['FileId']] || '')
        });
      });
    }
    reports.sort((a, b) => (b.eventDate || '').localeCompare(a.eventDate || '') || (b.savedAt || '').localeCompare(a.savedAt || ''));
    return jsonOut({reports: reports.slice(0, 1000)});
  }

  if (e.parameter.type === 'aarReportFile') {
    const sheet = ss.getSheetByName('AfterActionReports');
    if (!sheet) return jsonOut({dataUrl: '', error: 'No reports saved yet'});
    const map = headerMap(sheet);
    const row = findAarRow(sheet, map, e.parameter.id);
    if (row < 0) return jsonOut({dataUrl: '', error: 'That report was not found'});
    const fileId = String(sheet.getRange(row, map['FileId'] + 1).getValue() || '');
    const fileName = String(sheet.getRange(row, map['FileName'] + 1).getValue() || 'report.pdf');
    try {
      const file = DriveApp.getFileById(fileId);
      if (file.isTrashed()) return jsonOut({dataUrl: '', error: 'The saved PDF is in the Drive trash'});
      const blob = file.getBlob();
      return jsonOut({dataUrl: 'data:application/pdf;base64,' + Utilities.base64Encode(blob.getBytes()), fileName: fileName});
    } catch (err) {
      return jsonOut({dataUrl: '', error: 'Could not read the saved PDF from Drive'});
    }
  }

  if (e.parameter.type === 'backups') {
    return jsonOut({backups: listBackups(), weeklyOn: weeklyBackupIsOn(), keep: BACKUPS_TO_KEEP});
  }

  if (e.parameter.type === 'shellProducts') {
    const products = [];
    const sheet = ss.getSheetByName('ShellProducts');
    if (sheet && sheet.getLastRow() > 1) {
      const map = headerMap(sheet);
      sheet.getDataRange().getValues().slice(1).forEach(r => {
        const id = String(r[map['Id']] || '').trim();
        if (!id) return;
        products.push({
          id: id,
          size: String(r[map['Size']] || ''),
          manufacturer: String(r[map['Manufacturer']] || ''),
          isAssortment: r[map['IsAssortment']] === 'Yes',
          assortmentNumber: String(r[map['AssortmentNumber']] || ''),
          colors: String(r[map['Colors']] || ''),
          effect: String(r[map['Effect']] || ''),
          itemNumber: String(r[map['ItemNumber']] || ''),
          sku: String(r[map['SKU']] || '')
        });
      });
    }
    return jsonOut({products: products});
  }

  if (e.parameter.type === 'cakeProducts') {
    const products = [];
    const sheet = ss.getSheetByName('CakeProducts');
    if (sheet && sheet.getLastRow() > 1) {
      const map = headerMap(sheet);
      sheet.getDataRange().getValues().slice(1).forEach(r => {
        const id = String(r[map['Id']] || '').trim();
        if (!id) return;
        products.push({
          id: id,
          manufacturer: String(r[map['Manufacturer']] || ''),
          name: String(r[map['Name']] || ''),
          shotCount: String(r[map['ShotCount']] || ''),
          gram: String(r[map['Gram']] || ''),
          effects: String(r[map['Effects']] || ''),
          colors: String(r[map['Colors']] || '')
        });
      });
    }
    return jsonOut({products: products});
  }

  if (e.parameter.type === 'showPlans') {
    const plans = [];
    const sheet = ss.getSheetByName('ShowPlans');
    if (sheet && sheet.getLastRow() > 1) {
      const map = headerMap(sheet);
      sheet.getDataRange().getValues().slice(1).forEach(r => {
        const name = String(r[map['Name']] || '').trim();
        if (!name) return;
        let items = [];
        try { items = JSON.parse(r[map['ItemsJson']] || '[]'); } catch (err) { items = []; }
        const updated = r[map['UpdatedAt']];
        plans.push({
          name: name,
          items: items,
          updatedAt: updated instanceof Date ? updated.toISOString() : String(updated || '')
        });
      });
    }
    plans.sort((a, b) => a.name.localeCompare(b.name));
    return jsonOut({plans: plans});
  }

  if (e.parameter.type === 'fireworkProducts') {
    const products = [];
    const sheet = ss.getSheetByName('FireworkProducts');
    if (sheet && sheet.getLastRow() > 1) {
      const map = headerMap(sheet);
      sheet.getDataRange().getValues().slice(1).forEach(r => {
        const name = String(r[map['Name']] || '').trim();
        if (!name) return;
        let assortment = [];
        try { assortment = JSON.parse(r[map['AssortmentJson']] || '[]'); } catch (err) { assortment = []; }
        products.push({
          name: name,
          type: r[map['Type']] === 'cake' ? 'cake' : 'shell',
          size: String(r[map['Size']] || ''),
          manufacturer: String(r[map['Manufacturer']] || ''),
          effects: String(r[map['Effects']] || ''),
          sku: String(r[map['SKU']] || ''),
          isAssortment: r[map['IsAssortment']] === 'Yes',
          assortment: assortment
        });
      });
    }
    products.sort((a, b) => a.name.localeCompare(b.name));
    return jsonOut({products: products});
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

  if (e.parameter.type === 'inventoryHistory') {
    const rows = [];
    const sheet = ss.getSheetByName('InventoryHistory');
    if (sheet && sheet.getLastRow() > 1) {
      const map = headerMap(sheet);
      sheet.getDataRange().getValues().slice(1).forEach(r => {
        const ts = r[map['Timestamp']];
        rows.push({
          timestamp: ts instanceof Date ? ts.toISOString() : String(ts || ''),
          type: String(r[map['Type']] || ''),
          from: String(r[map['FromContainer']] || ''),
          item: String(r[map['Item']] || ''),
          qty: r[map['Quantity']],
          destination: String(r[map['Destination']] || ''),
          note: String(r[map['Note']] || '')
        });
      });
    }
    rows.reverse(); // newest first
    return jsonOut({history: rows.slice(0, 300)}); // cap payload size
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
    const sheet = getOrCreateVenuesSheet(ss);
    const values = sheet.getDataRange().getValues();
    const headers = values[0] || [];
    const idx = {};
    headers.forEach((h, i) => { idx[h] = i; });
    // Lazily backfill an Id for any row that predates this column, so every venue has
    // a stable identity to edit or delete by, with no manual migration step needed.
    const idBackfills = [];
    values.slice(1).forEach((row, i) => {
      if (row[idx['Name']] && !row[idx['Id']]) {
        const newId = Utilities.getUuid();
        row[idx['Id']] = newId;
        idBackfills.push({ rowNumber: i + 2, id: newId });
      }
    });
    idBackfills.forEach(b => sheet.getRange(b.rowNumber, idx['Id'] + 1).setValue(b.id));
    const results = values.slice(1)
      .filter(row => row[idx['Name']])
      .map(row => ({
        id: String(row[idx['Id']] || ''),
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
      const eventDate = normalizeDateValue(row[map['EventDate']]);
      // Keyed by name + date: the same venue legitimately appears more than once with
      // different dates, so only an exact name+date match is a real accidental duplicate.
      const key = String(name).trim().toLowerCase() + '|' + eventDate;
      if (!groups[key]) groups[key] = [];
      groups[key].push({
        rowNumber: i + 2,
        name: String(name).trim(),
        address: row[map['Address']] || '',
        county: row[map['County']] || '',
        eventDate: eventDate,
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
