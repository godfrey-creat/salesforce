import React from "react";
import { table as tableStyles, pagination as pagStyles } from "./styles";

var ResultsTable = function (props) {
  var columns = props.columns;
  var fields = props.fields;
  var records = props.records;
  var totalSize = props.totalSize;
  var page = props.page;
  var pageSize = props.pageSize;
  var onPageChange = props.onPageChange;
  var loading = props.loading;

  // Display fields are all fields except Id (index 0)
  var displayFields = fields.slice(1);

  /**
   * Extract a nested field value from a record.
   * Handles dotted paths like 'Account.Name'.
   */
  var getFieldValue = function (record, fieldPath) {
    var parts = fieldPath.split(".");
    var value = record;
    for (var i = 0; i < parts.length; i++) {
      if (value == null) return "";
      value = value[parts[i]];
    }
    if (value == null) return "";

    if (fieldPath === "Amount" && typeof value === "number") {
      return (
        "$" +
        value.toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })
      );
    }

    return String(value);
  };

  var totalPages = Math.ceil(totalSize / pageSize);
  var showing = records.length;
  var rangeStart = page * pageSize + 1;
  var rangeEnd = page * pageSize + showing;

  return (
    <div>
      <div style={tableStyles.wrapper}>
        <table style={tableStyles.table}>
          <thead>
            <tr>
              {columns.map(function (col, i) {
                return (
                  <th key={i} style={tableStyles.th}>
                    {col}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={columns.length} style={tableStyles.emptyRow}>
                  Loading records...
                </td>
              </tr>
            ) : records.length === 0 ? (
              <tr>
                <td colSpan={columns.length} style={tableStyles.emptyRow}>
                  No records found. Try adjusting your search or filters.
                </td>
              </tr>
            ) : (
              records.map(function (record) {
                return (
                  <tr key={record.Id}>
                    {displayFields.map(function (field, i) {
                      return (
                        <td key={i} style={tableStyles.td}>
                          {getFieldValue(record, field)}
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {totalSize > 0 && (
        <div style={pagStyles.container}>
          <span style={pagStyles.info}>
            Showing {rangeStart}-{rangeEnd} of {totalSize} records
          </span>
          <div style={pagStyles.buttons}>
            <button
              style={Object.assign(
                {},
                pagStyles.button,
                page === 0 ? pagStyles.buttonDisabled : {}
              )}
              disabled={page === 0}
              onClick={function () {
                onPageChange(page - 1);
              }}
            >
              Previous
            </button>
            <button
              style={Object.assign(
                {},
                pagStyles.button,
                page >= totalPages - 1 ? pagStyles.buttonDisabled : {}
              )}
              disabled={page >= totalPages - 1}
              onClick={function () {
                onPageChange(page + 1);
              }}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ResultsTable;
