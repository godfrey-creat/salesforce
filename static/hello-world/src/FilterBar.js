import React, { useState, useEffect } from "react";
import { invoke } from "@forge/bridge";
import { filterBar as styles } from "./styles";

const FilterBar = ({ objectType, filterFields, onApply, onClear }) => {
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState({});
  const [picklistOptions, setPicklistOptions] = useState({});
  const [loadingPicklists, setLoadingPicklists] = useState(false);

  // Load picklist values for all filter fields on mount
  useEffect(() => {
    if (!filterFields || filterFields.length === 0) return;

    let cancelled = false;
    setLoadingPicklists(true);

    async function loadPicklists() {
      var results = {};

      for (var i = 0; i < filterFields.length; i++) {
        var ff = filterFields[i];
        if (ff.type === "picklist") {
          try {
            var values = await invoke("getPicklistValues", {
              objectType: objectType,
              fieldName: ff.field,
            });
            if (values && !values.error) {
              results[ff.field] = values;
            }
          } catch (e) {
            console.error("Failed to load picklist for " + ff.field + ":", e);
            results[ff.field] = [];
          }
        }
      }

      if (!cancelled) {
        setPicklistOptions(results);
        setLoadingPicklists(false);
      }
    }

    loadPicklists();
    return function () {
      cancelled = true;
    };
  }, [objectType, filterFields]);

  var handleApply = function () {
    onApply({ search: search, filters: filters });
  };

  var handleClear = function () {
    setSearch("");
    setFilters({});
    if (onClear) onClear();
  };

  var handleFilterChange = function (fieldName, value) {
    setFilters(function (prev) {
      var next = Object.assign({}, prev);
      next[fieldName] = value;
      return next;
    });
  };

  var handleKeyDown = function (e) {
    if (e.key === "Enter") {
      handleApply();
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.inputGroup}>
        <label style={styles.label}>Search</label>
        <input
          type="text"
          placeholder="Type to search..."
          value={search}
          onChange={function (e) {
            setSearch(e.target.value);
          }}
          onKeyDown={handleKeyDown}
          style={styles.input}
        />
      </div>

      {filterFields &&
        filterFields.map(function (ff) {
          return (
            <div key={ff.field} style={styles.inputGroup}>
              <label style={styles.label}>{ff.label}</label>
              <select
                value={filters[ff.field] || ""}
                onChange={function (e) {
                  handleFilterChange(ff.field, e.target.value);
                }}
                style={styles.select}
                disabled={loadingPicklists}
              >
                <option value="">
                  {loadingPicklists ? "Loading..." : "All " + ff.label}
                </option>
                {(picklistOptions[ff.field] || []).map(function (opt) {
                  return (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  );
                })}
              </select>
            </div>
          );
        })}

      <div style={Object.assign({}, styles.inputGroup, { justifyContent: "flex-end" })}>
        <label style={Object.assign({}, styles.label, { visibility: "hidden" })}>
          Actions
        </label>
        <div style={{ display: "flex", gap: 8 }}>
          <button style={styles.searchButton} onClick={handleApply}>
            Search
          </button>
          <button style={styles.clearButton} onClick={handleClear}>
            Clear
          </button>
        </div>
      </div>
    </div>
  );
};

export default FilterBar;
