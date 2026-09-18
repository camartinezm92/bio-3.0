import express from 'express';
import { createServer as createViteServer } from 'vite';
import { google } from 'googleapis';
import nodemailer from 'nodemailer';
import path from 'path';
import fs from 'fs';
import { Readable } from 'stream';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Body parser for JSON
  app.use(express.json({ limit: '100mb' }));
  app.use(express.urlencoded({ limit: '100mb', extended: true }));

  // Google Authentication Helper
  const getGoogleAuth = (scopes: string[], useSubject: boolean = false) => {
    const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const adminEmail = process.env.GOOGLE_ADMIN_EMAIL;
    
    // Robust private key parsing
    let privateKey = process.env.GOOGLE_PRIVATE_KEY;
    if (privateKey) {
      privateKey = privateKey.trim();
      if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
        privateKey = privateKey.substring(1, privateKey.length - 1);
      }
      if (privateKey.startsWith("'") && privateKey.endsWith("'")) {
        privateKey = privateKey.substring(1, privateKey.length - 1);
      }
      privateKey = privateKey.replace(/\\n/g, '\n');
    }

    if (!email || !privateKey) {
      throw new Error('Google credentials missing from environment variables');
    }

    return new google.auth.JWT({
      email,
      key: privateKey,
      scopes,
      subject: (useSubject && adminEmail) ? adminEmail : undefined,
    });
  };

  const getSheetsClient = () => {
    const auth = getGoogleAuth([
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive'
    ], false);
    return google.sheets({ 
      version: 'v4', 
      auth,
      retryConfig: {
        retry: 3,
        retryDelay: 1000,
        statusCodesToRetry: [[100, 199], [429, 429], [500, 599]],
        onRetryAttempt: (err) => {
          console.warn(`[Sheets] Retry attempt due to: ${err.message}`);
        }
      }
    });
  };

  const getDriveClient = () => {
    // Drive usually doesn't need impersonation if the folder is shared with the SA email
    const auth = getGoogleAuth([
      'https://www.googleapis.com/auth/drive.file', 
      'https://www.googleapis.com/auth/drive'
    ], false); 
    return google.drive({ 
      version: 'v3', 
      auth,
      retryConfig: {
        retry: 3,
        retryDelay: 1000,
        statusCodesToRetry: [[100, 199], [429, 429], [500, 599]],
        onRetryAttempt: (err) => {
          console.warn(`[Drive] Retry attempt due to: ${err.message}`);
        }
      }
    });
  };

  const getGmailTransporter = () => {
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (!user || !pass) {
      throw new Error('SMTP credentials missing (SMTP_USER/SMTP_PASS)');
    }

    return nodemailer.createTransport({
      service: 'gmail',
      auth: { user, pass }
    });
  };

  // API Routes
  app.get('/api/whatsapp/health', async (req, res) => {
    const token = process.env.WHATSAPP_TOKEN;
    const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;

    if (!token || !phoneId) {
      return res.json({ 
        status: 'pending', 
        message: 'WhatsApp no configurado. Faltan tokens.' 
      });
    }

    res.json({ 
      status: 'ok', 
      message: 'Tokens de WhatsApp detectados',
      phoneId: phoneId
    });
  });

  // RUTAS DE ADMINISTRACIÓN Y LIMPIEZA
  app.post('/api/admin/purge-data', async (req, res) => {
    const { confirm } = req.body;
    if (confirm !== 'ELIMINAR_TODO_PRODUCCION') {
      return res.status(400).json({ error: 'Confirmación inválida' });
    }
    // En este entorno, el usuario deberá limpiar Firestore manualmente para asegurar la integridad
    res.json({ status: 'ok', message: 'Sistema preparado. Por favor limpie su Firestore manualmente para iniciar de cero.' });
  });

  // Helpers para Google Drive
  async function getOrCreateFolder(drive: any, folderName: string, parentId?: string): Promise<string> {
    const query = parentId 
      ? `name='${folderName}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`
      : `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
    
    try {
      const response = await drive.files.list({
        q: query,
        fields: 'files(id, name)',
        spaces: 'drive',
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
      });

      if (response.data.files && response.data.files.length > 0) {
        return response.data.files[0].id;
      }
    } catch (e: any) {
      if (e.message && e.message.includes('File not found')) {
        console.warn(`Parent folder ${parentId} may have been deleted, creating folder without parent or throwing...`);
        // If parent not found, we cannot search inside it.
        // We will just let it create without parent? No, we shouldn't. We should throw a specific error, but handled above.
        throw new Error(`Carpeta Padre extraviada en Google Drive: ${e.message}`);
      }
      throw e;
    }

    const folderMetadata: any = {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
    };
    if (parentId) {
      folderMetadata.parents = [parentId];
    }

    const folderResponse = await drive.files.create({
      requestBody: folderMetadata,
      fields: 'id',
      supportsAllDrives: true,
    });
    return folderResponse.data.id;
  }

  // RUTA PARA CREAR EQUIPO CON DRIVE Y SHEETS
  app.post('/api/equipment/register', async (req, res) => {
    const { equipment, isEdit, photo, sheetsId } = req.body;
    const drive = getDriveClient();
    const sheets = getSheetsClient();
    const rootFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID?.trim();

    try {
      if (!rootFolderId) {
        throw new Error("GOOGLE_DRIVE_FOLDER_ID no configurado en el backend. Necesitamos el ID de la carpeta principal.");
      }

      // 1. Obtener o Crear la carpeta maestra "Equipos" en la raíz
      const mainEquiposId = await getOrCreateFolder(drive, 'Equipos', rootFolderId);

      // Usar la carpeta del equipo actual si está en modo edición y existe, o crearla
      let eqFolderId = equipment.driveFolderId;
      const folderName = `${equipment.name?.toUpperCase() || 'EQUIPO'} - ${equipment.serial}`;
      
      // Validar si la carpeta aún existe en el Drive o si fue borrada manualmente
      if (eqFolderId) {
        try {
          await drive.files.get({ fileId: eqFolderId, fields: 'id, trashed' });
        } catch (e: any) {
          if (e.message && e.message.includes('File not found')) {
            console.log(`La carpeta ${eqFolderId} fue borrada manualmente. Recreando...`);
            eqFolderId = null;
          } else {
            console.warn(`Error extra resolviendo carpeta: ${e.message}`);
            eqFolderId = null;
          }
        }
      }

      // Si no hay carpeta, o forzamos recreación, creamos la estructura
      // Note: isEdit could be false, but they passed a driveFolderId if it was duplicated, etc.
      if (!eqFolderId) {
        eqFolderId = await getOrCreateFolder(drive, folderName, mainEquiposId);
      }

      // 3. Subir Foto del Equipo a su carpeta si existe
      let photoId = equipment.photoId || ''; // Preserve existing if no new photo
      if (photo) {
        // Asumiendo formato base64 como "data:image/jpeg;base64,/9j/4AAQSkZJRg..."
        const base64Data = photo.split(',')[1] || photo;
        const photoName = `FOTO_${equipment.serial}.jpg`;
        
        // Verificar si la foto ya existe para evitar duplicados
        const existingPhotoQuery = await drive.files.list({
          q: `'${eqFolderId}' in parents and name = '${photoName}' and trashed = false`,
          fields: 'files(id)'
        });

        if (existingPhotoQuery.data.files && existingPhotoQuery.data.files.length > 0) {
          // Actualizar archivo existente
          const existingId = existingPhotoQuery.data.files[0].id!;
          await drive.files.update({
            fileId: existingId,
            media: {
              mimeType: 'image/jpeg',
              body: Readable.from(Buffer.from(base64Data, 'base64'))
            }
          });
          photoId = existingId;
        } else {
          // Crear archivo nuevo
          const photoUpload = await drive.files.create({
            requestBody: {
              name: photoName,
              parents: [eqFolderId],
            },
            media: {
              mimeType: 'image/jpeg',
              body: Readable.from(Buffer.from(base64Data, 'base64')),
            },
            fields: 'id',
            supportsAllDrives: true,
          });
          photoId = photoUpload.data.id || '';
        }
      }

      // 4. Crear estructura interna (Documentos y Reportes)
      const documentosId = await getOrCreateFolder(drive, 'Documentos', eqFolderId);
      const reportesId = await getOrCreateFolder(drive, 'Reportes', eqFolderId);
      
      // 5. Crear subcarpetas de Reportes
      await getOrCreateFolder(drive, 'Mantenimientos', reportesId);
      await getOrCreateFolder(drive, 'Calibraciones', reportesId);

      // 6. Subir Manual y Protocolo a la carpeta Documentos si existen
      const manual = req.body.manual;
      const protocol = req.body.protocol;
      const cvPdf = req.body.cvPdf;
      let manualId = '';
      let protocolId = '';

      if (manual && manual.base64) {
        const base64Data = manual.base64.split(',')[1] || manual.base64;
        const upload = await drive.files.create({
          requestBody: { name: manual.name, parents: [documentosId] },
          media: { mimeType: manual.mimeType, body: Readable.from(Buffer.from(base64Data, 'base64')) },
          fields: 'id',
          supportsAllDrives: true,
        });
        manualId = upload.data.id || '';
      }

      if (protocol && protocol.base64) {
        const base64Data = protocol.base64.split(',')[1] || protocol.base64;
        const upload = await drive.files.create({
          requestBody: { name: protocol.name, parents: [documentosId] },
          media: { mimeType: protocol.mimeType, body: Readable.from(Buffer.from(base64Data, 'base64')) },
          fields: 'id',
          supportsAllDrives: true,
        });
        protocolId = upload.data.id || '';
      }
      
      // 6.1 Subir Anexos Varios
      const annexFiles = req.body.annexFiles || [];
      const uploadedAnnexes = [];
      for (const annex of annexFiles) {
        if (annex && annex.base64) {
          const base64Data = annex.base64.split(',')[1] || annex.base64;
          const upload = await drive.files.create({
            requestBody: { name: annex.name, parents: [documentosId] },
            media: { mimeType: annex.mimeType || 'application/pdf', body: Readable.from(Buffer.from(base64Data, 'base64')) },
            fields: 'id',
            supportsAllDrives: true,
          });
          if (upload.data.id) {
            uploadedAnnexes.push({
              name: annex.name,
              id: upload.data.id,
              url: `https://drive.google.com/file/d/${upload.data.id}/view`
            });
          }
        }
      }
      
      // 6.2 Subir Hoja de Vida generada (PDF)
      if (cvPdf && cvPdf.base64) {
        // Find existing CV PDF
        const cvName = cvPdf.name;
        const base64Data = cvPdf.base64.split(',')[1] || cvPdf.base64;
        const existingCvQuery = await drive.files.list({
          q: `'${eqFolderId}' in parents and name = '${cvName}' and trashed = false`,
          fields: 'files(id)'
        });
        
        if (existingCvQuery.data.files && existingCvQuery.data.files.length > 0) {
          // Update
          await drive.files.update({
            fileId: existingCvQuery.data.files[0].id!,
            media: {
              mimeType: 'application/pdf',
              body: Readable.from(Buffer.from(base64Data, 'base64'))
            }
          });
        } else {
          // Create
          await drive.files.create({
            requestBody: { name: cvName, parents: [eqFolderId] },
            media: { mimeType: 'application/pdf', body: Readable.from(Buffer.from(base64Data, 'base64')) },
            fields: 'id',
            supportsAllDrives: true,
          });
        }
      }

      // 6.5 Crear o Actualizar el archivo de respaldo (Backup) JSON en la carpeta principal del equipo
      // Esto actúa como base de datos de contingencia en Drive.
      try {
        const backupContent = JSON.stringify(equipment, null, 2);
        
        const existingBackup = await drive.files.list({
          q: `'${eqFolderId}' in parents and name = 'datos_equipo.json' and trashed = false`,
          fields: 'files(id)'
        });

        if (existingBackup.data.files && existingBackup.data.files.length > 0) {
          await drive.files.update({
            fileId: existingBackup.data.files[0].id!,
            media: {
              mimeType: 'application/json',
              body: Readable.from(Buffer.from(backupContent))
            }
          });
        } else {
          await drive.files.create({
            requestBody: {
              name: 'datos_equipo.json',
              parents: [eqFolderId]
            },
            media: {
              mimeType: 'application/json',
              body: Readable.from(Buffer.from(backupContent))
            }
          });
        }
      } catch (backupError: any) {
         console.warn("No se pudo regenerar el json temporal, pero el equipo sigue:", backupError.message);
      }

      // 4. Sincronizar con Google Sheets (Excel)
      const finalSheetsId = sheetsId || '1fkJzMgWXokEhB9-QJMPD9jm4W1ghCI5GrnvCp3tiP6E';
      if (finalSheetsId) {
        try {
          const rowData = [
            equipment.name,
            equipment.brand,
            equipment.model,
            equipment.serial,
            equipment.serviceName,
            equipment.location,
            equipment.registrationInvima,
            equipment.nextMaintenance || 'N/A',
            equipment.nextCalibration || 'N/A',
            equipment.calibrationFrequency || 'N/A',
            equipment.maintenanceFrequency || 'N/A'
          ];

          let rowUpdated = false;

          if (isEdit && equipment.originalSerial) {
             // Buscar la fila por serial original
             const searchRes: any = await sheets.spreadsheets.values.get({
               spreadsheetId: finalSheetsId,
               range: 'Inventario!A:D' // A: Name, B: Brand, C: Model, D: Serial
             });
             
             const values = searchRes.data.values || [];
             let targetIndex = -1;
             
             // Buscar desde abajo hacia arriba o normal (normalmente es 1 match)
             for (let i = 0; i < values.length; i++) {
               if (values[i][3] && String(values[i][3]).trim() === String(equipment.originalSerial).trim()) {
                 targetIndex = i + 1; // Las filas de excel son 1-indexed
                 break;
               }
             }

             if (targetIndex !== -1) {
               await sheets.spreadsheets.values.update({
                 spreadsheetId: finalSheetsId,
                 range: `Inventario!A${targetIndex}:K${targetIndex}`,
                 valueInputOption: 'USER_ENTERED',
                 requestBody: { values: [rowData] }
               });
               rowUpdated = true;
             }
          }

          if (!rowUpdated) {
            // Append if it's new or the existing row was not found
            await sheets.spreadsheets.values.append({
              spreadsheetId: finalSheetsId,
              range: 'Inventario!A1',
              valueInputOption: 'USER_ENTERED',
              requestBody: { values: [rowData] },
            });
          }

          // Registro en Logs
          await sheets.spreadsheets.values.append({
            spreadsheetId: finalSheetsId,
            range: 'Logs!A1',
            valueInputOption: 'USER_ENTERED',
            requestBody: {
              values: [[
                new Date().toLocaleString(),
                'SISTEMA',
                isEdit ? 'ACTUALIZA_EQUIPO' : 'REGISTRO_EQUIPO',
                isEdit 
                  ? `Se actualizó el equipo ${equipment.name} (Serial: ${equipment.originalSerial || equipment.serial} -> ${equipment.serial})` 
                  : `Se creó equipo ${equipment.name} con Serial ${equipment.serial} en carpeta ${folderName}`
              ]]
            },
          });
        } catch (sErr) {
          console.error('Error with Sheets (check if tabs "Inventario" and "Logs" exist):', sErr);
        }
      }

      res.json({ 
        status: 'ok', 
        driveFolderId: eqFolderId,
        photoId: photoId,
        manualId: manualId,
        protocolId: protocolId,
        uploadedAnnexes: uploadedAnnexes
      });
    } catch (error: any) {
      console.error('Registration Error:', error.message || error);
      res.status(500).json({ error: error.message || 'Registration Error' });
    }
  });

  // RUTA PARA ACTUALIZAR EXCEL / SHEETS (TRASLADOS Y EDICIONES MENORES)
  app.post('/api/equipment/sync-sheets', async (req, res) => {
    const { equipment, sheetsId, actionReason } = req.body;
    const sheets = getSheetsClient();
    
    try {
      const finalSheetsId = sheetsId || '1fkJzMgWXokEhB9-QJMPD9jm4W1ghCI5GrnvCp3tiP6E';
      const rowData = [
        equipment.name || '',
        equipment.brand || '',
        equipment.model || '',
        equipment.serial || '',
        equipment.serviceName || '',
        equipment.location || '',
        equipment.registrationInvima || '',
        equipment.nextMaintenance || 'N/A',
        equipment.nextCalibration || 'N/A',
        equipment.calibrationFrequency || 'N/A',
        equipment.maintenanceFrequency || 'N/A'
      ];

      // Buscar la fila por serial
      const searchRes: any = await sheets.spreadsheets.values.get({
        spreadsheetId: finalSheetsId,
        range: 'Inventario!A:D'
      });
      
      const values = searchRes.data.values || [];
      const searchSerial = equipment.originalSerial || equipment.serial;
      let targetIndex = -1;
      
      for (let i = 0; i < values.length; i++) {
        if (values[i][3] && String(values[i][3]).trim() === String(searchSerial).trim()) {
          targetIndex = i + 1;
          break;
        }
      }

      if (targetIndex !== -1) {
        await sheets.spreadsheets.values.update({
          spreadsheetId: finalSheetsId,
          range: `Inventario!A${targetIndex}:K${targetIndex}`,
          valueInputOption: 'USER_ENTERED',
          requestBody: { values: [rowData] }
        });
      }

      // Registro en Logs
      await sheets.spreadsheets.values.append({
        spreadsheetId: finalSheetsId,
        range: 'Logs!A1',
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [[
            new Date().toLocaleString(),
            'SISTEMA',
            'ACTUALIZA_UBICACION',
            actionReason || `Se actualizó ubicación de equipo ${equipment.name} (Serial: ${equipment.serial}) a ${equipment.serviceName}`
          ]]
        },
      });

      res.json({ status: 'ok' });
    } catch (error: any) {
      console.error('Sync Sheets Error:', error.message || error);
      res.status(500).json({ error: error.message || 'Sync Sheets Error' });
    }
  });

  // RUTA PARA OBTENER O CREAR SUBCARPETAS (Helpers)
  // ... ya definimos getOrCreateFolder arriba
  
  // RUTA PARA DESCARGAR UN ARCHIVO DESDE GOOGLE DRIVE COMO BASE64
  app.get('/api/drive/file/:id/base64', async (req, res) => {
    const drive = getDriveClient();
    const fileId = req.params.id;
    
    try {
      // 1. Intentar vía API oficial (requiere que el Service Account tenga permiso)
      try {
        console.log(`[DriveProxy] Attempting API fetch for ${fileId}`);
        const response = await drive.files.get(
          { fileId: fileId, alt: 'media' },
          { responseType: 'arraybuffer' }
        );
        
        let mimeType = 'image/jpeg';
        try {
          const metadata = await drive.files.get({ fileId, fields: 'mimeType' });
          mimeType = metadata.data.mimeType || 'image/jpeg';
        } catch (e) { /* ignore metadata failure */ }

        const base64 = Buffer.from(response.data as any).toString('base64');
        console.log(`[DriveProxy] Success via API for ${fileId}`);
        return res.json({ base64: `data:${mimeType};base64,${base64}` });
      } catch (driveApiError: any) {
        // 2. Fallback A: CDN Público (lh3)
        console.log(`[DriveProxy] API failed for ${fileId}, trying CDN fallback...`);
        const publicUrls = [
          `https://lh3.googleusercontent.com/d/${fileId}`,
          `https://drive.google.com/uc?id=${fileId}&export=download`
        ];

        for (const url of publicUrls) {
          try {
            const fetchRes = await fetch(url);
            if (fetchRes.ok) {
              const arrayBuffer = await fetchRes.arrayBuffer();
              const buffer = Buffer.from(arrayBuffer);
              const mimeType = fetchRes.headers.get('content-type') || 'image/jpeg';
              const base64 = buffer.toString('base64');
              console.log(`[DriveProxy] Success via CDN (${url}) for ${fileId}`);
              return res.json({ base64: `data:${mimeType};base64,${base64}` });
            }
          } catch (e) {
            console.error(`[DriveProxy] Fallback failed for ${url}:`, e);
          }
        }
        
        throw driveApiError;
      }
    } catch (error: any) {
      console.error('[DriveProxy] All methods failed:', error.message || error);
      res.status(500).json({ error: 'No se pudo obtener la imagen del equipo. Verifique permisos en Drive.' });
    }
  });

  // RUTA PARA SUBIR REPORTES, TRASLADOS O ACTAS AL DRIVE
  app.post('/api/drive/upload-document', async (req, res) => {
    const { equipmentDirId, equipmentSerial, equipmentName, folderType, fileName, base64, mimeType } = req.body;
    const drive = getDriveClient();
    const rootFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID?.trim();
    
    try {
      if (!rootFolderId) throw new Error("Falta GOOGLE_DRIVE_FOLDER_ID");

      // 1. Determinar el Parent ID donde irá el archivo
      let parentId = rootFolderId; // Por defecto a la raíz si no es de equipo

      // Logica de Recuperación: Si un equipo es viejo y no tiene dirId, pero conocemos nombre y serial:
      let activeEqDirId = equipmentDirId;
      
      // Asegurarnos que la carpeta existe aún (no ha sido borrada)
      if (activeEqDirId) {
        try {
          await drive.files.get({ fileId: activeEqDirId, fields: 'id, trashed' });
        } catch (e: any) {
           console.log(`Directorio original ${activeEqDirId} extraviado. Regenerando ruta...`);
           activeEqDirId = null; 
        }
      }

      if (!activeEqDirId && equipmentSerial && equipmentName) {
         try {
           const mainEquiposId = await getOrCreateFolder(drive, 'Equipos', rootFolderId);
           const folderName = `${equipmentName.toUpperCase()} - ${equipmentSerial}`;
           // Intenta encontrarlo o crearlo si no existe para mantener integridad
           activeEqDirId = await getOrCreateFolder(drive, folderName, mainEquiposId);
         } catch(e) {
           console.log("No se pudo regenerar dir id:", e);
         }
      }

      if (activeEqDirId) {
        // Es un documento para un equipo específico
        if (folderType === 'maintenance' || folderType === 'preventive' || folderType === 'corrective') {
          const repId = await getOrCreateFolder(drive, 'Reportes', activeEqDirId);
          parentId = await getOrCreateFolder(drive, 'Mantenimientos', repId);
        } else if (folderType === 'calibration') {
          const repId = await getOrCreateFolder(drive, 'Reportes', activeEqDirId);
          parentId = await getOrCreateFolder(drive, 'Calibraciones', repId);
        } else if (folderType === 'transfer') {
          const repId = await getOrCreateFolder(drive, 'Reportes', activeEqDirId);
          parentId = await getOrCreateFolder(drive, 'Traslados', repId); // También se puede tener una subcarpeta de Traslados dentro del equipo
        } else {
          parentId = await getOrCreateFolder(drive, 'Documentos', activeEqDirId);
        }
      } else {
        // Archivos globales: Traslados Generales o Listas de Chequeo
        if (folderType === 'transfer') {
          parentId = await getOrCreateFolder(drive, 'Traslados', rootFolderId);
        } else if (folderType === 'compliance') {
          parentId = await getOrCreateFolder(drive, 'Listas de Chequeo', rootFolderId);
        }
      }

      // 2. Subir el archivo
      const base64Data = base64.split(',')[1] || base64;
      const upload = await drive.files.create({
        requestBody: {
          name: fileName,
          parents: [parentId],
        },
        media: {
          mimeType: mimeType || 'application/pdf',
          body: Readable.from(Buffer.from(base64Data, 'base64')),
        },
        fields: 'id, webViewLink',
        supportsAllDrives: true,
      });

      res.json({
        status: 'ok',
        fileId: upload.data.id,
        webViewLink: upload.data.webViewLink
      });

    } catch (error: any) {
      console.error('Error uploading document to Drive:', error.message || error);
      res.status(500).json({ error: error.message || 'Error uploading document' });
    }
  });

  app.post('/api/whatsapp/test', async (req, res) => {
    const token = process.env.WHATSAPP_TOKEN;
    const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const adminPhone = process.env.WHATSAPP_ADMIN_PHONE;

    if (!token || !phoneId || !adminPhone) {
      return res.status(400).json({ error: 'Configuración de WhatsApp incompleta' });
    }

    try {
      const cleanPhone = adminPhone.replace(/\D/g, '');
      const { templateName = "hello_world", components = [] } = req.body;

      const response = await fetch(`https://graph.facebook.com/v20.0/${phoneId}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: cleanPhone,
          type: "template",
          template: {
            name: templateName,
            language: { code: templateName === "utility" ? "es_CO" : "en_US" },
            components: components.length > 0 ? components : undefined
          }
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message || 'Error API WhatsApp');

      res.json({ status: 'ok', message: `Mensaje (${templateName}) enviado`, data });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Escáner de Vencimientos Manual (para pruebas)
  app.post('/api/whatsapp/scan-alerts', async (req, res) => {
    const { equipment } = req.body; // Se espera un array de equipos desde el cliente
    const token = process.env.WHATSAPP_TOKEN;
    const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const adminPhone = process.env.WHATSAPP_ADMIN_PHONE;

    if (!equipment || !Array.isArray(equipment)) {
      return res.status(400).json({ error: 'No se enviaron datos de equipos para escanear' });
    }

    try {
      const cleanPhone = adminPhone?.replace(/\D/g, '');
      const results = [];

      for (const item of equipment) {
        // Ejemplo de lógica: si vence en menos de 15 días
        const nextDate = item.nextMaintenance ? new Date(item.nextMaintenance) : null;
        if (!nextDate) continue;

        const diffTime = nextDate.getTime() - new Date().getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays <= 15 && diffDays >= 0) {
          // Enviar alerta por WhatsApp usando la plantilla 'utility'
          const response = await fetch(`https://graph.facebook.com/v20.0/${phoneId}/messages`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              messaging_product: "whatsapp",
              to: cleanPhone,
              type: "template",
              template: {
                name: "utility",
                language: { code: "es_CO" },
                components: [{
                  type: "body",
                  parameters: [
                    { type: "text", text: item.name },
                    { type: "text", text: item.serial || 'N/A' },
                    { type: "text", text: "MANTENIMIENTO PREVENTIVO" },
                    { type: "text", text: new Date(item.nextMaintenance).toLocaleDateString() }
                  ]
                }]
              }
            }),
          });
          const data = await response.json();
          results.push({ name: item.name, status: response.ok ? 'sent' : 'failed', detail: data });
        }
      }

      res.json({ status: 'ok', processed: equipment.length, alertsSent: results.length, results });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/drive/health', async (req, res) => {
    try {
      const drive = getDriveClient();
      let folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
      
      if (!folderId) {
        return res.status(400).json({ error: 'GOOGLE_DRIVE_FOLDER_ID missing' });
      }

      folderId = folderId.trim();

      // Check if folder is accessible
      const response: any = await drive.files.get({
        fileId: folderId,
        fields: 'id, name',
        supportsAllDrives: true
      });

      res.json({ 
        status: 'ok', 
        message: 'Google Drive connected', 
        folder: response.data.name 
      });
    } catch (error: any) {
      console.error('Drive Error:', error.message || error);
      let errorMsg = error.message;
      if (errorMsg && errorMsg.includes('storage quota')) {
        errorMsg = 'Error de Quota: La Cuenta de Servicio no tiene espacio. Solución: Crea una "Unidad Compartida" (Shared Drive), mueve la carpeta allí y añade a la Cuenta de Servicio como miembro.';
      }
      res.status(500).json({ 
        status: 'error',
        error: 'Failed to connect to Google Drive', 
        details: errorMsg 
      });
    }
  });

  app.post('/api/drive/upload', async (req, res) => {
    const { name, content, mimeType } = req.body;
    let folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    
    if (folderId) folderId = folderId.trim();

    console.log(`[Drive] Intento de subida. Folder: ${folderId}, File: ${name}`);

    try {
      const drive = getDriveClient();

      const fileMetadata = {
        name: name || 'Untitled Report',
        parents: folderId ? [folderId] : [],
      };

      const media = {
        mimeType: mimeType || 'text/plain',
        body: Readable.from([typeof content === 'string' ? content : JSON.stringify(content)]),
      };

      const response = await drive.files.create({
        requestBody: fileMetadata,
        media: media,
        fields: 'id, name, parents',
        supportsAllDrives: true,
      });

      console.log(`[Drive] ÉXITO. File ID: ${response.data.id}, Parents: ${JSON.stringify(response.data.parents)}`);
      res.json({ id: response.data.id, name: response.data.name });
    } catch (error: any) {
      console.error('[Drive] ERROR:', error.message);
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/gmail/health', async (req, res) => {
    try {
      const transporter = getGmailTransporter();
      await transporter.verify();

      res.json({ 
        status: 'ok', 
        message: 'Gmail SMTP connected', 
        user: process.env.SMTP_USER 
      });
    } catch (error: any) {
      console.error('SMTP Verify Error:', error);
      res.status(500).json({ 
        error: 'Failed to verify Gmail SMTP', 
        details: error.message,
        hint: 'Use a Google "App Password" if you have 2FA enabled.'
      });
    }
  });

  app.post('/api/gmail/test', async (req, res) => {
    try {
      const transporter = getGmailTransporter();
      const adminEmail = process.env.GOOGLE_ADMIN_EMAIL || process.env.SMTP_USER;
      
      if (!adminEmail) {
        return res.status(400).json({ error: 'Destinatario no configurado (GOOGLE_ADMIN_EMAIL o SMTP_USER)' });
      }

      await transporter.sendMail({
        from: `"BioCRM Alertas" <${process.env.SMTP_USER}>`,
        to: adminEmail,
        subject: '🩺 BIOCRM - Prueba de Sistema Alertas',
        html: `
          <div style="font-family: sans-serif; padding: 20px; border: 2px solid #3b82f6; border-radius: 15px;">
            <h2 style="color: #1e40af;">🔧 Prueba de Notificación Exitosa</h2>
            <p>Este es un correo automático generado por el sistema de Gestión Biomédica.</p>
            <ul>
              <li><b>Estado:</b> Operativo (vía SMTP)</li>
              <li><b>Fecha:</b> ${new Date().toLocaleString()}</li>
            </ul>
            <p style="color: #64748b; font-size: 12px;">Recibiste esto porque estás configurado como Administrador Clínico.</p>
          </div>
        `
      });

      res.json({ status: 'ok', message: 'Correo de prueba enviado vía SMTP' });
    } catch (error: any) {
      console.error('Email Send Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Global error handler for body-parser and other Express errors
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Global Error Handler:', err);
    if (err.type === 'entity.too.large') {
      return res.status(413).json({ error: 'Payload Too Large: Los archivos enviados exceden el límite del servidor. Por favor suba archivos más ligeros.' });
    }
    res.status(err.status || 500).json({ 
      error: err.message || 'Internal Server Error',
      status: err.status || 500
    });
  });

  // External services health check
  app.get("/api/health/external", async (req, res) => {
    const results = {
      timestamp: new Date().toISOString(),
      google: { status: 'unknown', details: '' },
      firebase: { status: 'ok' } // Client side handles Firebase mostly, but server can check environment
    };

    try {
      const drive = getDriveClient();
      // Using 'about.get' with minimal fields is the cheapest call possible to verify connection/auth
      await drive.about.get({ fields: 'kind' });
      results.google.status = 'ok';
    } catch (error: any) {
      results.google.status = 'error';
      results.google.details = error.message;
      console.error("[HealthCheck] Google API Error:", error.message);
    }

    res.json(results);
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Production serving
    const distPath = path.join(__dirname, 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
});
