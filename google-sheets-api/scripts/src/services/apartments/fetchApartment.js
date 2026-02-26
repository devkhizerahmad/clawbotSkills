'use strict';

const { getDriveClient, DRIVE_READ_SCOPE } = require('../../auth');
const { APARTMENT_CATALOG_FOLDER_ID } = require('../../config');

/**
 * Fetch folders with pagination support
 */
async function fetchFolders(drive, parentId, query = '', maxResults = 100) {
  const folders = [];
  let pageToken = null;

  let q = `'${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  if (query) {
    q += ` and name contains '${query}'`;
  }

  try {
    do {
      const response = await drive.files.list({
        q,
        spaces: 'drive',
        fields: 'nextPageToken, files(id, name, webViewLink, description)',
        pageSize: maxResults,
        pageToken,
      });

      if (response.data.files) {
        folders.push(...response.data.files);
      }
      pageToken = response.data.nextPageToken;
    } while (pageToken);
  } catch (error) {
    console.error('Error fetching folders:', error.message);
    throw error;
  }

  return folders;
}

/**
 * Fetch a specific apartment by name and its room type subfolders
 */
async function fetchApartmentByName(apartmentName) {
  const drive = getDriveClient([DRIVE_READ_SCOPE]);

  // Find the apartment folder
  const apartments = await fetchFolders(
    drive,
    APARTMENT_CATALOG_FOLDER_ID,
    apartmentName,
  );

  if (apartments.length === 0) {
    return null;
  }

  // Use the first match
  const apartment = apartments[0];

  // Fetch room types (subfolders)
  const roomTypes = await fetchFolders(drive, apartment.id);

  return {
    id: apartment.id,
    name: apartment.name,
    driveLink: apartment.webViewLink,
    description: apartment.description,
    roomTypes: roomTypes.map((room) => ({
      id: room.id,
      name: room.name,
      driveLink: room.webViewLink,
    })),
  };
}

/**
 * Fetch all apartments and their room type subfolders
 */
async function fetchAllApartments(options = {}) {
  const { silent = false } = options;
  const drive = getDriveClient([DRIVE_READ_SCOPE]);

  if (!silent) {
    console.log('Fetching apartments from Google Drive...');
  }

  const apartments = await fetchFolders(drive, APARTMENT_CATALOG_FOLDER_ID);

  const apartmentsWithRooms = [];
  for (const apartment of apartments) {
    const roomTypes = await fetchFolders(drive, apartment.id);
    apartmentsWithRooms.push({
      id: apartment.id,
      name: apartment.name,
      driveLink: apartment.webViewLink,
      description: apartment.description,
      roomTypes: roomTypes.map((room) => ({
        id: room.id,
        name: room.name,
        driveLink: room.webViewLink,
      })),
    });
  }

  return apartmentsWithRooms;
}

module.exports = {
  fetchApartmentByName,
  fetchAllApartments,
};
