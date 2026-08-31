import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import 'dayjs/locale/fr';

dayjs.extend(utc);
dayjs.extend(timezone);

dayjs.locale('fr');
dayjs.tz.setDefault('Indian/Antananarivo');

export default dayjs;
