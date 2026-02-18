import api from "@forge/api";
import Resolver from "@forge/resolver";
import jwt from "jsonwebtoken";

const resolver = new Resolver();

/* ===========================================================================
   Salesforce / Account Engagement (Pardot) Authentication
   Using JWT Bearer Flow (Client ID + Username + Private Key)
=========================================================================== */

// ---------------------------------------------------------------------------
// JWT Credentials from Forge Environment Variables
//
// forge variables set SALESFORCE_CLIENT_ID <consumer_key> --encrypt
// forge variables set SALESFORCE_USERNAME user@company.com --encrypt
// forge variables set SALESFORCE_JWT_PRIVATE_KEY "$(cat server.key)" --encrypt
// ---------------------------------------------------------------------------
function getJwtCredentials() {
  const clientId = process.env.SALESFORCE_CLIENT_ID;
  const username = process.env.SALESFORCE_USERNAME;
  const privateKey = process.env.SALESFORCE_JWT_PRIVATE_KEY;

  const missing = [];

  if (!clientId) missing.push("SALESFORCE_CLIENT_ID");
  if (!username) missing.push("SALESFORCE_USERNAME");
  if (!privateKey) missing.push("SALESFORCE_JWT_PRIVATE_KEY");

  if (missing.length > 0) {
    throw new Error(
      `Missing required Forge variables: ${missing.join(", ")}`
    );
  }

  return { clientId, username, privateKey };
}

function getBusinessUnitId() {
  return process.env.SALESFORCE_BUSINESS_UNIT_ID || null;
}

// ---------------------------------------------------------------------------
// Token Cache
// ---------------------------------------------------------------------------
let tokenCache = null;
let tokenPromise = null;

// ---------------------------------------------------------------------------
// Salesforce Login URL
// ---------------------------------------------------------------------------
function getLoginUrl() {
  return process.env.SALESFORCE_LOGIN_URL || "https://login.salesforce.com";
}

// ---------------------------------------------------------------------------
// Pardot Base URL
// ---------------------------------------------------------------------------
function getPardotBaseUrl() {
  return process.env.PARDOT_API_URL || "https://pi.pardot.com";
}

// ---------------------------------------------------------------------------
// JWT Authentication
// ---------------------------------------------------------------------------
async function authenticateWithJwt() {
  const { clientId, username, privateKey } = getJwtCredentials();
  const loginUrl = getLoginUrl();

  const tokenEndpoint = `${loginUrl}/services/oauth2/token`;

  const payload = {
    iss: clientId,
    sub: username,
    aud: loginUrl,
    exp: Math.floor(Date.now() / 1000) + 180,
  };

  const jwtToken = jwt.sign(payload, privateKey, {
    algorithm: "RS256",
  });

  const params = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion: jwtToken,
  });

  console.log(`Authenticating with Salesforce (JWT) as ${username}`);

  const response = await api.fetch(tokenEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const err = await response.text();
    console.error(`JWT Auth Failed (${response.status}): ${err}`);
    throw new Error(err);
  }

  const auth = await response.json();

  return {
    access_token: auth.access_token,
    instance_url: auth.instance_url,
  };
}

// ---------------------------------------------------------------------------
// Login Resolver
// ---------------------------------------------------------------------------
resolver.define("loginToSalesforce", async () => {
  try {
    const auth = await authenticateWithJwt();

    tokenCache = {
      access_token: auth.access_token,
      instance_url: auth.instance_url,
      expiresAt: Date.now() + 55 * 60 * 1000,
    };

    console.log("Salesforce connected:", auth.instance_url);

    return {
      connected: true,
      instance_url: auth.instance_url,
    };

  } catch (error) {
    console.error("loginToSalesforce error:", error);

    return {
      error: true,
      message: error.message,
    };
  }
});

// ---------------------------------------------------------------------------
// Connection Check
// ---------------------------------------------------------------------------
resolver.define("checkSalesforceConnection", async () => {
  try {
    const hasCredentials =
      !!process.env.SALESFORCE_USERNAME &&
      !!process.env.SALESFORCE_CLIENT_ID &&
      !!process.env.SALESFORCE_JWT_PRIVATE_KEY;

    return {
      connected: hasCredentials,
      instance_url: tokenCache ? tokenCache.instance_url : null,
    };

  } catch (error) {
    return { connected: false };
  }
});

// ---------------------------------------------------------------------------
// Disconnect
// ---------------------------------------------------------------------------
resolver.define("disconnectSalesforce", async () => {
  tokenCache = null;
  return { disconnected: true };
});

// ---------------------------------------------------------------------------
// Get Valid Token
// ---------------------------------------------------------------------------
async function getSalesforceAccessToken() {

  if (tokenCache && Date.now() < tokenCache.expiresAt) {
    return {
      access_token: tokenCache.access_token,
      instance_url: tokenCache.instance_url,
    };
  }

  if (tokenPromise) {
    return tokenPromise;
  }

  tokenPromise = reauthenticate();

  try {
    return await tokenPromise;
  } finally {
    tokenPromise = null;
  }
}

