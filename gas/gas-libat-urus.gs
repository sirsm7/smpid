function getRequiredFolderId_() {
  const folderId = PropertiesService.getScriptProperties().getProperty("FOLDER_ID");
  if (!folderId || !String(folderId).trim()) {
    throw new Error("Konfigurasi FOLDER_ID tidak ditemui dalam Script Properties.");
  }
  return String(folderId).trim();
}

function createJsonResponse_(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(
    ContentService.MimeType.JSON
  );
}

function doGet() {
  return createJsonResponse_({
    status: "ok",
    service: "gas-libat-urus"
  });
}

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      throw new Error("Muatan permintaan POST tidak sah atau kosong.");
    }

    const payload = JSON.parse(e.postData.contents);
    if (!payload || !payload.base64Data) {
      throw new Error("Data fail base64Data diperlukan.");
    }

    const cleanBase64 = String(payload.base64Data).replace(/^data:[^;]+;base64,/, "");
    const mimeType = payload.mimeType
      ? String(payload.mimeType).trim()
      : "application/octet-stream";
    const fileName = payload.fileName
      ? String(payload.fileName).trim()
      : "libat_urus_" + new Date().getTime();

    const fileData = Utilities.base64Decode(cleanBase64);
    const blob = Utilities.newBlob(fileData, mimeType, fileName);

    const folderId = getRequiredFolderId_();
    const folder = DriveApp.getFolderById(folderId);
    const file = folder.createFile(blob);

    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    return createJsonResponse_({
      status: "success",
      url: file.getUrl()
    });
  } catch (error) {
    return createJsonResponse_({
      status: "error",
      message: error && error.message ? error.message : String(error)
    });
  }
}

function doOptions() {
  return ContentService.createTextOutput("").setMimeType(ContentService.MimeType.TEXT);
}