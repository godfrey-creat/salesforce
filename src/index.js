import api from "@forge/api";
import Resolver from "@forge/resolver";

const resolver = new Resolver();

/**
 * Get Salesforce OAuth Access Token using the Refresh Token Flow.
 * Caches the token to avoid concurrent refresh requests that trigger rate-limiting.
 *
 * Setup via Forge CLI:
 * forge variables set SALESFORCE_CLIENT_ID <your_consumer_key> --encrypt
 * forge variables set SALESFORCE_CLIENT_SECRET <your_consumer_secret> --encrypt
 * forge variables set SALESFORCE_REFRESH_TOKEN <your_token> --encrypt
 */
let tokenCache = null;   // { access_token, instance_url, expiresAt }
let tokenPromise = null;  // in-flight refresh promise (deduplicates concurrent calls)

async function getSalesforceAccessToken() {
  // Return cached token if still valid (with 60s safety margin)
  if (tokenCache && Date.now() < tokenCache.expiresAt) {
    return { access_token: tokenCache.access_token, instance_url: tokenCache.instance_url };
  }

  // If a refresh is already in-flight, wait for it instead of making a duplicate request
  if (tokenPromise) {
    return tokenPromise;
  }

  tokenPromise = refreshAccessToken();
  try {
    const result = await tokenPromise;
    return result;
  } finally {
    tokenPromise = null;
  }
}

async function refreshAccessToken(retries = 2) {
  const loginUrl = process.env.SALESFORCE_LOGIN_URL || "https://login.salesforce.com";
  const tokenEndpoint = `${loginUrl}/services/oauth2/token`;

  const params = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: process.env.SALESFORCE_CLIENT_ID,
    client_secret: process.env.SALESFORCE_CLIENT_SECRET,
    refresh_token: process.env.SALESFORCE_REFRESH_TOKEN,
  });

  console.log(`Refreshing Salesforce token at ${tokenEndpoint}`);

  const response = await api.fetch(tokenEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const err = await response.text();

    // Retry on transient "unknown_error" / "retry your request" from Salesforce
    if (retries > 0 && response.status === 400 && err.includes("retry your request")) {
      console.warn(`Transient Salesforce auth error, retrying (${retries} left)...`);
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return refreshAccessToken(retries - 1);
    }

    console.error(`Salesforce Auth Failed (HTTP ${response.status}): ${err}`);
    throw new Error(`Salesforce Auth Failed: ${err}`);
  }

  const auth = await response.json();

  // Cache token for 55 minutes (Salesforce tokens typically expire in 1-2 hours)
  tokenCache = {
    access_token: auth.access_token,
    instance_url: auth.instance_url,
    expiresAt: Date.now() + 55 * 60 * 1000,
  };

  return {
    access_token: auth.access_token,
    instance_url: auth.instance_url
  };
}

/**
 * Shared Helper: Executes a SOQL query using the refreshed token
 */
async function executeSalesforceQuery(soql) {
  const auth = await getSalesforceAccessToken();
  const url = `${auth.instance_url}/services/data/v60.0/query?q=${encodeURIComponent(soql)}`;

  const resp = await api.fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${auth.access_token}`,
      "Content-Type": "application/json",
    },
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Salesforce Query Failed (${resp.status}): ${text}`);
  }

  return await resp.json();
}

// ---------------------------------------------------------------------------
// Main Logic & Resolvers
// ---------------------------------------------------------------------------

resolver.define("searchSalesforceAccounts", async ({ payload }) => {
  try {
    const query = payload.query || "";
    const escapedQuery = query.replace(/'/g, "\\'");

    let soql = `SELECT Id, Name FROM Account WHERE Status__c = 'Former Customer'`;
    if (query) {
      soql += ` AND Name LIKE '%${escapedQuery}%'`;
    }
    soql += ` ORDER BY Name LIMIT 20`;

    const data = await executeSalesforceQuery(soql);

    return (data.records || []).map((r) => ({
      id: r.Id,
      name: r.Name,
    }));
  } catch (error) {
    console.error("Salesforce Error:", error);
    return { error: true, message: error.message };
  }
});

const OBJECT_CONFIG = {
  Account: {
    fields: ["Id", "Name", "Industry", "Type", "Phone"],
    columns: ["Name", "Industry", "Type", "Phone"],
    searchField: "Name",
    filterFields: [
      { field: "Industry", label: "Industry", type: "picklist" },
      { field: "Type", label: "Type", type: "picklist" },
    ],
  },
  Contact: {
    fields: ["Id", "FirstName", "LastName", "Email", "Phone", "Account.Name"],
    columns: ["First Name", "Last Name", "Email", "Phone", "Account"],
    searchField: "LastName",
    filterFields: [],
  },
  Opportunity: {
    fields: ["Id", "Name", "StageName", "Amount", "CloseDate", "Account.Name"],
    columns: ["Name", "Stage", "Amount", "Close Date", "Account"],
    searchField: "Name",
    filterFields: [{ field: "StageName", label: "Stage", type: "picklist" }],
  },
};

resolver.define("getObjectMetadata", async () => {
  return OBJECT_CONFIG;
});

resolver.define("getPicklistValues", async ({ payload }) => {
  try {
    const { objectType, fieldName } = payload;
    const auth = await getSalesforceAccessToken();
    const url = `${auth.instance_url}/services/data/v60.0/sobjects/${objectType}/describe`;

    const resp = await api.fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${auth.access_token}`,
        "Content-Type": "application/json",
      },
    });

    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Salesforce Describe Failed (${resp.status}): ${text}`);
    }

    const describe = await resp.json();
    const field = (describe.fields || []).find((f) => f.name === fieldName);

    if (!field || !field.picklistValues) {
      return [];
    }

    return field.picklistValues
      .filter((pv) => pv.active)
      .map((pv) => ({ label: pv.label, value: pv.value }));
  } catch (error) {
    console.error("Picklist fetch error:", error);
    return { error: true, message: error.message };
  }
});

resolver.define("querySalesforce", async ({ payload }) => {
  try {
    const { objectType, search = "", filters = {}, limit = 50, offset = 0 } = payload;
    const config = OBJECT_CONFIG[objectType];
    
    if (!config) throw new Error(`Unsupported object: ${objectType}`);

    const whereClauses = [];
    if (search) {
      whereClauses.push(`${config.searchField} LIKE '%${search.replace(/'/g, "\\'")}%'`);
    }

    for (const [field, value] of Object.entries(filters)) {
      if (value) whereClauses.push(`${field} = '${String(value).replace(/'/g, "\\'")}'`);
    }

    let soql = `SELECT ${config.fields.join(", ")} FROM ${objectType}`;
    if (whereClauses.length > 0) soql += " WHERE " + whereClauses.join(" AND ");
    soql += ` ORDER BY ${config.searchField} ASC LIMIT ${limit} OFFSET ${offset}`;

    const data = await executeSalesforceQuery(soql);
    return { records: data.records || [], totalSize: data.totalSize || 0 };
  } catch (error) {
    return { error: true, message: error.message };
  }
});

export const handler = resolver.getDefinitions();