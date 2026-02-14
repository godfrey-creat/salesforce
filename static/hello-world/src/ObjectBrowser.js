import React, { useState, useEffect } from "react";
import { invoke } from "@forge/bridge";
import FilterBar from "./FilterBar";
import ResultsTable from "./ResultsTable";

var PAGE_SIZE = 50;

var ObjectBrowser = function (props) {
  var objectType = props.objectType;
  var metadata = props.metadata;

  var stateRecords = useState([]);
  var records = stateRecords[0];
  var setRecords = stateRecords[1];

  var stateTotalSize = useState(0);
  var totalSize = stateTotalSize[0];
  var setTotalSize = stateTotalSize[1];

  var statePage = useState(0);
  var page = statePage[0];
  var setPage = statePage[1];

  var stateLoading = useState(false);
  var loading = stateLoading[0];
  var setLoading = stateLoading[1];

  var stateError = useState(null);
  var error = stateError[0];
  var setError = stateError[1];

  var stateSearch = useState("");
  var currentSearch = stateSearch[0];
  var setCurrentSearch = stateSearch[1];

  var stateFilters = useState({});
  var currentFilters = stateFilters[0];
  var setCurrentFilters = stateFilters[1];

  var fetchRecords = function (search, filters, pageNum) {
    setLoading(true);
    setError(null);

    invoke("querySalesforce", {
      objectType: objectType,
      search: search,
      filters: filters,
      limit: PAGE_SIZE,
      offset: pageNum * PAGE_SIZE,
    })
      .then(function (result) {
        if (result && result.error) {
          throw new Error(result.message);
        }
        setRecords(result.records || []);
        setTotalSize(result.totalSize || 0);
        setLoading(false);
      })
      .catch(function (e) {
        console.error("Query error:", e);
        setError("Failed to load records: " + e.message);
        setRecords([]);
        setTotalSize(0);
        setLoading(false);
      });
  };

  // Load initial data on mount
  useEffect(function () {
    fetchRecords("", {}, 0);
  }, []);

  var handleApply = function (params) {
    setCurrentSearch(params.search);
    setCurrentFilters(params.filters);
    setPage(0);
    fetchRecords(params.search, params.filters, 0);
  };

  var handleClear = function () {
    setCurrentSearch("");
    setCurrentFilters({});
    setPage(0);
    fetchRecords("", {}, 0);
  };

  var handlePageChange = function (newPage) {
    setPage(newPage);
    fetchRecords(currentSearch, currentFilters, newPage);
  };

  return (
    <div>
      <FilterBar
        objectType={objectType}
        filterFields={metadata.filterFields}
        onApply={handleApply}
        onClear={handleClear}
      />

      {error && (
        <div style={{ color: "#DE350B", marginBottom: 12, fontSize: 14 }}>
          {error}
        </div>
      )}

      <ResultsTable
        columns={metadata.columns}
        fields={metadata.fields}
        records={records}
        totalSize={totalSize}
        page={page}
        pageSize={PAGE_SIZE}
        onPageChange={handlePageChange}
        loading={loading}
      />
    </div>
  );
};

export default ObjectBrowser;
