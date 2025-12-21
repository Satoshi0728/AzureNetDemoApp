export const ToolPage = ({ title, description, eyebrow = "Utilities", actions, children }) => (
  <section className="section tool-page section-panel">
    <div className="container tool-container">
      <header className="tool-heading">
        {eyebrow ? <span className="label">{eyebrow}</span> : null}
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
        {actions ? <div className="tool-actions">{actions}</div> : null}
      </header>
      <div className="tool-content">{children}</div>
    </div>
  </section>
);
