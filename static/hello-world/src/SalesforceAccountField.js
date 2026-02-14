// src/frontend/SalesforceAccountField.jsx

import React, { useEffect, useState } from "react";
import { invoke } from "@forge/bridge";

const SalesforceAccountField = ({ value, onChange, mode }) => {
  const [search, setSearch] = useState("");
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (mode === "view") return;

    let cancelled = false;

    async function fetchAccounts() {
      setLoading(true);
      setError(null);

      try {
        const result = await invoke("searchSalesforceAccounts", {
          query: search,
        });

        // Backend error handling
        if (result?.error) {
          throw new Error(result.message);
        }

        if (!cancelled) {
          setOptions(result || []);
        }
      } catch (e) {
        console.error("Salesforce fetch error:", e);

        if (!cancelled) {
          setOptions([]);
          setError("Failed to load Salesforce accounts");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    // Debounce
    const timeout = setTimeout(fetchAccounts, 300);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [search, mode]);

  /**
   * View Mode
   */
  if (mode === "view") {
    if (!value) {
      return <span>-</span>;
    }

    return (
      <span>
        {value.name} ({value.id})
      </span>
    );
  }

  /**
   * Edit Mode
   */
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        minWidth: 220,
      }}
    >
      {/* Search */}
      <input
        type="text"
        placeholder="Search Former Customers..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{
          padding: 6,
          borderRadius: 4,
          border: "1px solid #ccc",
        }}
      />

      {/* Status */}
      {loading && <span>Loading accounts…</span>}

      {error && (
        <span style={{ color: "red", fontSize: 12 }}>
          {error}
        </span>
      )}

      {/* Dropdown */}
      <select
        disabled={loading}
        value={value?.id || ""}
        onChange={(e) => {
          const selected =
            options.find((o) => o.id === e.target.value) || null;

          if (selected) {
            onChange({
              id: selected.id,
              name: selected.name,
            });
          } else {
            onChange(null);
          }
        }}
        style={{
          padding: 6,
          borderRadius: 4,
        }}
      >
        <option value="">
          {loading
            ? "Loading..."
            : "Select a Salesforce account"}
        </option>

        {!loading && options.length === 0 && (
          <option disabled value="">
            No results found
          </option>
        )}

        {options.map((acc) => (
          <option key={acc.id} value={acc.id}>
            {acc.name}
          </option>
        ))}
      </select>
    </div>
  );
};

export default SalesforceAccountField;
