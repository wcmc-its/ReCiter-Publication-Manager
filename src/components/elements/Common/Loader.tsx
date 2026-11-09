import Skeleton from "@mui/material/Skeleton";

// Default loading state: a skeleton of text rows instead of a spinner.
// ponytail: one generic shape for every caller; give a screen its own skeleton when the layout shift bothers someone.
const ROWS = ["40%", "90%", "75%", "85%", "60%"];

const Loader = () => {
  return (
    <div role="status" aria-busy="true" aria-live="polite" style={{ width: "100%", maxWidth: 720, margin: "0 auto", padding: "16px 0" }}>
      <span className="visually-hidden">Loading…</span>
      {ROWS.map((w, i) => (
        <Skeleton key={i} variant="text" animation="wave" width={w} height={i === 0 ? 32 : 20} sx={{ mb: 1 }} />
      ))}
    </div>
  );
};

export default Loader;
