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

// Which NFPA standard(s) a venue/event falls under — checked off in Manage → Venues, autofilled
// onto the After Action Report's own checkboxes from there, and used to decide which events even
// show up in the Prox Planning Sheet (only 1126 shows do).
const KNOWN_NFPA_TYPES = ['1123', '1126', '160'];
function cleanNfpaTypes(types) {
  const list = Array.isArray(types) ? types : String(types || '').split(',');
  return list.map(t => String(t).trim()).filter(t => KNOWN_NFPA_TYPES.indexOf(t) > -1);
}

function getOrCreateVenuesSheet(ss) {
  const requiredHeaders = ['Name', 'Address', 'County', 'EventDate', 'SignInEnabled', 'Id', 'AssignedHp', 'CallTime', 'SignupLimit', 'NfpaTypes'];
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

// The general vendor-style product catalog (replaces the old shell-only / cake-only
// import for Plan a Show + Catalog): one row per catalog item, however the vendor
// categorizes it (Cakes, Shells 3in, Fountains, Comets, Finale Chains, ...), with
// price and a description carried straight through from the price list.
function getOrCreateProductsSheet(ss) {
  const requiredHeaders = ['Id', 'Class', 'Category', 'Name', 'Brand', 'Color', 'Effect', 'Duration', 'Price', 'Description', 'Url', 'ImageUrl', 'VideoId', 'KurtisApproved'];
  let sheet = ss.getSheetByName('Products');
  if (!sheet) {
    sheet = ss.insertSheet('Products');
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
  const requiredHeaders = ['Name', 'ItemsJson', 'Notes', 'UpdatedAt'];
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

/* ---- Prox (Holotron) Planning Sheet ----
   One record per venue/event (keyed by the Venues row's own Id, not its name, since a show's
   name can repeat or change — see ProxPlan below). EffectsJson holds up to PROX_PLAN_MAX_EFFECTS
   lines, each {label, holotronChannel, remoteChannel, repeaterChannel, actions} — a single effect
   can use more than one piece of equipment at once, each on its own channel. VenueName/VenueDate are a snapshot taken
   at save time so the cheat sheet and the editor can show a label without a second lookup; the
   Venues row itself (by Id) is still the source of truth for scheduling. */
const PROX_PLAN_MAX_EFFECTS = 10;

function getOrCreateProxPlansSheet(ss) {
  const requiredHeaders = ['VenueId', 'VenueName', 'VenueDate', 'EffectsJson', 'Notes', 'UpdatedAt'];
  let sheet = ss.getSheetByName('ProxPlans');
  if (!sheet) {
    sheet = ss.insertSheet('ProxPlans');
    sheet.appendRow(requiredHeaders);
    sheet.setFrozenRows(1);
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

function findProxPlanRow(sheet, map, venueId) {
  const rows = sheet.getDataRange().getValues();
  const key = String(venueId || '').trim();
  if (!key) return -1;
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][map['VenueId']]).trim() === key) return i + 1;
  }
  return -1;
}

// Keeps only well-formed lines, trims text, and caps the count — applied both on save (so nothing
// oversized or malformed ever reaches the sheet) and left for the reader to trust as already clean.
function cleanProxPlanEffects(effects) {
  if (!Array.isArray(effects)) return [];
  return effects
    .map(e => ({
      label: String((e && e.label) || '').trim().slice(0, 120),
      holotronChannel: String((e && e.holotronChannel) || '').trim().slice(0, 40),
      remoteChannel: String((e && e.remoteChannel) || '').trim().slice(0, 40),
      repeaterChannel: String((e && e.repeaterChannel) || '').trim().slice(0, 40),
      actions: String((e && e.actions) || '').trim().slice(0, 500)
    }))
    .filter(e => e.label || e.holotronChannel || e.remoteChannel || e.repeaterChannel || e.actions)
    .slice(0, PROX_PLAN_MAX_EFFECTS);
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

const PAYROLL_FOLDER_NAME = 'Vortex Payroll Reports';

// Saved privately in the script owner's Drive (no public link) — these PDFs hold crew names and pay amounts.
function savePayrollPdfToDrive(base64, fileName) {
  const bytes = Utilities.base64Decode(base64);
  if (!bytes || !bytes.length || bytes.length > 15 * 1024 * 1024) return null;   // safety cap: 15 MB
  const blob = Utilities.newBlob(bytes, 'application/pdf', fileName);
  const folders = DriveApp.getFoldersByName(PAYROLL_FOLDER_NAME);
  const folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(PAYROLL_FOLDER_NAME);
  return folder.createFile(blob).getId();
}

function getOrCreatePayrollReportsSheet(ss) {
  const requiredHeaders = ['SavedAt', 'Event', 'EventDate', 'SentTo', 'FileName', 'FileId', 'SubmissionId'];
  let sheet = ss.getSheetByName('PayrollReports');
  if (!sheet) {
    sheet = ss.insertSheet('PayrollReports');
    sheet.appendRow(requiredHeaders);
    return sheet;
  }
  const headers = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0];
  requiredHeaders.forEach(h => {
    if (headers.indexOf(h) === -1) sheet.getRange(1, sheet.getLastColumn() + 1).setValue(h);
  });
  return sheet;
}

// Every logged Payroll line item as plain objects — shared by the admin report, the
// self-serve "My Pay" lookup, and the rate-memory suggestion.
function readPayrollRecords(ss) {
  const records = [];
  const sheet = ss.getSheetByName('Payroll');
  if (!sheet || sheet.getLastRow() <= 1) return records;
  const map = headerMap(sheet);
  sheet.getDataRange().getValues().slice(1).forEach(r => {
    const name = String(r[map['Name']] || '').trim();
    if (!name) return;
    const ts = r[map['Timestamp']];
    const declared = r[map['DeclaredTotal']];
    // Rows logged before approval existed have no Status at all — treat those as already
    // approved rather than retroactively putting old, already-paid payroll into limbo.
    const status = String(r[map['Status']] || '').trim() || 'Approved';
    const editedAt = r[map['EditedAt']];
    records.push({
      id: String(r[map['Id']] || ''),
      submissionId: String(r[map['SubmissionId']] || ''),
      timestamp: ts instanceof Date ? ts.toISOString() : String(ts || ''),
      event: String(r[map['Event']] || ''),
      eventDate: normalizeDateValue(r[map['EventDate']]),
      name: name,
      role: String(r[map['Role']] || 'Crew'),
      amount: Number(r[map['Amount']]) || 0,
      unit: r[map['Unit']] === 'hours' ? 'hours' : 'usd',
      declaredTotal: declared === '' || declared == null ? null : Number(declared) || 0,
      status: status === 'Pending' ? 'Pending' : 'Approved',
      editedAt: editedAt instanceof Date ? editedAt.toISOString() : (editedAt ? String(editedAt) : ''),
      editReason: String(r[map['EditReason']] || '')
    });
  });
  return records;
}

// Whether a show's payroll stays hidden from My Pay (and from Totals/Year-End totals in the
// admin report) until an admin approves it, or shows right away marked Pending. Admin-wide,
// changed from the Payroll Reports page.
function payrollHideUnapproved() {
  return PropertiesService.getScriptProperties().getProperty('PAYROLL_HIDE_UNAPPROVED') === 'true';
}

// Admin-wide kill switch for the self-serve My Pay lookup, changed from the Payroll Reports page.
function myPayDisabled() {
  return PropertiesService.getScriptProperties().getProperty('MY_PAY_DISABLED') === 'true';
}

// Admin-wide kill switch for the crew-facing read-only show schedule page, changed from the
// Venues page. Venue data and editing are unaffected either way — this only hides the display.
function scheduleDisabled() {
  return PropertiesService.getScriptProperties().getProperty('SCHEDULE_DISABLED') === 'true';
}

// PINs crew members set up for themselves on "My Pay" — an optional, faster alternative to
// re-entering the phone number every time. Keyed by lowercased name, same as the phone check.
function getOrCreatePayrollPinsSheet(ss) {
  let sheet = ss.getSheetByName('PayrollPins');
  if (!sheet) {
    sheet = ss.insertSheet('PayrollPins');
    sheet.appendRow(['NameKey', 'PinHash', 'UpdatedAt']);
  }
  return sheet;
}
function getPayrollPinHash(ss, nameKey) {
  const sheet = getOrCreatePayrollPinsSheet(ss);
  if (sheet.getLastRow() <= 1) return null;
  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0] || '').trim().toLowerCase() === nameKey) return String(rows[i][1] || '') || null;
  }
  return null;
}
function setPayrollPinHash(ss, nameKey, pinHash) {
  const sheet = getOrCreatePayrollPinsSheet(ss);
  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0] || '').trim().toLowerCase() === nameKey) {
      sheet.getRange(i + 1, 2, 1, 2).setValues([[pinHash, new Date()]]);
      return;
    }
  }
  sheet.appendRow([nameKey, pinHash, new Date()]);
}

// Who's marked themselves unavailable for an upcoming show. Only "unavailable" rows are stored —
// no row for a venue/name pair means that person hasn't flagged a conflict, which keeps the sheet
// small and means a brand-new venue needs no setup to show everyone as available by default.
function getOrCreateAvailabilitySheet(ss) {
  let sheet = ss.getSheetByName('Availability');
  if (!sheet) {
    sheet = ss.insertSheet('Availability');
    sheet.appendRow(['NameKey', 'Name', 'VenueId', 'UpdatedAt']);
  }
  return sheet;
}
// All venue ids a person has marked themselves unavailable for.
function getUnavailableVenueIds(ss, nameKey) {
  const sheet = getOrCreateAvailabilitySheet(ss);
  if (sheet.getLastRow() <= 1) return [];
  const rows = sheet.getDataRange().getValues();
  const ids = [];
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0] || '').trim().toLowerCase() === nameKey) ids.push(String(rows[i][2] || ''));
  }
  return ids;
}
// Map of venueId -> names marked unavailable for it, for every venue that has at least one.
function getUnavailableNamesByVenue(ss) {
  const sheet = getOrCreateAvailabilitySheet(ss);
  const map = {};
  if (sheet.getLastRow() <= 1) return map;
  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    const venueId = String(rows[i][2] || '');
    const name = String(rows[i][1] || '').trim();
    if (!venueId || !name) continue;
    if (!map[venueId]) map[venueId] = [];
    map[venueId].push(name);
  }
  return map;
}
function setAvailability(ss, nameKey, name, venueId, unavailable) {
  const sheet = getOrCreateAvailabilitySheet(ss);
  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0] || '').trim().toLowerCase() === nameKey && String(rows[i][2] || '') === venueId) {
      if (unavailable) {
        sheet.getRange(i + 1, 4).setValue(new Date()); // just refresh UpdatedAt
      } else {
        sheet.deleteRow(i + 1); // marking available again removes the row entirely
      }
      return;
    }
  }
  if (unavailable) {
    sheet.appendRow([nameKey, name, venueId, new Date()]);
  }
}

// Crew self-sign-up for a show, capped at the venue's SignupLimit. Separate from AssignedHp
// (the lead, set by an admin) — this is a roster of crew who volunteered, up to the headcount
// the admin asked for. Low-stakes self-reported data, same shared-password trust level as
// Availability: anyone signed in at the Head Pyro level can sign up or remove any name, since
// there's no individual login to tell people apart.
function getOrCreateShowSignupsSheet(ss) {
  let sheet = ss.getSheetByName('ShowSignups');
  if (!sheet) {
    sheet = ss.insertSheet('ShowSignups');
    sheet.appendRow(['VenueId', 'Name', 'SignedUpAt']);
  }
  return sheet;
}
// Map of venueId -> signed-up names, for every venue that has at least one.
function getShowSignupsByVenue(ss) {
  const sheet = getOrCreateShowSignupsSheet(ss);
  const map = {};
  if (sheet.getLastRow() <= 1) return map;
  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    const venueId = String(rows[i][0] || '');
    const name = String(rows[i][1] || '').trim();
    if (!venueId || !name) continue;
    if (!map[venueId]) map[venueId] = [];
    map[venueId].push(name);
  }
  return map;
}
function addShowSignup(ss, venueId, name) {
  const venuesSheet = getOrCreateVenuesSheet(ss);
  const vMap = headerMap(venuesSheet);
  const vRows = venuesSheet.getDataRange().getValues();
  let limit = 0;
  for (let i = 1; i < vRows.length; i++) {
    if (String(vRows[i][vMap['Id']]) === venueId) { limit = Number(vRows[i][vMap['SignupLimit']]) || 0; break; }
  }
  if (!limit) return {status: 'error', message: "Sign-up isn't open for this show."};

  const sheet = getOrCreateShowSignupsSheet(ss);
  const rows = sheet.getDataRange().getValues();
  const nameLower = name.toLowerCase();
  let count = 0;
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0] || '') !== venueId) continue;
    count++;
    if (String(rows[i][1] || '').trim().toLowerCase() === nameLower) {
      return {status: 'error', message: "You're already signed up for this show."};
    }
  }
  // No capacity check here on purpose: past the limit, a sign-up still goes on the list, just
  // as a waitlist entry. Position (and so confirmed-vs-waitlisted) is derived from sign-up order
  // every time the list is read, so someone removing themselves automatically promotes the next
  // person in line without any extra bookkeeping here.
  sheet.appendRow([venueId, name, new Date()]);
  return {status: 'ok', waitlisted: count >= limit};
}
// Builds the full .ics text for the Schedule subscription feed (one VEVENT per upcoming show).
function buildScheduleIcs(shows) {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Vortex Fireworks//Show Schedule//EN', 'CALSCALE:GREGORIAN', 'X-WR-CALNAME:Vortex Show Schedule'];
  shows.forEach(v => {
    const d = v.eventDate.replace(/-/g, '');
    const summary = (v.name || 'Show').replace(/[\r\n]/g, ' ') + (v.assignedHp ? ' (HP: ' + v.assignedHp.replace(/[\r\n]/g, ' ') + ')' : '');
    lines.push('BEGIN:VEVENT');
    if (v.callTime) {
      const parts = v.callTime.split(':');
      const hh = String(parts[0] || '0').padStart(2, '0');
      const mm = String(parts[1] || '0').padStart(2, '0');
      const start = `${d}T${hh}${mm}00`;
      const endDate = new Date(Number(d.slice(0,4)), Number(d.slice(4,6)) - 1, Number(d.slice(6,8)), Number(hh), Number(mm));
      endDate.setHours(endDate.getHours() + 2);
      const end = endDate.getFullYear() + String(endDate.getMonth()+1).padStart(2,'0') + String(endDate.getDate()).padStart(2,'0')
        + 'T' + String(endDate.getHours()).padStart(2,'0') + String(endDate.getMinutes()).padStart(2,'0') + '00';
      lines.push(`DTSTART:${start}`, `DTEND:${end}`);
    } else {
      lines.push(`DTSTART;VALUE=DATE:${d}`, `DTEND;VALUE=DATE:${d}`);
    }
    lines.push(`SUMMARY:${summary}`);
    if (v.address) lines.push(`LOCATION:${v.address.replace(/[\r\n]/g, ' ')}`);
    lines.push(`UID:${v.id || Utilities.getUuid()}@vortex-schedule`, 'END:VEVENT');
  });
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

function removeShowSignup(ss, venueId, name) {
  const sheet = getOrCreateShowSignupsSheet(ss);
  const rows = sheet.getDataRange().getValues();
  const nameLower = name.toLowerCase();
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0] || '') === venueId && String(rows[i][1] || '').trim().toLowerCase() === nameLower) {
      sheet.deleteRow(i + 1);
      return;
    }
  }
}

