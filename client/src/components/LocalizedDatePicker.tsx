import DatePicker, { registerLocale } from "react-datepicker";
import { format, parseISO } from "date-fns";
import { uk } from "date-fns/locale/uk";
import "react-datepicker/dist/react-datepicker.css";

registerLocale("uk", uk);

type LocalizedDatePickerProps = {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  min?: string;
  max?: string;
  placeholder?: string;
  disabled?: boolean;
};

const toDate = (value?: string) => {
  if (!value) return null;
  return parseISO(value);
};

export function LocalizedDatePicker({
  value,
  onChange,
  className,
  min,
  max,
  placeholder,
  disabled,
}: LocalizedDatePickerProps) {
  return (
    <DatePicker
      selected={toDate(value)}
      onChange={(date: Date | null) => onChange(date ? format(date, "yyyy-MM-dd") : "")}
      minDate={toDate(min) ?? undefined}
      maxDate={toDate(max) ?? undefined}
      locale="uk"
      dateFormat="dd.MM.yyyy"
      placeholderText={placeholder ?? "дд.мм.рррр"}
      className={className}
      wrapperClassName="w-full localized-datepicker-wrapper"
      popperClassName="localized-datepicker-popper"
      calendarClassName="localized-datepicker-calendar"
      disabled={disabled}
      isClearable={false}
      calendarStartDay={1}
    />
  );
}
