import React, { useState, useEffect } from "react";
import { invoke } from "@forge/bridge";
import SalesforceAccountField from "./SalesforceAccountField";
import ObjectBrowser from "./ObjectBrowser";
import { layout } from "./styles";

const OBJECT_TYPES = ["Account", "Contact", "Opportunity", "Lead", "Case"];

const TAB_LABELS = {
  Account: "Accounts",
  Contact: "Contacts",
  Opportunity: "Opportunities",
  Lead: "Leads",
  Case: "Cases",
};

const App = ({ context }) => {
  const [activeTab, setActiveTab] = useState("Account");
  const [metadata, setMetadata] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Detect if this is running as a custom field
  const isCustomField =
    context &&
    (context.mode !== undefined ||
      (context.extension && context.extension.fieldType));

  // If custom field, render the legacy component
  if (isCustomField) {
    return (
      <SalesforceAccountField
        value={context.value}
        mode={context.mode}
        onChange={context.onChange}
      />
    );
  }

  // Global Page: load metadata for all objects on mount
  useEffect(() => {
    let cancelled = false;

    async function fetchMetadata() {
      try {
        const result = await invoke("getObjectMetadata", {});
        if (result && result.error) {
          throw new Error(result.message);
        }
        if (!cancelled) {
          setMetadata(result);
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
  }, []);

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

  return (
    <div style={layout.shell}>
      <div style={layout.header}>Salesforce Data Browser</div>

      <div style={layout.tabBar}>
        {OBJECT_TYPES.map((objType) => (
          <button
            key={objType}
            style={Object.assign(
              {},
              layout.tab,
              activeTab === objType ? layout.tabActive : {}
            )}
            onClick={() => setActiveTab(objType)}
          >
            {TAB_LABELS[objType]}
          </button>
        ))}
      </div>

      <div style={layout.contentArea}>
        {metadata && metadata[activeTab] && (
          <ObjectBrowser
            key={activeTab}
            objectType={activeTab}
            metadata={metadata[activeTab]}
          />
        )}
      </div>
    </div>
  );
};

export default App;
