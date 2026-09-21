const REPO_URL = "https://github.com/sarfrazahmedS/teambrain";

/** A small strip shown only in the static demo build (VITE_DEMO=1). */
export function DemoBanner() {
  return (
    <div className="demo-banner" role="note">
      <span className="demo-tag">DEMO</span>
      <span className="demo-text">
        In-memory mock backend — retrieval &amp; citations are real, answers are templated (no{" "}
        <code>ANTHROPIC_API_KEY</code>). Sign in with <code>demo@teambrain.dev</code> /{" "}
        <code>Passw0rd!</code>.
      </span>
      <a className="demo-link" href={REPO_URL} target="_blank" rel="noreferrer">
        Source&nbsp;on&nbsp;GitHub&nbsp;↗
      </a>
    </div>
  );
}