// Photo wall: anyone can submit a photo from the front page, but it only shows up in the public
// slideshow once an admin approves it from Manage. Pending/rejected photos stay on this sheet so
// an admin can review them, but are never served to the public feed.
function getOrCreatePhotoWallSheet(ss) {
  let sheet = ss.getSheetByName('PhotoWall');
  if (!sheet) {
    sheet = ss.insertSheet('PhotoWall');
    sheet.appendRow(['Id', 'Name', 'Caption', 'PhotoUrl', 'SubmittedAt', 'Status']);
  }
  return sheet;
}

function addPhotoWallSubmission(ss, name, caption, photoBase64) {
  if (!photoBase64) return {status: 'error', message: 'No photo was attached.'};
  const url = savePhotoToDrive(photoBase64, name || 'photo', 1600);
  if (!url) return {status: 'error', message: "That didn't look like a photo — try a different file."};
  const sheet = getOrCreatePhotoWallSheet(ss);
  const id = Utilities.getUuid();
  sheet.appendRow([id, String(name || '').trim(), String(caption || '').trim(), url, new Date(), 'Pending']);
  return {status: 'ok'};
}

// The public slideshow feed: only ever approved photos, newest first.
function getApprovedPhotoWall(ss) {
  const sheet = getOrCreatePhotoWallSheet(ss);
  if (sheet.getLastRow() <= 1) return [];
  const map = headerMap(sheet);
  const rows = sheet.getDataRange().getValues();
  const out = [];
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][map['Status']] || '') !== 'Approved') continue;
    out.push({
      id: String(rows[i][map['Id']] || ''),
      name: String(rows[i][map['Name']] || ''),
      caption: String(rows[i][map['Caption']] || ''),
      photoUrl: String(rows[i][map['PhotoUrl']] || ''),
      submittedAt: normalizeDateValue(rows[i][map['SubmittedAt']]) || String(rows[i][map['SubmittedAt']] || '')
    });
  }
  out.reverse();
  return out;
}

// Everything, pending/approved/rejected alike, for the Manage review screen.
function getAllPhotoWall(ss) {
  const sheet = getOrCreatePhotoWallSheet(ss);
  if (sheet.getLastRow() <= 1) return [];
  const map = headerMap(sheet);
  const rows = sheet.getDataRange().getValues();
  const out = [];
  for (let i = 1; i < rows.length; i++) {
    if (!rows[i][map['Id']]) continue;
    out.push({
      id: String(rows[i][map['Id']] || ''),
      name: String(rows[i][map['Name']] || ''),
      caption: String(rows[i][map['Caption']] || ''),
      photoUrl: String(rows[i][map['PhotoUrl']] || ''),
      submittedAt: normalizeDateValue(rows[i][map['SubmittedAt']]) || String(rows[i][map['SubmittedAt']] || ''),
      status: String(rows[i][map['Status']] || 'Pending')
    });
  }
  out.reverse();
  return out;
}

// status is 'Approved' or 'Rejected'. Rejected photos just stop appearing in the public feed —
// an admin can still see them under Manage and flip them back if it was a mistake.
function setPhotoWallStatus(ss, id, status) {
  const sheet = getOrCreatePhotoWallSheet(ss);
  const map = headerMap(sheet);
  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][map['Id']] || '') === id) {
      sheet.getRange(i + 1, map['Status'] + 1).setValue(status);
      return {status: 'ok'};
    }
  }
  return {status: 'error', message: 'Photo not found.'};
}

function deletePhotoWallEntry(ss, id) {
  const sheet = getOrCreatePhotoWallSheet(ss);
  const map = headerMap(sheet);
  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][map['Id']] || '') === id) {
      const url = String(rows[i][map['PhotoUrl']] || '');
      sheet.deleteRow(i + 1);
      const match = url.match(/\/d\/([^=]+)/);
      if (match) {
        try { DriveApp.getFileById(match[1]).setTrashed(true); } catch (err) { /* already gone, or not ours to trash */ }
      }
      return {status: 'ok'};
    }
  }
  return {status: 'error', message: 'Photo not found.'};
}

// Structured line items (who was paid what, per show) powering the Manage/Edit payroll report.
function getOrCreatePayrollSheet(ss) {
  const requiredHeaders = ['Id', 'SubmissionId', 'Timestamp', 'Event', 'EventDate', 'Name', 'Role', 'Amount', 'Unit', 'DeclaredTotal', 'Status', 'EditedAt', 'EditReason'];
  let sheet = ss.getSheetByName('Payroll');
  if (!sheet) {
    sheet = ss.insertSheet('Payroll');
    sheet.appendRow(requiredHeaders);
    return sheet;
  }
  const headers = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0];
  requiredHeaders.forEach(h => {
    if (headers.indexOf(h) === -1) sheet.getRange(1, sheet.getLastColumn() + 1).setValue(h);
  });
  return sheet;
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
  // VenueId ties a pick list to one specific Venues row (one specific show), so two
  // different events that happen to share a venue name never collide or overwrite
  // each other. Name is kept alongside it for display and as a fallback match for
  // pick lists saved before this column existed.
  const requiredHeaders = ['VenueId', 'Name', 'EventDate', 'SiteMapUrl', 'SiteMapFileId', 'DataJson', 'UpdatedAt'];
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

