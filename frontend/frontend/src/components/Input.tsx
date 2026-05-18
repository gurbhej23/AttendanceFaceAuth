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
  className
}: InputProps) {
  return (
    <input
      type={type}
      value={value}
      max={max}
      className = {className}
      onChange={onChange}
      placeholder={placeholder} 
    />
  );
}
