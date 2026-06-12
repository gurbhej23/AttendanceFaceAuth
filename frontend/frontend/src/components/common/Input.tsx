interface InputProps {
  type?: string;
  value?: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  max?: string;
  className?: string 
  min?: string;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  accept?: string
}

export default function Input({
  type,
  value,
  onChange,
  placeholder,
  max,
  min,
  className,
  onKeyDown,
  accept
}: InputProps) {
  return (
    <input
      type={type}
      value={value}
      max={max}
      min={min}
      className = {className}
      onChange={onChange}
      placeholder={placeholder} 
      onKeyDown={onKeyDown}
      accept={accept}
    />
  );
}