// Matches by the venue's Id first — the real identity of a specific show — so two
// different shows that share a venue name never collide. Falls back to matching by
// name alone only for rows saved before VenueId existed (or if no id was sent).
function findPickListRow(sheet, map, name, id) {
  const rows = sheet.getDataRange().getValues();
  const wantId = String(id || '').trim();
  if (wantId && map['VenueId'] !== undefined) {
    for (let i = 1; i < rows.length; i++) {
      if (String(rows[i][map['VenueId']] || '').trim() === wantId) return i + 1;
    }
  }
  const key = String(name || '').trim().toLowerCase();
  if (!key) return -1;
  for (let i = 1; i < rows.length; i++) {
    const rowHasId = wantId && map['VenueId'] !== undefined && String(rows[i][map['VenueId']] || '').trim();
    if (rowHasId) continue; // already has its own id — a name match here would be a different show
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

// Pulls a product's main picture out of its supplier page's HTML — tries the standard
// social-preview meta tags first (what a page author intends as "the" image for the
// product), then falls back to the first plausible-looking <img> on the page.
function extractImageFromHtml(html, pageUrl) {
  const metaPatterns = [
    /<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image(?::secure_url)?["']/i,
    /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i
  ];
  for (const pattern of metaPatterns) {
    const m = html.match(pattern);
    if (m && m[1]) return resolveUrl(m[1], pageUrl);
  }
  // No social-preview tag — fall back to a plausible-looking <img> (skip tiny
  // icons/logos by requiring it to come from an uploads/media-style path). Some sites
  // (e.g. worldclassfireworks.com) put an unrelated banner/ad image earlier in the page
  // than the actual product photo, so picking the very first match grabs the wrong
  // picture — instead, among the candidates, prefer whichever sits closest to the
  // page's <h1> (the product title), which is reliably right next to the real photo.
  const imgTagPattern = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
  const candidates = [];
  let tagMatch;
  while ((tagMatch = imgTagPattern.exec(html)) !== null) {
    const src = tagMatch[1];
    if (src && /uploads|products|media|cdn/i.test(src) && !/logo|icon|sprite/i.test(src)) {
      candidates.push({ src: src, index: tagMatch.index });
    }
  }
  if (!candidates.length) return '';
  const h1Match = /<h1[^>]*>/i.exec(html);
  if (h1Match) {
    const h1Index = h1Match.index;
    candidates.sort((a, b) => Math.abs(a.index - h1Index) - Math.abs(b.index - h1Index));
  }
  return resolveUrl(candidates[0].src, pageUrl);
}
// Pulls the first YouTube video id referenced anywhere on the page — a plain link, an
// embedded player's iframe src, or a bare watch/share URL in the markup.
function extractYoutubeIdFromHtml(html) {
  const patterns = [
    /youtube(?:-nocookie)?\.com\/embed\/([A-Za-z0-9_-]{6,15})/i,
    /youtube\.com\/watch\?[^"'\s]*v=([A-Za-z0-9_-]{6,15})/i,
    /youtu\.be\/([A-Za-z0-9_-]{6,15})/i
  ];
  for (const pattern of patterns) {
    const m = html.match(pattern);
    if (m && m[1]) return m[1];
  }
  return '';
}
// Pulls a Wistia video id out of the page — an embedded iframe src, or the
// wistia_embed/wistia_async_<id> div class some sites use instead. Wistia ids are
// returned prefixed ("wistia:<id>") so the catalog page's video player can tell them
// apart from a plain YouTube id and build the right embed URL for each.
function extractWistiaIdFromHtml(html) {
  const patterns = [
    /fast\.wistia\.(?:net|com)\/embed\/(?:iframe|medias)\/([A-Za-z0-9]{8,12})/i,
    /wistia_async_([A-Za-z0-9]{8,12})/i
  ];
  for (const pattern of patterns) {
    const m = html.match(pattern);
    if (m && m[1]) return 'wistia:' + m[1];
  }
  return '';
}
// shop.76fireworks.com is a JS-rendered React app — its product pages ship as an
// almost-empty HTML shell with no og:image/twitter:image tags and no <img>/YouTube
// markup at all, so the normal HTML scrape below always comes back empty for it.
// Its product pages do carry the item's slug in the URL (/product/<slug>), and that
// slug is exactly the id its own internal JSON API expects, so we call that API
// directly instead of scraping rendered-by-JS markup we can never see.
function fetch76FireworksMedia(pageUrl) {
  const m = String(pageUrl).match(/^https?:\/\/shop\.76fireworks\.com\/product\/([^/?#]+)/i);
  if (!m) return null;
  const slug = m[1];
  const apiUrl = 'https://shop.76fireworks.com/spirit-api/public/api/products/get-by-url/'
    + encodeURIComponent(slug) + '?project_id=12';
  try {
    const res = UrlFetchApp.fetch(apiUrl, {
      muteHttpExceptions: true,
      followRedirects: true,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; VortexCueSheet/1.0)', 'Accept': 'application/json' }
    });
    if (res.getResponseCode() >= 400) return { imageUrl: '', videoId: '' };
    const data = JSON.parse(res.getContentText());
    const imageUrl = (data.images && data.images[0] && data.images[0].image_url) || '';
    const videoEmbed = (data.videos && data.videos[0] && data.videos[0].products_video) || '';
    return { imageUrl: imageUrl, videoId: videoEmbed ? extractYoutubeIdFromHtml(videoEmbed) : '' };
  } catch (err) {
    return { imageUrl: '', videoId: '' };
  }
}
// brotherspyrotechnics.com serves its product photo through a generic image API
// (/api/Resource/GetImage?fileId=NNNN) with no og:image/twitter:image meta tag and no
// "uploads/products/media/cdn" wording in the URL for extractImageFromHtml's normal
// fallback to recognize, so it always came back empty for this site. The same URL
// pattern is also used for small flag icons (which carry &width=/&height= resize
// params) and for "related products" thumbnails further down the page, so we match
// only the plain (no resize params) occurrences and take the first one — the main
// product photo is the first such image on the page, above the related-products rail.
function fetchBrothersPyroMedia(pageUrl) {
  if (!/^https?:\/\/(?:www\.)?brotherspyrotechnics\.com\//i.test(String(pageUrl))) return null;
  let html;
  try {
    const res = UrlFetchApp.fetch(pageUrl, {
      muteHttpExceptions: true,
      followRedirects: true,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; VortexCueSheet/1.0)' }
    });
    if (res.getResponseCode() >= 400) return { imageUrl: '', videoId: '' };
    html = res.getContentText();
  } catch (err) {
    return { imageUrl: '', videoId: '' };
  }
  const matches = html.match(/\/api\/Resource\/GetImage\?fileId=\d+[^"'\s)]*/gi) || [];
  let imageUrl = '';
  for (const url of matches) {
    if (!/width=|height=/i.test(url)) { imageUrl = resolveUrl(url, pageUrl); break; }
  }
  return { imageUrl: imageUrl, videoId: extractYoutubeIdFromHtml(html) };
}
// Fetches a product's supplier page once and pulls out both its main picture and any
// YouTube video linked or embedded on it, so a page is only ever downloaded a single
// time no matter how many kinds of media we're looking for on it.
function fetchProductMedia(pageUrl) {
  const viaApi = fetch76FireworksMedia(pageUrl);
  if (viaApi) return viaApi;
  const viaBrothersPyro = fetchBrothersPyroMedia(pageUrl);
  if (viaBrothersPyro) return viaBrothersPyro;
  let html;
  try {
    const res = UrlFetchApp.fetch(pageUrl, {
      muteHttpExceptions: true,
      followRedirects: true,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; VortexCueSheet/1.0)' }
    });
    if (res.getResponseCode() >= 400) return { imageUrl: '', videoId: '' };
    html = res.getContentText();
  } catch (err) {
    return { imageUrl: '', videoId: '' };
  }
  const videoId = extractYoutubeIdFromHtml(html) || extractWistiaIdFromHtml(html);
  return { imageUrl: extractImageFromHtml(html, pageUrl), videoId: videoId };
}
function resolveUrl(url, base) {
  if (/^https?:\/\//i.test(url)) return url;
  try {
    const b = base.match(/^(https?:\/\/[^\/]+)/i);
    if (url.indexOf('//') === 0) return 'https:' + url;
    if (url.indexOf('/') === 0 && b) return b[1] + url;
    return url;
  } catch (err) {
    return url;
  }
}

const PRODUCT_PICTURES_FOLDER_NAME = 'VortexProductPictures';

function getOrCreateProductPicturesFolder() {
  const folders = DriveApp.getFoldersByName(PRODUCT_PICTURES_FOLDER_NAME);
  return folders.hasNext() ? folders.next() : DriveApp.createFolder(PRODUCT_PICTURES_FOLDER_NAME);
}

// Downloads the actual image bytes (not just the URL) and saves them into the
// VortexProductPictures Drive folder, so the picture keeps working even if the
// supplier later changes or removes it from their page.
function saveProductImageToDrive(imageUrl, productName) {
  try {
    const res = UrlFetchApp.fetch(imageUrl, {
      muteHttpExceptions: true,
      followRedirects: true,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; VortexCueSheet/1.0)' }
    });
    if (res.getResponseCode() >= 400) return '';
    const blob = res.getBlob();
    if (!blob || blob.getBytes().length > 10 * 1024 * 1024) return '';   // safety cap: 10 MB
    const contentType = blob.getContentType() || '';
    let ext = 'jpg';
    if (/png/i.test(contentType)) ext = 'png';
    else if (/webp/i.test(contentType)) ext = 'webp';
    else if (/gif/i.test(contentType)) ext = 'gif';
    const safeName = String(productName || 'product').replace(/[^a-zA-Z0-9]/g, '_').slice(0, 60) + '_' + new Date().getTime() + '.' + ext;
    blob.setName(safeName);
    const folder = getOrCreateProductPicturesFolder();
    const file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return 'https://lh3.googleusercontent.com/d/' + file.getId() + '=s1600';
  } catch (err) {
    return '';
  }
}

// Finds the picture and any YouTube video on a product's supplier page (one fetch of
// the page covers both), then downloads and saves a real copy of the picture into
// Drive rather than just linking to the supplier's own URL.
function fetchAndSaveProductMedia(pageUrl, productName) {
  const media = fetchProductMedia(pageUrl);
  const imageUrl = media.imageUrl ? saveProductImageToDrive(media.imageUrl, productName) : '';
  return { imageUrl: imageUrl, videoId: media.videoId || '' };
}

// TEMPORARY DIAGNOSTIC — run this manually from the Apps Script editor (select it in the
// function dropdown next to Run, click Run, then View > Logs) to see exactly why every
// product is coming back with no image or video: what HTTP status the supplier page
// returned, how much HTML came back, and whether either pattern matched it.
function debugFetchOneProduct() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = getOrCreateProductsSheet(ss);
  const map = headerMap(sheet);
  const values = sheet.getDataRange().getValues();
  let row = null;
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][map['Url']] || '')) { row = values[i]; break; }
  }
  if (!row) { Logger.log('No product with a Url was found at all.'); return; }
  const pageUrl = String(row[map['Url']] || '');
  const name = String(row[map['Name']] || '');
  Logger.log('Product: ' + name);
  Logger.log('Url: ' + pageUrl);
  try {
    const res = UrlFetchApp.fetch(pageUrl, {
      muteHttpExceptions: true,
      followRedirects: true,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; VortexCueSheet/1.0)' }
    });
    const code = res.getResponseCode();
    Logger.log('HTTP status: ' + code);
    if (code >= 400) { Logger.log('Stopped here — the page itself returned an error/blocked status.'); return; }
    const html = res.getContentText();
    Logger.log('HTML length: ' + html.length);
    Logger.log('First 300 chars: ' + html.slice(0, 300));
    const img = extractImageFromHtml(html, pageUrl);
    const vid = extractYoutubeIdFromHtml(html);
    Logger.log('Image match: ' + (img || '(none)'));
    Logger.log('YouTube match: ' + (vid || '(none)'));
    Logger.log('Has og:image tag anywhere: ' + /property=["\']og:image/i.test(html));
    Logger.log('Has <img tag anywhere: ' + /<img\b/i.test(html));
    Logger.log('Has youtube.com/youtu.be anywhere: ' + /youtube\.com|youtu\.be/i.test(html));
  } catch (err) {
    Logger.log('Fetch threw an error: ' + (err && err.message ? err.message : err));
  }
}

// TEMPORARY ONE-OFF — run this manually from the Apps Script editor (select it in the
// function dropdown, click Run) exactly once. Every product's ImageUrl/VideoId got
// stuck at 'NONE' while UrlFetchApp was missing permission, so the normal backfill
// would just skip all 943 rows as "already checked." This clears those two columns
// back to blank so the next "Download photos for every item" click actually re-fetches
// every page now that permission is granted. Safe to run more than once; it only ever
// clears cells that currently say 'NONE'.
function resetStuckProductMedia() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = getOrCreateProductsSheet(ss);
  const map = headerMap(sheet);
  const values = sheet.getDataRange().getValues();
  let cleared = 0;
  for (let i = 1; i < values.length; i++) {
    const img = String(values[i][map['ImageUrl']] || '');
    const vid = String(values[i][map['VideoId']] || '');
    if (img === 'NONE') { sheet.getRange(i + 1, map['ImageUrl'] + 1).setValue(''); cleared++; }
    if (vid === 'NONE') { sheet.getRange(i + 1, map['VideoId'] + 1).setValue(''); }
  }
  Logger.log('Cleared ' + cleared + ' row(s) marked NONE. Now click "Download photos for every item" in the Catalog page.');
}

function getOrCreatePhotoFolder() {
  const folderName = 'Vortex Operator Photos';
  const folders = DriveApp.getFoldersByName(folderName);
  if (folders.hasNext()) return folders.next();
  return DriveApp.createFolder(folderName);
}

function savePhotoToDrive(dataUrl, name, size) {
  const matches = dataUrl.match(/^data:(image\/\w+);base64,(.*)$/);
  if (!matches) return '';
  const contentType = matches[1];
  const bytes = Utilities.base64Decode(matches[2]);
  const safeName = String(name).replace(/[^a-zA-Z0-9]/g, '_') + '_' + new Date().getTime() + '.jpg';
  const blob = Utilities.newBlob(bytes, contentType, safeName);
  const folder = getOrCreatePhotoFolder();
  const file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return 'https://lh3.googleusercontent.com/d/' + file.getId() + '=s' + (size || 400);
}

/* ===================== ACCESS CONTROL =====================
   Three levels of access:
     public - Check-In, New Hire and Update My Info. These only ever get what they need.
     hp     - Head Pyro Tools: the crew directory, pick lists, Payroll, the After-Action Report, Enable Sign-In.
     admin  - Manage/Edit: everything that edits or deletes, plus the saved reports and backups.
   Signing in is Google-only (recordType 'googleLogin') — there is no shared password anymore. An admin
   grants each person's Google account one or more roles in Manage Access (the AccessRoles sheet), and
   signing in with that Google account gets back a signed token carrying those roles. Every request that
   is not public must carry a valid token of at least the level it needs. */
const TOKEN_LIFETIME_SECONDS = 24 * 60 * 60;

// What each read needs. Anything not listed here (including the check-in list) needs the Head Pyro level.
const GET_LEVELS = {
  names: 'public', verifyPerson: 'public', myContactInfo: 'any', venues: 'public', announcements: 'public',
  contacts: 'hp', pyroDirectory: 'any', pickLists: 'hp', pickListSiteMapData: 'hp', hpContactLookup: 'hp',
  findDuplicateContacts: 'admin', findDuplicateVenues: 'admin', findDuplicateProducts: 'admin',
  shellProducts: 'admin', cakeProducts: 'admin', products: 'hp', productImage: 'hp', showPlans: 'hp', fireworkProducts: 'admin',
  inventory: 'admin', inventoryHistory: 'admin', aarReports: 'admin', aarReportFile: 'admin', backups: 'admin', payrollRecords: 'payroll',
  payrollRecordsForName: 'hp', payRate: 'hp', payrollPinStatus: 'hp', payrollSettings: 'payroll', myPayStatus: 'hp', scheduleStatus: 'public', scheduleFeed: 'public',
  myAvailability: 'hp', availabilityOverview: 'hp', complianceReport: 'admin', showSignups: 'public',
  photoWallApproved: 'public', photoWallAll: 'photoMod', pendingTasksSummary: 'admin', accessRoles: 'admin',
  accessRequests: 'admin', signInLog: 'admin', proxPlan: 'hp'
};
// What each write needs. Anything not listed here needs the Manage/Edit level.
// (A check-in has no recordType and is public; 'contact' decides for itself below.)
const POST_LEVELS = {
  aarReport: 'hp', payrollReport: 'hp', payrollSetPin: 'hp', toggleVenueSignIn: 'hp', hpCheckIn: 'hp', deleteCheckIn: 'hp',
  productsImageBackfill: 'hp', showPlan: 'hp', deleteShowPlan: 'hp', setAvailability: 'hp',
  proxPlan: 'hp', deleteProxPlan: 'hp',
  showSignup: 'crew', removeShowSignup: 'crew', photoWallSubmit: 'crew',
  photoWallModerate: 'photoMod', photoWallDelete: 'photoMod',
  deleteContact: 'admin', deleteContactRow: 'admin', venue: 'admin', deleteVenueRow: 'admin',
  announcement: 'admin', deleteAnnouncementRow: 'admin', pickList: 'admin', pickListSiteMap: 'admin', pickListRacksConfig: 'admin',
  shellProductsImport: 'admin', cakeProductsImport: 'admin', deleteShellProduct: 'admin', deleteCakeProduct: 'admin',
  product: 'admin', productsImport: 'admin', deleteProduct: 'admin',
  fireworkProduct: 'admin', deleteFireworkProduct: 'admin',
  inventoryContainer: 'admin', deleteInventoryContainer: 'admin', inventoryTransfer: 'admin',
  deleteAarReport: 'admin', deletePayrollLine: 'payroll', deletePayrollShow: 'payroll', backupNow: 'admin',
  editPayrollLine: 'payroll', approvePayrollShow: 'payroll', unapprovePayrollShow: 'payroll',
  scheduleSettings: 'admin', accessRoleSet: 'admin', accessRoleDelete: 'admin'
};
// Roles a sign-in token can carry. 'admin' always passes every check (see hasRole below); the
// others are narrow slices handed out to someone who should only reach one part of the app.
// 'crew' isn't checked anywhere in GET_LEVELS/POST_LEVELS — those pages (Check-in, Show Schedule,
// New Hire Documents, Photo Wall) are intentionally open to everyone with the link. It exists so
// Manage Access has a label for "this person is a regular crew member" to track in the roster.
const KNOWN_ROLES = ['hp', 'admin', 'payroll', 'photoMod', 'crew'];
// The OAuth 2.0 Client ID for "Sign in with Google" (Google Cloud project "Vortex Web Login").
// This is not a secret — it identifies the app to Google, the way a public key does.
const GOOGLE_CLIENT_ID = '691238707295-qa5ugobjgrkeou9ji46hdtp354n4dgv0.apps.googleusercontent.com';

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
  return props;
}
// A stored password is either an original plain SHA-256 hash, or "salt$hash" for passwords set with the functions below.
// (Still used for the self-serve Payroll PIN, below — not for signing in to Head Pyro Tools or Manage/Edit anymore.)
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
// A token carries one or more roles (sorted, joined with '+' — e.g. "admin", "hp", "payroll+photoMod").
// Pass a single tier string (the old password-login shape) or an array of roles (Google sign-in).
// A Google sign-in also binds the signed-in email into the token (signed along with everything
// else), so a page can look someone's own record up by that email later without having to trust
// whatever email a request claims — see emailFromToken.
function makeToken(rolesOrTier, email) {
  const roles = (Array.isArray(rolesOrTier) ? rolesOrTier : [rolesOrTier]).filter(Boolean).sort();
  const expires = Math.floor(new Date().getTime() / 1000) + TOKEN_LIFETIME_SECONDS;
  const emailPart = email ? Utilities.base64EncodeWebSafe(Utilities.newBlob(String(email).trim().toLowerCase()).getBytes()).replace(/=+$/, '') : '';
  const payload = roles.join('+') + '.' + expires + '.' + emailPart;
  return payload + '.' + signPayload(payload);
}
// Returns the roles a token actually carries (after checking its signature and expiry), or [] if
// the token is missing, expired, tampered with, or carries something outside KNOWN_ROLES.
// Accepts both the current 4-part token shape (roles.expires.email.signature) and the older
// 3-part shape issued before tokens carried an email, so sign-ins from just before this change
// keep working until they naturally expire.
function rolesFromToken(token) {
  if (!token || typeof token !== 'string') return [];
  const parts = token.split('.');
  if (parts.length !== 3 && parts.length !== 4) return [];
  const expires = Number(parts[1]);
  if (!expires || expires < Math.floor(new Date().getTime() / 1000)) return [];
  const signedPart = parts.slice(0, parts.length - 1).join('.');
  if (!safeEqual(signPayload(signedPart), parts[parts.length - 1])) return [];
  const roles = parts[0].split('+').filter(Boolean);
  if (!roles.length || !roles.every(r => KNOWN_ROLES.indexOf(r) > -1)) return [];
  return roles;
}
// The Google email bound into a token at sign-in time ('' for a token with no email bound, such
// as the legacy 3-part shape). Re-checks the token's signature itself rather than trusting a
// caller that already called rolesFromToken, so this is always safe to call on its own.
function emailFromToken(token) {
  if (!token || typeof token !== 'string') return '';
  const parts = token.split('.');
  if (parts.length !== 4) return '';
  const expires = Number(parts[1]);
  if (!expires || expires < Math.floor(new Date().getTime() / 1000)) return '';
  if (!safeEqual(signPayload(parts.slice(0, 3).join('.')), parts[3])) return '';
  if (!parts[2]) return '';
  try {
    return Utilities.newBlob(Utilities.base64DecodeWebSafe(parts[2])).getDataAsString();
  } catch (e) {
    return '';
  }
}
// Backward-compatible helper some call sites still use for a plain "are they a full admin?" check.
function tierFromToken(token) {
  const roles = rolesFromToken(token);
  if (roles.indexOf('admin') > -1) return 'admin';
  if (roles.indexOf('hp') > -1) return 'hp';
  return null;
}
function tierRank(tier) {
  return tier === 'admin' ? 2 : (tier === 'hp' ? 1 : 0);
}
// 'admin' can always do everything. 'any' passes for anyone signed in with at least one granted
// role — crew included — since crew is the lowest tier Manage Access hands out; it's for things
// that should be open to every signed-in crew member and up, without needing a specific role.
// Otherwise the token needs the exact role being asked for — 'hp' for Head Pyro Tools, or one of
// the narrow extra roles (payroll, photoMod) a person can be granted without full Manage/Edit access.
function hasRole(roles, needed) {
  if (needed === 'public') return true;
  if (!roles || !roles.length) return false;
  if (needed === 'any') return true;
  if (roles.indexOf('admin') > -1) return true;
  // Head Pyro is a crew role too (and then some) — someone granted 'hp' can do anything a 'crew'
  // grant can, same as 'admin' can do anything at all. Doesn't go the other way: 'crew' alone
  // doesn't unlock 'hp'-only pages.
  if (needed === 'crew' && roles.indexOf('hp') > -1) return true;
  return roles.indexOf(needed) > -1;
}
function authError(needed) {
  let message = 'Sign in with your Google account to continue.';
  if (needed === 'admin' || needed === 'hp') message = 'Sign in with your Google account to continue. Ask an admin to grant you access in Manage Access if you need it.';
  else if (needed === 'payroll' || needed === 'photoMod') message = "You don't have access to this section. Ask an admin to grant it in Manage Access.";
  else if (needed === 'crew' || needed === 'any') message = 'Sign in with your crew Google account to do this.';
  return jsonOut({ status: 'error', code: 'auth', needs: needed, message: message });
}
// How long before a token's expiry it was issued at — lets anything holding a token work out
// when it was handed out without needing to store that separately.
function tokenIssuedAt(token) {
  if (!token || typeof token !== 'string') return 0;
  const parts = token.split('.');
  if (parts.length !== 3 && parts.length !== 4) return 0;
  const expires = Number(parts[1]);
  return expires ? expires - TOKEN_LIFETIME_SECONDS : 0;
}
function authorize(ss, token, needed) {
  if (!hasRole(rolesFromToken(token), needed)) return authError(needed);
  if (needed === 'public') return null;
  // The role check above only looks at what the token itself claims. A Manage Access change since
  // this token was issued (role removed, person deleted) revokes it immediately — see revokeAccessFor.
  const email = emailFromToken(token);
  if (email) {
    const issuedAt = tokenIssuedAt(token);
    if (issuedAt && getRevokedAt(ss, email) > issuedAt) return authError(needed);
  }
  return null;
}
// Pulls together everything across the app that's waiting on an admin decision, for tasks.html.
// Each category mirrors a badge already shown
// elsewhere (Venues, Payroll Reports, Photo Wall) so there's one definition of "needs attention",
// not a second one invented just for this page.
function getPendingTasksSummary(ss) {
  const venuesSheet = getOrCreateVenuesSheet(ss);
  const vMap = headerMap(venuesSheet);
  const today = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'America/Denver', 'yyyy-MM-dd');
  const venueRows = venuesSheet.getLastRow() > 1 ? venuesSheet.getDataRange().getValues().slice(1) : [];
  const venuesNeedHp = venueRows
    .filter(r => r[vMap['Name']] && normalizeDateValue(r[vMap['EventDate']]) >= today && !String(r[vMap['AssignedHp']] || '').trim())
    .map(r => ({ name: String(r[vMap['Name']] || ''), eventDate: normalizeDateValue(r[vMap['EventDate']]) }))
    .sort((a, b) => a.eventDate.localeCompare(b.eventDate));

  const payrollRecords = readPayrollRecords(ss);
  const bySubmission = {};
  payrollRecords.forEach(r => {
    const key = r.submissionId || r.id;
    (bySubmission[key] = bySubmission[key] || []).push(r);
  });
  const payrollNeedsApproval = Object.values(bySubmission)
    .filter(items => !items.every(it => it.status === 'Approved'))
    .map(items => ({ event: items[0].event, eventDate: items[0].eventDate }))
    .sort((a, b) => a.eventDate.localeCompare(b.eventDate));

  const photoWallPending = getAllPhotoWall(ss)
    .filter(p => p.status === 'Pending')
    .map(p => ({ name: p.name, caption: p.caption, submittedAt: p.submittedAt }));

  const accessRequests = listAccessRequests(ss);

  return {
    venuesNeedHp: venuesNeedHp,
    payrollNeedsApproval: payrollNeedsApproval,
    photoWallPending: photoWallPending,
    accessRequests: accessRequests,
    totalCount: venuesNeedHp.length + payrollNeedsApproval.length + photoWallPending.length + accessRequests.length
  };
}

