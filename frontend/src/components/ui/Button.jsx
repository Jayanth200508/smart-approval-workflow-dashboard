const Button = ({
  variant = "primary",
  className = "",
  children,
  ...props
}) => (
  <button className={`btn btn-${variant} ${className}`.trim()} {...props}>
    {children}
  </button>
);

export default Button;
