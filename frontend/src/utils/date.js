import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import 'dayjs/locale/fr';

dayjs.extend(utc);
dayjs.extend(timezone);

dayjs.locale('fr');
dayjs.tz.setDefault('Indian/Antananarivo');

export const yearOptions = (() => {
  const currentYear = new Date().getFullYear();
  return Array.from({ length: currentYear - 2023 }, (_, i) => String(currentYear - i));
})();

export default dayjs;