/* ===================== GOOGLE SIGN-IN + ACCESS ROLES =====================
   The only way to sign in to Head Pyro Tools or Manage/Edit — there's no shared password anymore.
   The "AccessRoles" sheet is the roster: which Google email maps to which person and which roles
   they're allowed to use. Managed from the Manage Access admin page. */
const ACCESS_ROLES_SHEET = 'AccessRoles';
const ACCESS_ROLES_HEADERS = ['Email', 'Name', 'Roles', 'DateAdded'];

function getOrCreateAccessRolesSheet(ss) {
  let sheet = ss.getSheetByName(ACCESS_ROLES_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(ACCESS_ROLES_SHEET);
    sheet.appendRow(ACCESS_ROLES_HEADERS);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

// Reads the roster into a plain array of {email, name, roles: [...], dateAdded}.
function listAccessRoles(ss) {
  const sheet = getOrCreateAccessRolesSheet(ss);
  const values = sheet.getDataRange().getValues();
  const out = [];
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    const email = String(row[0] || '').trim();
    if (!email) continue;
    out.push({
      email: email,
      name: String(row[1] || ''),
      roles: String(row[2] || '').split(',').map(r => r.trim()).filter(Boolean),
      dateAdded: row[3] ? String(row[3]) : ''
    });
  }
  return out;
}

// Case-insensitive lookup of the roles on file for one email address. [] if not in the roster.
function getRolesForEmail(ss, email) {
  const needle = String(email || '').trim().toLowerCase();
  if (!needle) return [];
  const match = listAccessRoles(ss).find(r => r.email.toLowerCase() === needle);
  return match ? match.roles.filter(r => KNOWN_ROLES.indexOf(r) > -1) : [];
}

// True if changing `email`'s roles to `newRolesOrNull` (null meaning "removed entirely") would
// leave the roster with no admin at all. Only blocks when email is itself the LAST admin — editing
// or removing anyone else is always fine, even if they're also an admin, as long as one other
// admin account remains.
function wouldRemoveLastAdmin(ss, email, newRolesOrNull) {
  const needle = String(email || '').trim().toLowerCase();
  const roster = listAccessRoles(ss);
  const current = roster.find(r => r.email.toLowerCase() === needle);
  const wasAdmin = !!(current && current.roles.indexOf('admin') > -1);
  if (!wasAdmin) return false;
  const otherAdminExists = roster.some(r => r.email.toLowerCase() !== needle && r.roles.indexOf('admin') > -1);
  if (otherAdminExists) return false;
  const stillAdmin = Array.isArray(newRolesOrNull) && newRolesOrNull.indexOf('admin') > -1;
  return !stillAdmin;
}
const LAST_ADMIN_MESSAGE = "Can't do that — it would leave no one with admin access. Grant admin to someone else first.";

// Adds a person to the roster, or overwrites their name/roles if the email is already there.
function setAccessRole(ss, email, name, roles) {
  email = String(email || '').trim();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { status: 'error', message: 'Enter a valid email address.' };
  }
  const cleanRoles = (Array.isArray(roles) ? roles : String(roles || '').split(','))
    .map(r => String(r).trim()).filter(r => KNOWN_ROLES.indexOf(r) > -1);
  if (!cleanRoles.length) return { status: 'error', message: 'Pick at least one role.' };
  if (wouldRemoveLastAdmin(ss, email, cleanRoles)) return { status: 'error', message: LAST_ADMIN_MESSAGE };
  const sheet = getOrCreateAccessRolesSheet(ss);
  const values = sheet.getDataRange().getValues();
  const needle = email.toLowerCase();
  // Granting access answers any pending request from this email, so it drops off the action-item list.
  deleteAccessRequest(ss, email);
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][0] || '').trim().toLowerCase() === needle) {
      sheet.getRange(i + 1, 1, 1, 4).setValues([[email, name || '', cleanRoles.join(','), values[i][3] || new Date()]]);
      // Roles just changed — make that take effect right away instead of leaving whatever token
      // they're already holding valid for up to another day.
      revokeAccessFor(ss, email);
      return { status: 'ok' };
    }
  }
  sheet.appendRow([email, name || '', cleanRoles.join(','), new Date()]);
  return { status: 'ok' };
}

function deleteAccessRole(ss, email) {
  const needle = String(email || '').trim().toLowerCase();
  if (wouldRemoveLastAdmin(ss, email, null)) return { status: 'error', message: LAST_ADMIN_MESSAGE };
  const sheet = getOrCreateAccessRolesSheet(ss);
  const values = sheet.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][0] || '').trim().toLowerCase() === needle) {
      sheet.deleteRow(i + 1);
      revokeAccessFor(ss, email);
      return { status: 'ok' };
    }
  }
  return { status: 'error', message: 'Not found.' };
}

/* ---- Revoking access immediately ----
   Removing someone from Manage Access (or taking a role away) only stops NEW sign-ins by itself —
   whatever token they're already holding in their browser keeps working until it naturally
   expires, up to TOKEN_LIFETIME_SECONDS later. revokeAccessFor() records "nothing issued to this
   email before right now still counts," so authorize() can refuse an already-issued token the
   moment an admin makes the change, not up to a day afterward. Only tokens with an email bound in
   (every Google sign-in — see makeToken) can be checked this way; there's nothing to check for an
   older token with no email bound, but those expire on their own within a day regardless. */
const REVOKED_ACCESS_SHEET = 'RevokedAccess';
const REVOKED_ACCESS_HEADERS = ['Email', 'RevokedAt'];
const REVOKED_ACCESS_CACHE_KEY = 'revokedAccess_v1';
const REVOKED_ACCESS_CACHE_SECONDS = 300;

function getOrCreateRevokedAccessSheet(ss) {
  let sheet = ss.getSheetByName(REVOKED_ACCESS_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(REVOKED_ACCESS_SHEET);
    sheet.appendRow(REVOKED_ACCESS_HEADERS);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function revokeAccessFor(ss, email) {
  email = String(email || '').trim().toLowerCase();
  if (!email) return;
  const sheet = getOrCreateRevokedAccessSheet(ss);
  const values = sheet.getDataRange().getValues();
  const now = new Date();
  let found = false;
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][0] || '').trim().toLowerCase() === email) {
      sheet.getRange(i + 1, 2).setValue(now);
      found = true;
      break;
    }
  }
  if (!found) sheet.appendRow([email, now]);
  try { CacheService.getScriptCache().remove(REVOKED_ACCESS_CACHE_KEY); } catch (e) { /* ignore */ }
}

// epoch seconds that email's access was last revoked at, or 0 if never. Cached briefly (and
// cleared the moment revokeAccessFor runs) since this is checked on nearly every request.
function getRevokedAt(ss, email) {
  email = String(email || '').trim().toLowerCase();
  if (!email) return 0;
  const cache = CacheService.getScriptCache();
  let map = null;
  try {
    const cached = cache.get(REVOKED_ACCESS_CACHE_KEY);
    if (cached) map = JSON.parse(cached);
  } catch (e) { map = null; }
  if (!map) {
    map = {};
    const sheet = getOrCreateRevokedAccessSheet(ss);
    const values = sheet.getDataRange().getValues();
    for (let i = 1; i < values.length; i++) {
      const e = String(values[i][0] || '').trim().toLowerCase();
      if (!e || !values[i][1]) continue;
      map[e] = Math.floor(new Date(values[i][1]).getTime() / 1000);
    }
    try { cache.put(REVOKED_ACCESS_CACHE_KEY, JSON.stringify(map), REVOKED_ACCESS_CACHE_SECONDS); } catch (e) { /* ignore */ }
  }
  return map[email] || 0;
}

// Asks Google itself whether this ID token is genuine, unexpired, and issued for THIS app, and
// returns the verified email (or null if anything about it looks wrong). Using Google's own
// tokeninfo endpoint avoids needing a JWT/crypto library inside Apps Script.
function verifyGoogleIdToken(idToken) {
  if (!idToken || typeof idToken !== 'string') return null;
  try {
    const res = UrlFetchApp.fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(idToken), {
      muteHttpExceptions: true
    });
    if (res.getResponseCode() !== 200) return null;
    const info = JSON.parse(res.getContentText());
    if (!info || info.aud !== GOOGLE_CLIENT_ID) return null;
    if (info.email_verified !== true && info.email_verified !== 'true') return null;
    if (!info.email) return null;
    return { email: String(info.email).toLowerCase(), name: info.name || info.email };
  } catch (err) {
    return null;
  }
}

function handleGoogleLogin(data, ss) {
  const verified = verifyGoogleIdToken(data.idToken);
  if (!verified) {
    return jsonOut({status: 'error', code: 'badtoken', message: 'Could not verify that Google sign-in. Please try again.'});
  }
  const roles = getRolesForEmail(ss, verified.email);
  if (!roles.length) {
    recordAccessRequest(ss, verified.email, verified.name);
    return jsonOut({
      status: 'error', code: 'notprovisioned',
      message: "You're signed in as " + verified.email + ", but you're not set up for access yet. Ask an admin to add you in Manage Access."
    });
  }
  logSignIn(ss, 'Google', roles.join('+'), data.userAgent, verified.email, verified.name);
  return jsonOut({
    status: 'ok', token: makeToken(roles, verified.email), roles: roles, email: verified.email, name: verified.name,
    expiresIn: TOKEN_LIFETIME_SECONDS
  });
}

/* ---- Pending access requests ----
   Every time someone signs in with Google but isn't on the Manage Access roster yet, this logs
   it (one row per email, just the latest attempt) so it shows up as an action item for admins —
   on the Manage Access page, in the Tasks list, and as a badge on the Manage/Edit home screen —
   instead of that person's request disappearing the moment they close the tab. */
const ACCESS_REQUESTS_SHEET = 'AccessRequests';
const ACCESS_REQUESTS_HEADERS = ['Email', 'Name', 'FirstRequestedAt', 'LastRequestedAt'];

function getOrCreateAccessRequestsSheet(ss) {
  let sheet = ss.getSheetByName(ACCESS_REQUESTS_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(ACCESS_REQUESTS_SHEET);
    sheet.appendRow(ACCESS_REQUESTS_HEADERS);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function recordAccessRequest(ss, email, name) {
  email = String(email || '').trim();
  if (!email) return;
  const sheet = getOrCreateAccessRequestsSheet(ss);
  const values = sheet.getDataRange().getValues();
  const needle = email.toLowerCase();
  const now = new Date();
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][0] || '').trim().toLowerCase() === needle) {
      sheet.getRange(i + 1, 2, 1, 3).setValues([[name || values[i][1] || '', values[i][2] || now, now]]);
      return;
    }
  }
  sheet.appendRow([email, name || '', now, now]);
}

