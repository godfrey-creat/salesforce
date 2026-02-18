import { useState, useEffect, useCallback } from "react";
import { invoke } from "@forge/bridge";
import SalesforceAccountField from "./SalesforceAccountField";
import ObjectBrowser from "./ObjectBrowser";
import { COLORS, layout } from "./styles";

const TAB_LABELS = {
  Account: "Accounts",
  Contact: "Contacts",
  Opportunity: "Opportunities",
  Lead: "Leads",
  Case: "Cases",
};

// ---------------------------------------------------------------------------
// Inline styles
// ---------------------------------------------------------------------------
const connectStyles = {
  connectedBanner: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "8px 24px",
    backgroundColor: "#E3FCEF",
    borderBottom: "1px solid #ABF5D1",
    fontSize: 13,
  },
  disconnectButton: {
    padding: "4px 12px",
    borderRadius: 3,
    border: "1px solid #ABF5D1",
    backgroundColor: "transparent",
    color: "#006644",
    fontSize: 12,
    cursor: "pointer",
  },
  errorBox: {
    maxWidth: 440,
    margin: "60px auto",
    padding: 32,
    backgroundColor: COLORS.surface,
    border: "1px solid " + COLORS.border,
    borderRadius: 6,
    textAlign: "center",
  },
  errorText: {
    color: COLORS.error,
    fontSize: 13,
    marginBottom: 16,
  },
  retryButton: {
    padding: "8px 20px",
    borderRadius: 3,
    border: "none",
    backgroundColor: COLORS.primary,
    color: "#FFFFFF",
    fontSize: 14,
    cursor: "pointer",
  },
};

