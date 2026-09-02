import React from 'react'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger'
  size?: 'sm' | 'md' | 'lg'
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  ...props
}) => {
  return (
    <button
      className={`btn btn-${variant} btn-${size}`}
      {...props}
    >
      {children}
    </button>
  )
}
