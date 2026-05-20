interface InputProps {
  type?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  max?: string;
  className?: string 
  min?: string;
}

export default function Input({
  type,
  value,
  onChange,
  placeholder,
  max,
  min,
  className
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
    />
  );
}