// Oldest request first, so the admin sees who's been waiting longest.
function listAccessRequests(ss) {
  const sheet = getOrCreateAccessRequestsSheet(ss);
  const values = sheet.getDataRange().getValues();
  const out = [];
  for (let i = 1; i < values.length; i++) {
    const email = String(values[i][0] || '').trim();
    if (!email) continue;
    out.push({
      email: email, name: String(values[i][1] || ''),
      firstRequestedAt: values[i][2] ? new Date(values[i][2]).toISOString() : '',
      lastRequestedAt: values[i][3] ? new Date(values[i][3]).toISOString() : ''
    });
  }
  out.sort((a, b) => a.firstRequestedAt.localeCompare(b.firstRequestedAt));
  return out;
}

function deleteAccessRequest(ss, email) {
  const needle = String(email || '').trim().toLowerCase();
  if (!needle) return;
  const sheet = getOrCreateAccessRequestsSheet(ss);
  const values = sheet.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][0] || '').trim().toLowerCase() === needle) {
      sheet.deleteRow(i + 1);
      return;
    }
  }
}

/* ---- Sign-in log ----
   Records every successful sign-in, password-based or Google-based, so admins can see who's been
   getting in and when. Apps Script never hands a web app the caller's real IP address, so there's
   no IP column here on purpose — logging a self-reported one would mean an extra, unverifiable
   network call out to a third-party lookup service for every sign-in, which wasn't worth it. The
   "Device" column is the browser's own User-Agent string, reported by the page itself (no outside
   service involved) to at least show roughly what device/browser was used. */
const SIGN_IN_LOG_SHEET = 'SignInLog';
const SIGN_IN_LOG_HEADERS = ['Timestamp', 'Via', 'Email', 'Name', 'Roles', 'Device'];
const SIGN_IN_LOG_MAX_ROWS = 3000; // trims oldest entries beyond this so the sheet doesn't grow forever

