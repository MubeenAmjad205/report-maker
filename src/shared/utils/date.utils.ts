export const getTodayDateString = (): string => {
  const date = new Date();
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
};

export const getSinceISOString = (): string => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date.toISOString();
};
