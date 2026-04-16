const Card = ({ className = "", children }) => (
  <article className={`surface-card ${className}`.trim()}>{children}</article>
);

export default Card;
