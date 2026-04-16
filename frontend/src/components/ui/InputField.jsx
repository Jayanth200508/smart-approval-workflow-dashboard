const InputField = ({ label, error, children }) => (
  <label className="ui-field">
    <span>{label}</span>
    {children}
    {error ? <small className="field-error">{error}</small> : null}
  </label>
);

export default InputField;
