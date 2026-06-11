import type React from "react";

interface ButtonProps {
    text: React.ReactNode;
    onClick?: () => void;
    className?: string;
    type?: "button" | "submit";
    disabled?: boolean;
    title?: string;
}

export default function Button({
    text,
    onClick,
    className = " ",
    type = "button",
    disabled = false,
    title = "",
}: ButtonProps) {
    return(
        <button 
            type={type}
            onClick={onClick}
            disabled={disabled}
            title={title}
            className={`cursor-pointer rounded-2xl font-semibold transition duration-200 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
        >
            {text}
        </button>
    )
}