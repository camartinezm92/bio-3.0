import { updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import { Equipment, MaintenanceReport } from '@/types';
import { calculateNextMaintenance, projectScheduleMonths } from './schedule-utils';

/**
 * Re-calculates and updates the summary maintenance/calibration fields of an equipment
 * based on its complete report history.
 */
export const syncEquipmentWithHistory = async (equipment: Equipment, reports: MaintenanceReport[]) => {
  if (!equipment.id) return;

  // 1. Find most recent maintenance report (preventive or corrective)
  const maintenanceReports = reports
    .filter(r => r.type === 'preventive' || r.type === 'corrective')
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const latestManto = maintenanceReports[0];

  // 2. Find most recent calibration report
  const calibrationReports = reports
    .filter(r => r.type === 'calibration')
    .sort((a, b) => {
      const dateA = new Date(a.calibrationDate || a.date).getTime();
      const dateB = new Date(b.calibrationDate || b.date).getTime();
      return dateB - dateA;
    });

  const latestCalib = calibrationReports[0];

  // 3. Prepare payload
  const isTerminalStatus = ['baja', 'baja_repuestos', 'reserva'].includes(equipment.status);

  const updatePayload: any = {
    updatedAt: serverTimestamp(),
    // If it's a backup (reserva), it remains in that state.
    // If it's decommissioned, it remains in that state.
    // Otherwise, we default to active if we are performing a new intervention successfully.
    status: isTerminalStatus ? equipment.status : 'active',
    pauseStartDate: isTerminalStatus ? (equipment.pauseStartDate || null) : null
  };

  // Update maintenance fields
  if (latestManto) {
    updatePayload.lastMaintenance = latestManto.date;
    if (equipment.maintenanceFrequency) {
      const nextManto = calculateNextMaintenance(latestManto.date, Number(equipment.maintenanceFrequency));
      updatePayload.nextMaintenance = nextManto;
      
      const currentYear = new Date().getFullYear();
      updatePayload.scheduledMaintenanceMonths = projectScheduleMonths(
        nextManto,
        equipment.maintenanceFrequency,
        currentYear
      );
    }
  }

  // Update calibration fields
  if (latestCalib) {
    const calibDate = latestCalib.calibrationDate || latestCalib.date;
    const nextCalib = latestCalib.nextCalibrationDate || (latestCalib as any).nextCalibration;
    
    updatePayload.lastCalibration = calibDate;
    updatePayload.nextCalibration = nextCalib;
    
    if (nextCalib && equipment.calibrationFrequency) {
      const currentYear = new Date().getFullYear();
      updatePayload.scheduledCalibrationMonths = projectScheduleMonths(
        nextCalib,
        equipment.calibrationFrequency,
        currentYear
      );
    }
  }

  // Only update if there are changes to apply
  if (Object.keys(updatePayload).length > 1) {
    await updateDoc(doc(db, 'equipment', equipment.id), updatePayload);
  }
};
