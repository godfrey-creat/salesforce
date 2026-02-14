const COLORS = {
  primary: "#0052CC",
  primaryHover: "#0065FF",
  background: "#FAFBFC",
  surface: "#FFFFFF",
  text: "#172B4D",
  textSubtle: "#6B778C",
  border: "#DFE1E6",
  borderFocus: "#4C9AFF",
  error: "#DE350B",
  activeTab: "#0052CC",
  hoverRow: "#F4F5F7",
};

const layout = {
  shell: {
    display: "flex",
    flexDirection: "column",
    height: "100vh",
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif",
    color: COLORS.text,
    backgroundColor: COLORS.background,
  },
  header: {
    padding: "16px 24px",
    backgroundColor: COLORS.surface,
    borderBottom: "1px solid " + COLORS.border,
    fontSize: 20,
    fontWeight: 600,
  },
  tabBar: {
    display: "flex",
    gap: 0,
    backgroundColor: COLORS.surface,
    borderBottom: "2px solid " + COLORS.border,
    paddingLeft: 24,
  },
  tab: {
    padding: "12px 20px",
    cursor: "pointer",
    border: "none",
    background: "none",
    fontSize: 14,
    fontWeight: 500,
    color: COLORS.textSubtle,
    borderBottom: "2px solid transparent",
    marginBottom: -2,
    transition: "color 0.15s, border-color 0.15s",
  },
  tabActive: {
    color: COLORS.activeTab,
    borderBottomColor: COLORS.activeTab,
  },
  contentArea: {
    flex: 1,
    padding: 24,
    overflowY: "auto",
  },
};

const filterBar = {
  container: {
    display: "flex",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 20,
    alignItems: "flex-end",
  },
  inputGroup: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  label: {
    fontSize: 12,
    fontWeight: 600,
    color: COLORS.textSubtle,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  input: {
    padding: "8px 12px",
    borderRadius: 3,
    border: "1px solid " + COLORS.border,
    fontSize: 14,
    minWidth: 200,
    outline: "none",
  },
  select: {
    padding: "8px 12px",
    borderRadius: 3,
    border: "1px solid " + COLORS.border,
    fontSize: 14,
    minWidth: 160,
    outline: "none",
    backgroundColor: COLORS.surface,
  },
  searchButton: {
    padding: "8px 16px",
    borderRadius: 3,
    border: "none",
    backgroundColor: COLORS.primary,
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: 500,
    cursor: "pointer",
  },
  clearButton: {
    padding: "8px 16px",
    borderRadius: 3,
    border: "1px solid " + COLORS.border,
    backgroundColor: COLORS.surface,
    color: COLORS.text,
    fontSize: 14,
    cursor: "pointer",
  },
};

const table = {
  wrapper: {
    backgroundColor: COLORS.surface,
    borderRadius: 3,
    border: "1px solid " + COLORS.border,
    overflow: "hidden",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: 14,
  },
  th: {
    textAlign: "left",
    padding: "10px 16px",
    backgroundColor: "#F4F5F7",
    borderBottom: "2px solid " + COLORS.border,
    fontSize: 12,
    fontWeight: 600,
    color: COLORS.textSubtle,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  td: {
    padding: "10px 16px",
    borderBottom: "1px solid " + COLORS.border,
    color: COLORS.text,
  },
  emptyRow: {
    padding: "40px 16px",
    textAlign: "center",
    color: COLORS.textSubtle,
  },
};

const pagination = {
  container: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "12px 0",
  },
  info: {
    fontSize: 13,
    color: COLORS.textSubtle,
  },
  buttons: {
    display: "flex",
    gap: 8,
  },
  button: {
    padding: "6px 12px",
    borderRadius: 3,
    border: "1px solid " + COLORS.border,
    backgroundColor: COLORS.surface,
    cursor: "pointer",
    fontSize: 13,
  },
  buttonDisabled: {
    opacity: 0.5,
    cursor: "not-allowed",
  },
};

export { COLORS, layout, filterBar, table, pagination };