// ---------------------------------------------------------------------------
// Re-authenticate
// ---------------------------------------------------------------------------
async function reauthenticate(retries = 2) {
  try {

    const auth = await authenticateWithJwt();

    tokenCache = {
      access_token: auth.access_token,
      instance_url: auth.instance_url,
      expiresAt: Date.now() + 55 * 60 * 1000,
    };

    return auth;

  } catch (error) {

    if (retries > 0) {
      console.warn(`JWT auth retrying (${retries})...`);
      await new Promise((r) => setTimeout(r, 1000));
      return reauthenticate(retries - 1);
    }

    tokenCache = null;
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Build Headers
// ---------------------------------------------------------------------------
async function buildSalesforceHeaders(includePardotBuid = false) {

  const auth = await getSalesforceAccessToken();

  const headers = {
    Authorization: `Bearer ${auth.access_token}`,
    "Content-Type": "application/json",
  };

  if (includePardotBuid) {
    const buid = getBusinessUnitId();
    if (buid) {
      headers["Pardot-Business-Unit-Id"] = buid;
    }
  }

  return {
    headers,
    instance_url: auth.instance_url,
  };
}

// ---------------------------------------------------------------------------
// Execute SOQL
// ---------------------------------------------------------------------------
async function executeSalesforceQuery(soql) {

  const { headers, instance_url } = await buildSalesforceHeaders();

  const url =
    `${instance_url}/services/data/v60.0/query?q=${encodeURIComponent(soql)}`;

  const resp = await api.fetch(url, {
    method: "GET",
    headers,
  });

  if (!resp.ok) {

    const text = await resp.text();

    if (resp.status === 401) {

      tokenCache = null;

      const retry = await buildSalesforceHeaders();

      const retryResp = await api.fetch(
        `${retry.instance_url}/services/data/v60.0/query?q=${encodeURIComponent(soql)}`,
        {
          method: "GET",
          headers: retry.headers,
        }
      );

      if (!retryResp.ok) {
        throw new Error(await retryResp.text());
      }

      return retryResp.json();
    }

    throw new Error(text);
  }

  return resp.json();
}

// ---------------------------------------------------------------------------
// Pardot Requests
// ---------------------------------------------------------------------------
async function executePardotRequest(path, method = "GET", body = null) {

  const { headers } = await buildSalesforceHeaders(true);

  const url = `${getPardotBaseUrl()}${path}`;

  const options = { method, headers };

  if (body && method !== "GET") {
    options.headers["Content-Type"] =
      "application/x-www-form-urlencoded";
    options.body = body;
  }

  const resp = await api.fetch(url, options);

  if (!resp.ok) {

    if (resp.status === 401) {

      tokenCache = null;

      const retry = await buildSalesforceHeaders(true);

      const retryOptions = {
        method,
        headers: retry.headers,
      };

      if (body && method !== "GET") {
        retryOptions.headers["Content-Type"] =
          "application/x-www-form-urlencoded";
        retryOptions.body = body;
      }

      const retryResp = await api.fetch(url, retryOptions);

      if (!retryResp.ok) {
        throw new Error(await retryResp.text());
      }

      return retryResp.json();
    }

    throw new Error(await resp.text());
  }

  return resp.json();
}

// ---------------------------------------------------------------------------
// Object Config
// ---------------------------------------------------------------------------
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
    filterFields: [
      { field: "StageName", label: "Stage", type: "picklist" },
    ],
  },
};

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------
resolver.define("getObjectMetadata", async () => {
  return OBJECT_CONFIG;
});

// ---------------------------------------------------------------------------
// Picklists
// ---------------------------------------------------------------------------
resolver.define("getPicklistValues", async ({ payload }) => {

  try {

    const { objectType, fieldName } = payload;

    const { headers, instance_url } =
      await buildSalesforceHeaders();

    const url =
      `${instance_url}/services/data/v60.0/sobjects/${objectType}/describe`;

    const resp = await api.fetch(url, {
      method: "GET",
      headers,
    });

    if (!resp.ok) {
      throw new Error(await resp.text());
    }

    const describe = await resp.json();

    const field =
      describe.fields.find((f) => f.name === fieldName);

    if (!field || !field.picklistValues) return [];

    return field.picklistValues
      .filter((p) => p.active)
      .map((p) => ({
        label: p.label,
        value: p.value,
      }));

  } catch (error) {

    return {
      error: true,
      message: error.message,
    };
  }
});

// ---------------------------------------------------------------------------
// Query
// ---------------------------------------------------------------------------
resolver.define("querySalesforce", async ({ payload }) => {

  try {

    const {
      objectType,
      search = "",
      filters = {},
      limit = 50,
      offset = 0,
    } = payload;

    const config = OBJECT_CONFIG[objectType];

    if (!config) {
      throw new Error(`Unsupported object: ${objectType}`);
    }

    const where = [];

    if (search) {
      where.push(
        `${config.searchField} LIKE '%${search.replace(/'/g, "\\'")}%'`
      );
    }

    for (const [field, value] of Object.entries(filters)) {
      if (value) {
        where.push(
          `${field} = '${String(value).replace(/'/g, "\\'")}'`
        );
      }
    }

    let soql =
      `SELECT ${config.fields.join(", ")} FROM ${objectType}`;

    if (where.length) {
      soql += " WHERE " + where.join(" AND ");
    }

    soql +=
      ` ORDER BY ${config.searchField} ASC LIMIT ${limit} OFFSET ${offset}`;

    const data = await executeSalesforceQuery(soql);

    return {
      records: data.records || [],
      totalSize: data.totalSize || 0,
    };

  } catch (error) {

    return {
      error: true,
      message: error.message,
    };
  }
});

// ---------------------------------------------------------------------------

export const handler = resolver.getDefinitions();