function getOrCreateSignInLogSheet(ss) {
  let sheet = ss.getSheetByName(SIGN_IN_LOG_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(SIGN_IN_LOG_SHEET);
    sheet.appendRow(SIGN_IN_LOG_HEADERS);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

// via: a short label for how they signed in — "Google", "Master password", "Tasks password",
// "Head Pyro password", or "Manage/Edit password". roles: a '+'-joined role string (or a bare
// tier like 'admin'/'hp' for password logins). email/name: only set for Google sign-ins.
function logSignIn(ss, via, roles, userAgent, email, name) {
  try {
    const sheet = getOrCreateSignInLogSheet(ss);
    sheet.appendRow([
      new Date(), via || '', email || '', name || '', roles || '',
      String(userAgent || '').slice(0, 300)
    ]);
    const lastRow = sheet.getLastRow();
    if (lastRow > SIGN_IN_LOG_MAX_ROWS + 1) {
      sheet.deleteRows(2, lastRow - (SIGN_IN_LOG_MAX_ROWS + 1));
    }
  } catch (err) {
    // A logging failure should never block someone from signing in.
  }
}

// Newest first, capped to `limit` (default 200) so the admin page stays fast even once the sheet is large.
function listSignInLog(ss, limit) {
  const sheet = getOrCreateSignInLogSheet(ss);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  const cap = Math.max(1, Math.min(Number(limit) || 200, SIGN_IN_LOG_MAX_ROWS));
  const firstRow = Math.max(2, lastRow - cap + 1);
  const values = sheet.getRange(firstRow, 1, lastRow - firstRow + 1, SIGN_IN_LOG_HEADERS.length).getValues();
  const out = values.map(row => ({
    timestamp: row[0] ? new Date(row[0]).toISOString() : '',
    via: String(row[1] || ''),
    email: String(row[2] || ''),
    name: String(row[3] || ''),
    roles: String(row[4] || ''),
    userAgent: String(row[5] || '')
  }));
  out.reverse(); // newest first
  return out;
}

// For the Manage Access page only — when was each email last seen signing in, pulled from the
// sign-in log. Scans the whole log once (it's capped at SIGN_IN_LOG_MAX_ROWS rows) rather than
// once per person on the roster, since nothing else needs this.
function getLastSignInByEmail(ss) {
  const sheet = getOrCreateSignInLogSheet(ss);
  const lastRow = sheet.getLastRow();
  const map = {};
  if (lastRow < 2) return map;
  const values = sheet.getRange(2, 1, lastRow - 1, SIGN_IN_LOG_HEADERS.length).getValues();
  values.forEach(row => {
    const email = String(row[2] || '').trim().toLowerCase();
    if (!email || !row[0]) return;
    const ts = new Date(row[0]).toISOString();
    if (!map[email] || ts > map[email]) map[email] = ts;
  });
  return map;
}

/* ---- Run this from the Apps Script editor (not from a page) ---- */
// Invalidates every signed-in session (Google included) by rotating the token-signing secret —
// useful if a device or account needs to be forced to sign in again right away.
function signOutEveryone() {
  PropertiesService.getScriptProperties().setProperty('TOKEN_SECRET', Utilities.getUuid() + Utilities.getUuid());
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
  try {
    return doPostInner(e);
  } catch (err) {
    return jsonOut({status: 'error', message: 'Server error: ' + (err && err.message ? err.message : err)});
  }
}

function doPostInner(e) {
  const data = JSON.parse(e.postData.contents);
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  if (data.recordType === 'googleLogin') return handleGoogleLogin(data, ss);
  if (data.recordType === 'accessRoleSet') {
    const denied = authorize(ss, data.token, 'admin');
    if (denied) return denied;
    return jsonOut(setAccessRole(ss, data.email, data.name, data.roles));
  }
  if (data.recordType === 'accessRoleDelete') {
    const denied = authorize(ss, data.token, 'admin');
    if (denied) return denied;
    return jsonOut(deleteAccessRole(ss, data.email));
  }
  if (data.recordType === 'accessRequestDismiss') {
    // Lets an admin clear a request without granting access — a wrong email, someone who
    // shouldn't have access, or a duplicate of one already handled.
    const denied = authorize(ss, data.token, 'admin');
    if (denied) return denied;
    deleteAccessRequest(ss, data.email);
    return jsonOut({status: 'ok'});
  }
  if (data.recordType && data.recordType !== 'contact') {
    const denied = authorize(ss, data.token, POST_LEVELS[data.recordType] || 'admin');
    if (denied) return denied;
  }

  if (data.recordType === 'contact') {
    // Three ways in: the manager (token), a person updating their own record (name + phone must match what is on file),
    // or a brand-new person (createOnly: it can add a record but never touch an existing one).
    const isAdmin = rolesFromToken(data.token).indexOf('admin') > -1;
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
    const venueId = String(data.id || '').trim();
    const dataJson = JSON.stringify(data.data && typeof data.data === 'object' ? data.data : {});
    if (dataJson.length > 45000) return jsonOut({status: 'error', message: 'Pick list is too large'});
    const sheet = getOrCreatePickListsSheet(ss);
    const map = headerMap(sheet);
    const row = findPickListRow(sheet, map, name, venueId);
    const eventDate = normalizeDateValue(data.eventDate);
    if (row > 0) {
      // Only touch the fields this save owns, so an uploaded site map is never lost.
      if (venueId && map['VenueId'] !== undefined && !String(sheet.getRange(row, map['VenueId'] + 1).getValue() || '').trim()) {
        sheet.getRange(row, map['VenueId'] + 1).setValue(venueId); // backfill a legacy row the first time it's resaved
      }
      sheet.getRange(row, map['Name'] + 1).setValue(name);
      sheet.getRange(row, map['EventDate'] + 1).setValue(eventDate);
      sheet.getRange(row, map['DataJson'] + 1).setValue(dataJson);
      sheet.getRange(row, map['UpdatedAt'] + 1).setValue(new Date());
    } else {
      const newRow = new Array(sheet.getLastColumn()).fill('');
      if (map['VenueId'] !== undefined) newRow[map['VenueId']] = venueId;
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
    const venueId = String(data.id || '').trim();
    const sheet = getOrCreatePickListsSheet(ss);
    const map = headerMap(sheet);
    let row = findPickListRow(sheet, map, name, venueId);
    if (row < 0) {
      const newRow = new Array(sheet.getLastColumn()).fill('');
      if (map['VenueId'] !== undefined) newRow[map['VenueId']] = venueId;
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

  if (data.recordType === 'payrollReport') {
    const base64 = String(data.pdfBase64 || '').replace(/^data:application\/pdf[^,]*;base64,/, '');
    if (!base64) return jsonOut({status: 'error', message: 'Missing the payroll PDF'});
    let fileName = String(data.fileName || '').replace(/[\\\/:*?"<>|]/g, '').trim().slice(0, 120);
    if (!fileName) fileName = 'Payroll_' + (String(data.eventDate || '').trim() || 'report') + '.pdf';
    if (!/\.pdf$/i.test(fileName)) fileName += '.pdf';

    const fileId = savePayrollPdfToDrive(base64, fileName);
    if (!fileId) return jsonOut({status: 'error', message: 'Could not save that PDF to Drive'});

    const submissionId = Utilities.getUuid();
    const event = String(data.event || '').trim().slice(0, 200);
    const eventDate = normalizeDateValue(data.eventDate);
    const savedAt = new Date();

    const reportsSheet = getOrCreatePayrollReportsSheet(ss);
    reportsSheet.appendRow([
      savedAt, event, eventDate, String(data.toAddress || '').trim().slice(0, 200), fileName, fileId, submissionId
    ]);

    // Structured line items for the Manage/Edit payroll report, logged at most once per
    // submission (the page only sends `entries` the first time it's sent/shared; repeat
    // emails of the same unedited payroll just save another Drive copy of the PDF).
    const entries = Array.isArray(data.entries) ? data.entries : [];
    if (entries.length) {
      const unit = data.unit === 'hours' ? 'hours' : 'usd';
      const declaredTotal = data.declaredTotal === '' || data.declaredTotal == null ? '' : Number(data.declaredTotal) || 0;
      const payrollSheet = getOrCreatePayrollSheet(ss);
      const map = headerMap(payrollSheet);
      const rows = entries.map(entry => {
        const row = new Array(Object.keys(map).length).fill('');
        row[map['Id']] = Utilities.getUuid();
        row[map['SubmissionId']] = submissionId;
        row[map['Timestamp']] = savedAt;
        row[map['Event']] = event;
        row[map['EventDate']] = eventDate;
        row[map['Name']] = String(entry.name || '').trim().slice(0, 120);
        row[map['Role']] = entry.role === 'headPyro' ? 'Head Pyro' : 'Crew';
        row[map['Amount']] = Number(entry.amount) || 0;
        row[map['Unit']] = unit;
        row[map['DeclaredTotal']] = declaredTotal;
        row[map['Status']] = 'Pending';
        return row;
      }).filter(row => row[map['Name']]);
      if (rows.length) payrollSheet.getRange(payrollSheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
    }

    return jsonOut({status: 'ok', fileId: fileId, submissionId: submissionId});
  }

  if (data.recordType === 'payrollSetPin') {
    // Setting (or replacing) a PIN still requires proving it's really that person, the same way
    // looking up their pay does today — with the phone number on file for their exact name.
    const nameKey = String(data.name || '').trim().toLowerCase();
    if (!nameKey) return jsonOut({status: 'error', message: 'Enter your name.'});
    const pin = String(data.pin || '').trim();
    if (!/^\d{4,8}$/.test(pin)) return jsonOut({status: 'error', message: 'Use a PIN of 4 to 8 digits.'});

    const cache = CacheService.getScriptCache();
    const failKey = 'payrollPhoneFail_' + nameKey.replace(/[^a-z0-9]/g, '_').slice(0, 80);
    const failures = Number(cache.get(failKey) || 0);
    if (failures >= 8) {
      return jsonOut({status: 'error', code: 'locked', message: 'Too many attempts for that name. Wait a few minutes and try again.'});
    }
    const merged = getMergedContacts(ss);
    const match = merged[nameKey];
    const onFilePhone = match ? String(match.phone || '').replace(/\D/g, '') : '';
    const enteredPhone = String(data.phone || '').replace(/\D/g, '');
    if (!match || !onFilePhone || enteredPhone.length < 7 || onFilePhone !== enteredPhone) {
      cache.put(failKey, String(failures + 1), 600);
      return jsonOut({status: 'error', message: 'That name and phone number don\'t match what\'s on file together.'});
    }
    cache.remove(failKey);
    setPayrollPinHash(ss, nameKey, saltedHash(pin));
    return jsonOut({status: 'ok'});
  }

  if (data.recordType === 'setAvailability') {
    // Crew marking themselves unavailable for an upcoming show, so Head Pyros can see conflicts
    // when staffing. Low-stakes self-reported data — no identity check beyond the name, same as
    // everything else gated at the shared Head Pyro password level.
    const name = String(data.name || '').trim();
    const venueId = String(data.venueId || '').trim();
    if (!name) return jsonOut({status: 'error', message: 'Enter your name.'});
    if (!venueId) return jsonOut({status: 'error', message: 'Missing which show.'});
    setAvailability(ss, name.toLowerCase(), name, venueId, !!data.unavailable);
    return jsonOut({status: 'ok'});
  }

  if (data.recordType === 'showSignup') {
    // Public — the Schedule page is a front-page feature with no sign-in, same as Check-In.
    const name = String(data.name || '').trim();
    const venueId = String(data.venueId || '').trim();
    if (!name) return jsonOut({status: 'error', message: 'Enter your name.'});
    if (!venueId) return jsonOut({status: 'error', message: 'Missing which show.'});
    const result = addShowSignup(ss, venueId, name);
    return jsonOut(result);
  }

  if (data.recordType === 'removeShowSignup') {
    const name = String(data.name || '').trim();
    const venueId = String(data.venueId || '').trim();
    if (!name) return jsonOut({status: 'error', message: 'Missing name.'});
    if (!venueId) return jsonOut({status: 'error', message: 'Missing which show.'});
    removeShowSignup(ss, venueId, name);
    return jsonOut({status: 'ok'});
  }

  if (data.recordType === 'photoWallSubmit') {
    // Public — anyone can submit from the front page, same trust level as Check-In. Nothing
    // submitted here is shown anywhere until an admin approves it from Manage.
    const result = addPhotoWallSubmission(ss, data.name, data.caption, data.photoBase64);
    return jsonOut(result);
  }

  if (data.recordType === 'photoWallModerate') {
    // Admin-only: approve or reject a pending photo.
    const id = String(data.id || '').trim();
    const status = data.status === 'Approved' ? 'Approved' : (data.status === 'Rejected' ? 'Rejected' : '');
    if (!id || !status) return jsonOut({status: 'error', message: 'Missing which photo, or an invalid status.'});
    return jsonOut(setPhotoWallStatus(ss, id, status));
  }

  if (data.recordType === 'photoWallDelete') {
    // Admin-only: permanently remove a photo (and its Drive file).
    const id = String(data.id || '').trim();
    if (!id) return jsonOut({status: 'error', message: 'Missing which photo.'});
    return jsonOut(deletePhotoWallEntry(ss, id));
  }

  if (data.recordType === 'editPayrollLine') {
    // Changing an already-logged amount — requires a reason, which is kept with the line so
    // anyone looking at the report later can see why it doesn't match what was first entered.
    // If that show had already been approved, this puts it back to Pending: the approval was
    // for the old number, not this one.
    const sheet = ss.getSheetByName('Payroll');
    if (!sheet || !data.id) return jsonOut({status: 'error', message: 'Missing which line to change.'});
    const newAmount = Number(data.newAmount);
    if (!Number.isFinite(newAmount) || newAmount < 0) return jsonOut({status: 'error', message: 'Enter a valid amount of zero or more.'});
    const reason = String(data.reason || '').trim().slice(0, 500);
    if (!reason) return jsonOut({status: 'error', message: 'Enter a reason for this change.'});
    const map = headerMap(sheet);
    const rows = sheet.getDataRange().getValues();
    let found = false;
    const editedAt = new Date();
    for (let i = 1; i < rows.length; i++) {
      if (String(rows[i][map['Id']]) === String(data.id)) {
        sheet.getRange(i + 1, map['Amount'] + 1).setValue(newAmount);
        sheet.getRange(i + 1, map['EditedAt'] + 1).setValue(editedAt);
        sheet.getRange(i + 1, map['EditReason'] + 1).setValue(reason);
        if (String(rows[i][map['Status']] || '').trim() === 'Approved') {
          sheet.getRange(i + 1, map['Status'] + 1).setValue('Pending');
        }
        found = true;
        break;
      }
    }
    if (!found) return jsonOut({status: 'error', message: 'Could not find that payroll line.'});
    return jsonOut({status: 'ok', editedAt: editedAt.toISOString()});
  }

  if (data.recordType === 'deletePayrollLine') {
    const sheet = ss.getSheetByName('Payroll');
    if (sheet && data.id) {
      const map = headerMap(sheet);
      const rows = sheet.getDataRange().getValues();
      for (let i = rows.length - 1; i >= 1; i--) {
        if (String(rows[i][map['Id']]) === String(data.id)) { sheet.deleteRow(i + 1); break; }
      }
    }
    return jsonOut({status: 'ok'});
  }

  if (data.recordType === 'deletePayrollShow') {
    const sheet = ss.getSheetByName('Payroll');
    if (sheet && data.submissionId) {
      const map = headerMap(sheet);
      const rows = sheet.getDataRange().getValues();
      for (let i = rows.length - 1; i >= 1; i--) {
        if (String(rows[i][map['SubmissionId']]) === String(data.submissionId)) sheet.deleteRow(i + 1);
      }
    }
    return jsonOut({status: 'ok'});
  }

  if (data.recordType === 'approvePayrollShow' || data.recordType === 'unapprovePayrollShow') {
    const sheet = ss.getSheetByName('Payroll');
    const newStatus = data.recordType === 'approvePayrollShow' ? 'Approved' : 'Pending';
    if (sheet && data.submissionId) {
      const map = headerMap(sheet);
      const rows = sheet.getDataRange().getValues();
      for (let i = 1; i < rows.length; i++) {
        if (String(rows[i][map['SubmissionId']]) === String(data.submissionId)) {
          sheet.getRange(i + 1, map['Status'] + 1).setValue(newStatus);
        }
      }
    }
    return jsonOut({status: 'ok'});
  }

  if (data.recordType === 'payrollSettings') {
    // Each setting is only touched when the caller actually sends it, so flipping one switch
    // (e.g. from the checkbox's onchange) never resets the other one back to its default.
    const props = PropertiesService.getScriptProperties();
    if (Object.prototype.hasOwnProperty.call(data, 'hideUnapproved')) {
      props.setProperty('PAYROLL_HIDE_UNAPPROVED', data.hideUnapproved ? 'true' : 'false');
    }
    if (Object.prototype.hasOwnProperty.call(data, 'myPayDisabled')) {
      props.setProperty('MY_PAY_DISABLED', data.myPayDisabled ? 'true' : 'false');
    }
    return jsonOut({status: 'ok'});
  }

  if (data.recordType === 'scheduleSettings') {
    if (Object.prototype.hasOwnProperty.call(data, 'scheduleDisabled')) {
      PropertiesService.getScriptProperties().setProperty('SCHEDULE_DISABLED', data.scheduleDisabled ? 'true' : 'false');
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

  // Manual add/edit for a single catalog item (Manage Catalog's "Add / Edit" form) —
  // mirrors the venue save pattern: match by the row's stable Id when editing,
  // otherwise always append a new row, so two different items that happen to share a
  // name are never silently merged into one.
  if (data.recordType === 'product') {
    const name = String(data.name || '').trim();
    if (!name) return jsonOut({status: 'error', message: 'Product name is required'});
    const sheet = getOrCreateProductsSheet(ss);
    const map = headerMap(sheet);
    const rows = sheet.getDataRange().getValues();
    let rowIndex = -1;
    if (data.id) {
      for (let i = 1; i < rows.length; i++) {
        if (String(rows[i][map['Id']]) === String(data.id)) { rowIndex = i + 1; break; }
      }
    }
    const existingId = rowIndex > 0 ? String(rows[rowIndex - 1][map['Id']] || '') : '';
    const existingImage = rowIndex > 0 ? String(rows[rowIndex - 1][map['ImageUrl']] || '') : '';
    const existingVideo = rowIndex > 0 ? String(rows[rowIndex - 1][map['VideoId']] || '') : '';
    const existingUrl = rowIndex > 0 ? String(rows[rowIndex - 1][map['Url']] || '') : '';
    const newUrl = String(data.url || '');
    const urlChanged = newUrl !== existingUrl;

    const newRow = [];
    newRow[map['Id']] = existingId || Utilities.getUuid();
    newRow[map['Class']] = String(data.class || '');
    newRow[map['Category']] = String(data.category || '');
    newRow[map['Name']] = name;
    newRow[map['Brand']] = String(data.brand || '');
    newRow[map['Color']] = String(data.color || '');
    newRow[map['Effect']] = String(data.effect || '');
    newRow[map['Duration']] = String(data.duration || '');
    newRow[map['KurtisApproved']] = data.kurtisApproved ? 'Yes' : '';
    newRow[map['Price']] = String(data.price || '');
    newRow[map['Description']] = String(data.description || '');
    newRow[map['Url']] = newUrl;
    // A changed (or newly-added) link needs a fresh picture/video lookup; an unchanged
    // one keeps whatever was already cached so editing other fields doesn't re-fetch it.
    newRow[map['ImageUrl']] = urlChanged ? '' : existingImage;
    newRow[map['VideoId']] = urlChanged ? '' : existingVideo;

    if (rowIndex > 0) {
      sheet.getRange(rowIndex, 1, 1, newRow.length).setValues([newRow]);
    } else {
      sheet.appendRow(newRow);
    }
    return jsonOut({status: 'ok', id: newRow[map['Id']]});
  }

  // The general vendor-catalog import used by Import Product Lists — one CSV, any
  // mix of categories (Cakes, Shells 3in, Fountains, Comets, ...), straight from a
  // supplier's price list export.
  if (data.recordType === 'productsImport') {
    const rows = Array.isArray(data.rows) ? data.rows : [];
    if (!rows.length) return jsonOut({status: 'error', message: 'No rows to import'});
    if (rows.length > 5000) return jsonOut({status: 'error', message: 'That CSV has too many rows to import at once (max 5000)'});
    const sheet = getOrCreateProductsSheet(ss);
    const map = headerMap(sheet);
    // A row whose Id column matches an existing product updates that row in place
    // instead of appending a duplicate — this is what makes "export the catalog, edit
    // it, re-import the same file" work as a round trip rather than piling up copies.
    const existingRows = sheet.getDataRange().getValues();
    const idRowNumber = {};
    for (let i = 1; i < existingRows.length; i++) {
      const id = String(existingRows[i][map['Id']] || '').trim();
      if (id) idRowNumber[id] = i + 1;
    }
    const newRows = [];
    let created = 0, updated = 0;
    rows.forEach(r => {
      const id = String(r.id || '').trim();
      const matchedRow = id && idRowNumber[id] ? idRowNumber[id] : -1;
      const row = new Array(Object.keys(map).length).fill('');
      row[map['Id']] = matchedRow > 0 ? id : Utilities.getUuid();
      row[map['Class']] = String(r.class || '');
      row[map['Category']] = String(r.category || '');
      row[map['Name']] = String(r.name || '');
      row[map['Brand']] = String(r.brand || '');
      row[map['Color']] = String(r.color || '');
      row[map['Effect']] = String(r.effect || '');
      row[map['Duration']] = String(r.duration || '');
      row[map['KurtisApproved']] = r.kurtisApproved ? 'Yes' : '';
      row[map['Price']] = String(r.price || '');
      row[map['Description']] = String(r.description || '');
      row[map['Url']] = String(r.url || '');
      if (matchedRow > 0) {
        // Keep the cached photo/video unless the supplier link itself changed —
        // same rule the single-item editor uses.
        const existingUrl = String(existingRows[matchedRow - 1][map['Url']] || '');
        const urlChanged = row[map['Url']] !== existingUrl;
        row[map['ImageUrl']] = urlChanged ? '' : String(existingRows[matchedRow - 1][map['ImageUrl']] || '');
        row[map['VideoId']] = urlChanged ? '' : String(existingRows[matchedRow - 1][map['VideoId']] || '');
        sheet.getRange(matchedRow, 1, 1, row.length).setValues([row]);
        updated++;
      } else {
        newRows.push(row);
        created++;
      }
    });
    if (newRows.length) {
      sheet.getRange(sheet.getLastRow() + 1, 1, newRows.length, newRows[0].length).setValues(newRows);
    }
    return jsonOut({status: 'ok', imported: created, updated: updated});
  }

  if (data.recordType === 'deleteProduct') {
    const sheet = ss.getSheetByName('Products');
    if (sheet) {
      const map = headerMap(sheet);
      const rows = sheet.getDataRange().getValues();
      for (let i = 1; i < rows.length; i++) {
        if (String(rows[i][map['Id']]) === String(data.id)) { sheet.deleteRow(i + 1); break; }
      }
    }
    return jsonOut({status: 'ok'});
  }

  // Pre-fetches the supplier picture for every product that has a link and hasn't been
  // checked yet, instead of waiting for someone to open each one in the Catalog. A web
  // request here is capped at 6 minutes, and a few hundred supplier pages won't fit in
  // that, so this does as many as it can and reports back how many are left — the page
  // calling it keeps calling this in a loop (each call resuming where the last left off,
  // since every fetch is written to the sheet immediately) until none remain.
  if (data.recordType === 'productsImageBackfill') {
    const startedAt = Date.now();
    const timeBudgetMs = 4.5 * 60 * 1000;
    const sheetExists = !!ss.getSheetByName('Products');
    if (!sheetExists) return jsonOut({status: 'ok', processed: 0, remaining: 0, done: true});
    // getOrCreateProductsSheet (not getSheetByName) so a Products sheet created by an
    // older version of this script — before the ImageUrl column existed — gets that
    // column backfilled now, instead of computing an invalid (missing) column number.
    const sheet = getOrCreateProductsSheet(ss);
    const map = headerMap(sheet);
    const values = sheet.getDataRange().getValues();
    let processed = 0;
    let remaining = 0;
    for (let i = 1; i < values.length; i++) {
      const url = String(values[i][map['Url']] || '');
      const cachedImage = String(values[i][map['ImageUrl']] || '');
      const cachedVideo = String(values[i][map['VideoId']] || '');
      if (!url || (cachedImage && cachedVideo)) continue;
      if (Date.now() - startedAt > timeBudgetMs) { remaining++; continue; }
      const name = String(values[i][map['Name']] || '');
      const found = fetchAndSaveProductMedia(url, name);
      sheet.getRange(i + 1, map['ImageUrl'] + 1).setValue(found.imageUrl || 'NONE');
      sheet.getRange(i + 1, map['VideoId'] + 1).setValue(found.videoId || 'NONE');
      processed++;
    }
    return jsonOut({status: 'ok', processed: processed, remaining: remaining, done: remaining === 0});
  }

  if (data.recordType === 'showPlan') {
    const name = String(data.name || '').trim();
    if (!name) return jsonOut({status: 'error', message: 'Missing plan name'});
    const itemsJson = JSON.stringify(Array.isArray(data.items) ? data.items : []);
    if (itemsJson.length > 200000) return jsonOut({status: 'error', message: 'That plan is too large to save at once'});
    const notes = String(data.notes || '');
    const sheet = getOrCreateShowPlansSheet(ss);
    const map = headerMap(sheet);
    const row = findShowPlanRow(sheet, map, data.originalName || name);
    if (row > 0) {
      sheet.getRange(row, map['Name'] + 1).setValue(name);
      sheet.getRange(row, map['ItemsJson'] + 1).setValue(itemsJson);
      // Notes is only sent when the caller is actually editing it (the plan-a-show page
      // sends it on every save); guard anyway so an older/partial payload can't wipe it.
      if (data.notes !== undefined) sheet.getRange(row, map['Notes'] + 1).setValue(notes);
      sheet.getRange(row, map['UpdatedAt'] + 1).setValue(new Date());
    } else {
      const newRow = ['', '', '', ''];
      newRow[map['Name']] = name;
      newRow[map['ItemsJson']] = itemsJson;
      newRow[map['Notes']] = notes;
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

  if (data.recordType === 'proxPlan') {
    const venueId = String(data.venueId || '').trim();
    if (!venueId) return jsonOut({status: 'error', message: 'Pick an event first.'});
    const effects = cleanProxPlanEffects(data.effects);
    const notes = String(data.notes || '').slice(0, 2000);
    const sheet = getOrCreateProxPlansSheet(ss);
    const map = headerMap(sheet);
    const row = findProxPlanRow(sheet, map, venueId);
    const rowValues = new Array(sheet.getLastColumn()).fill('');
    rowValues[map['VenueId']] = venueId;
    rowValues[map['VenueName']] = String(data.venueName || '').trim();
    rowValues[map['VenueDate']] = String(data.venueDate || '').trim();
    rowValues[map['EffectsJson']] = JSON.stringify(effects);
    rowValues[map['Notes']] = notes;
    rowValues[map['UpdatedAt']] = new Date();
    if (row > 0) {
      sheet.getRange(row, 1, 1, rowValues.length).setValues([rowValues]);
    } else {
      sheet.appendRow(rowValues);
    }
    return jsonOut({status: 'ok'});
  }

  if (data.recordType === 'deleteProxPlan') {
    const sheet = ss.getSheetByName('ProxPlans');
    if (sheet) {
      const map = headerMap(sheet);
      const row = findProxPlanRow(sheet, map, data.venueId);
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
    const existingAssignedHp = rowIndex > 0 ? rows[rowIndex - 1][map['AssignedHp']] : '';
    const existingCallTime = rowIndex > 0 ? normalizeTimeValue(rows[rowIndex - 1][map['CallTime']]) : '';
    const existingSignupLimit = rowIndex > 0 ? rows[rowIndex - 1][map['SignupLimit']] : '';
    const existingNfpaTypes = rowIndex > 0 ? rows[rowIndex - 1][map['NfpaTypes']] : '';

    const newRow = [];
    newRow[map['Name']] = data.name;
    newRow[map['Address']] = data.address || '';
    newRow[map['County']] = data.county || '';
    newRow[map['EventDate']] = data.eventDate || '';
    newRow[map['SignInEnabled']] = existingSignIn || '';
    newRow[map['Id']] = existingId || Utilities.getUuid();
    // assignedHp/callTime/nfpaTypes are only sent as explicit fields from venues.html's editor,
    // but use hasOwnProperty so an admin clearing the field still gets that saved rather than
    // falling back to the preserved existing value.
    newRow[map['AssignedHp']] = Object.prototype.hasOwnProperty.call(data, 'assignedHp') ? (data.assignedHp || '') : (existingAssignedHp || '');
    newRow[map['CallTime']] = Object.prototype.hasOwnProperty.call(data, 'callTime') ? (data.callTime || '') : (existingCallTime || '');
    newRow[map['SignupLimit']] = Object.prototype.hasOwnProperty.call(data, 'signupLimit') ? (Number(data.signupLimit) || 0) : (existingSignupLimit || '');
    newRow[map['NfpaTypes']] = Object.prototype.hasOwnProperty.call(data, 'nfpaTypes') ? cleanNfpaTypes(data.nfpaTypes).join(',') : (existingNfpaTypes || '');

    if (rowIndex > 0) {
      sheet.getRange(rowIndex, 1, 1, newRow.length).setValues([newRow]);
    } else {
      sheet.appendRow(newRow);
    }
    CacheService.getScriptCache().remove(VENUES_CACHE_KEY);
    return ContentService.createTextOutput(JSON.stringify({status: 'ok', id: newRow[map['Id']]}))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // A Head Pyro signing someone else in manually (hp-tools → Sign In Crew), as opposed to
  // a person checking themselves in on checkin.html. Written to the same sheet and read by
  // the same roster everywhere else reads it, but flagged in its own column so it's always
  // possible to tell the two apart later.
  if (data.recordType === 'hpCheckIn') {
    const name = String(data.name || '').trim();
    const eventName = String(data.event || '').trim();
    if (!name) return jsonOut({status: 'error', message: 'Missing name'});
    if (!eventName) return jsonOut({status: 'error', message: 'Missing event'});
    const sheet = ensureCheckInSheet(ss);
    const row = [new Date(), eventName, data.eventDate || '', name, data.license || '', data.address || '', data.age || '', data.phone || '', data.checkInTime || '', data.isHeadPyro ? 'Yes' : '', 'Yes'];
    sheet.appendRow(row);
    return jsonOut({status: 'ok'});
  }

  // Removes one sign-in row — for an accidental duplicate (the quick-tap sign-in on
  // sign-in-crew.html is an easy double-tap away from one). rowIndex comes from the same
  // ?event= listing the page just rendered, and name is checked against that row before
  // deleting so a stale rowIndex (sheet edited elsewhere in between) can't delete the wrong person.
  if (data.recordType === 'deleteCheckIn') {
    const rowIndex = Number(data.rowIndex) || 0;
    const name = String(data.name || '').trim();
    if (!rowIndex || rowIndex < 2) return jsonOut({status: 'error', message: 'Missing row'});
    const sheet = findCheckInSheet(ss);
    if (rowIndex > sheet.getLastRow()) return jsonOut({status: 'error', message: 'That sign-in is already gone — refresh and try again.'});
    const rowVals = sheet.getRange(rowIndex, 1, 1, Math.max(sheet.getLastColumn(), 4)).getValues()[0];
    const rowName = String(rowVals[3] || '').trim();
    if (name && rowName.toLowerCase() !== name.toLowerCase()) {
      return jsonOut({status: 'error', message: 'That sign-in has changed — refresh and try again.'});
    }
    sheet.deleteRow(rowIndex);
    return jsonOut({status: 'ok'});
  }

  // Only a real check-in (which has no recordType) reaches here. Anything else is a request this script does not know,
  // and must not be quietly written into the check-in sheet.
  if (data.recordType) return jsonOut({status: 'error', message: 'Unknown request'});

  const sheet = ensureCheckInSheet(ss);
  sheet.appendRow([new Date(), data.event, data.eventDate, data.name, data.license, data.address, data.age, data.phone || '', data.checkInTime || '', data.isHeadPyro ? 'Yes' : '', '']);
  return ContentService.createTextOutput(JSON.stringify({status: 'ok'}))
    .setMimeType(ContentService.MimeType.JSON);
}

// Sheet1 predates the header-backfill pattern used elsewhere in this file and is written to
// by fixed column position, not by name — this only adds the 11th column's label the first
// time it's needed, so a plain check-in that never sets it still lines up under a real header.
//
// getSheetByName('Sheet1') returns null if that tab was ever renamed (Google Sheets
// lets you rename "Sheet1" like any other tab), which used to crash both check-in
// paths with "Cannot read properties of null". findCheckInSheet() falls back to the
// spreadsheet's first tab — the check-in log is always created first — instead of
// assuming the literal name "Sheet1" still applies, and only creates a brand new
// sheet if the spreadsheet has none at all.
function findCheckInSheet(ss) {
  let sheet = ss.getSheetByName('Sheet1');
  if (sheet) return sheet;
  const sheets = ss.getSheets();
  return sheets.length ? sheets[0] : ss.insertSheet('Sheet1');
}
function ensureCheckInSheet(ss) {
  const sheet = findCheckInSheet(ss);
  const lastCol = Math.max(sheet.getLastColumn(), 1);
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  if (!headers[10]) sheet.getRange(1, 11).setValue('SignedInByHP');
  return sheet;
}

function normalizeDateValue(value) {
  if (Object.prototype.toString.call(value) === '[object Date]') {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  return String(value || '').slice(0, 10);
}

// A call time typed as "14:30" can get auto-converted by Google Sheets into a time-formatted
// cell, which Apps Script then hands back as a Date object (on the spreadsheet's 1899-12-30
// epoch) instead of the original string. Left alone, that Date serializes to JSON as a full
// ISO timestamp that nothing downstream can parse as a time. Same fix as normalizeDateValue,
// just for the time-of-day part.
function normalizeTimeValue(value) {
  if (Object.prototype.toString.call(value) === '[object Date]') {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'HH:mm');
  }
  return String(value || '').trim();
}

function doGet(e) {
  try {
    return doGetInner(e);
  } catch (err) {
    return jsonOut({status: 'error', message: 'Server error: ' + (err && err.message ? err.message : err)});
  }
}

function doGetInner(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const requestType = (e.parameter && e.parameter.type) || '';
  const denied = authorize(ss, e.parameter && e.parameter.token, GET_LEVELS[requestType] || 'hp');
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

  // Lets a signed-in Google user skip typing their name+phone on Update My Info: the email bound
  // into their token (set at Google sign-in, in makeToken) is matched against the Email column on
  // each contact. Only ever matches the token's OWN email — never a name or email a request
  // supplies — so a signed-in crew member can only ever auto-fill their own record this way, not
  // look anyone else's up.
  if (e.parameter.type === 'myContactInfo') {
    const signedInEmail = emailFromToken(e.parameter.token);
    const merged = signedInEmail ? getMergedContacts(ss) : {};
    const match = signedInEmail
      ? Object.values(merged).find(c => String(c.email || '').trim().toLowerCase() === signedInEmail)
      : null;
    if (match) {
      return ContentService.createTextOutput(JSON.stringify({
        found: true,
        name: match.name || '',
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
    return ContentService.createTextOutput(JSON.stringify({found: false}))
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
    // Matched by the venue's Id first (the real identity of a specific show); name is only
    // a fallback for pick lists saved before VenueId existed, and is ambiguous whenever two
    // shows share a venue name.
    const venueDatesById = {};
    const venueDatesByName = {};
    const vSheet = ss.getSheetByName('Venues');
    if (vSheet && vSheet.getLastRow() > 1) {
      const vm = headerMap(vSheet);
      vSheet.getDataRange().getValues().slice(1).forEach(r => {
        const id = String(r[vm['Id']] || '').trim();
        const n = String(r[vm['Name']] || '').trim().toLowerCase();
        const d = normalizeDateValue(r[vm['EventDate']]);
        if (id) venueDatesById[id] = d;
        if (n) venueDatesByName[n] = d;
      });
    }
    const lists = [];
    const sheet = ss.getSheetByName('PickLists');
    if (sheet && sheet.getLastRow() > 1) {
      const map = headerMap(sheet);
      sheet.getDataRange().getValues().slice(1).forEach(r => {
        const name = String(r[map['Name']] || '').trim();
        if (!name) return;
        const venueId = map['VenueId'] !== undefined ? String(r[map['VenueId']] || '').trim() : '';
        let parsed = {};
        try { parsed = JSON.parse(r[map['DataJson']] || '{}'); } catch (err) { parsed = {}; }
        const updated = r[map['UpdatedAt']];
        const liveDate = venueId ? venueDatesById[venueId] : venueDatesByName[name.toLowerCase()];
        lists.push({
          id: venueId,
          name: name,
          eventDate: liveDate || normalizeDateValue(r[map['EventDate']]),
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

  if (e.parameter.type === 'complianceReport') {
    // Crew roster + license info per show, straight from check-in records — the license captured
    // is whatever was on file at the moment that person checked in, which is the right number for
    // proving who was certified to work a given show, even if their license has since been renewed.
    const sheet = findCheckInSheet(ss);
    const fromDate = String(e.parameter.fromDate || '');
    const toDate = String(e.parameter.toDate || '');
    const rows = sheet.getDataRange().getValues();
    const results = rows.slice(1)
      .map(row => ({
        event: row[1], eventDate: normalizeDateValue(row[2]), name: row[3],
        license: row[4] || '', isHeadPyro: row[9] === 'Yes', checkInTime: row[8] || ''
      }))
      .filter(r => r.name)
      .filter(r => !fromDate || (r.eventDate || '') >= fromDate)
      .filter(r => !toDate || (r.eventDate || '') <= toDate)
      .sort((a, b) => (a.eventDate || '').localeCompare(b.eventDate || '') || a.event.localeCompare(b.event));
    return jsonOut({records: results.slice(0, 20000)});
  }

  if (e.parameter.type === 'payrollRecords') {
    // Every logged line item (who was paid what, per show) — the Manage/Edit payroll
    // report groups and totals these client-side, including by date range. Always returns
    // pending lines too (with their status) so an admin can find and approve them.
    return jsonOut({records: readPayrollRecords(ss).slice(0, 20000), hideUnapproved: payrollHideUnapproved(), myPayDisabled: myPayDisabled()});
  }

  if (e.parameter.type === 'payrollSettings') {
    return jsonOut({hideUnapproved: payrollHideUnapproved(), myPayDisabled: myPayDisabled()});
  }

  if (e.parameter.type === 'myPayStatus') {
    // Lets the My Pay page itself check the admin's kill switch before showing the lookup form.
    return jsonOut({disabled: myPayDisabled()});
  }

  if (e.parameter.type === 'scheduleStatus') {
    // Lets both the Venues page (to show the toggle's current state) and the crew-facing
    // show-schedule.html (to check the kill switch before showing the list) read this.
    return jsonOut({disabled: scheduleDisabled()});
  }

  if (e.parameter.type === 'scheduleFeed') {
    // A live calendar subscription (webcal://) for the Schedule page: every upcoming show, one
    // VEVENT each. Whoever subscribes gets this re-fetched by their calendar app on its own
    // schedule, so it stays current without anyone re-downloading a .ics file by hand.
    if (scheduleDisabled()) {
      return ContentService.createTextOutput(buildScheduleIcs([]))
        .setMimeType(ContentService.MimeType.ICAL);
    }
    const sheet = getOrCreateVenuesSheet(ss);
    const values = sheet.getDataRange().getValues();
    const headers = values[0] || [];
    const idx = {};
    headers.forEach((h, i) => { idx[h] = i; });
    const today = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'America/Denver', 'yyyy-MM-dd');
    const shows = values.slice(1)
      .filter(row => row[idx['Name']] && row[idx['EventDate']])
      .map(row => ({
        id: String(row[idx['Id']] || ''),
        name: String(row[idx['Name']] || ''),
        address: String(row[idx['Address']] || ''),
        eventDate: normalizeDateValue(row[idx['EventDate']]),
        assignedHp: String(row[idx['AssignedHp']] || ''),
        callTime: normalizeTimeValue(row[idx['CallTime']])
      }))
      .filter(v => v.eventDate && v.eventDate >= today)
      .sort((a, b) => a.eventDate.localeCompare(b.eventDate));
    return ContentService.createTextOutput(buildScheduleIcs(shows))
      .setMimeType(ContentService.MimeType.ICAL);
  }

  if (e.parameter.type === 'payrollPinStatus') {
    // So the page can show a PIN box instead of the phone box as soon as a name is typed,
    // without waiting for a failed lookup first.
    const nameKey = String(e.parameter.name || '').trim().toLowerCase();
    return jsonOut({hasPin: nameKey ? !!getPayrollPinHash(ss, nameKey) : false});
  }

  if (e.parameter.type === 'myAvailability') {
    // Which upcoming shows this person has already flagged as a conflict, so the page can
    // pre-check their boxes instead of starting blank every visit.
    const nameKey = String(e.parameter.name || '').trim().toLowerCase();
    return jsonOut({venueIds: nameKey ? getUnavailableVenueIds(ss, nameKey) : []});
  }

  if (e.parameter.type === 'availabilityOverview') {
    // Everyone's conflicts, by show — this is what turns individual check-boxes into a shared
    // staffing view for Head Pyros, without needing a separate sign-up/assignment system.
    return jsonOut({unavailableByVenue: getUnavailableNamesByVenue(ss)});
  }

  if (e.parameter.type === 'showSignups') {
    return jsonOut({byVenue: getShowSignupsByVenue(ss)});
  }

  if (e.parameter.type === 'photoWallApproved') {
    // Public — feeds the front-page slideshow. Only ever approved photos.
    return jsonOut(getApprovedPhotoWall(ss));
  }

  if (e.parameter.type === 'photoWallAll') {
    // Admin-only — the Manage review screen, pending/approved/rejected alike.
    return jsonOut(getAllPhotoWall(ss));
  }

  if (e.parameter.type === 'pendingTasksSummary') {
    // Admin-only — what tasks.html shows, and what the Tasks password's login alert is built from.
    return jsonOut(getPendingTasksSummary(ss));
  }

  if (e.parameter.type === 'accessRoles') {
    // Admin-only — the roster the Manage Access page edits (who can sign in with Google, and what
    // they can do), plus when each person was last seen signing in, so an admin can spot a grant
    // nobody's actually using.
    const roster = listAccessRoles(ss);
    const lastSignIn = getLastSignInByEmail(ss);
    roster.forEach(r => { r.lastSignIn = lastSignIn[r.email.toLowerCase()] || ''; });
    return jsonOut(roster);
  }

  if (e.parameter.type === 'accessRequests') {
    // Admin-only — people who tried signing in with Google but aren't on the roster yet.
    return jsonOut(listAccessRequests(ss));
  }

  if (e.parameter.type === 'signInLog') {
    // Admin-only — a record of every successful sign-in (password or Google), newest first.
    return jsonOut(listSignInLog(ss, e.parameter.limit));
  }

  if (e.parameter.type === 'payrollRecordsForName') {
    // Self-serve "My Pay": being signed in to Head Pyro Tools only proves which Google account
    // someone used, not which crew member's pay they're allowed to see (one HP/admin account can
    // look up anyone's name). So this also checks one of three things for that exact name: the
    // signed-in Google account's own email, if it matches the Email on file for that name (see
    // emailFromToken — can only ever match the SIGNED-IN account, never a name/email a request
    // just claims); a PIN the person set up for themselves; or (if they never set one up, or
    // forgot it) the phone number on file — the same way Update My Info lets someone update their
    // own record. Locked out per name after repeated wrong PIN/phone attempts (a Google-email
    // match never counts against that, since it isn't a guess).
    if (myPayDisabled()) return jsonOut({verified: false, disabled: true, records: []});
    const nameKey = String(e.parameter.name || '').trim().toLowerCase();
    if (!nameKey) return jsonOut({verified: false, records: []});
    const merged = getMergedContacts(ss);
    const match = merged[nameKey];
    const signedInEmail = emailFromToken(e.parameter.token);
    const viaGoogle = !!(signedInEmail && match && String(match.email || '').trim().toLowerCase() === signedInEmail);
    const cache = CacheService.getScriptCache();
    const failKey = 'payrollPhoneFail_' + nameKey.replace(/[^a-z0-9]/g, '_').slice(0, 80);
    const failures = Number(cache.get(failKey) || 0);
    if (!viaGoogle && failures >= 8) {
      return jsonOut({verified: false, locked: true, records: []});
    }
    const pinHash = getPayrollPinHash(ss, nameKey);
    const enteredPin = String(e.parameter.pin || '').trim();
    let ok = viaGoogle;
    if (!ok && enteredPin) {
      ok = !!pinHash && passwordMatches(pinHash, enteredPin);
    } else if (!ok) {
      const onFilePhone = match ? String(match.phone || '').replace(/\D/g, '') : '';
      const enteredPhone = String(e.parameter.phone || '').replace(/\D/g, '');
      ok = !!match && !!onFilePhone && enteredPhone.length >= 7 && onFilePhone === enteredPhone;
    }
    if (!ok) {
      cache.put(failKey, String(failures + 1), 600);
      return jsonOut({verified: false, records: [], hasPin: !!pinHash});
    }
    cache.remove(failKey);
    let records = readPayrollRecords(ss).filter(r => r.name.trim().toLowerCase() === nameKey);
    if (payrollHideUnapproved()) records = records.filter(r => r.status === 'Approved');
    return jsonOut({verified: true, records: records.slice(0, 2000), hasPin: !!pinHash});
  }

  if (e.parameter.type === 'payRate') {
    // One rate-memory suggestion for the Payroll page: this person's most recent amount,
    // preferring a match at the same venue if there is one.
    const nameKey = String(e.parameter.name || '').trim().toLowerCase();
    if (!nameKey) return jsonOut({suggestion: null});
    const venueKey = String(e.parameter.venue || '').trim().toLowerCase();
    const mine = readPayrollRecords(ss).filter(r => r.name.trim().toLowerCase() === nameKey);
    const pick = (list) => list.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''))[0] || null;
    let best = venueKey ? pick(mine.filter(r => r.event.trim().toLowerCase() === venueKey)) : null;
    if (!best) best = pick(mine);
    if (!best) return jsonOut({suggestion: null});
    return jsonOut({suggestion: {amount: best.amount, unit: best.unit, event: best.event, eventDate: best.eventDate}});
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

  if (e.parameter.type === 'products') {
    const products = [];
    const sheet = ss.getSheetByName('Products');
    if (sheet && sheet.getLastRow() > 1) {
      const map = headerMap(sheet);
      sheet.getDataRange().getValues().slice(1).forEach(r => {
        const id = String(r[map['Id']] || '').trim();
        if (!id) return;
        products.push({
          id: id,
          class: String(r[map['Class']] || ''),
          category: String(r[map['Category']] || ''),
          name: String(r[map['Name']] || ''),
          brand: String(r[map['Brand']] || ''),
          color: String(r[map['Color']] || ''),
          effect: String(r[map['Effect']] || ''),
          duration: String(r[map['Duration']] || ''),
          price: String(r[map['Price']] || ''),
          description: String(r[map['Description']] || ''),
          url: String(r[map['Url']] || ''),
          imageUrl: String(r[map['ImageUrl']] || ''),
          videoId: String(r[map['VideoId']] || ''),
          kurtisApproved: String(r[map['KurtisApproved']] || '') === 'Yes'
        });
      });
    }
    return jsonOut({products: products});
  }

  // Looks up (and caches, in the ImageUrl/VideoId columns) the picture and any YouTube
  // video on a product's supplier page, for the Catalog's item detail view. A plain
  // client-side fetch of another site's page almost never has CORS allowed, so this has
  // to happen here, server-side, once per product — after that, the Products GET above
  // just returns the cached values for free.
  if (e.parameter.type === 'productImage') {
    const id = String(e.parameter.id || '').trim();
    if (!id) return jsonOut({imageUrl: '', videoId: '', error: 'Missing product id'});
    const sheetExists = !!ss.getSheetByName('Products');
    if (!sheetExists) return jsonOut({imageUrl: '', videoId: '', error: 'No products yet'});
    const sheet = getOrCreateProductsSheet(ss);   // backfills the ImageUrl/VideoId columns on an older sheet
    const map = headerMap(sheet);
    const rows = sheet.getDataRange().getValues();
    for (let i = 1; i < rows.length; i++) {
      if (String(rows[i][map['Id']]) !== id) continue;
      const cachedImage = String(rows[i][map['ImageUrl']] || '');
      const cachedVideo = String(rows[i][map['VideoId']] || '');
      if (cachedImage && cachedVideo) {
        return jsonOut({imageUrl: cachedImage === 'NONE' ? '' : cachedImage, videoId: cachedVideo === 'NONE' ? '' : cachedVideo});
      }
      const pageUrl = String(rows[i][map['Url']] || '');
      if (!pageUrl) {
        sheet.getRange(i + 1, map['ImageUrl'] + 1).setValue('NONE');
        sheet.getRange(i + 1, map['VideoId'] + 1).setValue('NONE');
        return jsonOut({imageUrl: '', videoId: '', error: 'This product has no supplier link saved'});
      }
      const productName = String(rows[i][map['Name']] || '');
      const found = fetchAndSaveProductMedia(pageUrl, productName);
      sheet.getRange(i + 1, map['ImageUrl'] + 1).setValue(found.imageUrl || 'NONE');
      sheet.getRange(i + 1, map['VideoId'] + 1).setValue(found.videoId || 'NONE');
      return jsonOut({
        imageUrl: found.imageUrl || '', videoId: found.videoId || '',
        error: (found.imageUrl || found.videoId) ? '' : 'No picture or video found on that page'
      });
    }
    return jsonOut({imageUrl: '', error: 'Product not found'});
  }

  if (e.parameter.type === 'findDuplicateProducts') {
    const sheet = ss.getSheetByName('Products');
    if (!sheet) {
      return ContentService.createTextOutput(JSON.stringify([]))
        .setMimeType(ContentService.MimeType.JSON);
    }
    const map = headerMap(sheet);
    const rows = sheet.getDataRange().getValues();
    const groups = {};
    rows.slice(1).forEach(row => {
      const name = row[map['Name']];
      const id = String(row[map['Id']] || '').trim();
      if (!name || !id) return;
      // Keyed by name + brand + category: the same-named item from a different brand, or
      // deliberately filed under a different category, isn't an accidental duplicate —
      // only re-importing (or re-entering) the same item is.
      const key = String(name).trim().toLowerCase() + '|' +
        String(row[map['Brand']] || '').trim().toLowerCase() + '|' +
        String(row[map['Category']] || '').trim().toLowerCase();
      if (!groups[key]) groups[key] = [];
      groups[key].push({
        id: id,
        class: String(row[map['Class']] || ''),
        category: String(row[map['Category']] || ''),
        name: String(name).trim(),
        brand: String(row[map['Brand']] || ''),
        color: String(row[map['Color']] || ''),
        effect: String(row[map['Effect']] || ''),
        duration: String(row[map['Duration']] || ''),
        price: String(row[map['Price']] || ''),
        description: String(row[map['Description']] || ''),
        url: String(row[map['Url']] || ''),
        imageUrl: String(row[map['ImageUrl']] || ''),
        videoId: String(row[map['VideoId']] || ''),
        kurtisApproved: String(row[map['KurtisApproved']] || '') === 'Yes'
      });
    });
    const duplicates = Object.values(groups)
      .filter(g => g.length > 1)
      .map(g => ({ items: g }));
    return ContentService.createTextOutput(JSON.stringify(duplicates))
      .setMimeType(ContentService.MimeType.JSON);
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
          notes: String(r[map['Notes']] || ''),
          updatedAt: updated instanceof Date ? updated.toISOString() : String(updated || '')
        });
      });
    }
    plans.sort((a, b) => a.name.localeCompare(b.name));
    return jsonOut({plans: plans});
  }

  if (e.parameter.type === 'proxPlan') {
    // One venue/event's Holotron planning sheet, by the Venues row's own Id — both the editor
    // (prox-plan.html) and the read-only cheat sheet (prox-cheat-sheet.html) use this. An empty
    // shape (not an error) for a venue that has no plan saved yet, so the editor just starts blank.
    const venueId = String(e.parameter.venueId || '').trim();
    if (!venueId) return jsonOut({found: false, effects: [], notes: ''});
    const sheet = getOrCreateProxPlansSheet(ss);
    const map = headerMap(sheet);
    const row = findProxPlanRow(sheet, map, venueId);
    if (row < 0) return jsonOut({found: false, effects: [], notes: ''});
    const values = sheet.getRange(row, 1, 1, sheet.getLastColumn()).getValues()[0];
    let effects = [];
    try { effects = JSON.parse(values[map['EffectsJson']] || '[]'); } catch (err) { effects = []; }
    const updated = values[map['UpdatedAt']];
    return jsonOut({
      found: true,
      venueId: venueId,
      venueName: String(values[map['VenueName']] || ''),
      venueDate: normalizeDateValue(values[map['VenueDate']]),
      effects: cleanProxPlanEffects(effects),
      notes: String(values[map['Notes']] || ''),
      updatedAt: updated instanceof Date ? updated.toISOString() : String(updated || '')
    });
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
    const row = findPickListRow(sheet, map, e.parameter.name, e.parameter.id);
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

  // One person's full contact record, looked up by name, for Sign In Crew. Kept separate from
  // pyroDirectory (which lists everyone but deliberately leaves out address/age/license-by-type)
  // so that a bulk fetch never hands out every crew member's home address at once — this only
  // ever returns one person's record, and only once a Head Pyro has actually picked that name.
  if (e.parameter.type === 'hpContactLookup') {
    const merged = getMergedContacts(ss);
    const nameKey = String(e.parameter.name || '').trim().toLowerCase();
    const match = merged[nameKey];
    if (!match) return jsonOut({found: false});
    return jsonOut({
      found: true, name: match.name,
      displayLicense: match.displayLicense || '', specialEffectsLicense: match.specialEffectsLicense || '', flameLicense: match.flameLicense || '',
      address: match.address || '', age: match.age || '', phone: match.phone || ''
    });
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
        signInEnabled: row[idx['SignInEnabled']] === 'Yes',
        assignedHp: row[idx['AssignedHp']] || '',
        callTime: normalizeTimeValue(row[idx['CallTime']]),
        signupLimit: Number(row[idx['SignupLimit']]) || 0,
        nfpaTypes: cleanNfpaTypes(row[idx['NfpaTypes']])
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

  const sheet = findCheckInSheet(ss);
  const rows = sheet.getDataRange().getValues();
  const eventFilter = e.parameter.event;
  const results = rows.slice(1)
    .map((row, i) => ({
      rowIndex: i + 2, // actual 1-based sheet row, so a client can ask to delete this exact entry
      timestamp: row[0], event: row[1], eventDate: normalizeDateValue(row[2]), name: row[3],
      license: row[4], address: row[5], age: row[6], phone: row[7] || '', checkInTime: row[8] || '', isHeadPyro: row[9] === 'Yes',
      signedInByHp: row[10] === 'Yes'
    }))
    .filter(r => !eventFilter || String(r.event).toLowerCase() === eventFilter.toLowerCase());
  return ContentService.createTextOutput(JSON.stringify(results))
    .setMimeType(ContentService.MimeType.JSON);
}