// ---------------------------------------------------------------------------
// Main App component
// ---------------------------------------------------------------------------
const App = ({ context }) => {
  const [connected, setConnected] = useState(null); // null = checking, true/false
  const [instanceUrl, setInstanceUrl] = useState(null);
  const [activeTab, setActiveTab] = useState(null);
  const [metadata, setMetadata] = useState(null);
  const [availableObjects, setAvailableObjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Detect if this is running as a custom field
  const isCustomField =
    context &&
    (context.mode !== undefined ||
      (context.extension && context.extension.fieldType));

  // If custom field, render the Salesforce field directly
  if (isCustomField) {
    return (
      <SalesforceAccountField
        value={context.value}
        mode={context.mode}
        onChange={context.onChange}
      />
    );
  }

  // -------------------------------------------------------------------------
  // Connection logic: check env vars, then authenticate
  // -------------------------------------------------------------------------
  const attemptConnection = useCallback(async () => {
    setConnected(null);
    setError(null);
    setLoading(true);
    setInstanceUrl(null);

    try {
      // 1) Check if credentials are configured in Forge env vars
      const check = await invoke("checkSalesforceConnection", {});

      if (!check || check.connected === false) {
        setConnected(false);
        setLoading(false);
        setError(
          "Salesforce credentials are not configured. " +
            "Set SALESFORCE_CLIENT_ID, SALESFORCE_USERNAME, " +
            "and SALESFORCE_JWT_PRIVATE_KEY via Forge environment variables, " +
            "then redeploy the app."
        );
        return;
      }

      // 2) Credentials exist – authenticate via JWT
      const result = await invoke("loginToSalesforce", {});

      if (result && result.error) {
        setConnected(false);
        setLoading(false);
        setError(result.message || "Failed to authenticate with Salesforce.");
        return;
      }

      setConnected(true);
      setInstanceUrl(result.instance_url || null);
      setLoading(true); // will be cleared after metadata loads
    } catch (e) {
      console.error("Auto-connect failed:", e);
      setConnected(false);
      setLoading(false);
      setError(e.message || "Failed to connect to Salesforce.");
    }
  }, []);

  // Auto-connect on mount using environment variable credentials
  useEffect(() => {
    attemptConnection();
  }, [attemptConnection]);

  // Once connected, load object metadata
  useEffect(() => {
    if (!connected) return;

    let cancelled = false;

    async function fetchMetadata() {
      try {
        const result = await invoke("getObjectMetadata", {});
        if (result && result.error) {
          throw new Error(result.message);
        }

        if (!cancelled) {
          setMetadata(result || {});
          const keys = Object.keys(result || {});

          // Align tabs with backend-supported objects
          setAvailableObjects(keys);
          if (!activeTab && keys.length > 0) {
            setActiveTab(keys[0]);
          }

          setLoading(false);
        }
      } catch (e) {
        console.error("Metadata fetch error:", e);
        if (!cancelled) {
          setError("Failed to load configuration. " + e.message);
          setLoading(false);
        }
      }
    }

    fetchMetadata();
    return () => {
      cancelled = true;
    };
  }, [connected, activeTab]);

  // Handle disconnect
  const handleDisconnect = async () => {
    try {
      await invoke("disconnectSalesforce", {});
      setConnected(false);
      setMetadata(null);
      setAvailableObjects([]);
      setActiveTab(null);
      setLoading(true);
      setError(null);
      setInstanceUrl(null);
    } catch (e) {
      console.error("Disconnect failed:", e);
    }
  };

  // -------------------------------------------------------------------------
  // Renders
  // -------------------------------------------------------------------------

  // Still checking connection status
  if (connected === null) {
    return (
      <div style={layout.shell}>
        <div style={layout.header}>Salesforce Data Browser</div>
        <div style={layout.contentArea}>
          <p>Checking Salesforce connection...</p>
        </div>
      </div>
    );
  }

  // Not connected: show error with retry
  if (!connected) {
    return (
      <div style={layout.shell}>
        <div style={layout.header}>Salesforce Data Browser</div>
        <div style={layout.contentArea}>
          <div style={connectStyles.errorBox}>
            <div style={connectStyles.errorText}>
              {error ||
                "Not connected to Salesforce. Ensure credentials are configured via Forge environment variables."}
            </div>
            <button
              style={connectStyles.retryButton}
              onClick={attemptConnection}
            >
              Retry Connection
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Connected but still loading metadata
  if (loading) {
    return (
      <div style={layout.shell}>
        <div style={layout.header}>Salesforce Data Browser</div>
        <div style={layout.contentArea}>
          <p>Loading configuration...</p>
        </div>
      </div>
    );
  }

  // Connected but metadata load failed
  if (error) {
    return (
      <div style={layout.shell}>
        <div style={layout.header}>Salesforce Data Browser</div>
        <div style={layout.contentArea}>
          <p style={{ color: "#DE350B" }}>{error}</p>
        </div>
      </div>
    );
  }

  // Connected and metadata loaded: show the data browser
  return (
    <div style={layout.shell}>
      <div style={layout.header}>Salesforce Data Browser</div>

      {/* Connection status banner */}
      <div style={connectStyles.connectedBanner}>
        <span>
          Connected to Salesforce
          {instanceUrl ? ` — ${instanceUrl}` : ""}
        </span>
        <button
          style={connectStyles.disconnectButton}
          onClick={handleDisconnect}
        >
          Disconnect
        </button>
      </div>

      {/* Tab bar based on backend metadata */}
      <div style={layout.tabBar}>
        {availableObjects.map((objType) => (
          <button
            key={objType}
            style={Object.assign(
              {},
              layout.tab,
              activeTab === objType ? layout.tabActive : {}
            )}
            onClick={() => setActiveTab(objType)}
          >
            {TAB_LABELS[objType] || objType}
          </button>
        ))}
      </div>

      <div style={layout.contentArea}>
        {metadata &&
          activeTab &&
          metadata[activeTab] && (
            <ObjectBrowser
              key={activeTab}
              objectType={activeTab}
              metadata={metadata[activeTab]}
            />
          )}

        {activeTab && !metadata[activeTab] && (
          <p>No configuration found for {activeTab}.</p>
        )}
      </div>
    </div>
  );
};

export default App;