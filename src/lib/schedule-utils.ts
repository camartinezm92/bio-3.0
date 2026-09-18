
export const projectScheduleMonths = (
  baseDateStr: string | undefined, 
  freq: number | undefined, 
  targetYear: number
): number[] => {
  const targetArray: number[] = [];
  if (!baseDateStr) return targetArray;

  // Add artificial time to prevent UTC date shift on initialization
  const baseDate = new Date(`${baseDateStr}T12:00:00Z`);

  if (isNaN(baseDate.getTime())) return targetArray;

  let currentMonth = baseDate.getMonth();
  let currentYear = baseDate.getFullYear();

  if (!freq || freq <= 0) {
    if (currentYear === targetYear) {
      targetArray.push(currentMonth);
    }
    return targetArray;
  }

  // Limit the forward projection to prevent infinite loops
  let loopSafety = 0;
  while (currentYear <= targetYear && loopSafety < 100) {
    loopSafety++;
    if (currentYear === targetYear && !targetArray.includes(currentMonth)) {
      targetArray.push(currentMonth);
    }
    currentMonth += freq;
    while (currentMonth >= 12) {
      currentMonth -= 12;
      currentYear += 1;
    }
  }

  return targetArray.sort((a, b) => a - b);
};

export const calculateNextMaintenance = (lastDateStr: string, frequencyMonths: number): string => {
  if (!lastDateStr || !frequencyMonths) return lastDateStr;
  
  // Use T12:00:00Z to avoid date shifts due to timezone
  const date = new Date(`${lastDateStr}T12:00:00Z`);
  if (isNaN(date.getTime())) return lastDateStr;
  
  date.setMonth(date.getMonth() + frequencyMonths);
  return date.toISOString().split('T')[0];
};

export const isMoreRecent = (newDateStr: string, currentDateStr?: string): boolean => {
  if (!currentDateStr) return true;
  const newDate = new Date(`${newDateStr}T12:00:00Z`);
  const currentDate = new Date(`${currentDateStr}T12:00:00Z`);
  return newDate >= currentDate;
};
